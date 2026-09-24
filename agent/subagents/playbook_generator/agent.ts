import { defineAgent } from "eve";
import { resolveAgentModel } from "@/lib/models";

export default defineAgent({
  description:
    "Runs System 2 on an Opportunity already scored by Jev: per-dimension citations and gap callouts, competitive playbook, and the SA discovery form. Send it the opportunityId and optional model.",
  model: resolveAgentModel(),
  modelContextWindowTokens: 200_000,
  // Only its authored tool (run_system2_analysis); no shell, web or file tools.
  defaultTools: false,
});
