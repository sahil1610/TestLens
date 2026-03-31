import { describe, expect, it, vi } from 'vitest';
import { TestLensReporter } from '../src/reporter';

function attachmentJson(name: string, obj: any) {
  return {
    name,
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(obj), 'utf8'),
  };
}

describe('TestLensReporter', () => {
  it('prints a clean end-of-run summary for failed + flaky', () => {
    const r = new TestLensReporter();
    r.onBegin({ reporter: [] } as any, {} as any);

    const t1 = {
      id: 't1',
      location: { file: 'tests/checkout.spec.ts' },
      title: 'Checkout Flow',
      titlePath: () => ['Checkout Flow'],
    };
    const res1 = {
      status: 'failed',
      retry: 0,
      duration: 123,
      errors: [{ message: 'boom' }],
      attachments: [
        attachmentJson('testlens-network-summary', {
          events: [{ url: 'https://api.test/orders', method: 'POST', status: 500, count: 3 }],
        }),
      ],
    };

    const t2 = {
      id: 't2',
      location: { file: 'tests/search.spec.ts' },
      title: 'Search Test',
      titlePath: () => ['Search Test'],
    };
    const res2 = {
      status: 'flaky',
      retry: 1,
      duration: 50,
      errors: [],
      attachments: [],
    };

    r.onTestEnd(t1 as any, res1 as any);
    r.onTestEnd(t2 as any, res2 as any);

    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      logs.push(args.join(' '));
    });

    try {
      r.onEnd();
    } finally {
      spy.mockRestore();
    }

    const out = logs.join('\n');
    expect(out).toContain('TestLens Failure Summary');
    expect(out).toContain('FAIL Checkout Flow');
    expect(out).toContain('Likely Cause: Backend Issue');
    expect(out).toContain('returned 500 (3 times)');
    expect(out).toContain('FLAKY Search Test');
    expect(out).toContain('Likely Cause: Flaky Test');
    expect(out).toContain('Passed on retry');
    expect(out).toContain('- Total failed tests: 1');
    expect(out).toContain('- Flaky tests: 1');
  });
});

