import type { Page, TestInfo } from '@playwright/test';
import type { NetworkAggregate, NetworkEvent, TestNetworkSummary } from './types';
import { getNetworkAttachmentName } from './collectors/networkCollector';
import { getConsoleAttachmentName } from './collectors/consoleCollector';

const FLUSH_FN_KEY = Symbol.for('testlens.flush');

function redactUrl(url: string) {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

function aggregate(events: NetworkEvent[]): NetworkAggregate[] {
  const key = (e: NetworkEvent) => `${e.method} ${e.status} ${e.url}`;
  const map = new Map<string, NetworkAggregate>();
  for (const e of events) {
    const k = key(e);
    const existing = map.get(k);
    if (existing) existing.count += 1;
    else map.set(k, { url: e.url, method: e.method, status: e.status, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

type AttachTestLensOptions = {
  /**
   * By default, only error-ish statuses are recorded to keep output useful/noise-free.
   * Set to true if you also want 2xx/3xx for deeper debugging.
   */
  captureAllStatuses?: boolean;
};

/**
 * Attach lightweight network failure telemetry to the current test.
 *
 * Playwright reporters can't subscribe to `page.on('response')`, so this helper
 * must be installed from within the test process.
 *
 * Minimal setup:
 *
 * ```ts
 * test.beforeEach(async ({ page }, testInfo) => {
 *   attachTestLens(page, testInfo);
 * });
 *
 * test.afterEach(async ({}, testInfo) => {
 *   await flushTestLens(testInfo);
 * });
 * ```
 */
export function attachTestLens(page: Page, testInfo: TestInfo, options: AttachTestLensOptions = {}) {
  const events: NetworkEvent[] = [];
  const captureAll = Boolean(options.captureAllStatuses);
  const consoleErrorCounts = new Map<string, { type: 'console' | 'pageerror'; message: string; count: number }>();

  const onResponse = async (response: any) => {
    try {
      const status: number = response.status();
      if (!captureAll && status < 400) return;
      const request = response.request();
      events.push({
        url: redactUrl(response.url()),
        method: request.method(),
        status,
      });
    } catch {
      // ignore
    }
  };

  const onConsole = (msg: any) => {
    try {
      const type = String(msg.type?.() ?? '');
      if (type !== 'error') return;
      const message = String(msg.text?.() ?? '');
      const key = `console::${message}`;
      const existing = consoleErrorCounts.get(key);
      if (existing) existing.count += 1;
      else consoleErrorCounts.set(key, { type: 'console', message, count: 1 });
    } catch {
      // ignore
    }
  };

  const onPageError = (err: any) => {
    try {
      const message = String(err?.message ?? err);
      const key = `pageerror::${message}`;
      const existing = consoleErrorCounts.get(key);
      if (existing) existing.count += 1;
      else consoleErrorCounts.set(key, { type: 'pageerror', message, count: 1 });
    } catch {
      // ignore
    }
  };

  page.on('response', onResponse);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const flush = async () => {
    page.off('response', onResponse);
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    const summary: TestNetworkSummary = { events: aggregate(events) };
    await testInfo.attach(getNetworkAttachmentName(), {
      body: Buffer.from(JSON.stringify(summary), 'utf8'),
      contentType: 'application/json',
    });

    const consoleSummary = {
      errors: [...consoleErrorCounts.values()].sort((a, b) => b.count - a.count),
    };
    await testInfo.attach(getConsoleAttachmentName(), {
      body: Buffer.from(JSON.stringify(consoleSummary), 'utf8'),
      contentType: 'application/json',
    });
  };

  (testInfo as any)[FLUSH_FN_KEY] = flush;
}

export async function flushTestLens(testInfo: TestInfo) {
  const flush = (testInfo as any)[FLUSH_FN_KEY] as undefined | (() => Promise<void>);
  if (!flush) return;
  delete (testInfo as any)[FLUSH_FN_KEY];
  await flush();
}

