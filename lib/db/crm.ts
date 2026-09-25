import { neon } from '@neondatabase/serverless';
import {
  Opportunity,
  DealScenario,
  DealInteraction,
  QualificationStatus,
  MEDDPICCBreakdown,
} from '@/lib/types/crm';
import { DEFAULT_SCENARIO_ID, DEMO_SCENARIO_IDS as EXPECTED_SCENARIO_IDS } from './scenarios';
import { getPostgresUrl } from '@/lib/env';

/**
 * Simulated Salesforce CRM backed exclusively by Postgres (Neon).
 * Tables are defined in db/schema.sql. A missing POSTGRES_URL or any query
 * failure throws; there is no alternate store.
 */
function getSql() {
  return neon(getPostgresUrl());
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT o.*,
      (SELECT MAX(created_at) FROM deal_interactions i WHERE i.opportunity_id = o.id AND i.action = 'reset') AS last_reset_at
    FROM opportunities o WHERE o.id = ${id} LIMIT 1;`;
  return rows.length > 0 ? mapRowToOpportunity(rows[0]) : null;
}

/** Like getOpportunity, but a missing record throws. */
export async function requireOpportunity(id: string): Promise<Opportunity> {
  const opportunity = await getOpportunity(id);
  if (!opportunity) throw new Error(`Opportunity "${id}" not found in CRM.`);
  return opportunity;
}

export async function getOpportunityByScenario(scenarioId: string): Promise<Opportunity | null> {
  const scenario = (await getScenarios()).find((s) => s.scenario_id === scenarioId);
  if (!scenario) return null;
  return getOpportunity(scenario.default_data.id);
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM opportunities ORDER BY created_at ASC;`;
  return rows.map(mapRowToOpportunity);
}

export async function updateOpportunity(
  id: string,
  updates: Partial<Opportunity>
): Promise<Opportunity> {
  const now = new Date().toISOString();
  const sql = getSql();
  const existing = await getOpportunity(id);
  if (!existing) throw new Error(`Opportunity ${id} not found`);

  const merged: Opportunity = {
    ...existing,
    ...updates,
    updated_at: now,
  };

  await sql`
    UPDATE opportunities SET
      name = ${merged.name},
      account_name = ${merged.account_name},
      stage_name = ${merged.stage_name},
      amount = ${merged.amount},
      close_date = ${merged.close_date},
      ae_name = ${merged.ae_name},
      sa_name = ${merged.sa_name},
      ae_notes = ${merged.ae_notes},
      sa_notes = ${merged.sa_notes},
      suggested_next_steps = ${merged.suggested_next_steps},
      qualification_status = ${merged.qualification_status},
      meddpicc_score = ${merged.meddpicc_score},
      meddpicc_breakdown = ${JSON.stringify(merged.meddpicc_breakdown)}::jsonb,
      competitive_flags = ${merged.competitive_flags},
      updated_at = ${now}
    WHERE id = ${id};
  `;

  return merged;
}

export interface QualificationWritebackData {
  /** The ae_notes the caller read. The write is rejected if the stored value differs (ae_notes is immutable). */
  expectedAeNotes: string;
  suggested_next_steps: string;
  qualification_status: QualificationStatus;
  meddpicc_score: number;
  meddpicc_breakdown: MEDDPICCBreakdown;
  /** The Assessment Session this writeback closes; each session is written back at most once. */
  sessionId: string;
  /** The single `writeback` audit row, inserted in the same statement as the update. */
  audit: { actor: DealInteraction['actor']; payload: Record<string, unknown> };
}

