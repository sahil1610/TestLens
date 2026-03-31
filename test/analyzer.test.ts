import { describe, expect, it } from 'vitest';
import { explainFailure } from '../src/analysis/analyzer';
import type { CollectedTestFailure } from '../src/types';

function base(overrides: Partial<CollectedTestFailure> = {}): CollectedTestFailure {
  return {
    id: 't1',
    title: 'Suite › Test',
    status: 'failed',
    retry: 0,
    durationMs: 10,
    ...overrides,
  };
}

describe('explainFailure', () => {
  it('classifies 500s as Backend Issue', () => {
    const t = base({
      network: {
        events: [{ method: 'POST', url: 'https://api.example.com/orders', status: 500, count: 3 }],
      },
    });
    const e = explainFailure(t);
    expect(e.likelyCause).toBe('Backend Issue');
    expect(e.reason).toContain('returned 500 (3 times)');
    expect(e.confidence).toBe('High');
  });

  it('classifies 4xx as Client/Test Data Issue', () => {
    const t = base({
      network: {
        events: [{ method: 'GET', url: 'https://api.example.com/search', status: 404, count: 1 }],
      },
    });
    const e = explainFailure(t);
    expect(e.likelyCause).toBe('Client/Test Data Issue');
    expect(e.reason).toContain('returned 404 (1 time)');
    expect(e.confidence).toBe('High');
  });

  it('classifies passed-after-retry as Flaky Test', () => {
    const t = base({ status: 'passed', retry: 1 });
    const e = explainFailure(t);
    expect(e.likelyCause).toBe('Flaky Test');
    expect(e.reason).toBe('Passed on retry');
    expect(e.confidence).toBe('High');
  });

  it('classifies timeout as Test Issue when no API failure observed', () => {
    const t = base({ status: 'timedOut' });
    const e = explainFailure(t);
    expect(e.likelyCause).toBe('Test Issue');
    expect(e.reason).toContain('Timed out');
  });
});

