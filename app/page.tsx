import { getOpportunityByScenario } from '@/lib/db/crm';
import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from '@/lib/db/scenarios';
import type { Opportunity } from '@/lib/types/crm';
import { QualificationWorkbench } from '@/components/workbench/QualificationWorkbench';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let opportunity: Opportunity | null = null;
  if (process.env.POSTGRES_URL?.trim()) {
    try {
      opportunity = await getOpportunityByScenario(DEFAULT_SCENARIO_ID);
    } catch {
      // If DB is offline or not configured, fall back to default scenario data
    }
  }

  if (!opportunity) {
    const scenario = DEMO_SCENARIOS[DEFAULT_SCENARIO_ID];
    opportunity = {
      ...scenario.default_data,
      created_at: scenario.created_at,
      updated_at: scenario.created_at,
    };
  }

  return (
    <QualificationWorkbench
      initialOpportunity={opportunity}
      initialScenarioId={DEFAULT_SCENARIO_ID}
    />
  );
}
