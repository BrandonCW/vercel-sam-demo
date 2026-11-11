import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { assessmentScopeOf } from "@/lib/assessment-session";
import { resolveSystem2Model, System2ModelSchema } from "@/lib/models";
import {
  generateSystem2Analysis,
  parseSaAnswer,
  recordFeedback,
  saveJevScoring,
  saveSystem2Analysis,
  scoreWithJev,
  writeBack,
  type SaAnswer,
} from "../lib/assessment-steps";
import type { AssessmentProgress, AssessmentResult } from "@/lib/assessment-progress";

/** Prompt of the discovery pause. The workbench renders the form from the yielded gap analysis result. */
export const DISCOVERY_PROMPT =
  "Submit Solutions Architect discovery responses as JSON text: { formResponses, notesDelta?, feedbackKey }.";

/**
 * The whole deal qualification audit as one durable workflow: code, not the root model, sequences it.
 * Baseline rubric scores yield immediately (`jev_scored`) while persistence and deep gap/citation
 * synthesis run concurrently; `ctx.ask` parks the session at zero compute while awaiting discovery
 * answers; Turn 2 re-scores and writes back using in-memory results to minimize DB roundtrips.
 */
export default defineWorkflowTool({
  description:
    "Run the complete MEDDPICC deal audit for an Opportunity: baseline rubric scoring, deep gap & citation analysis with discovery form generation, a durable pause for Solutions Architect answers, delta re-scoring, and atomic CRM writeback.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to assess"),
    model: System2ModelSchema.optional().describe(
      "AI Gateway analysis model for deep gap & citation synthesis (defaults to the configured model)"
    ),
    writebackWithoutFeedback: z
      .boolean()
      .optional()
      .describe(
        "Only when explicitly requested: write back immediately after baseline gap analysis without waiting for discovery answers"
      ),
  }),
  label: {
    start: () => "Baseline MEDDPICC rubric scoring",
    delta: (_input, partial: AssessmentProgress | AssessmentResult) => progressLabel(partial),
    complete: (_input, output: AssessmentProgress | AssessmentResult) => progressLabel(output),
  },
  // The workbench and evals read the full result from the stream; the root model only needs one line.
  toModelOutput(output: AssessmentProgress | AssessmentResult) {
    if (!("status" in output)) return { type: "json", value: { stage: output.stage } };
    const { status, qualificationStatus, finalScore, delta } = output;
    return { type: "json", value: { status, qualificationStatus, finalScore, delta } };
  },
  async *execute(input, ctx): AsyncGenerator<AssessmentProgress, AssessmentResult> {
    "use workflow";
    const { opportunityId, model, writebackWithoutFeedback } = input;
    const scope = assessmentScopeOf(ctx);
    const skipFeedback = Boolean(writebackWithoutFeedback);

    const [analysisModel, baseline] = model
      ? [model, await scoreWithJev(opportunityId, ctx.abortSignal)]
      : await Promise.all([defaultAnalysisModel(), scoreWithJev(opportunityId, ctx.abortSignal)]);

    const { sessionStartedAt } = baseline;

    // Surface baseline rubric scores to the UI immediately before waiting on CRM write or deep synthesis.
    yield { stage: "jev_scored", round: "baseline", jevResult: baseline.jevResult };

    // Run baseline CRM persistence and deep gap/citation LLM inference concurrently (zero serial barrier).
    const saveBaselinePromise = saveJevScoring(
      baseline.opportunity,
      baseline.jevResult,
      scope,
      sessionStartedAt
    );
    const inferencePromise = generateSystem2Analysis(
      baseline.opportunity,
      baseline.jevResult,
      analysisModel,
      ctx.abortSignal
    );
    // Attach no-op handler while awaiting `saveBaselinePromise` + `yield` so an early rejection never surfaces unhandled.
    inferencePromise.catch(() => {});

    const scoredOpportunity = await saveBaselinePromise;
    yield {
      stage: "jev_saved",
      round: "baseline",
      jevResult: baseline.jevResult,
      opportunity: scoredOpportunity,
    };

    const system2Result = await inferencePromise;
    const analyzedOpportunity = await saveSystem2Analysis(
      scoredOpportunity,
      baseline.jevResult,
      system2Result,
      scope,
      skipFeedback,
      sessionStartedAt
    );
    yield { stage: "system2_saved", system2Result, opportunity: analyzedOpportunity };

    if (skipFeedback) {
      return writeBack(opportunityId, scope, "skipped", {
        opportunity: analyzedOpportunity,
        baselineJevResult: baseline.jevResult,
        latestJevResult: baseline.jevResult,
        system2Result,
        sessionStartedAt,
      });
    }

    let saAnswer: SaAnswer | null = null;
    let promptText = DISCOVERY_PROMPT;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const reply = await ctx.ask({ prompt: promptText, display: "text", allowFreeform: true });
      try {
        saAnswer = parseSaAnswer(reply.text);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        promptText = `${DISCOVERY_PROMPT} (Previous response invalid: ${msg}. Please re-submit valid JSON.)`;
      }
    }
    if (!saAnswer) throw new Error("Failed to receive valid SA answers after 3 attempts");

    const feedback = await recordFeedback(opportunityId, saAnswer, scope, {
      phase3Form: system2Result.phase3Form,
      sessionStartedAt,
    });
    yield { stage: "feedback_recorded", feedback };

    const rescore = await scoreWithJev(opportunityId, ctx.abortSignal);
    yield { stage: "jev_scored", round: "rescore", jevResult: rescore.jevResult };
    const rescoredOpportunity = await saveJevScoring(
      rescore.opportunity,
      rescore.jevResult,
      scope,
      sessionStartedAt
    );
    yield {
      stage: "jev_saved",
      round: "rescore",
      jevResult: rescore.jevResult,
      opportunity: rescoredOpportunity,
    };

    return writeBack(opportunityId, scope, "recorded", {
      opportunity: rescoredOpportunity,
      baselineJevResult: baseline.jevResult,
      latestJevResult: rescore.jevResult,
      system2Result,
      sessionStartedAt,
    });
  },
});

/** `process.env` belongs in a step: the workflow body is replayed and must stay deterministic. */
async function defaultAnalysisModel() {
  "use step";
  return resolveSystem2Model();
}

function progressLabel(progress: AssessmentProgress | AssessmentResult): string {
  if ("status" in progress) return `CRM writeback complete: ${progress.qualificationStatus}`;
  switch (progress.stage) {
    case "jev_scored":
      return progress.round === "baseline"
        ? "Baseline MEDDPICC rubric scored · starting deep gap & citation analysis"
        : "Post-discovery MEDDPICC rubric scored · saving to CRM";
    case "jev_saved":
      return progress.round === "baseline"
        ? "Deep gap & citation analysis"
        : "Finalizing qualification verdict & CRM writeback";
    case "system2_saved":
      return "Awaiting Solutions Architect discovery answers";
    case "feedback_recorded":
      return "Re-scoring MEDDPICC rubric with discovery answers";
  }
}
