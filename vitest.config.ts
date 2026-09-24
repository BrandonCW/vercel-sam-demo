import { defineConfig } from "vitest/config";
import fs from "fs";
import { parseEnv } from "util";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Live tests share one Postgres test branch; run files serially to avoid row races.
    fileParallelism: false,
    // POSTGRES_URL for the Neon `test` branch lives in the gitignored .env.test.local.
    env: fs.existsSync(".env.test.local")
      ? parseEnv(fs.readFileSync(".env.test.local", "utf8"))
      : {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
