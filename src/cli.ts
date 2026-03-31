#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { adoptTestLens } from './codemod/adopt';

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`testlens-playwright

Usage:
  testlens-playwright adopt [--dir <testsDir>] [--wrapper <path>] [--dry-run]

Examples:
  testlens-playwright adopt
  testlens-playwright adopt --dir e2e
  testlens-playwright adopt --dir tests --wrapper tests/test.ts
  testlens-playwright adopt --dry-run
`);
}

function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const [, , cmd] = process.argv;
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    printHelp();
    process.exit(0);
  }

  if (cmd !== 'adopt') {
    // eslint-disable-next-line no-console
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
  }

  const dir = getArg('--dir');
  const wrapper = getArg('--wrapper');
  const dryRun = process.argv.includes('--dry-run');

  const projectRoot = process.cwd();
  const res = await adoptTestLens(projectRoot, { dir, wrapper, dryRun });

  // eslint-disable-next-line no-console
  console.log(`TestLens adoption complete`);
  // eslint-disable-next-line no-console
  console.log(`- Wrapper: ${res.wrapperPath}${res.wrapperCreated ? ' (created)' : ''}`);
  // eslint-disable-next-line no-console
  console.log(`- Files scanned: ${res.filesScanned}`);
  // eslint-disable-next-line no-console
  console.log(`- Files updated: ${res.filesUpdated}`);
  if (res.updatedFiles.length) {
    // eslint-disable-next-line no-console
    console.log(`- Updated:`);
    for (const f of res.updatedFiles.slice(0, 25)) console.log(`  - ${f}`);
    if (res.updatedFiles.length > 25) console.log(`  - ... and ${res.updatedFiles.length - 25} more`);
  }

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log(`(dry-run: no files written)`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  process.exit(1);
});

