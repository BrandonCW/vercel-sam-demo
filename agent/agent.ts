import { defineAgent } from "eve";
import { resolveAgentModel } from "@/lib/models";

export default defineAgent({
  description:
    "Enterprise Deal Qualification Agent orchestrating MEDDPICC scoring (Jev), System 2 deep reasoning, and CRM writeback.",
  model: resolveAgentModel(),
  modelContextWindowTokens: 200_000,
});
