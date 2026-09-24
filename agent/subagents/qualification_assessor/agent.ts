import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Specializes in deal intake, baseline MEDDPICC scoring coordination via Jev, and delta re-scoring when SA feedback is provided.",
  model: process.env.SYSTEM2_MODEL_ID || "anthropic/claude-3-5-sonnet",
  modelContextWindowTokens: 200_000,
});
