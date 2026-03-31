import type {
  CollectedTestFailure,
  FailureExplanation,
  LikelyCause,
  Confidence,
  NetworkAggregate,
} from '../types';

function topFailureSignal(events: NetworkAggregate[] | undefined) {
  if (!events?.length) return undefined;
  // Prefer >=500 signals, then 4xx, then highest count
  const sorted = [...events].sort((a, b) => {
    const aTier = a.status >= 500 ? 2 : a.status >= 400 ? 1 : 0;
    const bTier = b.status >= 500 ? 2 : b.status >= 400 ? 1 : 0;
    if (aTier !== bTier) return bTier - aTier;
    if (a.count !== b.count) return b.count - a.count;
    return b.status - a.status;
  });
  return sorted[0];
}

function confidenceForCause(cause: LikelyCause, signal?: NetworkAggregate): Confidence {
  if (cause === 'Flaky Test') return 'High';
  if (cause === 'Backend Issue' && signal?.status && signal.status >= 500) return 'High';
  if (cause === 'Client/Test Data Issue' && signal?.status && signal.status >= 400) return 'High';
  if (cause === 'Test Issue') return 'Medium';
  return 'Low';
}

export function explainFailure(t: CollectedTestFailure): FailureExplanation {
  // Rule: If test passed after retry → Flaky Test
  if (t.status === 'flaky' || (t.status === 'passed' && t.retry > 0)) {
    return {
      likelyCause: 'Flaky Test',
      reason: 'Passed on retry',
      confidence: confidenceForCause('Flaky Test'),
    };
  }

  const top = topFailureSignal(t.network?.events);
  if (top && top.status >= 500) {
    return {
      likelyCause: 'Backend Issue',
      reason: `${top.method} ${top.url} returned ${top.status} (${top.count} ${top.count === 1 ? 'time' : 'times'})`,
      confidence: confidenceForCause('Backend Issue', top),
    };
  }

  if (top && top.status >= 400 && top.status <= 499) {
    return {
      likelyCause: 'Client/Test Data Issue',
      reason: `${top.method} ${top.url} returned ${top.status} (${top.count} ${top.count === 1 ? 'time' : 'times'})`,
      confidence: confidenceForCause('Client/Test Data Issue', top),
    };
  }

  const topConsole = t.console?.errors?.[0];
  if (topConsole?.message) {
    const prefix = topConsole.type === 'pageerror' ? 'Page error' : 'Console error';
    const suffix = topConsole.count > 1 ? ` (${topConsole.count} times)` : '';
    return {
      likelyCause: 'Test Issue',
      reason: `${prefix}: ${topConsole.message}${suffix}`,
      confidence: confidenceForCause('Test Issue'),
    };
  }

  // Rule: If timeout and no API failure → Test Issue
  if (t.status === 'timedOut') {
    return {
      likelyCause: 'Test Issue',
      reason: 'Timed out (no API failure observed)',
      confidence: confidenceForCause('Test Issue'),
    };
  }

  const raw = t.errorMessage ?? '';
  const msg = raw.toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      likelyCause: 'Test Issue',
      reason: 'Timed out (no API failure observed)',
      confidence: confidenceForCause('Test Issue'),
    };
  }

  if (isAssertionError(raw)) {
    return {
      likelyCause: 'Test Issue',
      reason: extractAssertionReason(raw),
      confidence: 'High',
    };
  }

  if (raw.trim()) {
    const firstLine = raw.split('\n')[0].trim();
    return {
      likelyCause: 'Test Issue',
      reason: firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine,
      confidence: 'Medium',
    };
  }

  return {
    likelyCause: 'Unknown',
    reason: 'No signal detected — check attachTestLens is wired into your test wrapper',
    confidence: 'Low',
  };
}

function isAssertionError(msg: string): boolean {
  return (
    msg.includes('expect(') ||
    /Expected[\s\S]{0,10}:/.test(msg) ||
    /Received[\s\S]{0,10}:/.test(msg) ||
    /to(Be|Equal|Contain|HaveTitle|HaveText|HaveURL|BeVisible|BeEnabled|BeChecked|BeDisabled|HaveCount|HaveValue)\b/.test(msg)
  );
}

function extractAssertionReason(errorMessage: string): string {
  const expectedMatch = errorMessage.match(/Expected[:\s]+(.+)/);
  const receivedMatch = errorMessage.match(/Received[:\s]+(.+)/);
  if (expectedMatch && receivedMatch) {
    const exp = expectedMatch[1].trim().slice(0, 80);
    const rec = receivedMatch[1].trim().slice(0, 80);
    return `Assertion failed: expected ${exp}, received ${rec}`;
  }
  const firstLine = errorMessage.split('\n')[0].trim();
  return `Assertion failed: ${firstLine.slice(0, 120)}`;
}

