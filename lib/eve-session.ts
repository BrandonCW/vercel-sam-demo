import { Client } from 'eve/client';
import { z } from 'zod';

/**
 * Server-side bridge from the Next.js `/api/qualification/*` routes to the eve
 * agent, through eve's typed HTTP client (`eve/client`). The agent is mounted
 * same-origin at `/eve/v1/*` by `withEve`, and the caller's `deal_qual_session`
 * cookie is forwarded so the eve channel auth admits the request.
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

export interface AgentTurn {
  /** Configured origin that serves `/eve/v1/*` (see getEveAgentOrigin). */
  origin: string;
  /** Incoming `cookie` header, forwarded for channel auth. */
  cookie: string | null;
  message: string;
  signal?: AbortSignal;
}

/** Runs one turn on a fresh eve session and throws unless the agent reports success. */
export async function runAgentTurn({ origin, cookie, message, signal }: AgentTurn): Promise<void> {
  const client = new Client({
    host: origin,
    headers: cookie ? { cookie } : undefined,
    redirect: 'error',
  });
  const { response } = await client.sessions.create({
    message,
    outputSchema: TURN_OUTCOME_JSON_SCHEMA,
    signal,
  });
  const result = await response.result();
  if (result.status !== 'completed') {
    throw new Error(`eve agent turn ${result.status} (session ${result.sessionId})`);
  }
  const outcome = TurnOutcomeSchema.safeParse(result.data);
  if (!outcome.success) {
    throw new Error(`eve agent returned no turn outcome (session ${result.sessionId})`);
  }
  if (outcome.data.outcome === 'failed') {
    throw new Error(outcome.data.error || `eve agent reported a failed turn (session ${result.sessionId})`);
  }
}
