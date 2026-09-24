import { NextResponse } from 'next/server';
import { getOpportunityByScenario, getOpportunity } from '@/lib/db/crm';
import { DEFAULT_SCENARIO_ID } from '@/lib/db/fixtures';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get('scenarioId');
  const oppId = searchParams.get('id');

  if (oppId) {
    const opp = await getOpportunity(oppId);
    if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    return NextResponse.json(opp);
  }

  const targetScenario = scenarioId || DEFAULT_SCENARIO_ID;
  const opp = await getOpportunityByScenario(targetScenario);
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });

  return NextResponse.json(opp);
}
