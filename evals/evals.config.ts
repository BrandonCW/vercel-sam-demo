import { defineEvalConfig } from "eve/evals";
import { assertAiGatewayConfigured, getPostgresUrl } from "@/lib/env";
import { requireEvalTarget, seedDemoData } from "@/lib/db/seed";

/**
 * Live evals: real AI Gateway (Jev + System 2 + the agent model) and the real
 * Neon `test` branch. No mocks. Run with `pnpm eval` (loads .env.test.local).
 */
export default defineEvalConfig({
  judge: { model: "typesafe-ai/jev" },
  // Two-turn sessions with delegated subagents take minutes, not seconds.
  timeoutMs: 900_000,
  async setup() {
    // Fail fast on missing credentials, then refuse any database but the marked test branch.
    assertAiGatewayConfigured();
    getPostgresUrl();
    await requireEvalTarget();
    // Full reset: every eval starts from the seeded scenario baselines.
    await seedDemoData({ fullReset: true });
  },
});
