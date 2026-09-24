import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  writebackOpportunityQualification,
  recordInteraction,
  getOpportunity,
} from "@/lib/db/crm";
import { QualificationStatus, MEDDPICCBreakdown } from "@/lib/types/crm";

export default defineTool({
  description:
    "Atomically write back Suggested Next Steps, qualification status, updated SA notes, and MEDDPICC scoring to the simulated Salesforce CRM Opportunity record.",
  inputSchema: z.object({
    opportunityId: z.string().describe("The ID of the Opportunity to update"),
    suggestedNextSteps: z
      .string()
      .describe("Standardized Suggested Next Steps string"),
    qualificationStatus: z
      .enum(["unqualified", "in_review", "qualified", "disqualified"])
      .describe("Updated Qualification Status"),
    saNotes: z.string().describe("Updated SA Notes"),
    meddpiccScore: z.number().describe("Composite MEDDPICC score (0-100)"),
    meddpiccBreakdown: z.any().describe("MEDDPICC breakdown object"),
  }),
  async execute({
    opportunityId,
    suggestedNextSteps,
    qualificationStatus,
    saNotes,
    meddpiccScore,
    meddpiccBreakdown,
  }) {
    const existing = await getOpportunity(opportunityId);
    if (!existing) {
      throw new Error(`Opportunity "${opportunityId}" not found in CRM.`);
    }

    const updated = await writebackOpportunityQualification(opportunityId, {
      sa_notes: saNotes,
      suggested_next_steps: suggestedNextSteps,
      qualification_status: qualificationStatus as QualificationStatus,
      meddpicc_score: meddpiccScore,
      meddpicc_breakdown: meddpiccBreakdown as MEDDPICCBreakdown,
    });

    await recordInteraction({
      opportunity_id: opportunityId,
      actor: "system2_llm",
      action: "writeback",
      payload: {
        suggested_next_steps: suggestedNextSteps,
        qualification_status: qualificationStatus,
        meddpicc_score: meddpiccScore,
      },
    });

    return {
      success: true,
      opportunity: updated,
    };
  },
});
