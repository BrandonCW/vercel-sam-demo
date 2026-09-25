import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { assessmentScopeOf } from "@/lib/assessment-session";
import { resolveSystem2Model, System2ModelSchema } from "@/lib/models";
import {
  analyzeWithSystem2,
  parseSaAnswer,
  recordFeedback,
  saveJevScoring,
  scoreWithJev,
  writeBack,
} from "../lib/assessment-steps";
import type { AssessmentProgress, AssessmentClosed } from "@/lib/assessment-progress";

/** Prompt of the discovery pause. The workbench renders the form from the yielded System 2 result. */
export const DISCOVERY_PROMPT =
  "Answer the System 2 discovery form. Send JSON text: { formResponses, notesDelta?, feedbackKey }.";

/**
 * The whole Assessment Session as one durable workflow: code, not the root model, sequences it.
 * Every yield is an `action.partial` the workbench renders (Jev scores before their CRM write,
 * then the persisted results); the SA pause is `ctx.ask`, which parks the run at zero compute
 * for as long as discovery takes. The return value closes the session.
 */
export default defineWorkflowTool({
  description:
    "Run the whole Assessment Session for one Opportunity: Jev scoring (System 1), System 2 analysis and discovery form, a durable pause for the Solutions Architect's answers, delta re-scoring and the CRM writeback. Pass only the opportunityId and, if one was requested, the System 2 model. Returns when the session is written back.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to assess"),
    model: System2ModelSchema.optional().describe("Vercel AI Gateway model for System 2 (defaults to the configured model)"),
    writebackWithoutFeedback: z
      .boolean()
      .optional()
      .describe("Only when explicitly asked: write back right after System 2 instead of waiting for the SA's answers"),
  }),
  label: {
    start: () => "Scoring with Jev (System 1)",
    delta: (_input, partial: AssessmentProgress | AssessmentClosed) => progressLabel(partial),
    complete: (_input, output: AssessmentProgress | AssessmentClosed) =>
      progressLabel(output),
  },
  // The workbench renders from the yields; the root model only needs the outcome.
  toModelOutput(output: AssessmentProgress | AssessmentClosed) {
    if (output.stage !== "closed") return { type: "json", value: { stage: output.stage } };
    const { qualificationStatus, deltaScore } = output.writeback;
    return { type: "json", value: { outcome: "completed", qualificationStatus, deltaScore } };
  },
  async *execute({ opportunityId, model, writebackWithoutFeedback }, ctx): AsyncGenerator<AssessmentProgress, AssessmentClosed> {
    "use workflow";
    const scope = assessmentScopeOf(ctx);
    const system2Model = model ?? (await defaultSystem2Model());

    const baseline = await scoreWithJev(opportunityId);
    yield { stage: "jev_scored", round: "baseline", jevResult: baseline.jevResult };
    const scored = await saveJevScoring(baseline.opportunity, baseline.jevResult, scope);
    yield { stage: "jev_saved", round: "baseline", jevResult: baseline.jevResult, opportunity: scored };

    const analysis = await analyzeWithSystem2(scored, baseline.jevResult, system2Model, scope);
    yield { stage: "system2_saved", system2Result: analysis.system2Result, opportunity: analysis.opportunity };

    if (!writebackWithoutFeedback) {
      const reply = await ctx.ask({ prompt: DISCOVERY_PROMPT, display: "text", allowFreeform: true });
      const feedback = await recordFeedback(opportunityId, parseSaAnswer(reply.text), scope);
      yield { stage: "feedback_recorded", feedback };

      const rescore = await scoreWithJev(opportunityId);
      yield { stage: "jev_scored", round: "rescore", jevResult: rescore.jevResult };
      const rescored = await saveJevScoring(rescore.opportunity, rescore.jevResult, scope);
      yield { stage: "jev_saved", round: "rescore", jevResult: rescore.jevResult, opportunity: rescored };
    }

    const { opportunity, ...writeback } = await writeBack(opportunityId, scope);
    return { stage: "closed", writeback, opportunity };
  },
});

/** `process.env` belongs in a step: the body is replayed and must stay deterministic. */
async function defaultSystem2Model() {
  "use step";
  return resolveSystem2Model();
}

function progressLabel(progress: AssessmentProgress | AssessmentClosed): string {
  switch (progress.stage) {
    case "jev_scored":
      return "Jev scored; saving to the CRM";
    case "jev_saved":
      return progress.round === "baseline" ? "Running System 2 analysis" : "Writing back to the CRM";
    case "system2_saved":
      return "Waiting for the Solutions Architect";
    case "feedback_recorded":
      return "Re-scoring with Jev";
    case "closed":
      return `Written back: ${progress.writeback.qualificationStatus}`;
  }
}