export async function writebackOpportunityQualification(
  id: string,
  writeback: QualificationWritebackData
): Promise<Opportunity> {
  const now = new Date().toISOString();
  const sql = getSql();
  const payload = { ...writeback.audit.payload, assessmentSessionId: writeback.sessionId };
  // One transaction, serialised per session: updates ONLY the designated writeback fields
  // (ae_notes and sa_notes are untouched) and inserts the single writeback audit row, or
  // neither when ae_notes changed or the session is already closed.
  const [, closedRows, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext(${`writeback:${id}:${writeback.sessionId}`}));`,
    sql`SELECT EXISTS (
      SELECT 1 FROM deal_interactions
      WHERE opportunity_id = ${id} AND action = 'writeback'
        AND payload->>'assessmentSessionId' = ${writeback.sessionId}
    ) AS closed;`,
    sql`
    WITH updated AS (
      UPDATE opportunities SET
        suggested_next_steps = ${writeback.suggested_next_steps},
        qualification_status = ${writeback.qualification_status},
        meddpicc_score = ${writeback.meddpicc_score},
        meddpicc_breakdown = ${JSON.stringify(writeback.meddpicc_breakdown)}::jsonb,
        updated_at = ${now}
      WHERE id = ${id} AND ae_notes = ${writeback.expectedAeNotes}
        AND NOT EXISTS (
          SELECT 1 FROM deal_interactions
          WHERE opportunity_id = ${id} AND action = 'writeback'
            AND payload->>'assessmentSessionId' = ${writeback.sessionId}
        )
      RETURNING *
    ), audit AS (
      INSERT INTO deal_interactions (opportunity_id, actor, action, payload)
      SELECT id, ${writeback.audit.actor}, 'writeback', ${JSON.stringify(payload)}::jsonb FROM updated
    )
    SELECT * FROM updated;
  `,
  ]);
  if (rows.length === 0) {
    if (closedRows[0]?.closed) {
      throw new Error(`Writeback to ${id} rejected: Assessment Session ${writeback.sessionId} is already closed.`);
    }
    const existing = await getOpportunity(id);
    if (!existing) throw new Error(`Opportunity ${id} not found`);
    throw new Error(`Writeback to ${id} rejected: ae_notes changed since it was read; ae_notes is immutable.`);
  }
  return mapRowToOpportunity(rows[0]);
}

/**
 * Appends one SA discovery update to sa_notes and records its `sa_feedback` row
 * atomically, at most once per (Assessment Session, feedbackKey). Returns false
 * when that feedback was already recorded (a retried turn), changing nothing.
 */
export async function appendSaFeedbackOnce(input: {
  opportunityId: string;
  sessionId: string;
  feedbackKey: string;
  notesDelta: string;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const sql = getSql();
  const now = new Date().toISOString();
  const lockKey = `sa_feedback:${input.opportunityId}:${input.sessionId}:${input.feedbackKey}`;
  const [, inserted] = await sql.transaction([
    // Serialises identical concurrent submissions; released at commit.
    sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}));`,
    sql`
      WITH existing AS (
        SELECT 1 FROM deal_interactions
        WHERE opportunity_id = ${input.opportunityId}
          AND action = 'sa_feedback'
          AND payload->>'assessmentSessionId' = ${input.sessionId}
          AND payload->>'feedbackKey' = ${input.feedbackKey}
      ), updated AS (
        UPDATE opportunities SET
          sa_notes = CASE
            WHEN btrim(coalesce(sa_notes, '')) = '' THEN ${input.notesDelta}
            ELSE btrim(sa_notes) || E'\n\n' || ${input.notesDelta}
          END,
          updated_at = ${now}
        WHERE id = ${input.opportunityId} AND NOT EXISTS (SELECT 1 FROM existing)
        RETURNING id
      )
      INSERT INTO deal_interactions (opportunity_id, actor, action, payload)
      SELECT id, 'sa_user', 'sa_feedback', ${JSON.stringify(input.payload)}::jsonb FROM updated
      RETURNING id;
    `,
  ]);
  return inserted.length > 0;
}

const NOT_SEEDED_HINT = 'Seed the demo data with `pnpm db:seed` (see README).';

