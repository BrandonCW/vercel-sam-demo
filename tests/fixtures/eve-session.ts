import type { AssessmentScope } from '@/lib/assessment-session';

/** Minimal eve tool ctx for a root-agent tool call in `sessionId`, turn `turnId`. */
export function rootCtx(sessionId: string, turnId: string): any {
  return { session: { id: sessionId, turn: { id: turnId, sequence: 1 } } };
}

export function scope(sessionId: string, turnId: string): AssessmentScope {
  return { sessionId, turnId };
}

/**
 * Runs an eve tool the way eve does: a plain executor's return is the result; an async-generator
 * executor's earlier yields are `action.partial` snapshots and its last yield is the result.
 * `onYield` sees every yielded value as it arrives, before the generator resumes (so before any
 * code that follows the yield has run).
 */
export async function runTool(
  tool: { execute?: (...args: any[]) => any },
  input: unknown,
  ctx: unknown,
  onYield: (value: any) => void | Promise<void> = () => {}
): Promise<{ partials: any[]; result: any }> {
  const out = await tool.execute!(input, ctx);
  if (!out || typeof out[Symbol.asyncIterator] !== 'function') return { partials: [], result: out };
  const yields: any[] = [];
  for await (const value of out as AsyncIterable<any>) {
    yields.push(value);
    await onYield(value);
  }
  if (!yields.length) throw new Error('The tool generator yielded no result.');
  return { partials: yields.slice(0, -1), result: yields[yields.length - 1] };
}
