import { test as base, expect as baseExpect } from '@playwright/test';
import { attachTestLens, flushTestLens } from './attachTestLens';

/**
 * Drop-in replacement for Playwright's `test` that automatically enables
 * TestLens network capture for every test.
 *
 * Usage:
 *   import { test, expect } from 'testlens-playwright/fixtures';
 */
export const test = base;
export const expect = baseExpect;

test.beforeEach(async ({ page }, testInfo) => {
  attachTestLens(page, testInfo);
});

test.afterEach(async ({}, testInfo) => {
  await flushTestLens(testInfo);
});

