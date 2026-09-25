import { defineConfig } from "vitest/config";
import { loadTestEnv } from "./tests/test-env";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Live tests share one Postgres test branch; run files serially to avoid row races.
    fileParallelism: false,
    // Holds the live-run lease on the test database for the whole run (issue 12).
    globalSetup: ["./tests/global-setup.ts"],
    // POSTGRES_URL for the Neon `test` branch lives in the gitignored .env.test.local.
    env: loadTestEnv(),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
