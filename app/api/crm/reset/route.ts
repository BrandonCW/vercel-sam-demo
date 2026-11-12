import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifySameOrigin } from '@/lib/auth';
import { resetAllScenarios, resetCrmDatabase } from '@/lib/db/crm';

/**
 * POST { scenarioId? } restores one demo scenario to its seeded baseline.
 * POST { full: true } is the full reset: every Opportunity and interaction is
 * deleted and all seeded scenarios are restored. Blocked in production unless
 * ALLOW_FULL_CRM_RESET=true.
 */
export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: 'Cross-origin request forbidden' },
      { status: 403 }
    );
  }

  let scenarioId: string | undefined;
  let full = false;
  try {
    const rawBody = await request.text();
    if (rawBody.trim()) {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON request body' },
          { status: 400 }
        );
      }
      const record = parsed as { scenarioId?: unknown; full?: unknown };
      if (typeof record.scenarioId === 'string') {
        scenarioId = record.scenarioId;
      }
      full = record.full === true;
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }

  if (
    full &&
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_FULL_CRM_RESET !== 'true'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Full CRM reset is disabled in production.',
      },
      { status: 403 }
    );
  }

  try {
    const payload = full
      ? {
          message: 'Full reset: all demo scenarios restored',
          opportunities: await resetAllScenarios(),
        }
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
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset scenario.',
      },
      { status: 500 }
    );
  }
}
