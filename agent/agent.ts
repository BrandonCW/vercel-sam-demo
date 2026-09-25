import { defineAgent } from "eve";
import { resolveAgentModel } from "@/lib/models";

export default defineAgent({
  description:
    "Enterprise Deal Qualification Agent orchestrating MEDDPICC scoring (Jev), System 2 deep reasoning, and CRM writeback.",
  model: resolveAgentModel(),
  modelContextWindowTokens: 200_000,
  limits: {
    // An Assessment Session idles (zero compute, zero tokens) between assess and SA feedback,
    // which can be days of customer discovery. Explicit so the durability window is deliberate.
    sessionTimeoutMs: 30 * 24 * 60 * 60 * 1_000,
  },
});
