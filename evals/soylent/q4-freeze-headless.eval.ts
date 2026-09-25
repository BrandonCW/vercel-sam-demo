import { defineEval } from "eve/evals";
import { equals, includes, satisfies } from "eve/evals/expect";
import { getOpportunity } from "@/lib/db/crm";
import { loadLatestJevResult, loadLatestSystem2Result } from "@/lib/db/assessments";
import { DEFAULT_SYSTEM2_MODEL } from "@/lib/models";
import { assessTurnMessage } from "@/lib/assessment-turns";
import { NEXT_STEPS_FORMAT, assessmentAction, assessmentWrittenBack } from "../shared";

const SOYLENT = "opp_soylent_retail_003";

export default defineEval({
  description:
    "Soylent / headless Shopify Plus: no incumbent competitor, a hard Q4 freeze (Nov 1); assessed and written back without disqualification.",
  tags: ["live"],
  async test(t) {
    const turn = await t.send(assessTurnMessage(SOYLENT, DEFAULT_SYSTEM2_MODEL, { writeback: true }));
    // Pass or fail is the run_assessment action itself, not anything the model says.
    const action = assessmentAction(turn.session.events);
    await t.require(action, assessmentWrittenBack);
    t.calledTool("run_assessment", { count: 1 });
    t.toolOrder(["run_assessment"]);
    t.check(action!.result!.feedback, equals("skipped")).label("written back without SA feedback");
    t.check(action!.result!.opportunityId, equals(SOYLENT));
    t.check(action!.result!.nextSteps, includes(NEXT_STEPS_FORMAT)).label("result carries the standardized next steps");
    turn.notCalledTool("run_jev_scoring");
    t.check(turn.inputRequests.length, equals(0)).label("no SA pause when writing back without feedback");
    t.noFailedActions();
    t.succeeded();

    const jev = await loadLatestJevResult(SOYLENT, turn.sessionId);
    const system2 = await loadLatestSystem2Result(SOYLENT, turn.sessionId);
    t.log(`jev ${JSON.stringify({ overall: jev.overallScore, gate: jev.stageGate, flags: jev.competitiveFlags })}`);
    t.check(jev.stageGate.targetStage, equals("Stage 3 - Technical Validation")).label("Gate 2 evaluated");
    t.check(
      jev.competitiveFlags.filter((c) => c.threatLevel === "high").map((c) => c.name),
      equals([])
    ).label("no high-threat competitor");
    t.check(system2.fatalBlocker, equals(null)).label("a deadline is not a fatal blocker");

    const after = (await getOpportunity(SOYLENT))!;
    t.check(after.qualification_status, satisfies((s: string) => s === "in_review" || s === "qualified", "in review or qualified"));
    t.check(after.suggested_next_steps, includes(NEXT_STEPS_FORMAT)).label("standardized next steps");
    t.judge("The gap analysis, playbook or discovery questions account for the hard Nov 1 Q4 peak freeze deadline.", {
      on: { phase1Gaps: system2.phase1Gaps, phase2Competitive: system2.phase2Competitive, form: system2.phase3Form, nextMilestone: system2.nextMilestone },
    }).atLeast(0.6);
  },
});
