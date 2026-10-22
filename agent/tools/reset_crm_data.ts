import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { resetAllScenarios, resetCrmDatabase } from "@/lib/db/crm";

export default defineTool({
  description:
    "Reset the simulated CRM to a seeded demo scenario's clean baseline (e.g. Acme Corp / Netlify, Globex FinTech / AWS Amplify, Soylent Retail / Headless), or with full=true delete every Opportunity and interaction and restore all seeded scenarios.",
  approval: always(),
  inputSchema: z.object({
    scenarioId: z
      .string()
      .optional()
      .describe("The scenario identifier to reset to (defaults to the Acme scenario)"),
    full: z.boolean().optional().describe("Full reset of every scenario; ignores scenarioId"),
  }),
  async execute({ scenarioId, full }) {
    if (full) return { success: true, opportunities: await resetAllScenarios() };
    return { success: true, opportunity: await resetCrmDatabase(scenarioId) };
  },
});
