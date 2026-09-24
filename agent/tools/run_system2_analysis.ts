import { defineTool } from "eve/tools";
import { z } from "zod";
import { runSystem2Analysis } from "@/lib/agents/system2-runner";

export default defineTool({
  description:
    "Execute System 2 multi-phased deep reasoning to synthesize qualification gaps, construct competitive battlecards, and generate dynamic JSON Render forms for Solutions Architects.",
  inputSchema: z.object({
    opportunity: z.object({
      id: z.string(),
      name: z.string(),
      stageName: z.string(),
      amount: z.number(),
      aeNotes: z.string(),
      saNotes: z.string(),
    }),
    jevResult: z.any().describe("System 1 Jev scoring result"),
    model: z
      .enum(["claude-3-5-sonnet", "claude-3-5-haiku", "gpt-4o-mini", "gemini-2-flash"])
      .optional()
      .describe("Reasoning model option for System 2"),
  }),
  async execute({ opportunity, jevResult, model }) {
    const result = await runSystem2Analysis(
      {
        opportunity,
        jevResult,
        model,
      },
      { model }
    );

    return {
      system2Result: result,
    };
  },
});
