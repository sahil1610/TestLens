import type { TestConsoleSummary } from '../types';

const ATTACHMENT_NAME = 'testlens-console-summary';

export function getConsoleAttachmentName() {
  return ATTACHMENT_NAME;
}

export function parseConsoleSummaryFromAttachments(
  attachments: Array<{
    name: string;
    contentType?: string;
    body?: Buffer;
  }>,
): TestConsoleSummary | undefined {
  const hit = attachments.find((a) => a.name === ATTACHMENT_NAME);
  if (!hit?.body) return undefined;
  try {
    const raw = hit.body.toString('utf8');
    const parsed = JSON.parse(raw) as TestConsoleSummary;
    if (!parsed || !Array.isArray(parsed.errors)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

