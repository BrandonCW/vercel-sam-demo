import { defineEval } from "eve/evals";
import { equals, includes, satisfies } from "eve/evals/expect";
import { getOpportunity } from "@/lib/db/crm";
import { loadLatestJevResult, loadSessionWriteback } from "@/lib/db/assessments";
import { DEFAULT_SYSTEM2_MODEL } from "@/lib/models";
import { assessTurnMessage } from "@/lib/assessment-turns";
import { TURN, NEXT_STEPS_FORMAT, completedOutcome } from "../shared";

const GLOBEX = "opp_globex_fintech_002";

export default defineEval({
  description: "Globex / AWS Amplify: Jev detects AWS Amplify; a writeback without SA feedback lands [IN REVIEW].",
  tags: ["live"],
  async test(t) {
    const turn = await t.send(assessTurnMessage(GLOBEX, DEFAULT_SYSTEM2_MODEL, { writeback: true }), TURN);
    await t.require(turn.data, completedOutcome);
    t.toolOrder(["crm_read_deal", "run_jev_scoring", "run_system2_analysis", "crm_update_next_steps"]);
    t.noFailedActions();
    t.succeeded();

    const jev = await loadLatestJevResult(GLOBEX, turn.sessionId);
    t.log(`jev ${JSON.stringify({ overall: jev.overallScore, gate: jev.stageGate, flags: jev.competitiveFlags })}`);
    t.check(jev.competitiveFlags.map((c) => c.name), satisfies((n: string[]) => n.includes("AWS Amplify"), "AWS Amplify detected"));

    const writeback = await loadSessionWriteback(GLOBEX, turn.sessionId);
    const after = (await getOpportunity(GLOBEX))!;
    t.log(`writeback ${JSON.stringify(writeback)}`);
    t.check(after.qualification_status, equals("in_review"));
    t.check(after.suggested_next_steps, includes(/^\[IN REVIEW\] /));
    t.check(after.suggested_next_steps, includes(NEXT_STEPS_FORMAT)).label("standardized next steps");
    t.check(after.competitive_flags, satisfies((f: string[]) => f.includes("AWS Amplify"), "CRM competitor flag persisted"));
  },
});
