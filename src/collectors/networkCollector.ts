import type { TestNetworkSummary } from '../types';

const ATTACHMENT_NAME = 'testlens-network-summary';
const CONTENT_TYPE = 'application/json';

function isJsonAttachment(a: { name: string; contentType?: string }) {
  if (a.name !== ATTACHMENT_NAME) return false;
  return !a.contentType || a.contentType === CONTENT_TYPE || a.contentType.includes('json');
}

export function getNetworkAttachmentName() {
  return ATTACHMENT_NAME;
}

export function parseNetworkSummaryFromAttachments(
  attachments: Array<{
    name: string;
    contentType?: string;
    body?: Buffer;
  }>,
): TestNetworkSummary | undefined {
  const hit = attachments.find(isJsonAttachment);
  if (!hit?.body) return undefined;
  try {
    const raw = hit.body.toString('utf8');
    const parsed = JSON.parse(raw) as TestNetworkSummary;
    if (!parsed || !Array.isArray(parsed.events)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

