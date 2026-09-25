import { defineEval } from "eve/evals";
import { equals, satisfies } from "eve/evals/expect";
import { getOpportunity } from "@/lib/db/crm";
import { DEFAULT_JEV_MODEL, DEFAULT_SYSTEM2_MODEL, resolveJevModel } from "@/lib/models";
import { assessTurnMessage } from "@/lib/assessment-turns";
import { assessmentAction, sessionActions } from "../shared";

const GLOBEX = "opp_globex_fintech_002";

// Needs a broken Jev model for the whole agent server, so it runs in its own `eve eval`
// process: `pnpm eval` runs it with JEV_MODEL_ID=typesafe-ai/jev-nonexistent.
export default defineEval({
  description: "A failing AI Gateway call (unknown Jev model) surfaces as a failed action and produces no CRM writeback.",
  tags: ["live", "failure"],
  async test(t) {
    if (resolveJevModel() === DEFAULT_JEV_MODEL) {
      t.skip("Needs JEV_MODEL_ID set to an unknown model; run through `pnpm eval`.");
      return;
    }
    const before = (await getOpportunity(GLOBEX))!;
    const turn = await t.send(assessTurnMessage(GLOBEX, DEFAULT_SYSTEM2_MODEL, { writeback: true }));

    // The Gateway error surfaces as a failed tool action...
    t.calledTool("run_assessment", { status: "failed", count: 1 });
    // ...which is exactly what t.noFailedActions() gates on in the happy-path evals. Recorded
    // tracked-only here: its score must be 0 in this eval's artifact (see README).
    t.noFailedActions().soft().label("noFailedActions detects the Gateway failure");
    // Code decides: the action failed with the tool's own error, and there is no result.
    const action = assessmentAction(turn.session.events);
    t.log(`run_assessment error: ${action?.error}`);
    t.check(action?.status, equals("failed")).label("run_assessment action failed");
    t.check(action?.result ?? null, equals(null)).label("no result");
    t.check(action?.error ?? "", satisfies((e: string) => e.trim().length > 0, "the action carries the tool's error"));

    const after = (await getOpportunity(GLOBEX))!;
    t.check(after.suggested_next_steps, equals(null)).label("no Suggested Next Steps written");
    t.check(after.qualification_status, equals(before.qualification_status)).label("status unchanged");
    t.check(await sessionActions(GLOBEX, turn.sessionId), satisfies((a: string[]) => !a.includes("writeback"), "no writeback row"));
  },
});
