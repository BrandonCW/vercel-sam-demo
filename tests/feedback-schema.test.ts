// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { formatSaDiscoveryDelta, saFeedbackKey } from '@/lib/agents/feedback-schema';

// The workbench computes the key in the browser and record_sa_feedback recomputes it on the
// server, so both must agree: SHA-256 of the canonical answers, via Web Crypto.
describe('saFeedbackKey (browser-safe idempotency key for one SA submission)', () => {
  it('is the SHA-256 of the canonical answers, independent of key order and notes whitespace', async () => {
    const expected = '3f65ec264c72fd245db8587dc55a8c3f5a2df3101ef414600e4d5ff66e996607';
    await expect(saFeedbackKey({ a: '1', b: ['x'] }, ' n ')).resolves.toBe(expected);
    await expect(saFeedbackKey({ b: ['x'], a: '1' }, 'n')).resolves.toBe(expected);
  });

  it('differs when the answers differ', async () => {
    expect(await saFeedbackKey({ a: '1' })).not.toBe(await saFeedbackKey({ a: '2' }));
  });
});

// The block record_sa_feedback appends to SA Notes (never AE Notes).
describe('formatSaDiscoveryDelta', () => {
  it('formats one timestamped discovery update block', () => {
    const block = formatSaDiscoveryDelta(
      {
        eb_authority: 'Verified signoff authority up to $250k with VP of E-Commerce Marcus Vance.',
        cache_strategy: ['ISR', 'Edge Middleware'],
      },
      'Customer confirmed Netlify renewal deadline is hard Oct 31.',
      '2026-09-25T00:00:00.000Z'
    );
    expect(block).toBe(
      '[SA Discovery Update - 2026-09-25T00:00:00.000Z]\n' +
        '• eb_authority: Verified signoff authority up to $250k with VP of E-Commerce Marcus Vance.\n' +
        '• cache_strategy: ISR, Edge Middleware\n' +
        '• Additional SA Notes: Customer confirmed Netlify renewal deadline is hard Oct 31.'
    );
  });

  it('omits the notes line when there is no notesDelta', () => {
    expect(formatSaDiscoveryDelta({ pain_quant: '45-minute blocking' }, undefined, 'T')).toBe(
      '[SA Discovery Update - T]\n• pain_quant: 45-minute blocking'
    );
  });
});
