import * as vscode from 'vscode';
import { parseJUnitXml } from './junitParser';
import { recordRun, getFlakyTests, type TestHistory } from './history';
import { recordHit } from './reviewPrompt';

const HISTORY_KEY = 'flakyTestHistoryCompanion.history';
const DEFAULT_GLOB = '**/{junit.xml,TEST-*.xml,test-results/**/*.xml}';

let outputChannel: vscode.OutputChannel;

function readHistory(state: vscode.Memento): TestHistory {
  return state.get<TestHistory>(HISTORY_KEY, {});
}

async function ingestReport(state: vscode.Memento, uri: vscode.Uri): Promise<void> {
  let text: string;
  try {
    text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  } catch {
    return; // file deleted/unreadable between the watcher event and this read -- skip silently
  }
  const results = parseJUnitXml(text);
  if (results.length === 0) return; // not a JUnit report we could parse -- ignore, no history change
  const next = recordRun(readHistory(state), results);
  await state.update(HISTORY_KEY, next);
}

function showFlakyTests(context: vscode.ExtensionContext): void {
  const flaky = getFlakyTests(readHistory(context.workspaceState));
  outputChannel.clear();
  outputChannel.show(true);
  if (flaky.length === 0) {
    outputChannel.appendLine('No flaky tests recorded yet.');
    outputChannel.appendLine('');
    outputChannel.appendLine(
      'Flaky Test History Companion watches for JUnit XML reports ' +
        `(default pattern: ${DEFAULT_GLOB}) and needs at least one PASS ` +
        'and one FAIL recorded for the same test across separate runs ' +
        'before it counts as flaky.'
    );
    return;
  }
  outputChannel.appendLine(`${flaky.length} flaky test(s) (mixed pass/fail across recorded runs):`);
  outputChannel.appendLine('');
  for (const t of flaky) {
    outputChannel.appendLine(`  ${t.testId}`);
    outputChannel.appendLine(`    ${t.passCount} pass / ${t.failCount} fail across ${t.totalRuns} run(s) -- last: ${t.lastOutcome}`);
    // A test actually identified as flaky (mixed pass/fail across real
    // runs) is the genuine value moment here -- dedup'd by testId so
    // re-running "Show Flaky Tests" on the same still-flaky test
    // doesn't inflate the count.
    recordHit(context, t.testId);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Flaky Test History Companion');
  context.subscriptions.push(outputChannel);

  const config = vscode.workspace.getConfiguration('flakyTestHistoryCompanion');
  const glob = config.get<string>('reportGlob', DEFAULT_GLOB);
  const watcher = vscode.workspace.createFileSystemWatcher(glob);
  context.subscriptions.push(watcher);

  const onReport = (uri: vscode.Uri) => void ingestReport(context.workspaceState, uri);
  watcher.onDidCreate(onReport);
  watcher.onDidChange(onReport);

  context.subscriptions.push(
    vscode.commands.registerCommand('flakyTestHistoryCompanion.showFlakyTests', () => showFlakyTests(context)),
    vscode.commands.registerCommand('flakyTestHistoryCompanion.clearHistory', async () => {
      await context.workspaceState.update(HISTORY_KEY, {});
      vscode.window.showInformationMessage('Flaky Test History Companion: history cleared.');
    })
  );
}

export function deactivate(): void {
  // no-op: no timers, connections, or watchers outside context.subscriptions to tear down
}
