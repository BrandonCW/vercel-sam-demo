import { neon } from '@neondatabase/serverless';
import {
  Opportunity,
  DealScenario,
  DealInteraction,
  QualificationStatus,
  MEDDPICCBreakdown,
} from '@/lib/types/crm';
import { SCENARIO_FIXTURES, DEFAULT_SCENARIO_ID } from './fixtures';

// --- In-Memory State Fallback ---
interface InMemoryStore {
  opportunities: Map<string, Opportunity>;
  scenarios: Map<string, DealScenario>;
  interactions: DealInteraction[];
  scenarioToOppMap: Map<string, string>;
}

function createDefaultInMemoryStore(): InMemoryStore {
  const store: InMemoryStore = {
    opportunities: new Map(),
    scenarios: new Map(),
    interactions: [],
    scenarioToOppMap: new Map(),
  };

  const now = new Date().toISOString();

  for (const [scenarioId, scenario] of Object.entries(SCENARIO_FIXTURES)) {
    store.scenarios.set(scenarioId, { ...scenario });
    const opp: Opportunity = {
      ...scenario.default_data,
      created_at: now,
      updated_at: now,
    };
    store.opportunities.set(opp.id, opp);
    store.scenarioToOppMap.set(scenarioId, opp.id);
  }

  return store;
}

// Global in-memory singleton for serverless dev / tests
declare global {
  // eslint-disable-next-line no-var
  var __deal_qual_in_memory_store: InMemoryStore | undefined;
}

function getInMemoryStore(): InMemoryStore {
  if (!global.__deal_qual_in_memory_store) {
    global.__deal_qual_in_memory_store = createDefaultInMemoryStore();
  }
  return global.__deal_qual_in_memory_store;
}

export function isUsingPostgres(): boolean {
  return Boolean(process.env.POSTGRES_URL && process.env.POSTGRES_URL.trim() !== '');
}

function getSql() {
  if (!isUsingPostgres()) return null;
  return neon(process.env.POSTGRES_URL!);
}

let pgTablesInitialized = false;

