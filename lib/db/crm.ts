import { neon } from '@neondatabase/serverless';
import {
  Opportunity,
  DealScenario,
  DealInteraction,
  QualificationStatus,
  MEDDPICCBreakdown,
} from '@/lib/types/crm';
import { SCENARIO_FIXTURES, DEFAULT_SCENARIO_ID } from './fixtures';
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
  const rows = await sql`SELECT * FROM opportunities WHERE id = ${id} LIMIT 1;`;
  return rows.length > 0 ? mapRowToOpportunity(rows[0]) : null;
}

/** Like getOpportunity, but a missing record throws. */
export async function requireOpportunity(id: string): Promise<Opportunity> {
  const opportunity = await getOpportunity(id);
  if (!opportunity) throw new Error(`Opportunity "${id}" not found in CRM.`);
  return opportunity;
}

export async function getOpportunityByScenario(scenarioId: string): Promise<Opportunity | null> {
  const fixture = SCENARIO_FIXTURES[scenarioId];
  if (!fixture) return null;
  return getOpportunity(fixture.default_data.id);
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
  sa_notes: string;
  suggested_next_steps: string;
  qualification_status: QualificationStatus;
  meddpicc_score: number;
  meddpicc_breakdown: MEDDPICCBreakdown;
}

export async function writebackOpportunityQualification(
  id: string,
  writeback: QualificationWritebackData
): Promise<Opportunity> {
  const now = new Date().toISOString();
  const sql = getSql();
  // Updates ONLY the designated writeback fields; ae_notes and others are untouched.
  const rows = await sql`
    UPDATE opportunities SET
      sa_notes = ${writeback.sa_notes},
      suggested_next_steps = ${writeback.suggested_next_steps},
      qualification_status = ${writeback.qualification_status},
      meddpicc_score = ${writeback.meddpicc_score},
      meddpicc_breakdown = ${JSON.stringify(writeback.meddpicc_breakdown)}::jsonb,
      updated_at = ${now}
    WHERE id = ${id} AND ae_notes = ${writeback.expectedAeNotes}
    RETURNING *;
  `;
  if (rows.length === 0) {
    const existing = await getOpportunity(id);
    if (!existing) throw new Error(`Opportunity ${id} not found`);
    throw new Error(`Writeback to ${id} rejected: ae_notes changed since it was read; ae_notes is immutable.`);
  }
  return mapRowToOpportunity(rows[0]);
}

export async function resetCrmDatabase(scenarioId?: string): Promise<Opportunity> {
  const targetScenarioId = scenarioId ?? DEFAULT_SCENARIO_ID;
  const fixture = SCENARIO_FIXTURES[targetScenarioId];
  if (!fixture) throw new Error(`Unknown scenario '${targetScenarioId}'`);
  const now = new Date().toISOString();
  const sql = getSql();
  const seed = fixture.default_data;

  // One transaction: the upsert, telemetry purge and reset event land together or not at all.
  const [rows] = await sql.transaction([
    sql`
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
  `,
    sql`DELETE FROM deal_interactions WHERE opportunity_id = ${seed.id};`,
    sql`
    INSERT INTO deal_interactions (opportunity_id, actor, action, payload, created_at)
    VALUES (${seed.id}, 'sa_user', 'reset', ${JSON.stringify({ scenarioId: targetScenarioId })}::jsonb, ${now});
  `,
  ]);

  return mapRowToOpportunity(rows[0]);
}

export async function getScenarios(): Promise<DealScenario[]> {
  return Object.values(SCENARIO_FIXTURES);
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

export async function getInteractions(opportunityId: string): Promise<DealInteraction[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM deal_interactions
    WHERE opportunity_id = ${opportunityId}
    ORDER BY created_at DESC;
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
  };
}
