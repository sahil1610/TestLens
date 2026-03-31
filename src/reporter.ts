import type { Reporter, FullConfig, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import type { CollectedTestFailure } from './types';
import { collectFailureFromTestEnd } from './collectors/failureCollector';
import { explainFailure } from './analysis/analyzer';

type ColorMode = 'auto' | 'always' | 'never';

function line(char = '-', width = 34) {
  return char.repeat(width);
}

function formatTitle(title: string) {
  // Keep single-line for CI readability
  return title.replace(/\s+/g, ' ').trim();
}

function colorModeFromEnv(): ColorMode {
  const v = String(process.env.TESTLENS_COLOR ?? '').toLowerCase().trim();
  if (v === 'always') return 'always';
  if (v === 'never') return 'never';
  return 'auto';
}

function supportsColor(mode: ColorMode) {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  return Boolean(process.stdout.isTTY);
}

function makeAnsi(enabled: boolean) {
  const wrap = (open: string, close: string) => (s: string) => (enabled ? `${open}${s}${close}` : s);
  return {
    bold: wrap('\u001b[1m', '\u001b[22m'),
    dim: wrap('\u001b[2m', '\u001b[22m'),
    red: wrap('\u001b[31m', '\u001b[39m'),
    green: wrap('\u001b[32m', '\u001b[39m'),
    yellow: wrap('\u001b[33m', '\u001b[39m'),
    cyan: wrap('\u001b[36m', '\u001b[39m'),
    gray: wrap('\u001b[90m', '\u001b[39m'),
  };
}

function pickDisplayTests(tests: CollectedTestFailure[]) {
  // Prefer failures then flakies; keep stable ordering
  const failed = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut');
  const flaky = tests.filter((t) => t.status === 'flaky' || (t.status === 'passed' && t.retry > 0));
  return { failed, flaky };
}

export class TestLensReporter implements Reporter {
  // Keyed by test.id so retries overwrite earlier attempts — last result wins.
  private collected: Map<string, CollectedTestFailure> = new Map();
  private config?: FullConfig;

  onBegin(config: FullConfig, _suite: Suite) {
    this.config = config;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const collected = collectFailureFromTestEnd({ test, result });

    const isFlaky = collected.status === 'flaky' || (collected.status === 'passed' && collected.retry > 0);
    const isFail = collected.status === 'failed' || collected.status === 'timedOut';
    if (!isFlaky && !isFail) return;

    this.collected.set(test.id, collected);
  }

  onEnd() {
    const { failed, flaky } = pickDisplayTests([...this.collected.values()]);
    if (failed.length === 0 && flaky.length === 0) return;

    const ansi = makeAnsi(supportsColor(colorModeFromEnv()));

    // Keep output ASCII-only to avoid CI encoding issues. (User prompt shows emoji; feel free to add later.)
    // If you want emoji, swap the header with the example.
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(ansi.gray(line('-')));
    // eslint-disable-next-line no-console
    console.log(ansi.bold(ansi.cyan('TestLens Failure Summary')));
    // eslint-disable-next-line no-console
    console.log(ansi.gray(line('-')));
    // eslint-disable-next-line no-console
    console.log('');

    const all = [...failed, ...flaky];
    for (const t of all) {
      const explanation = explainFailure(t);
      const marker = t.status === 'failed' || t.status === 'timedOut' ? 'FAIL' : 'FLAKY';
      const markerColored =
        marker === 'FAIL' ? ansi.bold(ansi.red(marker)) : ansi.bold(ansi.yellow(marker));

      const causeColor =
        explanation.likelyCause === 'Backend Issue'
          ? ansi.red
          : explanation.likelyCause === 'Client/Test Data Issue'
            ? ansi.yellow
            : explanation.likelyCause === 'Flaky Test'
              ? ansi.yellow
              : explanation.likelyCause === 'Test Issue'
                ? ansi.cyan
                : (s: string) => s;

      const confidenceColor =
        explanation.confidence === 'High'
          ? ansi.green
          : explanation.confidence === 'Medium'
            ? ansi.yellow
            : ansi.gray;

      // eslint-disable-next-line no-console
      console.log(`${markerColored} ${ansi.bold(formatTitle(t.title))}`);
      // eslint-disable-next-line no-console
      console.log(`${ansi.bold('Likely Cause:')} ${causeColor(explanation.likelyCause)}`);
      // eslint-disable-next-line no-console
      console.log(`${ansi.bold('Reason:')} ${explanation.reason}`);
      // eslint-disable-next-line no-console
      console.log(`${ansi.bold('Confidence:')} ${confidenceColor(explanation.confidence)}`);
      // eslint-disable-next-line no-console
      console.log('');
    }

    // eslint-disable-next-line no-console
    console.log(ansi.gray(line('-')));
    // eslint-disable-next-line no-console
    console.log(ansi.bold('Summary:'));
    // eslint-disable-next-line no-console
    console.log(`- Total failed tests: ${failed.length}`);
    // eslint-disable-next-line no-console
    console.log(`- Flaky tests: ${flaky.length}`);
    // eslint-disable-next-line no-console
    console.log(ansi.gray(line('-')));
    // eslint-disable-next-line no-console
    console.log('');
  }
}

export default TestLensReporter;

