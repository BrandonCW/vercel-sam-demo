import { defineEval } from "eve/evals";
import { equals, includes, matches, satisfies } from "eve/evals/expect";
import { getOpportunity } from "@/lib/db/crm";
import { loadLatestJevResult, loadLatestSystem2Result, loadSessionWriteback } from "@/lib/db/assessments";
import { computeCompositeScore, getDimensionStatus } from "@/lib/agents/jev-scorer";
import { saFeedbackKey } from "@/lib/agents/feedback-schema";
import { JsonRenderFormSchema } from "@/lib/ui/json-render-schema";
import { DEFAULT_SYSTEM2_MODEL } from "@/lib/models";
import { assessTurnMessage, feedbackTurnMessage } from "@/lib/assessment-turns";
import { TURN, NEXT_STEPS_FORMAT, completedOutcome, sessionActions } from "../shared";

const ACME = "opp_acme_corp_001";

export default defineEval({
  description:
    "Acme / Netlify: one Assessment Session. Turn 1 baseline (composite 50-58, Netlify high, Gate 2 blocked on Economic Buyer); turn 2 SA feedback re-scores to >= 70 and writes back [QUALIFIED].",
  tags: ["live"],
  async test(t) {
    const baseline = (await getOpportunity(ACME))!;

    // Turn 1: assess.
    const first = await t.send(assessTurnMessage(ACME, DEFAULT_SYSTEM2_MODEL), TURN);
    await t.require(first.data, completedOutcome);
    first.toolOrder(["crm_read_deal", "score_deal", "analyze_deal"]);
    first.notCalledTool("crm_update_next_steps");
    const sessionId = first.sessionId;

    const jev = await loadLatestJevResult(ACME, sessionId);
    t.log(`baseline ${JSON.stringify({ overall: jev.overallScore, gate: jev.stageGate, flags: jev.competitiveFlags })}`);
    t.check(jev.overallScore, satisfies((s: number) => s >= 50 && s <= 58, "baseline composite 50-58"));
    t.check(jev.dimensions.identifyPain.score, satisfies((s: number) => s >= 8, "Identify Pain >= 8"));
    t.check(
      jev.competitiveFlags.find((c) => c.name === "Netlify")?.threatLevel,
      equals("high")
    ).label("Netlify high threat");
    t.check(jev.stageGate.gateReady, equals(false)).label("Gate 2 blocked");
    t.check(jev.stageGate.blockingDimensions, satisfies((d: string[]) => d.includes("economicBuyer"), "blocked on Economic Buyer"));
    // Tier-1 pure logic, checked on live Jev output: composite and per-dimension status are consistent.
    t.check(
      jev.overallScore,
      equals(computeCompositeScore(Object.fromEntries(Object.entries(jev.dimensions).map(([k, d]) => [k, d.score])) as any))
    ).label("composite = weighted dimension scores");
    t.check(
      Object.values(jev.dimensions).every((d) => d.status === getDimensionStatus(d.score)),
      equals(true)
    ).label("dimension status follows score bands");

    const system2 = await loadLatestSystem2Result(ACME, sessionId);
    t.check(system2.phase3Form, matches(JsonRenderFormSchema)).label("discovery form renders (DynamicFormRenderer contract)");
    const notes = `${baseline.ae_notes}\n${baseline.sa_notes}`;
    const citations = Object.values(system2.dimensionFindings).flatMap((f) => f.citations);
    t.check(citations.length, satisfies((n: number) => n > 0, "System 2 cites the notes"));
    t.judge(
      {
        state: { notes, dimensionFindings: system2.dimensionFindings, competitivePlaybook: system2.phase2Competitive },
        questions: {
          citationsGrounded: {
            type: "boolean",
            instructions: "Is every citation in dimensionFindings a sentence (or close excerpt) that appears in notes, attributed to a sensible dimension?",
          },
          playbookQuality: {
            type: "score",
            instructions: "Grade the Netlify competitive playbook: specific counter-positioning grounded in the notes (renewal discount, build times, launch-day queues) plus a usable trap question.",
            criteria: ["Generic or wrong", "Partly specific", "Specific and grounded", "Specific, grounded and actionable"],
          },
        },
      }
    );

    // Turn 2: SA feedback that verifies the Economic Buyer and fills the discovery gaps.
    const fieldIds = system2.phase3Form.sections.flatMap((s) => s.fields.map((f) => f.id));
    const payload = {
      opportunityId: ACME,
      formResponses: {
        [fieldIds[0]]:
          "Met CFO Mark Ellis with Priya on the discovery call. He confirmed he is the economic buyer, signs this decision, and approved a $180k FY27 budget line for the switch, contingent on the POC.",
      },
      notesDelta:
        "Economic Buyer verified: CFO Mark Ellis confirmed sign-off authority and approved the $180k budget. " +
        "Written decision criteria received: builds under 5 minutes, per-PR preview deploys, on-demand ISR revalidation, SAML SSO. " +
        "Decision process agreed: 3-week POC starting Oct 6, exec readout Oct 30, decision by Nov 15 ahead of the Netlify renewal. " +
        "Success metric: p95 build time from 45 to under 5 minutes and zero launch-day deploy queueing. " +
        "Paper process mapped: legal owns MSA redlines, security review uses our SOC2 report, procurement runs a standard 30-day cycle.",
    };
    const second = await first.session.send(feedbackTurnMessage(payload, await saFeedbackKey(payload.formResponses, payload.notesDelta)), TURN);
    await t.require(second.data, completedOutcome);
    second.toolOrder(["record_sa_feedback", "score_deal", "crm_update_next_steps"]);
    second.notCalledTool("analyze_deal");

    t.toolOrder(["crm_read_deal", "score_deal", "analyze_deal", "record_sa_feedback", "score_deal", "crm_update_next_steps"]);
    t.noFailedActions();
    t.succeeded();

    const writeback = await loadSessionWriteback(ACME, sessionId);
    const after = (await getOpportunity(ACME))!;
    t.log(`writeback ${JSON.stringify(writeback)}`);
    t.check(writeback.newScore, satisfies((s: number) => s >= 70, "re-scored composite >= 70"));
    t.check(writeback.previousScore, equals(jev.overallScore)).label("delta measured against the session baseline");
    t.check(after.qualification_status, equals("qualified"));
    t.check(after.suggested_next_steps, includes(/^\[QUALIFIED\] /));
    t.check(after.suggested_next_steps, includes(NEXT_STEPS_FORMAT)).label("standardized next steps");
    t.check(after.ae_notes, equals(baseline.ae_notes)).label("ae_notes unchanged");
    t.check(after.sa_notes, includes("Economic Buyer verified: CFO Mark Ellis"));
    t.check(
      await sessionActions(ACME, sessionId),
      satisfies(
        (a: string[]) =>
          a.filter((x) => x === "writeback").length === 1 &&
          a.filter((x) => x === "sa_feedback").length === 1 &&
          a.filter((x) => x === "initial_scoring").length === 2,
        "one sa_feedback, two scorings, exactly one writeback in the session"
      )
    );
  },
});
