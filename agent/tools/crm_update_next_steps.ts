import { defineTool } from "eve/tools";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { loadLatestJevResult, loadLatestSystem2Result, writebackQualification } from "@/lib/db/assessments";

export default defineTool({
  description:
    "Write back the assessment to the simulated Salesforce CRM. Loads the latest System 1 and System 2 results, decides the qualification status and the standardized Suggested Next Steps in code, and atomically updates the Opportunity. Rejects the write if ae_notes would change.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to update"),
  }),
  async execute({ opportunityId }) {
    const opportunity = await requireOpportunity(opportunityId);
    const jevResult = await loadLatestJevResult(opportunityId);
    const system2Result = await loadLatestSystem2Result(opportunityId);
    const { opportunity: updated, suggestedNextSteps } = await writebackQualification(
      opportunity,
      jevResult,
      system2Result
    );
    return { success: true, suggestedNextSteps, opportunity: updated };
  },
});
