import fs from 'node:fs/promises';
import path from 'node:path';

type AdoptOptions = {
  /**
   * Directory that contains Playwright specs (e.g. "tests", "e2e", "playwright").
   */
  dir?: string;
  /**
   * Path (relative to repo root) for the shared wrapper file.
   * Defaults to "<dir>/test.ts".
   */
  wrapper?: string;
  /**
   * Only rewrite files that match these extensions.
   */
  extensions?: string[];
  /**
   * When true, doesn't write files; returns what it would do.
   */
  dryRun?: boolean;
};

export type AdoptResult = {
  wrapperPath: string;
  wrapperCreated: boolean;
  filesScanned: number;
  filesUpdated: number;
  updatedFiles: string[];
};

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

async function pathExists(p: string) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string, dryRun: boolean) {
  if (dryRun) return;
  await fs.mkdir(p, { recursive: true });
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const current = stack.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        // Skip common junk dirs
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
        stack.push(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function toPosix(p: string) {
  return p.split(path.sep).join('/');
}

function toRelativeImport(fromFile: string, toFile: string) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile);
  rel = rel.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i, '');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return toPosix(rel);
}

function rewritePlaywrightImport(source: string, newModuleSpecifier: string): string | null {
  // Replace any import/export module specifier that points to '@playwright/test'
  // Examples:
  //   import { test } from '@playwright/test';
  //   export { test } from '@playwright/test';
  const replaced = source.replace(
    /(['"])@playwright\/test\1/g,
    (m) => m[0] + newModuleSpecifier + m[0],
  );
  return replaced === source ? null : replaced;
}

export async function adoptTestLens(projectRoot: string, options: AdoptOptions = {}): Promise<AdoptResult> {
  const dirRel = options.dir ?? 'tests';
  const dirAbs = path.resolve(projectRoot, dirRel);
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const dryRun = Boolean(options.dryRun);
  const wrapperRel = options.wrapper ?? path.join(dirRel, 'test.ts');
  const wrapperAbs = path.resolve(projectRoot, wrapperRel);

  if (!(await pathExists(dirAbs))) {
    throw new Error(`Directory not found: ${dirRel}`);
  }

  const wrapperDir = path.dirname(wrapperAbs);
  const wrapperContents = `export { test, expect } from 'testlens-playwright/fixtures';\n`;

  const wrapperAlready = await pathExists(wrapperAbs);
  if (!wrapperAlready) {
    await ensureDir(wrapperDir, dryRun);
    if (!dryRun) await fs.writeFile(wrapperAbs, wrapperContents, 'utf8');
  }

  const allFiles = await listFilesRecursive(dirAbs);
  const candidates = allFiles.filter((f) => extensions.includes(path.extname(f)));

  const updatedFiles: string[] = [];
  for (const fileAbs of candidates) {
    // Don’t rewrite the wrapper itself (idempotency).
    if (path.resolve(fileAbs) === wrapperAbs) continue;

    const input = await fs.readFile(fileAbs, 'utf8');
    if (!input.includes('@playwright/test')) continue;

    const spec = toRelativeImport(fileAbs, wrapperAbs);
    const next = rewritePlaywrightImport(input, spec);
    if (!next) continue;

    if (!dryRun) await fs.writeFile(fileAbs, next, 'utf8');
    updatedFiles.push(path.relative(projectRoot, fileAbs));
  }

  return {
    wrapperPath: path.relative(projectRoot, wrapperAbs),
    wrapperCreated: !wrapperAlready,
    filesScanned: candidates.length,
    filesUpdated: updatedFiles.length,
    updatedFiles,
  };
}

