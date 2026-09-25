import { defineEval } from "eve/evals";
import { equals, includes, satisfies } from "eve/evals/expect";
import { getOpportunity } from "@/lib/db/crm";
import { loadLatestJevResult, loadSessionWriteback } from "@/lib/db/assessments";
import { DEFAULT_SYSTEM2_MODEL } from "@/lib/models";
import { assessTurnMessage } from "@/lib/assessment-turns";
import { NEXT_STEPS_FORMAT, assessmentAction, assessmentWrittenBack } from "../shared";

const GLOBEX = "opp_globex_fintech_002";

export default defineEval({
  description: "Globex / AWS Amplify: Jev detects AWS Amplify; a writeback without SA feedback lands [IN REVIEW].",
  tags: ["live"],
  async test(t) {
    const turn = await t.send(assessTurnMessage(GLOBEX, DEFAULT_SYSTEM2_MODEL, { writeback: true }));
    // Pass or fail is the run_assessment action itself, not anything the model says.
    const action = assessmentAction(turn.session.events);
    await t.require(action, assessmentWrittenBack);
    t.calledTool("run_assessment", { count: 1 });
    t.toolOrder(["run_assessment"]);
    t.check(action!.result!.feedback, equals("skipped")).label("written back without SA feedback");
    t.check(action!.result!.opportunityId, equals(GLOBEX));
    t.check(action!.result!.nextSteps, includes(NEXT_STEPS_FORMAT)).label("result carries the standardized next steps");
    turn.notCalledTool("run_jev_scoring");
    t.check(turn.inputRequests.length, equals(0)).label("no SA pause when writing back without feedback");
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
