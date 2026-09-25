import { defineEvalConfig } from "eve/evals";
import { assertAiGatewayConfigured, getPostgresUrl } from "@/lib/env";
import { requireEvalTarget, seedDemoData } from "@/lib/db/seed";
import { acquireLiveRunLease } from "@/lib/db/live-run-lease";

/**
 * Live evals: real AI Gateway (Jev + System 2 + the agent model) and the real
 * Neon `test` branch. No mocks. Run with `pnpm eval` (loads .env.test.local).
 */
export default defineEvalConfig({
  judge: { model: "typesafe-ai/jev" },
  // Two-turn sessions with live Gateway calls take minutes, not seconds.
  timeoutMs: 900_000,
  async setup() {
    // Fail fast on missing credentials, then refuse any database but the marked test branch.
    assertAiGatewayConfigured();
    getPostgresUrl();
    await requireEvalTarget();
    // Hold the test database for the whole run: a concurrent `pnpm test` reset would delete this
    // run's Assessment Session rows mid-turn (issue 12). Fails loudly if another run holds it.
    const lease = await acquireLiveRunLease({ holder: `pnpm eval (pid ${process.pid})` });
    try {
      // Full reset: every eval starts from the seeded scenario baselines.
      await seedDemoData({ fullReset: true });
    } catch (error) {
      await lease.release();
      throw error;
    }
    return { lease };
  },
  async teardown(context) {
    if (!context) throw new Error("eval setup returned no live-run lease to release");
    await context.lease.release();
  },
});
