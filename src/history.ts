/** Pure logic -- no `vscode` dependency. Tracks per-test pass/fail
 * history across multiple JUnit report parses ("runs") and flags
 * tests whose history contains both outcomes as flaky. Kept separate
 * from persistence: extension.ts owns reading/writing this shape to
 * `context.workspaceState` -- this module only transforms it. */

import type { TestOutcome, TestResult } from './junitParser';

export type TestHistory = Record<string, TestOutcome[]>;

/** Cap per-test history so a long-lived workspace doesn't grow this
 * unboundedly in workspaceState -- only the most recent runs matter
 * for a "is this flaky right now" judgment. */
export const MAX_HISTORY_PER_TEST = 50;

/** Appends one run's results onto existing history. A test not seen
 * in this run is left untouched (its prior history stands). Returns a
 * new object; does not mutate `history`. */
export function recordRun(history: TestHistory, results: TestResult[]): TestHistory {
  const next: TestHistory = { ...history };
  for (const { testId, outcome } of results) {
    const prior = next[testId] ?? [];
    const updated = [...prior, outcome];
    next[testId] = updated.length > MAX_HISTORY_PER_TEST ? updated.slice(updated.length - MAX_HISTORY_PER_TEST) : updated;
  }
  return next;
}

export interface FlakyTest {
  testId: string;
  passCount: number;
  failCount: number;
  totalRuns: number;
  lastOutcome: TestOutcome;
}

/** A test is flaky iff its recorded history contains at least one
 * pass AND at least one fail -- a test that has only ever failed is
 * "broken", not flaky; a test that has only ever passed has no signal
 * either way. Sorted by fail count descending (most-flaky first). */
export function getFlakyTests(history: TestHistory): FlakyTest[] {
  const flaky: FlakyTest[] = [];
  for (const [testId, outcomes] of Object.entries(history)) {
    const passCount = outcomes.filter((o) => o === 'pass').length;
    const failCount = outcomes.filter((o) => o === 'fail').length;
    if (passCount > 0 && failCount > 0) {
      flaky.push({ testId, passCount, failCount, totalRuns: outcomes.length, lastOutcome: outcomes[outcomes.length - 1] });
    }
  }
  return flaky.sort((a, b) => b.failCount - a.failCount);
}