/** Baseline upsert of one scenario's Opportunity: unqualified, no score, no next steps. */
function upsertBaseline(sql: ReturnType<typeof getSql>, seed: DealScenario['default_data'], now: string) {
  return sql`
    INSERT INTO opportunities (
      id, name, account_name, stage_name, amount, close_date,
      ae_name, sa_name, ae_notes, sa_notes, suggested_next_steps,
      qualification_status, meddpicc_score, meddpicc_breakdown, competitive_flags,
      created_at, updated_at
    ) VALUES (
      ${seed.id}, ${seed.name}, ${seed.account_name}, ${seed.stage_name}, ${seed.amount}, ${seed.close_date},
      ${seed.ae_name}, ${seed.sa_name}, ${seed.ae_notes}, ${seed.sa_notes}, ${null},
      'unqualified', ${null}, ${JSON.stringify(seed.meddpicc_breakdown)}::jsonb, ${seed.competitive_flags},
      ${now}, ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      account_name = EXCLUDED.account_name,
      stage_name = EXCLUDED.stage_name,
      amount = EXCLUDED.amount,
      close_date = EXCLUDED.close_date,
      ae_name = EXCLUDED.ae_name,
      sa_name = EXCLUDED.sa_name,
      ae_notes = EXCLUDED.ae_notes,
      sa_notes = EXCLUDED.sa_notes,
      suggested_next_steps = NULL,
      qualification_status = 'unqualified',
      meddpicc_score = NULL,
      meddpicc_breakdown = EXCLUDED.meddpicc_breakdown,
      competitive_flags = EXCLUDED.competitive_flags,
      updated_at = ${now}
    RETURNING *;
  `;
}

/** The reset audit row, stamped by the database clock (delegation compares against it). */
function resetEvent(sql: ReturnType<typeof getSql>, opportunityId: string, scenarioId: string) {
  return sql`
    INSERT INTO deal_interactions (opportunity_id, actor, action, payload)
    VALUES (${opportunityId}, 'sa_user', 'reset', ${JSON.stringify({ scenarioId })}::jsonb);
  `;
}

/**
 * Restores one demo scenario to its seeded baseline (from `deal_scenarios`) and
 * clears that Opportunity's telemetry. Throws if the scenario is not seeded.
 */
export async function resetCrmDatabase(scenarioId?: string): Promise<Opportunity> {
  const targetScenarioId = scenarioId ?? DEFAULT_SCENARIO_ID;
  const scenario = (await getScenarios()).find((s) => s.scenario_id === targetScenarioId);
  if (!scenario) throw new Error(`Scenario '${targetScenarioId}' is not seeded in Postgres. ${NOT_SEEDED_HINT}`);
  const now = new Date().toISOString();
  const sql = getSql();
  const seed = scenario.default_data;

  // One transaction: the upsert, telemetry purge and reset event land together or not at all.
  await sql.transaction([
    upsertBaseline(sql, seed, now),
    sql`DELETE FROM deal_interactions WHERE opportunity_id = ${seed.id};`,
    resetEvent(sql, seed.id, targetScenarioId),
  ]);
  // Re-read so the result carries its new reset marker (last_reset_at).
  return requireOpportunity(seed.id);
}

/**
 * Full reset: deletes every Opportunity and interaction, then restores every seeded
 * scenario to its baseline, in one transaction. Throws if the scenarios are not seeded.
 */
export async function resetAllScenarios(): Promise<Opportunity[]> {
  const seeded = await getScenarios();
  const missing = EXPECTED_SCENARIO_IDS.filter((id) => !seeded.some((s) => s.scenario_id === id));
  if (missing.length > 0) {
    throw new Error(`Scenario(s) ${missing.join(', ')} not seeded in Postgres. ${NOT_SEEDED_HINT}`);
  }
  // Only the demo scenarios are restored; a stale extra deal_scenarios row is not resurrected.
  const scenarios = seeded.filter((s) => EXPECTED_SCENARIO_IDS.includes(s.scenario_id));
  const now = new Date().toISOString();
  const sql = getSql();
  const [, , ...perScenario] = await sql.transaction([
    sql`DELETE FROM deal_interactions;`,
    sql`DELETE FROM opportunities;`,
    ...scenarios.flatMap((s) => [upsertBaseline(sql, s.default_data, now), resetEvent(sql, s.default_data.id, s.scenario_id)]),
  ]);
  // perScenario alternates [upsert rows, reset event] per scenario.
  return scenarios.map((_, i) => mapRowToOpportunity(perScenario[i * 2][0]));
}

