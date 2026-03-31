import type { Page, TestInfo } from '@playwright/test';
import { attachTestLens, flushTestLens } from '../attachTestLens';

type MaybePromise<T> = T | Promise<T>;

export type RegisterTestLensOptions = {
  /**
   * Return the Page used by your custom test setup.
   * This lets TestLens capture signals without forcing Playwright's built-in `page` fixture.
   */
  getPage: (args: Record<string, unknown>) => MaybePromise<Page | undefined>;
};

/**
 * Register TestLens hooks on an existing/custom `test` implementation.
 *
 * Use this when you have your own `test` wrapper (e.g. `../utils/Playwright.Utils`)
 * that creates a shared `context/page` in `beforeAll`.
 *
 * Example:
 *
 * ```ts
 * import { test, expect } from '@playwright/test';
 * import { registerTestLens } from 'testlens-playwright';
 *
 * let page: Page;
 *
 * test.beforeAll(async ({ browser }) => {
 *   const context = await browser.newContext();
 *   page = await context.newPage();
 * });
 *
 * registerTestLens(test, {
 *   getPage: async () => page,
 * });
 * ```
 */
export function registerTestLens(test: any, options: RegisterTestLensOptions) {
  test.beforeEach(async (args: any, testInfo: TestInfo) => {
    const page = await options.getPage(args ?? {});
    if (!page) return;
    attachTestLens(page, testInfo);
  });

  test.afterEach(async (_args: any, testInfo: TestInfo) => {
    await flushTestLens(testInfo);
  });
}

