import { Client } from 'eve/client';
import { TurnOutcomeSchema, TURN_OUTCOME_JSON_SCHEMA } from '@/lib/assessment-turns';

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

/**
 * Headers for the server-side eve client: the caller's cookie (eve channel auth) and,
 * on Vercel, the Protection Bypass for Automation header. Vercel Authentication guards
 * every *.vercel.app deployment URL, including the one this deployment calls for
 * /eve/v1, so on Vercel the call needs VERCEL_AUTOMATION_BYPASS_SECRET (a system env
 * var Vercel sets once a bypass secret exists in Settings -> Deployment Protection).
 */
export function eveClientHeaders(cookie: string | null): Record<string, string> {
  const headers: Record<string, string> = cookie ? { cookie } : {};
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) return { ...headers, 'x-vercel-protection-bypass': bypass };
  if (process.env.VERCEL === '1') {
    throw new Error(
      'Missing or invalid environment configuration: VERCEL_AUTOMATION_BYPASS_SECRET is not set, so Vercel Deployment ' +
        'Protection would block this deployment calling its own /eve/v1 routes. Create a Protection Bypass for Automation ' +
        'secret (Project Settings -> Deployment Protection) and redeploy.'
    );
  }
  return headers;
}

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
    headers: eveClientHeaders(cookie),
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
