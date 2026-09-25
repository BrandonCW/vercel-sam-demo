import { z } from 'zod';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';

/**
 * The Assessment Session contract shared by the workbench and the live evals: the one message
 * that starts a session (the root agent calls `run_assessment`, which sequences everything in
 * code), the SA answer the workbench sends to the tool's discovery pause, and the structured
 * turn outcome the turn requests.
 */

/** The one assess message: call run_assessment. Writeback without SA feedback only when asked. */
export function assessTurnMessage(opportunityId: string, model: string, options: { writeback?: boolean } = {}): string {
  const call = `Assess opportunity ${opportunityId}: call run_assessment with opportunityId ${opportunityId} and model ${model}`;
  return options.writeback ? `${call} and writebackWithoutFeedback true.` : `${call}.`;
}

/** What an assess message asked for; null for any other message. */
export interface TurnRequest {
  model: string;
  writeback: boolean;
}

/** Reads a message built by assessTurnMessage back. */
export function parseTurnRequest(message: string): TurnRequest | null {
  const match = /^Assess opportunity \S+: call run_assessment with opportunityId \S+ and model (\S+?)(\.| and writebackWithoutFeedback true\.)$/.exec(message);
  return match ? { model: match[1], writeback: match[2] !== '.' } : null;
}

/**
 * The SA's discovery answers as the JSON text run_assessment parses from its `ctx.ask` pause.
 * The feedbackKey lets the tool reject answers that were altered on the way.
 */
export async function saAnswerText(formResponses: Record<string, string | string[]>, notesDelta?: string): Promise<string> {
  const feedbackKey = await saFeedbackKey(formResponses, notesDelta);
  return JSON.stringify({ formResponses, ...(notesDelta ? { notesDelta } : {}), feedbackKey });
}

/** Structured result every Assessment Session turn requests (`outputSchema`). */
export const TurnOutcomeSchema = z.object({
  outcome: z.enum(['completed', 'failed']),
  error: z.string().nullable(),
});
export type TurnOutcome = z.infer<typeof TurnOutcomeSchema>;

/** JSON Schema twin of TurnOutcomeSchema (zod 3 is not a Standard JSON Schema). */
export const TURN_OUTCOME_JSON_SCHEMA = {
  type: 'object',
  properties: {
    outcome: { type: 'string', enum: ['completed', 'failed'] },
    error: {
      type: ['string', 'null'],
      description: 'The failing tool error, verbatim, when outcome is failed; otherwise null',
    },
  },
  required: ['outcome', 'error'],
  additionalProperties: false,
};
