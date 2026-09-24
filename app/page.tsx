import { getOpportunityByScenario, isUsingPostgres } from '@/lib/db/crm';
import { DEFAULT_SCENARIO_ID, SCENARIO_FIXTURES } from '@/lib/db/fixtures';
import { WorkbenchShell } from '@/components/workbench/WorkbenchShell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const isPostgres = isUsingPostgres();
  let opportunity = await getOpportunityByScenario(DEFAULT_SCENARIO_ID);

  if (!opportunity) {
    const fallbackFixture = SCENARIO_FIXTURES[DEFAULT_SCENARIO_ID];
    const now = new Date().toISOString();
    opportunity = {
      ...fallbackFixture.default_data,
      created_at: now,
      updated_at: now,
    };
  }

  const hasAiGateway = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_TOKEN);
  const hasDirectKeys = Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );

  return (
    <WorkbenchShell
      initialOpportunity={opportunity}
      initialScenarioId={DEFAULT_SCENARIO_ID}
      isPostgres={isPostgres}
      aiStatus={{
        hasAiGateway,
        hasDirectKeys,
      }}
    />
  );
}
