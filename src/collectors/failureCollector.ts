import type { CollectedTestFailure, TestStatus } from '../types';
import { parseNetworkSummaryFromAttachments } from './networkCollector';
import { parseConsoleSummaryFromAttachments } from './consoleCollector';

function normalizeStatus(status: string | undefined): TestStatus {
  if (status === 'passed') return 'passed';
  if (status === 'failed') return 'failed';
  if (status === 'skipped') return 'skipped';
  if (status === 'timedOut') return 'timedOut';
  if (status === 'flaky') return 'flaky';
  return 'failed';
}

export function collectFailureFromTestEnd(args: {
  test: any;
  result: any;
}): CollectedTestFailure {
  const { test, result } = args;
  const id = String(test?.id ?? `${test?.location?.file ?? 'unknown'}::${test?.title ?? 'unknown'}`);
  const file = test?.location?.file as string | undefined;
  const titlePath: string[] | undefined =
    typeof test?.titlePath === 'function' ? (test.titlePath() as string[]) : undefined;
  const title = titlePath?.length ? titlePath.join(' › ') : String(test?.title ?? id);
  const status = normalizeStatus(result?.status);
  const retry = Number(result?.retry ?? 0);
  const durationMs = Number(result?.duration ?? 0);

  const errors: any[] = Array.isArray(result?.errors) ? result.errors : [];
  const errorMessage =
    errors.map((e) => e?.message || e?.stack || String(e)).filter(Boolean).join('\n\n') ||
    (result?.error?.message as string | undefined) ||
    (result?.error?.stack as string | undefined);

  const attachments = Array.isArray(result?.attachments) ? result.attachments : [];
  const network = parseNetworkSummaryFromAttachments(attachments);
  const consoleSummary = parseConsoleSummaryFromAttachments(attachments);

  return {
    id,
    title,
    file,
    status,
    retry,
    errorMessage,
    durationMs,
    network,
    console: consoleSummary,
  };
}

