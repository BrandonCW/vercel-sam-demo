import { createHash } from 'crypto';
import { z } from 'zod';

export const SaFeedbackPayloadSchema = z.object({
  opportunityId: z.string().min(1, 'opportunityId is required'),
  formResponses: z.record(z.union([z.string(), z.array(z.string())])),
  notesDelta: z.string().optional(),
});

export type SaFeedbackPayload = z.infer<typeof SaFeedbackPayloadSchema>;

/**
 * Idempotency key for one SA feedback submission: the same answers produce the
 * same key, so a retried turn cannot append them twice.
 */
export function saFeedbackKey(formResponses: Record<string, string | string[]>, notesDelta?: string | null): string {
  const canonical = JSON.stringify({
    formResponses: Object.keys(formResponses)
      .sort()
      .map((k) => [k, formResponses[k]]),
    notesDelta: notesDelta?.trim() || null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** One timestamped SA discovery update block (the text appended to SA Notes). */
export function formatSaDiscoveryDelta(
  formResponses: Record<string, string | string[]>,
  notesDelta: string | null | undefined,
  timestamp: string
): string {
  const entries = Object.entries(formResponses)
    .filter(([_, val]) => val !== undefined && val !== null && val !== '')
    .map(([fieldId, val]) => `• ${fieldId}: ${Array.isArray(val) ? val.join(', ') : val}`);

  const deltaParts: string[] = [`[SA Discovery Update - ${timestamp}]`];
  if (entries.length > 0) {
    deltaParts.push(entries.join('\n'));
  }
  if (notesDelta && notesDelta.trim().length > 0) {
    deltaParts.push(`• Additional SA Notes: ${notesDelta.trim()}`);
  }
  return deltaParts.join('\n').trim();
}
