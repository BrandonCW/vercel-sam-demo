import type { AssessmentScope } from '@/lib/assessment-session';

/** Minimal eve tool ctx for a root-agent tool call in `sessionId`, turn `turnId`. */
export function rootCtx(sessionId: string, turnId: string): any {
  return { session: { id: sessionId, turn: { id: turnId, sequence: 1 } } };
}

/** eve tool ctx for a subagent tool call delegated from the root session `sessionId`. */
export function subagentCtx(rootSessionId: string, rootTurnId: string): any {
  return {
    session: {
      id: `${rootSessionId}_child`,
      turn: { id: 'child_turn', sequence: 1 },
      parent: { callId: 'call_1', rootSessionId, sessionId: rootSessionId, turn: { id: rootTurnId, sequence: 1 } },
    },
  };
}

export function scope(sessionId: string, turnId: string): AssessmentScope {
  return { sessionId, turnId };
}
