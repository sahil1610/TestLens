import { test as base, expect as baseExpect } from '@playwright/test';
import { attachTestLens, flushTestLens } from './attachTestLens';

/**
 * Drop-in replacement for Playwright's `test` that automatically enables
 * TestLens capture when the Playwright `page` fixture is used.
 *
 * Usage:
 *   import { test, expect } from 'testlens-playwright/fixtures';
 */
export const expect = baseExpect;

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    attachTestLens(page, testInfo);
    await use(page);
    await flushTestLens(testInfo);
  },
});

