# Flaky Test History Companion (VS Code)

Tracks pass/fail history per test across JUnit XML report runs and
flags tests with mixed results (flaky) in an output channel.

**v0.1, new niche.** Not a port from the Gap Hunter Labs IntelliJ-
family catalog. Evidence: no VS Code extension tracks persistent
pass/fail history for a test *across separate runs* — Playwright's own
built-in "flaky" filter is scoped to a single HTML report from one
run, not a history accumulated over many runs during local
development. Real CI-log-ingestion tools that do track history over
time (BuildPulse, Datadog Test Visibility) are both paid SaaS products
with no editor extension.

## What it does

Watches for JUnit XML report files (default pattern:
`**/{junit.xml,TEST-*.xml,test-results/**/*.xml}`, universal output
format from pytest, jest-junit, `go test -junitfile`, and most other
test runners) and, every time one appears or changes, records a
pass/fail outcome per test name into this workspace's history. Run
**Flaky Test History Companion: Show Flaky Tests** to list every test
whose recorded history contains *both* a pass and a fail — a real
signal you're looking at a flaky test, not just a broken one.

**Flaky Test History Companion: Clear History** resets the recorded
history for the current workspace.

## v0.1 scope, honestly noted

- **Local-only signal.** History only covers runs that happened on
  this machine, in this workspace, since you started using the
  extension (or since the last "Clear History"). It has no visibility
  into CI runs unless you copy CI's report files into the workspace —
  a weaker signal than a real CI-log-ingestion tool, by design: this
  is meant for the tighter loop of local development, not a
  replacement for CI-wide flake tracking.
- **JUnit XML only.** Runners that don't emit this format aren't
  covered.
- **`<skipped>` tests are excluded from history entirely** — a skip
  tells you nothing about whether the test is flaky.
- History is capped at the most recent 50 runs per test, to keep
  workspace storage bounded in a long-lived project.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
