import { defineTool } from "eve/tools";
import { z } from "zod";
import { requireOpportunity } from "@/lib/db/crm";
import { recordSaFeedback } from "@/lib/db/assessments";
import { assessmentScopeOf } from "@/lib/assessment-session";

export default defineTool({
  description:
    "Turn 2 of the Assessment Session: record the Solutions Architect's discovery form answers. Appends one timestamped update to the Opportunity's SA notes (never ae_notes) and an sa_feedback audit row, atomically and at most once per identical submission in this session, so a retried turn is safe. Pass formResponses and notesDelta exactly as received.",
  inputSchema: z.object({
    opportunityId: z.string().min(1).describe("The ID of the Opportunity the answers are for"),
    formResponses: z
      .record(z.union([z.string(), z.array(z.string())]))
      .describe("Discovery form answers keyed by field id, copied verbatim"),
    notesDelta: z.string().optional().describe("Free-text SA notes, copied verbatim, if provided"),
    feedbackKey: z
      .string()
      .optional()
      .describe("The feedbackKey sent with the payload, if any; the tool rejects answers that do not match it"),
  }),
  async execute({ opportunityId, formResponses, notesDelta, feedbackKey: expectedKey }, ctx) {
    const scope = assessmentScopeOf(ctx);
    await requireOpportunity(opportunityId);
    const { recorded, feedbackKey } = await recordSaFeedback(opportunityId, { formResponses, notesDelta, expectedKey }, scope);
    return { recorded, feedbackKey };
  },
});
