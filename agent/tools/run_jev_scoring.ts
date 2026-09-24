import { defineTool } from "eve/tools";
import { z } from "zod";
import { scoreOpportunityWithJevAI } from "@/lib/agents/jev-scorer";

export default defineTool({
  description:
    "Run System 1: TypeSafe AI's typesafe-ai/jev evaluation model (via Vercel AI Gateway) scores the 8 MEDDPICC dimensions with confidence and classifies competitor threat levels; the composite score and stage gates are computed in code. Returns no citations or gap text.",
  inputSchema: z.object({
    opportunityId: z.string().describe("The ID of the Opportunity"),
    dealName: z.string().describe("Opportunity name"),
    stageName: z.string().describe("Current Deal Stage (e.g. Stage 2 - Discovery)"),
    aeNotes: z.string().describe("Account Executive notes"),
    saNotes: z.string().optional().describe("Solutions Architect notes"),
  }),
  async execute({ opportunityId, dealName, stageName, aeNotes, saNotes }, ctx) {
    const result = await scoreOpportunityWithJevAI({
      opportunityId,
      name: dealName,
      stageName,
      aeNotes,
      saNotes: saNotes || "",
    }, { abortSignal: ctx.abortSignal });

    return {
      jevResult: result,
    };
  },
});
