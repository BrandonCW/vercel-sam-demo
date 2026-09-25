/**
 * Assessment Session identity (spec §6): one durable root eve session spans
 * turn 1 (assess) and turn 2 (SA feedback). Every persisted interaction is
 * stamped with the root session and turn so results never cross between
 * concurrent sessions on the same opportunity.
 */
export interface AssessmentScope {
  /** Root eve session ID (the Assessment Session). */
  sessionId: string;
  /** Root turn ID the interaction was produced in. */
  turnId: string;
}

interface EveSessionLike {
  id: string;
  turn: { id: string };
  parent?: { rootSessionId: string; turn: { id: string } };
}

/** Resolves the Assessment Session from an eve tool ctx; subagent calls resolve to their root session. */
export function assessmentScopeOf(ctx: { session?: EveSessionLike } | undefined): AssessmentScope {
  const session = ctx?.session;
  if (!session?.id || !session.turn?.id) {
    throw new Error('This tool must run inside an eve session (Assessment Session); no ctx.session was provided.');
  }
  if (session.parent) {
    return { sessionId: session.parent.rootSessionId, turnId: session.parent.turn.id };
  }
  return { sessionId: session.id, turnId: session.turn.id };
}
