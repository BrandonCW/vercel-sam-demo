import { defineTool } from "eve/tools";
import { z } from "zod";
import { resetCrmDatabase } from "@/lib/db/crm";

export default defineTool({
  description:
    "Reset the simulated CRM database to a clean demo scenario state (e.g. Acme Corp / Netlify, Globex FinTech / AWS Amplify, Soylent Retail / Headless).",
  inputSchema: z.object({
    scenarioId: z
      .string()
      .optional()
      .describe("The scenario identifier to reset to (defaults to active scenario)"),
  }),
  async execute({ scenarioId }) {
    const opportunity = await resetCrmDatabase(scenarioId);
    return {
      success: true,
      opportunity,
    };
  },
});
