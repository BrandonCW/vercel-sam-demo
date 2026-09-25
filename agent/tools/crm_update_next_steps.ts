import { defineTool } from "eve/tools";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { writebackQualification } from "@/lib/db/assessments";
import { assessmentScopeOf } from "@/lib/assessment-session";

export default defineTool({
  description:
    "Write back the assessment to the simulated Salesforce CRM and close the Assessment Session. Loads this session's latest System 1 and System 2 results, decides the qualification status and the standardized Suggested Next Steps in code, and atomically updates the Opportunity with one writeback audit row (score delta against this session's first score). Rejects the write if ae_notes would change.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to update"),
  }),
  async execute({ opportunityId }, ctx) {
    const scope = assessmentScopeOf(ctx);
    const opportunity = await requireOpportunity(opportunityId);
    const { opportunity: updated, suggestedNextSteps, deltaScore } = await writebackQualification(opportunity, scope);
    return { success: true, suggestedNextSteps, deltaScore, sessionState: "closed" as const, opportunity: updated };
  },
});
