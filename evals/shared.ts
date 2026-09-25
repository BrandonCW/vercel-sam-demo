import { satisfies } from "eve/evals/expect";
import { AssessmentResultSchema, type AssessmentResult } from "@/lib/assessment-progress";
import { getSessionInteractions } from "@/lib/db/crm";

/** Standardized Suggested Next Steps (agent/instructions.md). */
export const NEXT_STEPS_FORMAT =
  /^\[(QUALIFIED|IN REVIEW|DISQUALIFIED)\] [^|]+ \| Owner: (AE|SA \(Lead\) \+ AE|AE \(Lead\) \+ SA) \| Focus: [^|]+ \| Watch: [^|]+$/;

/** How the run_assessment action settled in a session's stream: the pass/fail source of truth. */
export interface AssessmentAction {
  status: string;
  /** The code-built verdict when the action completed and its output parses; otherwise null. */
  result: AssessmentResult | null;
  /** eve's error message when the action failed. */
  error: string | null;
}

/** Reads the run_assessment `action.result` from a session's events (the same event the workbench reads). */
export function assessmentAction(events: readonly unknown[]): AssessmentAction | null {
  for (const event of events as { type: string; data: any }[]) {
    if (event.type !== "action.result" || event.data?.result?.toolName !== "run_assessment") continue;
    const parsed = AssessmentResultSchema.safeParse(event.data.result.output);
    return {
      status: event.data.status,
      result: event.data.status === "completed" && parsed.success ? parsed.data : null,
      error: event.data.error?.message ?? null,
    };
  }
  return null;
}

/** Gate: run_assessment completed and returned a result that parses (the workbench's success rule). */
export const assessmentWrittenBack = satisfies(
  (action: AssessmentAction | null) => action?.status === "completed" && action.result?.status === "written_back",
  "run_assessment completed with a written_back result"
);

/** Actions persisted in one Assessment Session, oldest first. */
export async function sessionActions(opportunityId: string, sessionId: string): Promise<string[]> {
  return (await getSessionInteractions(opportunityId, sessionId)).map((i) => i.action).reverse();
}
