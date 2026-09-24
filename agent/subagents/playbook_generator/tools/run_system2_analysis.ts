import { defineTool } from "eve/tools";
import { gateway, generateText, Output } from "ai";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { loadLatestJevResult, recordSystem2Analysis } from "@/lib/db/assessments";
import { resolveAgentModel, System2ModelSchema } from "@/lib/models";
import { assertAiGatewayConfigured } from "@/lib/env";
import { System2AnalysisResultSchema, System2ModelOutputSchema } from "@/lib/agents/system2";

const SYSTEM_PROMPT = `You are the Vercel Enterprise System 2 Deal Qualification Reasoning Engine.
System 1 (the Jev evaluation model) has already scored the opportunity; it returns scores only, no text.
Reason over the opportunity notes and the System 1 result in three phases:
1. Gap Synthesis: for unaddressed or partial MEDDPICC dimensions and Stage Gate blockers, separate verified facts from AE assumptions.
2. Competitive Playbook: for detected competitors (Netlify, AWS Amplify, Cloudflare Pages, Akamai/Fastly, DIY Kubernetes / AWS ECS), give counter-positioning using Vercel enterprise differentiators and a trap question.
3. Form Generation: 3 to 5 discovery questions for the Solutions Architect, grouped into sections (e.g. Stage Gate Blockers, Competitive Validation, Architecture & Metrics). Field types: text, textarea, select, radio, checkbox_group.

Also return, for every one of the 8 dimensions, dimensionFindings: "citations" are exact sentences copied verbatim from the AE or SA notes that support the score (empty if none), and "gaps" are short callouts of what is missing.
Set fatalBlocker only for a confirmed, unresolvable constraint that rules out Vercel; otherwise null.
valueFocus, primaryRisk and nextMilestone are short plain phrases without the "|" character.`;

const TIMEOUT_MS = 180_000;

export default defineTool({
  description:
    "Run System 2 deep reasoning on an Opportunity already scored by System 1: gap synthesis, per-dimension citations and gap callouts, competitive playbook, and a JSON Render discovery form for the Solutions Architect. Loads the Opportunity and the latest System 1 result itself and persists the analysis.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to analyze"),
    model: System2ModelSchema.optional().describe("Vercel AI Gateway model for System 2 (defaults to the configured model)"),
  }),
  async execute({ opportunityId, model: requested }, ctx) {
    const opportunity = await requireOpportunity(opportunityId);
    const jevResult = await loadLatestJevResult(opportunityId);
    assertAiGatewayConfigured();
    const model = requested ?? resolveAgentModel();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const abortSignal = ctx.abortSignal ? AbortSignal.any([ctx.abortSignal, timeout]) : timeout;

    const prompt = JSON.stringify({
      opportunity: {
        id: opportunity.id,
        name: opportunity.name,
        stageName: opportunity.stage_name,
        amount: Number(opportunity.amount),
        aeNotes: opportunity.ae_notes,
        saNotes: opportunity.sa_notes,
      },
      system1JevResult: {
        overallScore: jevResult.overallScore,
        dimensions: jevResult.dimensions,
        competitiveFlags: jevResult.competitiveFlags,
        stageGate: jevResult.stageGate,
      },
    });
    // One structured-output call; Gateway errors, timeouts and schema-invalid output all throw.
    const { output } = await generateText({
      model: gateway(model),
      system: SYSTEM_PROMPT,
      prompt,
      output: Output.object({ schema: System2ModelOutputSchema }),
      abortSignal,
    });
    if (!output) throw new Error(`System 2 model ${model} returned no structured output`);

    const system2Result = System2AnalysisResultSchema.parse({
      ...output,
      phase3Form: { ...output.phase3Form, opportunityId: opportunity.id },
      opportunityId: opportunity.id,
      modelUsed: model,
    });
    await recordSystem2Analysis(opportunity, jevResult, system2Result);
    return { system2Result };
  },
});
