import fs from 'fs';
import path from 'path';
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;
import { getPostgresUrl } from '@/lib/env';
import { resetAllScenarios, resetCrmDatabase } from './crm';
import { DEMO_SCENARIOS } from './scenarios';

/**
 * Idempotent demo seed for any environment's Postgres (Neon `main` for
 * dev/preview/production, `test` for tests and evals):
 * 1. applies db/schema.sql (CREATE ... IF NOT EXISTS only),
 * 2. upserts every demo scenario into `deal_scenarios`,
 * 3. restores each scenario Opportunity to its baseline (clearing its telemetry).
 * `fullReset` instead deletes every Opportunity and interaction before restoring.
 * Running it twice yields the same state.
 */
export async function seedDemoData(options: { fullReset?: boolean } = {}): Promise<void> {
  const sql = neon(getPostgresUrl());
  await applySchema(sql);
  await sql.transaction(
    Object.values(DEMO_SCENARIOS).map(
      (s) => sql`
        INSERT INTO deal_scenarios (scenario_id, title, description, default_data)
        VALUES (${s.scenario_id}, ${s.title}, ${s.description}, ${JSON.stringify(s.default_data)}::jsonb)
        ON CONFLICT (scenario_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          default_data = EXCLUDED.default_data;
      `
    )
  );
  if (options.fullReset) {
    await resetAllScenarios();
    return;
  }
  for (const scenarioId of Object.keys(DEMO_SCENARIOS)) await resetCrmDatabase(scenarioId);
}

/** db/schema.sql is plain DDL: whole-line `--` comments and one statement per `;` line end (no $$ bodies). */
async function applySchema(sql: Sql): Promise<void> {
  const ddl = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  const statements = ddl
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await sql(statement);
}

/**
 * Marks the current Neon branch as the one `eve eval` may wipe (run once, on
 * the `test` branch only, via `pnpm db:seed --eval-target`). The marker holds the
 * branch id, so a branch later created from `test` is not a valid target.
 */
export async function markEvalTarget(): Promise<string> {
  const sql = neon(getPostgresUrl());
  const branchId = await currentBranchId(sql);
  await sql`CREATE TABLE IF NOT EXISTS eval_target (branch_id TEXT PRIMARY KEY);`;
  await sql.transaction([sql`DELETE FROM eval_target;`, sql`INSERT INTO eval_target (branch_id) VALUES (${branchId});`]);
  return branchId;
}

/** Throws unless POSTGRES_URL points at the branch marked by markEvalTarget. Returns its branch id. */
export async function requireEvalTarget(): Promise<string> {
  const sql = neon(getPostgresUrl());
  const branchId = await currentBranchId(sql);
  const [{ marked }] = await sql`
    SELECT to_regclass('eval_target') IS NOT NULL AS marked;`;
  const rows = marked ? await sql`SELECT 1 FROM eval_target WHERE branch_id = ${branchId};` : [];
  if (rows.length === 0) {
    throw new Error(
      `Refusing to reset: the database at POSTGRES_URL (Neon branch ${branchId}) is not marked as the eval target. ` +
        'Point POSTGRES_URL at the Neon `test` branch (.env.test.local); mark it once with `pnpm db:seed --eval-target`.'
    );
  }
  return branchId;
}

async function currentBranchId(sql: Sql): Promise<string> {
  const [{ branch_id }] = (await sql`SELECT current_setting('neon.branch_id', true) AS branch_id;`) as { branch_id: string | null }[];
  if (!branch_id) throw new Error('POSTGRES_URL is not a Neon database (no neon.branch_id); evals run only against the Neon `test` branch.');
  return branch_id;
}
