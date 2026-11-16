import { getOpportunityByScenario } from '@/lib/db/crm';
import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from '@/lib/db/scenarios';
import type { Opportunity } from '@/lib/types/crm';
import type { WorkbenchMode } from '@/lib/simulation/types';
import { QualificationWorkbench } from '@/components/workbench/QualificationWorkbench';

export const dynamic = 'force-dynamic';

const SCENARIO_ALIASES: Record<string, string> = {
  acme: 'scenario_acme_netlify',
  globex: 'scenario_globex_amplify',
  soylent: 'scenario_soylent_headless',
};

function resolveScenarioId(rawScenario?: string): string {
  if (!rawScenario) return DEFAULT_SCENARIO_ID;
  const trimmed = rawScenario.trim();
  if (trimmed in DEMO_SCENARIOS) return trimmed;
  const aliased = SCENARIO_ALIASES[trimmed.toLowerCase()];
  if (aliased && aliased in DEMO_SCENARIOS) return aliased;
  return DEFAULT_SCENARIO_ID;
}

interface HomePageProps {
  searchParams?: Promise<{ scenario?: string; mode?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const resolvedScenarioId = resolveScenarioId(params?.scenario);
  const initialMode: WorkbenchMode = params?.mode === 'live' ? 'live' : 'simulation';

  let opportunity: Opportunity | null = null;
  let fetchedFromDb = false;

  // Only block SSR on Postgres when booting directly in Live mode; Simulation mode renders immediately from deterministic scenario data.
  if (initialMode === 'live' && process.env.POSTGRES_URL?.trim()) {
    try {
      opportunity = await getOpportunityByScenario(resolvedScenarioId);
      fetchedFromDb = Boolean(opportunity);
    } catch {
      // If DB is offline or not configured, fall back to scenario data
    }
  }

  if (!opportunity) {
    const scenario = DEMO_SCENARIOS[resolvedScenarioId];
    opportunity = {
      ...scenario.default_data,
      created_at: scenario.created_at,
      updated_at: scenario.created_at,
    };
  }

  return (
    <QualificationWorkbench
      initialOpportunity={opportunity}
      initialScenarioId={resolvedScenarioId}
      initialMode={initialMode}
      initialOpportunityFromDb={fetchedFromDb}
    />
  );
}