/** The demo scenarios seeded in Postgres (`deal_scenarios`). */
export async function getScenarios(): Promise<DealScenario[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM deal_scenarios ORDER BY scenario_id ASC;`;
  return rows.map((r: any) => ({
    scenario_id: String(r.scenario_id),
    title: String(r.title),
    description: String(r.description),
    default_data: typeof r.default_data === 'string' ? JSON.parse(r.default_data) : r.default_data,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

export async function recordInteraction(
  interaction: Omit<DealInteraction, 'id' | 'created_at'>
): Promise<DealInteraction> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO deal_interactions (opportunity_id, actor, action, payload)
    VALUES (${interaction.opportunity_id}, ${interaction.actor}, ${interaction.action}, ${JSON.stringify(interaction.payload)}::jsonb)
    RETURNING *;
  `;
  return mapRowToInteraction(rows[0]);
}

/** The database clock, ISO. */
export async function getDatabaseNow(): Promise<string> {
  const [{ now }] = await getSql()`SELECT NOW() AS now;`;
  return new Date(now).toISOString();
}

export async function getInteractions(opportunityId: string): Promise<DealInteraction[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM deal_interactions
    WHERE opportunity_id = ${opportunityId}
    ORDER BY created_at DESC;
  `;
  return rows.map(mapRowToInteraction);
}

/** Interactions of one Assessment Session (root eve session), newest first. */
export async function getSessionInteractions(opportunityId: string, sessionId: string): Promise<DealInteraction[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM deal_interactions
    WHERE opportunity_id = ${opportunityId} AND payload->>'assessmentSessionId' = ${sessionId}
    ORDER BY created_at DESC, id DESC;
  `;
  return rows.map(mapRowToInteraction);
}

function mapRowToInteraction(r: any): DealInteraction {
  return {
    id: String(r.id),
    opportunity_id: String(r.opportunity_id),
    actor: r.actor,
    action: r.action,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    created_at: new Date(r.created_at).toISOString(),
  };
}

function mapRowToOpportunity(row: any): Opportunity {
  const breakdown = typeof row.meddpicc_breakdown === 'string'
    ? JSON.parse(row.meddpicc_breakdown)
    : (row.meddpicc_breakdown ?? {});

  return {
    id: String(row.id),
    name: String(row.name),
    account_name: String(row.account_name),
    stage_name: String(row.stage_name),
    amount: Number(row.amount),
    close_date: typeof row.close_date === 'string' ? row.close_date : new Date(row.close_date).toISOString().slice(0, 10),
    ae_name: String(row.ae_name),
    sa_name: String(row.sa_name ?? 'Unassigned'),
    ae_notes: String(row.ae_notes),
    sa_notes: String(row.sa_notes ?? ''),
    suggested_next_steps: row.suggested_next_steps ? String(row.suggested_next_steps) : null,
    qualification_status: (row.qualification_status ?? 'unqualified') as QualificationStatus,
    meddpicc_score: row.meddpicc_score !== null ? Number(row.meddpicc_score) : null,
    meddpicc_breakdown: breakdown,
    competitive_flags: Array.isArray(row.competitive_flags) ? row.competitive_flags : [],
    stage_gate: breakdown?.stageGate,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    ...(row.last_reset_at !== undefined
      ? { last_reset_at: row.last_reset_at === null ? null : new Date(row.last_reset_at).toISOString() }
      : {}),
  };
}
