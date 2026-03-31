import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

describe('Playwright + TestLens reporter integration', () => {
  it('prints console/pageerror signals in summary output', async () => {
    const root = path.resolve(__dirname, '..');
    const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
    const config = path.join(root, 'playwright.e2e.config.ts');

    // These e2e specs intentionally fail so that TestLens prints entries.
    // We assert on the reporter output.
    let stdout = '';
    try {
      await execFileAsync(process.execPath, [cli, 'test', '-c', config], {
        cwd: root,
        env: { ...process.env },
        maxBuffer: 10 * 1024 * 1024,
      });
      throw new Error('Expected Playwright run to fail, but it succeeded');
    } catch (e: any) {
      stdout = String(e?.stdout ?? '') + String(e?.stderr ?? '');
    }

    expect(stdout).toContain('TestLens Failure Summary');
    expect(stdout).toContain('Console error: TL_CONSOLE_ERROR: checkout failed');
    expect(stdout).toContain('Page error: TL_PAGE_ERROR: something broke');
  }, 60_000);
});

