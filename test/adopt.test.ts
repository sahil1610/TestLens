import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { adoptTestLens } from '../src/codemod/adopt';

async function mkTmpProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'testlens-'));
  await fs.mkdir(path.join(root, 'tests'), { recursive: true });
  return root;
}

async function read(p: string) {
  return fs.readFile(p, 'utf8');
}

describe('adoptTestLens', () => {
  it('creates wrapper and rewrites imports with correct relative paths', async () => {
    const root = await mkTmpProject();

    const a = path.join(root, 'tests', 'a.spec.ts');
    const nestedDir = path.join(root, 'tests', 'flows');
    await fs.mkdir(nestedDir, { recursive: true });
    const b = path.join(nestedDir, 'b.test.ts');

    await fs.writeFile(
      a,
      `import { test, expect } from '@playwright/test';\n\ntest('a', async () => { expect(1).toBe(1); });\n`,
      'utf8',
    );
    await fs.writeFile(
      b,
      `import { test } from "@playwright/test";\n\ntest('b', async () => {});\n`,
      'utf8',
    );

    const res = await adoptTestLens(root, { dir: 'tests' });
    expect(res.wrapperPath.replace(/\\/g, '/')).toBe('tests/test.ts');
    expect(res.wrapperCreated).toBe(true);
    expect(res.filesUpdated).toBe(2);

    const wrapper = await read(path.join(root, 'tests', 'test.ts'));
    expect(wrapper).toBe(`export { test, expect } from 'testlens-playwright/fixtures';\n`);

    const aOut = await read(a);
    expect(aOut).toContain(`from './test'`);

    const bOut = await read(b);
    expect(bOut).toContain(`from "../test"`);
  });

  it('is idempotent', async () => {
    const root = await mkTmpProject();
    const a = path.join(root, 'tests', 'a.spec.ts');
    await fs.writeFile(a, `import { test } from '@playwright/test';\n`, 'utf8');

    const r1 = await adoptTestLens(root, { dir: 'tests' });
    const r2 = await adoptTestLens(root, { dir: 'tests' });

    expect(r1.filesUpdated).toBe(1);
    expect(r2.filesUpdated).toBe(0);
  });

  it('supports dry-run', async () => {
    const root = await mkTmpProject();
    const a = path.join(root, 'tests', 'a.spec.ts');
    await fs.writeFile(a, `import { test } from '@playwright/test';\n`, 'utf8');

    const res = await adoptTestLens(root, { dir: 'tests', dryRun: true });
    expect(res.wrapperCreated).toBe(true);
    expect(res.filesUpdated).toBe(1);

    // dry-run should not write wrapper or rewrite file
    await expect(fs.stat(path.join(root, 'tests', 'test.ts'))).rejects.toBeTruthy();
    const aOut = await read(a);
    expect(aOut).toContain(`'@playwright/test'`);
  });
});

