import { z } from 'zod';
import type { SaFeedbackPayload } from '@/lib/agents/feedback-schema';

/**
 * The messages that drive the two Assessment Session turns, and the structured
 * turn outcome each turn requests. The workbench and the live evals send exactly
 * these, so the evals exercise the same agent contract as the UI.
 */

/** Turn 1: read, score (System 1) and analyze (System 2). Writeback only when asked (no SA feedback). */
export function assessTurnMessage(opportunityId: string, model: string, options: { writeback?: boolean } = {}): string {
  const base = `Assess opportunity ${opportunityId}: call crm_read_deal, then run_jev_scoring, then run_system2_analysis with model ${model}`;
  return options.writeback
    ? `${base}, then call crm_update_next_steps for ${opportunityId} without waiting for SA feedback.`
    : `${base}. Do not write back to the CRM yet: the Solutions Architect answers the discovery form first.`;
}

/** Turn 2: record the SA answers, delta re-score, write back. */
export function feedbackTurnMessage(payload: SaFeedbackPayload, feedbackKey: string): string {
  return (
    `The Solutions Architect submitted the discovery form for opportunity ${payload.opportunityId}. ` +
    `Call record_sa_feedback with exactly this payload and feedbackKey ${feedbackKey}, then call run_jev_scoring for delta re-scoring, ` +
    `then call crm_update_next_steps for ${payload.opportunityId}. Do not re-run System 2.\n\n` +
    `SA feedback payload (JSON):\n${JSON.stringify(payload)}`
  );
}

/** What a turn message asked for: turn 1's System 2 model, or turn 2's feedbackKey. */
export type TurnRequest = { turn: 'assess'; model: string } | { turn: 'feedback'; feedbackKey: string };

/** Reads a turn message built by assessTurnMessage / feedbackTurnMessage back; null for any other message. */
export function parseTurnRequest(message: string): TurnRequest | null {
  const assess = /^Assess opportunity \S+: call crm_read_deal, then run_jev_scoring, then run_system2_analysis with model (\S+?)(?:\. Do not|, then)/.exec(message);
  if (assess) return { turn: 'assess', model: assess[1] };
  const feedback = /record_sa_feedback with exactly this payload and feedbackKey ([0-9a-zA-Z_-]+),/.exec(message);
  if (feedback) return { turn: 'feedback', feedbackKey: feedback[1] };
  return null;
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
