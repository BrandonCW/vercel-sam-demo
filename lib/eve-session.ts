import { Client } from 'eve/client';
import { z } from 'zod';

/**
 * Server-side bridge from the Next.js `/api/qualification/*` routes to the eve
 * agent, through eve's typed HTTP client (`eve/client`). The caller's
 * `deal_qual_session` cookie is forwarded so the eve channel auth admits the request.
 *
 * One durable eve session is one Assessment Session (spec §6): turn 1 (assess)
 * creates it, the session then idles at zero cost, and turn 2 (SA feedback)
 * is sent to the same session ID, however much later.
 *
 * This file calls no model: every model call happens inside the eve agent.
 */

const TurnOutcomeSchema = z.object({
  outcome: z.enum(['completed', 'failed']),
  error: z.string().nullable(),
});

/** JSON Schema twin of TurnOutcomeSchema (zod 3 is not a Standard JSON Schema). */
const TURN_OUTCOME_JSON_SCHEMA = {
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

export interface AssessmentTurn {
  /** Origin that serves `/eve/v1/*` (see getEveAgentOrigin). */
  origin: string;
  /** Incoming `cookie` header, forwarded for channel auth. */
  cookie: string | null;
  message: string;
  /** Continue this Assessment Session (turn 2). Omitted: start a new one (turn 1). */
  sessionId?: string;
  signal?: AbortSignal;
}

/**
 * Runs one Assessment Session turn and returns the session ID. Throws unless
 * the agent reports success.
 */
export async function runAssessmentTurn({
  origin,
  cookie,
  message,
  sessionId,
  signal,
}: AssessmentTurn): Promise<{ sessionId: string }> {
  const client = new Client({
    host: origin,
    headers: cookie ? { cookie } : undefined,
    redirect: 'error',
  });
  const response = sessionId
    ? await client.sessions.attach(sessionId).send(message, { outputSchema: TURN_OUTCOME_JSON_SCHEMA, signal })
    : (await client.sessions.create({ message, outputSchema: TURN_OUTCOME_JSON_SCHEMA, signal })).response;
  const result = await response.result();
  // A settled turn leaves the durable session `waiting` for its next message (the paused
  // Assessment Session). `completed` means the session itself ended, so turn 2 could never arrive.
  if (result.status !== 'waiting') {
    throw new Error(`eve Assessment Session ${result.sessionId} ended (${result.status}) instead of pausing for the next turn`);
  }
  const outcome = TurnOutcomeSchema.safeParse(result.data);
  if (!outcome.success) {
    throw new Error(`eve agent returned no turn outcome (session ${result.sessionId})`);
  }
  if (outcome.data.outcome === 'failed') {
    throw new Error(outcome.data.error || `eve agent reported a failed turn (session ${result.sessionId})`);
  }
  return { sessionId: result.sessionId };
}
