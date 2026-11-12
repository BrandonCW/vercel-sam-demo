import { defineAgent, defineDynamic } from "eve";
import { resolveAgentModel } from "@/lib/models";

export default defineAgent({
  description:
    "Enterprise Deal Desk Agent orchestrating baseline MEDDPICC rubric scoring, deep gap & citation analysis, interactive discovery, and CRM writeback.",
  defaultTools: false,
  tool: false,
  model: defineDynamic({
    events: {
      "session.started": () => resolveAgentModel(),
    },
  }),
  limits: {
    // An audit session idles (zero compute, zero tokens) between baseline analysis and discovery answers,
    // which can span days of customer discovery. Explicit so the durability window is deliberate.
    sessionTimeoutMs: 30 * 24 * 60 * 60 * 1_000,
  },
});
