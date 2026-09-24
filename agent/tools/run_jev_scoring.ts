import { defineTool } from "eve/tools";
import { z } from "zod";
import { scoreOpportunityWithJevAI } from "@/lib/agents/jev-scorer";

export default defineTool({
  description:
    "Execute System 1 Jev scoring via Vercel AI Gateway across all 8 MEDDPICC dimensions, calculate confidence ratings, and evaluate sales stage gates.",
  inputSchema: z.object({
    opportunityId: z.string().describe("The ID of the Opportunity"),
    dealName: z.string().describe("Opportunity name"),
    stageName: z.string().describe("Current Deal Stage (e.g. Stage 2 - Discovery)"),
    aeNotes: z.string().describe("Account Executive notes"),
    saNotes: z.string().optional().describe("Solutions Architect notes"),
  }),
  async execute({ opportunityId, dealName, stageName, aeNotes, saNotes }) {
    const result = await scoreOpportunityWithJevAI({
      opportunityId,
      name: dealName,
      stageName,
      aeNotes,
      saNotes: saNotes || "",
    });

    return {
      jevResult: result,
    };
  },
});
