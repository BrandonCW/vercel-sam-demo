import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Specializes in competitive threat analysis, battlecard extraction, and framing probing questions for Solutions Architects.",
  model: process.env.SYSTEM2_MODEL_ID || "anthropic/claude-3-5-sonnet",
  modelContextWindowTokens: 200_000,
});
