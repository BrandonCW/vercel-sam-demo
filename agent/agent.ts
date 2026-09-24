import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Enterprise Deal Qualification Agent orchestrating MEDDPICC rubric evaluation, System 2 deep reasoning, and CRM writeback.",
  model: process.env.SYSTEM2_MODEL_ID || "anthropic/claude-3-5-sonnet",
  modelContextWindowTokens: 200_000,
});
