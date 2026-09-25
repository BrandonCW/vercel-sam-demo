import { defineTool } from "eve/tools";
import { evaluate } from "eve/ai";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { buildJevEvaluationRequest, interpretJevEvaluation } from "@/lib/agents/jev-scorer";
import { recordJevScoring } from "@/lib/db/assessments";
import { assessmentScopeOf } from "@/lib/assessment-session";
import { assertAiGatewayConfigured } from "@/lib/env";
import { resolveJevModel } from "@/lib/models";

export default defineTool({
  description:
    "Run System 1: the typesafe-ai/jev evaluation model scores the 8 MEDDPICC dimensions (0-10 with confidence) and competitor threat levels for the Opportunity; composite score and stage gate are computed in code. Loads the Opportunity itself and persists the result. Returns no citations or gap text.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to score"),
  }),
  async execute({ opportunityId }, ctx) {
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
    await recordJevScoring(opportunity, jevResult, scope);
    return { jevResult };
  },
});
