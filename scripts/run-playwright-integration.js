/* eslint-disable no-console */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

function run() {
  const root = path.resolve(__dirname, '..');
  const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
  const config = path.join(root, 'playwright.e2e.config.ts');

  let out = '';
  try {
    execFileSync(process.execPath, [cli, 'test', '-c', config], {
      cwd: root,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    throw new Error('Expected Playwright run to fail, but it succeeded');
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }

  const mustContain = [
    'TestLens Failure Summary',
    'Console error: TL_CONSOLE_ERROR: checkout failed',
    'Page error: TL_PAGE_ERROR: something broke',
  ];

  const missing = mustContain.filter((s) => !out.includes(s));
  if (missing.length) {
    console.error('Integration assertion failed. Missing:');
    for (const m of missing) console.error(`- ${m}`);
    console.error('\n--- Output ---\n');
    console.error(out);
    process.exit(1);
  }

  console.log('Integration OK (expected Playwright failure, reporter output validated).');
}

run();

