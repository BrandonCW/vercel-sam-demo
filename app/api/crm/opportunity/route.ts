import { NextResponse } from 'next/server';
import { getOpportunityByScenario, getOpportunity } from '@/lib/db/crm';
import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from '@/lib/db/scenarios';
import type { Opportunity } from '@/lib/types/crm';

function toFallbackOpportunity(scenarioId: string): Opportunity | null {
  const scenario = DEMO_SCENARIOS[scenarioId];
  if (!scenario) return null;
  return {
    ...scenario.default_data,
    created_at: scenario.created_at,
    updated_at: scenario.created_at,
  };
}

function findFallbackOpportunityById(opportunityId: string): Opportunity | null {
  const scenario = Object.values(DEMO_SCENARIOS).find(
    (entry) => entry.default_data.id === opportunityId
  );
  if (!scenario) return null;
  return {
    ...scenario.default_data,
    created_at: scenario.created_at,
    updated_at: scenario.created_at,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get('scenarioId');
  const oppId = searchParams.get('id');
  const hasPostgresConfigured = Boolean(process.env.POSTGRES_URL?.trim());

  if (oppId) {
    if (hasPostgresConfigured) {
      try {
        const opp = await getOpportunity(oppId);
        if (!opp) {
          return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
        }
        return NextResponse.json(opp);
      } catch {
        // Fall through to seeded scenario fallback when DB is unreachable
      }
    }
    const fallbackOpp = findFallbackOpportunityById(oppId);
    if (!fallbackOpp) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    return NextResponse.json(fallbackOpp);
  }

  const targetScenario = scenarioId || DEFAULT_SCENARIO_ID;
  if (hasPostgresConfigured) {
    try {
      const opp = await getOpportunityByScenario(targetScenario);
      if (!opp) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      return NextResponse.json(opp);
    } catch {
      // Fall through to seeded scenario fallback when DB is unreachable
    }
  }

  const fallbackOpp = toFallbackOpportunity(targetScenario);
  if (!fallbackOpp) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  }
  return NextResponse.json(fallbackOpp);
}
