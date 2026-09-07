/**
 * Pure logic -- no `vscode` dependency. New niche (not a port from
 * the Kotlin catalog). Evidence: no extension tracks persistent pass/
 * fail history for a test across multiple runs -- Playwright's own
 * "flaky" filter is scoped to a single HTML report from one run, not
 * a history across many. Honest limit acknowledged from the start
 * (documented in the original research): a local-only v0.1 is a
 * weaker signal than real CI log ingestion (BuildPulse/Datadog, both
 * paid SaaS with no editor extension) -- still real value for anyone
 * running the same suite repeatedly during local development.
 *
 * Hand-rolled regex parser for JUnit XML `<testcase>` elements -- the
 * most universal test-report format (emitted by pytest, jest-junit,
 * go test -junitfile, and most other runners), not a full XML parser.
 */

export type TestOutcome = 'pass' | 'fail' | 'skipped';

export interface TestResult {
  testId: string; // "classname.name", or just "name" when there's no classname
  outcome: TestOutcome;
}

const TESTCASE_SELF_CLOSING = /<testcase\b([^>]*?)\/>/g;
// The negative lookbehind excludes self-closing tags (`.../>`) from
// matching here -- without it, `[^>]*?` happily swallows the trailing
// `/` of a self-closing tag, and the lazy body then reads straight
// through to the *next* testcase's `</testcase>`, silently merging
// two tests into one and dropping the other from the results (a real
// bug caught by the multi-testsuite test fixture below).
const TESTCASE_WITH_BODY = /<testcase\b([^>]*?)(?<!\/)>([\s\S]*?)<\/testcase>/g;

function attr(attrsText: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(attrsText);
  return match ? match[1] : null;
}

function testId(attrsText: string): string {
  const classname = attr(attrsText, 'classname');
  const name = attr(attrsText, 'name') ?? '(unnamed)';
  return classname ? `${classname}.${name}` : name;
}

/** Parses every <testcase> in a JUnit XML report. A self-closing
 * <testcase .../> passed; one with a body containing <failure>/
 * <error> failed; one containing <skipped> is excluded from pass/
 * fail history entirely (a skipped test tells you nothing about
 * flakiness). */
export function parseJUnitXml(xmlText: string): TestResult[] {
  // Collect from both patterns with their source position, then sort
  // by position: the two regexes run as independent passes over the
  // text, so without re-sorting, self-closing testcases would always
  // land after every with-body testcase regardless of where they
  // actually appear in the document.
  const found: (TestResult & { index: number })[] = [];
  const consumedRanges: [number, number][] = [];

  for (const match of xmlText.matchAll(TESTCASE_WITH_BODY)) {
    consumedRanges.push([match.index, match.index + match[0].length]);
    const [, attrsText, body] = match;
    if (/<skipped\b/.test(body)) continue;
    const outcome: TestOutcome = /<failure\b|<error\b/.test(body) ? 'fail' : 'pass';
    found.push({ testId: testId(attrsText), outcome, index: match.index });
  }

  for (const match of xmlText.matchAll(TESTCASE_SELF_CLOSING)) {
    const isInsideAlreadyConsumed = consumedRanges.some(([start, end]) => match.index >= start && match.index < end);
    if (isInsideAlreadyConsumed) continue;
    found.push({ testId: testId(match[1]), outcome: 'pass', index: match.index });
  }

  return found.sort((a, b) => a.index - b.index).map(({ testId, outcome }) => ({ testId, outcome }));
}
