import { satisfies } from "eve/evals/expect";
import type { EveEvalTurn } from "eve/evals";
import { TurnOutcomeSchema, TURN_OUTCOME_JSON_SCHEMA } from "@/lib/eve-session";
import { getSessionInteractions } from "@/lib/db/crm";

/** Send options every eval turn uses: the same structured outcome the /api/qualification routes require. */
export const TURN = { outputSchema: TURN_OUTCOME_JSON_SCHEMA };

/** Standardized Suggested Next Steps (agent/instructions.md). */
export const NEXT_STEPS_FORMAT =
  /^\[(QUALIFIED|IN REVIEW|DISQUALIFIED)\] [^|]+ \| Owner: (AE|SA \(Lead\) \+ AE|AE \(Lead\) \+ SA) \| Focus: [^|]+ \| Watch: [^|]+$/;

export function outcomeOf(turn: EveEvalTurn) {
  return TurnOutcomeSchema.safeParse(turn.data);
}

/** Gate: the turn's structured outcome is `completed` (the routes' success contract). */
export const completedOutcome = satisfies(
  (data: unknown) => TurnOutcomeSchema.safeParse(data).data?.outcome === "completed",
  "turn outcome is completed"
);

/** Actions persisted in one Assessment Session, oldest first. */
export async function sessionActions(opportunityId: string, sessionId: string): Promise<string[]> {
  return (await getSessionInteractions(opportunityId, sessionId)).map((i) => i.action).reverse();
}
