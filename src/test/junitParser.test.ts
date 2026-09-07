import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJUnitXml } from '../junitParser';

test('parses a passing self-closing testcase', () => {
  const xml = `<testsuite><testcase classname="pkg.Foo" name="testBar" time="0.01"/></testsuite>`;
  const results = parseJUnitXml(xml);
  assert.deepEqual(results, [{ testId: 'pkg.Foo.testBar', outcome: 'pass' }]);
});

test('parses a failing testcase (failure child)', () => {
  const xml = `<testsuite><testcase classname="pkg.Foo" name="testBar" time="0.01"><failure message="boom">stack trace</failure></testcase></testsuite>`;
  const results = parseJUnitXml(xml);
  assert.deepEqual(results, [{ testId: 'pkg.Foo.testBar', outcome: 'fail' }]);
});

test('parses an errored testcase (error child) as fail', () => {
  const xml = `<testsuite><testcase classname="pkg.Foo" name="testBar"><error message="oops"/></testcase></testsuite>`;
  const results = parseJUnitXml(xml);
  assert.deepEqual(results, [{ testId: 'pkg.Foo.testBar', outcome: 'fail' }]);
});

test('excludes skipped testcases from results entirely', () => {
  const xml = `<testsuite><testcase classname="pkg.Foo" name="testBar"><skipped/></testcase></testsuite>`;
  assert.deepEqual(parseJUnitXml(xml), []);
});

test('a testcase with a body but no failure/error/skipped child passed (e.g. system-out)', () => {
  const xml = `<testsuite><testcase classname="pkg.Foo" name="testBar"><system-out>log output</system-out></testcase></testsuite>`;
  const results = parseJUnitXml(xml);
  assert.deepEqual(results, [{ testId: 'pkg.Foo.testBar', outcome: 'pass' }]);
});

test('uses bare name when classname attribute is absent', () => {
  const xml = `<testsuite><testcase name="standaloneTest"/></testsuite>`;
  const results = parseJUnitXml(xml);
  assert.deepEqual(results, [{ testId: 'standaloneTest', outcome: 'pass' }]);
});

test('parses a realistic multi-testsuite report with mixed outcomes', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="pkg.FooTest" tests="3" failures="1" errors="0" skipped="1">
    <testcase classname="pkg.FooTest" name="testA" time="0.002"/>
    <testcase classname="pkg.FooTest" name="testB" time="0.5">
      <failure message="expected true but got false">at pkg.FooTest.testB(FooTest.java:42)</failure>
    </testcase>
    <testcase classname="pkg.FooTest" name="testC" time="0">
      <skipped/>
    </testcase>
  </testsuite>
  <testsuite name="pkg.BarTest" tests="1" failures="0" errors="0" skipped="0">
    <testcase classname="pkg.BarTest" name="testD" time="0.01"/>
  </testsuite>
</testsuites>`;
  const results = parseJUnitXml(xml);
  assert.deepEqual(results, [
    { testId: 'pkg.FooTest.testA', outcome: 'pass' },
    { testId: 'pkg.FooTest.testB', outcome: 'fail' },
    { testId: 'pkg.BarTest.testD', outcome: 'pass' },
  ]);
});

test('returns an empty array for non-JUnit XML (no testcase elements)', () => {
  assert.deepEqual(parseJUnitXml('<html><body>not a report</body></html>'), []);
});
