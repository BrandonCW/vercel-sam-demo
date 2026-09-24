import { describe, it, expect } from 'vitest';
import { runSystem2Analysis } from '@/lib/agents/system2-runner';
import type { JevScoringResult } from '@/lib/agents/jev-schema';

// Live System 2 coverage (real AI Gateway) lands with the eve evals in issue 10.
describe('System 2 runner fails loudly', () => {
  it('throws instead of returning canned output when AI_GATEWAY_API_KEY is unset', async () => {
    const saved = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      await expect(
        runSystem2Analysis({
          opportunity: {
            id: 'opp_x',
            name: 'X',
            stageName: 'Stage 2 - Discovery',
            amount: 1,
            aeNotes: 'notes',
            saNotes: '',
          },
          jevResult: {} as JevScoringResult,
        })
      ).rejects.toThrow(/AI_GATEWAY_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.AI_GATEWAY_API_KEY = saved;
    }
  });
});
