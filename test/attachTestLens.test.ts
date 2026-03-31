import { describe, expect, it } from 'vitest';
import { attachTestLens, flushTestLens } from '../src/attachTestLens';
import { getNetworkAttachmentName } from '../src/collectors/networkCollector';
import { getConsoleAttachmentName } from '../src/collectors/consoleCollector';

class FakePage {
  private listeners = new Map<string, Set<(arg: any) => void>>();

  on(event: string, cb: (arg: any) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(cb);
    this.listeners.set(event, set);
  }

  off(event: string, cb: (arg: any) => void) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(cb);
  }

  emit(event: string, arg: any) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of [...set]) cb(arg);
  }
}

class FakeTestInfo {
  public attachments: Array<{ name: string; body: Buffer; contentType?: string }> = [];

  async attach(name: string, opts: { body: Buffer; contentType?: string }) {
    this.attachments.push({ name, body: opts.body, contentType: opts.contentType });
  }
}

function makeResponse(args: { url: string; status: number; method: string }) {
  return {
    url: () => args.url,
    status: () => args.status,
    request: () => ({
      method: () => args.method,
    }),
  };
}

function makeConsoleMessage(args: { type: string; text: string }) {
  return {
    type: () => args.type,
    text: () => args.text,
  };
}

describe('attachTestLens/flushTestLens', () => {
  it('aggregates failures and attaches a compact JSON summary', async () => {
    const page = new FakePage();
    const testInfo = new FakeTestInfo();

    attachTestLens(page as any, testInfo as any);

    page.emit('response', makeResponse({ url: 'https://x.test/orders?token=secret', status: 500, method: 'POST' }));
    page.emit('response', makeResponse({ url: 'https://x.test/orders?token=secret', status: 500, method: 'POST' }));
    page.emit('response', makeResponse({ url: 'https://x.test/orders?token=secret', status: 500, method: 'POST' }));
    page.emit('response', makeResponse({ url: 'https://x.test/ping', status: 200, method: 'GET' })); // ignored by default
    page.emit('console', makeConsoleMessage({ type: 'error', text: 'oh no' }));
    page.emit('console', makeConsoleMessage({ type: 'error', text: 'oh no' }));
    page.emit('pageerror', new Error('page blew up'));

    await flushTestLens(testInfo as any);

    const hit = testInfo.attachments.find((a) => a.name === getNetworkAttachmentName());
    expect(hit).toBeTruthy();
    const parsed = JSON.parse(hit!.body.toString('utf8'));
    expect(parsed.events).toEqual([
      {
        method: 'POST',
        status: 500,
        count: 3,
        url: 'https://x.test/orders',
      },
    ]);

    const cHit = testInfo.attachments.find((a) => a.name === getConsoleAttachmentName());
    expect(cHit).toBeTruthy();
    const cParsed = JSON.parse(cHit!.body.toString('utf8'));
    expect(cParsed.errors[0]).toEqual({ type: 'console', message: 'oh no', count: 2 });
  });

  it('is safe to call flushTestLens even if attachTestLens was not called', async () => {
    const testInfo = new FakeTestInfo();
    await flushTestLens(testInfo as any);
    expect(testInfo.attachments.length).toBe(0);
  });
});

