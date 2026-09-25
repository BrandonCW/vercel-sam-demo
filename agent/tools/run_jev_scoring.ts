import { defineTool } from "eve/tools";
import { evaluate } from "eve/ai";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { buildJevEvaluationRequest, interpretJevEvaluation } from "@/lib/agents/jev-scorer";
import { recordJevScoring } from "@/lib/db/assessments";
import { assessmentScopeOf } from "@/lib/assessment-session";
import { assertAiGatewayConfigured } from "@/lib/env";
import { resolveJevModel } from "@/lib/models";
import type { JevScoringResult } from "@/lib/agents/jev-schema";
import type { Opportunity } from "@/lib/types/crm";

/** Preliminary snapshot (`action.partial`): the scores, before they are written to the CRM. */
type JevScored = { jevResult: JevScoringResult };
/** Final result (`action.result`): the persisted row and the Opportunity after the write. */
type JevPersisted = JevScored & { interactionId: string; opportunity: Opportunity };

export default defineTool({
  description:
    "Run System 1: the typesafe-ai/jev evaluation model scores the 8 MEDDPICC dimensions (0-10 with confidence) and competitor threat levels for the Opportunity; composite score and stage gate are computed in code. Loads the Opportunity itself and persists the result in this Assessment Session. Use for the baseline score (turn 1) and for delta re-scoring after SA feedback (turn 2). Returns no citations or gap text.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to score"),
  }),
  label: {
    start: () => "Scoring with Jev (System 1)",
    delta: () => "Jev scored; saving to the CRM",
    complete: (_input, output: JevScored | JevPersisted) => `Jev composite ${output.jevResult.overallScore}/100`,
  },
  // The workbench renders from the full result; the root model only needs the outcome to decide its next call.
  toModelOutput(output: JevScored | JevPersisted) {
    const { overallScore, stageGate, competitiveFlags } = output.jevResult;
    return {
      type: "json",
      value: {
        persisted: "interactionId" in output,
        overallScore,
        gateReady: stageGate.gateReady,
        gateBlockers: stageGate.gateBlockers,
        competitiveFlags,
      },
    };
  },
  async *execute({ opportunityId }, ctx): AsyncGenerator<JevScored | JevPersisted> {
    const scope = assessmentScopeOf(ctx);
    assertAiGatewayConfigured();
    const opportunity = await requireOpportunity(opportunityId);
    const input = {
      opportunityId: opportunity.id,
      name: opportunity.name,
      accountName: opportunity.account_name,
      stageName: opportunity.stage_name,
      amount: opportunity.amount,
      aeNotes: opportunity.ae_notes,
      saNotes: opportunity.sa_notes,
    };
    // Jev answers typed questions; composite and stage gate are computed in code.
    const evaluation = await evaluate({
      model: resolveJevModel(),
      ...buildJevEvaluationRequest(input),
      abortSignal: ctx.abortSignal,
    });
    const jevResult = interpretJevEvaluation(input, evaluation);
    // The scores reach the workbench now; a failed write below still fails this action.
    yield { jevResult };
    const { interaction, opportunity: updated } = await recordJevScoring(opportunity, jevResult, scope);
    yield { interactionId: interaction.id, jevResult, opportunity: updated };
  },
});
