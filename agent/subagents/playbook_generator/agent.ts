import { defineAgent } from "eve";
import { resolveAgentModel } from "@/lib/models";

export default defineAgent({
  description:
    "Runs System 2 on an Opportunity already scored by Jev: per-dimension citations and gap callouts, competitive playbook, and the SA discovery form. Send it the opportunityId and optional model.",
  model: resolveAgentModel(),
  modelContextWindowTokens: 200_000,
  // Only its authored tool (run_system2_analysis); no shell, web or file tools.
  defaultTools: false,
  // Called only through the root's score_deal / analyze_deal workflow tools, which wait for the
  // result so each Assessment Session turn finishes in one turn (no background task wake-ups).
  tool: false,
});