async function ensurePostgresTables() {
  const sql = getSql();
  if (!sql || pgTablesInitialized) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS opportunities (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT NOT NULL,
        account_name TEXT NOT NULL,
        stage_name TEXT NOT NULL,
        amount NUMERIC(12, 2) DEFAULT 0.00,
        close_date DATE NOT NULL,
        ae_name TEXT NOT NULL,
        ae_notes TEXT NOT NULL,
        sa_notes TEXT DEFAULT '',
        suggested_next_steps TEXT DEFAULT NULL,
        qualification_status VARCHAR(32) NOT NULL DEFAULT 'unqualified',
        meddpicc_score INTEGER DEFAULT NULL,
        meddpicc_breakdown JSONB DEFAULT '{}'::jsonb,
        competitive_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS deal_scenarios (
        scenario_id VARCHAR(64) PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        default_data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS deal_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        opportunity_id VARCHAR(64) NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        actor VARCHAR(32) NOT NULL,
        action VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    // Seed scenarios if empty
    const existing = await sql`SELECT scenario_id FROM deal_scenarios LIMIT 1;`;
    if (existing.length === 0) {
      for (const [id, s] of Object.entries(SCENARIO_FIXTURES)) {
        await sql`
          INSERT INTO deal_scenarios (scenario_id, title, description, default_data)
          VALUES (${id}, ${s.title}, ${s.description}, ${JSON.stringify(s.default_data)}::jsonb)
          ON CONFLICT (scenario_id) DO NOTHING;
        `;
        const d = s.default_data;
        await sql`
          INSERT INTO opportunities (
            id, name, account_name, stage_name, amount, close_date,
            ae_name, ae_notes, sa_notes, suggested_next_steps,
            qualification_status, meddpicc_score, meddpicc_breakdown, competitive_flags
          ) VALUES (
            ${d.id}, ${d.name}, ${d.account_name}, ${d.stage_name}, ${d.amount}, ${d.close_date},
            ${d.ae_name}, ${d.ae_notes}, ${d.sa_notes}, ${d.suggested_next_steps},
            ${d.qualification_status}, ${d.meddpicc_score}, ${JSON.stringify(d.meddpicc_breakdown)}::jsonb,
            ${d.competitive_flags}
          ) ON CONFLICT (id) DO NOTHING;
        `;
      }
    }

    pgTablesInitialized = true;
  } catch (err) {
    console.warn('Postgres connection/table check failed, falling back to in-memory:', err);
  }
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  if (isUsingPostgres()) {
    try {
      await ensurePostgresTables();
      const sql = getSql()!;
      const rows = await sql`SELECT * FROM opportunities WHERE id = ${id} LIMIT 1;`;
      if (rows.length > 0) {
        return mapRowToOpportunity(rows[0]);
      }
    } catch (e) {
      console.warn('Postgres getOpportunity failed, using in-memory:', e);
    }
  }

  const store = getInMemoryStore();
  return store.opportunities.get(id) || null;
}

export async function getOpportunityByScenario(scenarioId: string): Promise<Opportunity | null> {
  const fixture = SCENARIO_FIXTURES[scenarioId] || SCENARIO_FIXTURES[DEFAULT_SCENARIO_ID];
  if (!fixture) return null;

  return getOpportunity(fixture.default_data.id);
}

export async function listOpportunities(): Promise<Opportunity[]> {
  if (isUsingPostgres()) {
    try {
      await ensurePostgresTables();
      const sql = getSql()!;
      const rows = await sql`SELECT * FROM opportunities ORDER BY created_at ASC;`;
      if (rows.length > 0) {
        return rows.map(mapRowToOpportunity);
      }
    } catch (e) {
      console.warn('Postgres listOpportunities failed, using in-memory:', e);
    }
  }

  const store = getInMemoryStore();
  return Array.from(store.opportunities.values());
}

export async function updateOpportunity(
  id: string,
  updates: Partial<Opportunity>
): Promise<Opportunity> {
  const now = new Date().toISOString();

  if (isUsingPostgres()) {
    try {
      await ensurePostgresTables();
      const sql = getSql()!;
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
    } catch (e) {
      console.warn('Postgres updateOpportunity failed, updating in-memory:', e);
    }
  }

  const store = getInMemoryStore();
  const existing = store.opportunities.get(id);
  if (!existing) {
    throw new Error(`Opportunity ${id} not found in store`);
  }

  const updated: Opportunity = {
    ...existing,
    ...updates,
    updated_at: now,
  };
  store.opportunities.set(id, updated);
  return updated;
}

export async function resetCrmDatabase(scenarioId?: string): Promise<Opportunity> {
  const targetScenarioId = scenarioId && SCENARIO_FIXTURES[scenarioId]
    ? scenarioId
    : DEFAULT_SCENARIO_ID;
  const fixture = SCENARIO_FIXTURES[targetScenarioId];
  const now = new Date().toISOString();

  if (isUsingPostgres()) {
    try {
      await ensurePostgresTables();
      const sql = getSql()!;
      const d = fixture.default_data;

      // Re-seed default opportunity
      await sql`
        INSERT INTO opportunities (
          id, name, account_name, stage_name, amount, close_date,
          ae_name, ae_notes, sa_notes, suggested_next_steps,
          qualification_status, meddpicc_score, meddpicc_breakdown, competitive_flags,
          created_at, updated_at
        ) VALUES (
          ${d.id}, ${d.name}, ${d.account_name}, ${d.stage_name}, ${d.amount}, ${d.close_date},
          ${d.ae_name}, ${d.ae_notes}, ${d.sa_notes}, ${null},
          'unqualified', ${null}, ${JSON.stringify(d.meddpicc_breakdown)}::jsonb, ${d.competitive_flags},
          ${now}, ${now}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          account_name = EXCLUDED.account_name,
          stage_name = EXCLUDED.stage_name,
          amount = EXCLUDED.amount,
          close_date = EXCLUDED.close_date,
          ae_name = EXCLUDED.ae_name,
          ae_notes = EXCLUDED.ae_notes,
          sa_notes = EXCLUDED.sa_notes,
          suggested_next_steps = NULL,
          qualification_status = 'unqualified',
          meddpicc_score = NULL,
          meddpicc_breakdown = EXCLUDED.meddpicc_breakdown,
          competitive_flags = EXCLUDED.competitive_flags,
          updated_at = ${now};
      `;

      // Clear interactions for this opportunity
      await sql`DELETE FROM deal_interactions WHERE opportunity_id = ${d.id};`;

      // Record reset interaction
      await sql`
        INSERT INTO deal_interactions (opportunity_id, actor, action, payload, created_at)
        VALUES (${d.id}, 'sa_user', 'reset', ${JSON.stringify({ scenarioId: targetScenarioId })}::jsonb, ${now});
      `;

      return {
        ...d,
        suggested_next_steps: null,
        qualification_status: 'unqualified',
        meddpicc_score: null,
        created_at: now,
        updated_at: now,
      };
    } catch (e) {
      console.warn('Postgres resetCrmDatabase failed, resetting in-memory:', e);
    }
  }

  // In-memory reset
  const store = getInMemoryStore();
  const resetOpp: Opportunity = {
    ...fixture.default_data,
    suggested_next_steps: null,
    qualification_status: 'unqualified',
    meddpicc_score: null,
    created_at: now,
    updated_at: now,
  };
  store.opportunities.set(resetOpp.id, resetOpp);
  store.interactions = store.interactions.filter((i) => i.opportunity_id !== resetOpp.id);
  store.interactions.push({
    id: `interaction_${Date.now()}`,
    opportunity_id: resetOpp.id,
    actor: 'sa_user',
    action: 'reset',
    payload: { scenarioId: targetScenarioId },
    created_at: now,
  });

  return resetOpp;
}

export async function getScenarios(): Promise<DealScenario[]> {
  return Object.values(SCENARIO_FIXTURES);
}

export async function recordInteraction(
  interaction: Omit<DealInteraction, 'id' | 'created_at'>
): Promise<DealInteraction> {
  const now = new Date().toISOString();
  const full: DealInteraction = {
    ...interaction,
    id: `interaction_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: now,
  };

  if (isUsingPostgres()) {
    try {
      await ensurePostgresTables();
      const sql = getSql()!;
      await sql`
        INSERT INTO deal_interactions (opportunity_id, actor, action, payload, created_at)
        VALUES (${full.opportunity_id}, ${full.actor}, ${full.action}, ${JSON.stringify(full.payload)}::jsonb, ${now});
      `;
      return full;
    } catch (e) {
      console.warn('Postgres recordInteraction failed, recording in-memory:', e);
    }
  }

  const store = getInMemoryStore();
  store.interactions.push(full);
  return full;
}

export async function getInteractions(opportunityId: string): Promise<DealInteraction[]> {
  if (isUsingPostgres()) {
    try {
      await ensurePostgresTables();
      const sql = getSql()!;
      const rows = await sql`
        SELECT * FROM deal_interactions
        WHERE opportunity_id = ${opportunityId}
        ORDER BY created_at DESC;
      `;
      return rows.map((r: any) => ({
        id: String(r.id),
        opportunity_id: String(r.opportunity_id),
        actor: r.actor,
        action: r.action,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
        created_at: new Date(r.created_at).toISOString(),
      }));
    } catch (e) {
      console.warn('Postgres getInteractions failed, reading from in-memory:', e);
    }
  }

  const store = getInMemoryStore();
  return store.interactions
    .filter((i) => i.opportunity_id === opportunityId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function mapRowToOpportunity(row: any): Opportunity {
  return {
    id: String(row.id),
    name: String(row.name),
    account_name: String(row.account_name),
    stage_name: String(row.stage_name),
    amount: Number(row.amount),
    close_date: typeof row.close_date === 'string' ? row.close_date : new Date(row.close_date).toISOString().slice(0, 10),
    ae_name: String(row.ae_name),
    ae_notes: String(row.ae_notes),
    sa_notes: String(row.sa_notes ?? ''),
    suggested_next_steps: row.suggested_next_steps ? String(row.suggested_next_steps) : null,
    qualification_status: (row.qualification_status ?? 'unqualified') as QualificationStatus,
    meddpicc_score: row.meddpicc_score !== null ? Number(row.meddpicc_score) : null,
    meddpicc_breakdown: typeof row.meddpicc_breakdown === 'string'
      ? JSON.parse(row.meddpicc_breakdown)
      : (row.meddpicc_breakdown ?? {}),
    competitive_flags: Array.isArray(row.competitive_flags) ? row.competitive_flags : [],
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}
