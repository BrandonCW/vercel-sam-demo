import { z } from 'zod';

export interface DiscoveryFormLookup {
  sections?: {
    fields?: {
      id: string;
      name?: string;
      label?: string;
      options?: { label: string; value: string }[];
    }[];
  }[];
}

export const SaFeedbackPayloadSchema = z.object({
  opportunityId: z.string().min(1, 'opportunityId is required'),
  formResponses: z.record(z.union([z.string(), z.array(z.string())])),
  notesDelta: z.string().optional(),
});

export type SaFeedbackPayload = z.infer<typeof SaFeedbackPayloadSchema>;

/**
 * Idempotency key for one SA feedback submission: the same answers produce the
 * same key, so a retried turn cannot append them twice. SHA-256 through Web Crypto,
 * so the workbench (browser) and record_sa_feedback (server) compute the same key.
 */
export async function saFeedbackKey(
  formResponses: Record<string, string | string[]>,
  notesDelta?: string | null
): Promise<string> {
  const canonical = JSON.stringify({
    formResponses: Object.keys(formResponses)
      .sort()
      .map((k) => [k, formResponses[k]]),
    notesDelta: notesDelta?.trim() || null,
  });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** One timestamped SA discovery update block (the text appended to SA Notes). */
export function formatSaDiscoveryDelta(
  formResponses: Record<string, string | string[]>,
  notesDelta: string | null | undefined,
  timestamp: string,
  form?: DiscoveryFormLookup | null
): string {
  const fieldById = new Map(
    (form?.sections ?? [])
      .flatMap((s) => s.fields ?? [])
      .flatMap((f) => [
        [f.id, f] as const,
        ...(f.name && f.name !== f.id ? ([[f.name, f]] as const) : []),
      ])
  );

  const entries = Object.entries(formResponses)
    .filter(
      ([_, val]) =>
        val !== undefined &&
        val !== null &&
        val !== '' &&
        (!Array.isArray(val) || val.length > 0)
    )
    .map(([fieldId, val]) => {
      const field = fieldById.get(fieldId);
      const questionLabel = field?.label?.trim()
        ? field.label.trim().replace(/:\s*$/, '')
        : fieldId;
      const resolveOptionLabel = (rawVal: string): string => {
        const matchedOption = field?.options?.find((opt) => opt.value === rawVal);
        return matchedOption?.label?.trim() ? matchedOption.label.trim() : rawVal;
      };
      const answerText = Array.isArray(val)
        ? val.map(resolveOptionLabel).join(', ')
        : resolveOptionLabel(val);
      return `• ${questionLabel}: ${answerText}`;
    });

  const deltaParts: string[] = [`[SA Discovery Update - ${timestamp}]`];
  if (entries.length > 0) {
    deltaParts.push(entries.join('\n'));
  }
  if (notesDelta && notesDelta.trim().length > 0) {
    deltaParts.push(`• Additional SA Notes: ${notesDelta.trim()}`);
  }
  return deltaParts.join('\n').trim();
}
