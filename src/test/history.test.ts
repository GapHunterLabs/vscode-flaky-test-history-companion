import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordRun, getFlakyTests, MAX_HISTORY_PER_TEST, type TestHistory } from '../history';
import type { TestResult } from '../junitParser';

test('recordRun appends outcomes for tests seen in the run', () => {
  const history = recordRun({}, [{ testId: 'a', outcome: 'pass' }]);
  assert.deepEqual(history, { a: ['pass'] });
  const history2 = recordRun(history, [{ testId: 'a', outcome: 'fail' }]);
  assert.deepEqual(history2, { a: ['pass', 'fail'] });
});

test('recordRun leaves tests not present in this run untouched', () => {
  const history: TestHistory = { a: ['pass'], b: ['fail'] };
  const next = recordRun(history, [{ testId: 'a', outcome: 'pass' }]);
  assert.deepEqual(next, { a: ['pass', 'pass'], b: ['fail'] });
});

test('recordRun does not mutate the input history object', () => {
  const history: TestHistory = { a: ['pass'] };
  recordRun(history, [{ testId: 'a', outcome: 'fail' }]);
  assert.deepEqual(history, { a: ['pass'] });
});

test('recordRun caps per-test history at MAX_HISTORY_PER_TEST, dropping the oldest', () => {
  let history: TestHistory = {};
  for (let i = 0; i < MAX_HISTORY_PER_TEST + 5; i++) {
    const outcome = i === 0 ? 'fail' : 'pass'; // mark the very first (oldest) run distinctly
    history = recordRun(history, [{ testId: 'a', outcome } as TestResult]);
  }
  assert.equal(history.a.length, MAX_HISTORY_PER_TEST);
  // the oldest run (the lone 'fail') should have been pushed out by the cap
  assert.ok(!history.a.includes('fail'), 'oldest run should have rolled off');
});

test('getFlakyTests flags a test with both pass and fail in history', () => {
  const flaky = getFlakyTests({ a: ['pass', 'fail', 'pass'] });
  assert.equal(flaky.length, 1);
  assert.equal(flaky[0].testId, 'a');
  assert.equal(flaky[0].passCount, 2);
  assert.equal(flaky[0].failCount, 1);
  assert.equal(flaky[0].totalRuns, 3);
  assert.equal(flaky[0].lastOutcome, 'pass');
});

test('getFlakyTests does not flag an always-passing test', () => {
  assert.deepEqual(getFlakyTests({ a: ['pass', 'pass', 'pass'] }), []);
});

test('getFlakyTests does not flag an always-failing test (that is "broken", not flaky)', () => {
  assert.deepEqual(getFlakyTests({ a: ['fail', 'fail'] }), []);
});

test('getFlakyTests sorts by fail count descending', () => {
  const flaky = getFlakyTests({
    low: ['pass', 'fail'],
    high: ['pass', 'fail', 'fail', 'fail'],
    mid: ['pass', 'fail', 'fail'],
  });
  assert.deepEqual(flaky.map((f) => f.testId), ['high', 'mid', 'low']);
});
