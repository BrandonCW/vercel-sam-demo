import { z } from 'zod';

export const SaFeedbackPayloadSchema = z.object({
  opportunityId: z.string().min(1, 'opportunityId is required'),
  formResponses: z.record(z.union([z.string(), z.array(z.string())])),
  notesDelta: z.string().optional(),
});

export type SaFeedbackPayload = z.infer<typeof SaFeedbackPayloadSchema>;

/**
 * Formats SA discovery updates into a structured, timestamped markdown log
 * to be appended to the Opportunity's SA Notes, leaving AE Notes immutable.
 */
export function formatSaDiscoveryNotes(
  formResponses: Record<string, string | string[]>,
  notesDelta?: string,
  existingSaNotes?: string
): string {
  const timestamp = new Date().toISOString();
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

  const formattedDelta = deltaParts.join('\n').trim();

  if (!existingSaNotes || existingSaNotes.trim().length === 0) {
    return formattedDelta;
  }

  return `${existingSaNotes.trim()}\n\n${formattedDelta}`;
}
