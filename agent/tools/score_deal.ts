import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { requireDelegatedResult } from "@/lib/agents/delegation";

export default defineWorkflowTool({
  description:
    "Delegate System 1 to the qualification_assessor subagent and wait for it: it runs run_jev_scoring (the typesafe-ai/jev evaluation model) on the Opportunity's current notes and persists the result in this Assessment Session. Use for the baseline score (turn 1) and for delta re-scoring after SA feedback (turn 2). Fails unless a fresh score was persisted.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to score"),
  }),
  async execute({ opportunityId }, ctx) {
    "use workflow";
    const report = await ctx.agent("qualification_assessor", {
      message: `Run run_jev_scoring for opportunityId ${opportunityId} and report the composite score and stage gate exactly as returned, or the tool error verbatim.`,
    });
    return requireDelegatedResult({
      agent: "qualification_assessor",
      tool: "run_jev_scoring",
      action: "initial_scoring",
      opportunityId,
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
      report: typeof report === "string" ? report : JSON.stringify(report),
    });
  },
});
