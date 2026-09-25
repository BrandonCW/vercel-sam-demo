import { getOpportunityByScenario } from '@/lib/db/crm';
import { DEFAULT_SCENARIO_ID } from '@/lib/db/scenarios';
import { assertAiGatewayConfigured } from '@/lib/env';
import { WorkbenchShell } from '@/components/workbench/WorkbenchShell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Fail loudly at render time if the AI Gateway is not configured.
  assertAiGatewayConfigured();

  const opportunity = await getOpportunityByScenario(DEFAULT_SCENARIO_ID);
  if (!opportunity) {
    throw new Error(
      `Default scenario '${DEFAULT_SCENARIO_ID}' is not seeded in Postgres. Reset the demo or load the scenario seed data.`
    );
  }

  return <WorkbenchShell initialOpportunity={opportunity} initialScenarioId={DEFAULT_SCENARIO_ID} />;
}
