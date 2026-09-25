import { defineTool } from "eve/tools";
import { z } from "zod";
import { getOpportunity } from "@/lib/db/crm";

export default defineTool({
  description: "Fetch Opportunity details from the simulated Salesforce CRM by Opportunity ID.",
  inputSchema: z.object({
    opportunityId: z.string().describe("The ID of the Opportunity to retrieve"),
  }),
  async execute({ opportunityId }) {
    const opportunity = await getOpportunity(opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity with ID "${opportunityId}" not found in CRM.`);
    }
    return {
      opportunity,
    };
  },
});
