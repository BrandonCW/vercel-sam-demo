import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { resetCrmDatabase } from '@/lib/db/crm';

export async function POST(request: Request) {
  try {
    let scenarioId: string | undefined;
    try {
      const body = await request.json();
      scenarioId = body?.scenarioId;
    } catch {
      // Body may be empty
    }

    const resetOpp = await resetCrmDatabase(scenarioId);
    try {
      revalidatePath('/');
    } catch {
      // Ignore during unit tests without Next.js server context
    }

    return NextResponse.json({
      success: true,
      message: `Scenario ${scenarioId || 'default'} reset successfully`,
      opportunity: resetOpp,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reset scenario', details: String(error) },
      { status: 500 }
    );
  }
}
