import { defineAgent } from "eve";
import { resolveAgentModel } from "@/lib/models";

export default defineAgent({
  description:
    "Reads an Opportunity and scores it with System 1 (the Jev evaluation model): baseline MEDDPICC scoring and delta re-scoring after SA feedback. Send it the opportunityId.",
  model: resolveAgentModel(),
  modelContextWindowTokens: 200_000,
  // Only its authored tools (crm_read_deal, run_jev_scoring); no shell, web or file tools.
  defaultTools: false,
});
