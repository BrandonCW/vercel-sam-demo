import { getOpportunityByScenario } from '@/lib/db/crm';
import { DEFAULT_SCENARIO_ID, DEMO_SCENARIOS } from '@/lib/db/scenarios';
import { QualificationWorkbench } from '@/components/workbench/QualificationWorkbench';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let opportunity = null;
  try {
    opportunity = await getOpportunityByScenario(DEFAULT_SCENARIO_ID);
  } catch {
    // If DB is offline or not configured, fall back to default demo data for simulation
  }

  if (!opportunity) {
    opportunity = DEMO_SCENARIOS[DEFAULT_SCENARIO_ID]?.default_data as any;
  }

  return (
    <QualificationWorkbench
      initialOpportunity={opportunity}
      initialScenarioId={DEFAULT_SCENARIO_ID}
    />
  );
}
