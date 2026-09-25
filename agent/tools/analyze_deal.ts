import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { System2ModelSchema } from "@/lib/models";
import { delegationStartedAt, requireDelegatedResult, analyzeDealResult } from "@/lib/agents/delegation";

export default defineWorkflowTool({
  description:
    "Delegate System 2 to the playbook_generator subagent and wait for it: it runs run_system2_analysis (citations, gap callouts, competitive playbook and the SA discovery form, which is the Assessment Session checkpoint) on an Opportunity already scored in this session. Fails unless a fresh analysis was persisted with the requested model. Returns the persisted System 2 result and the updated Opportunity.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity to analyze"),
    model: System2ModelSchema.optional().describe("Vercel AI Gateway model for System 2, if one was requested"),
  }),
  async execute({ opportunityId, model }, ctx) {
    "use workflow";
    // A CRM reset after this instant explains a missing result (see requireDelegatedResult).
    const delegatedAt = await delegationStartedAt();
    const report = await ctx.agent("playbook_generator", {
      message:
        `Run run_system2_analysis for opportunityId ${opportunityId}` +
        (model ? ` with model ${model}` : "") +
        ". Report what it returned without adding content, or the tool error verbatim.",
    });
    const delegated = await requireDelegatedResult({
      agent: "playbook_generator",
      tool: "run_system2_analysis",
      action: "questions_generated",
      opportunityId,
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
      delegatedAt,
      report: typeof report === "string" ? report : JSON.stringify(report),
    });
    // Typed result on the root stream (action.result): the workbench renders from it.
    return analyzeDealResult(delegated, model);
  },
});
