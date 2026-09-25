import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { resetAllScenarios, resetCrmDatabase } from '@/lib/db/crm';

/**
 * POST { scenarioId? } restores one demo scenario to its seeded baseline.
 * POST { full: true } is the full reset: every Opportunity and interaction is
 * deleted and all seeded scenarios are restored.
 */
export async function POST(request: Request) {
  try {
    let scenarioId: string | undefined;
    let full = false;
    try {
      const body = await request.json();
      scenarioId = body?.scenarioId;
      full = body?.full === true;
    } catch {
      // Body may be empty
    }

    const payload = full
      ? { message: 'Full reset: all demo scenarios restored', opportunities: await resetAllScenarios() }
      : {
          message: `Scenario ${scenarioId || 'default'} reset successfully`,
          opportunity: await resetCrmDatabase(scenarioId),
        };
    try {
      revalidatePath('/');
    } catch {
      // Ignore during unit tests without Next.js server context
    }

    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to reset scenario: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
