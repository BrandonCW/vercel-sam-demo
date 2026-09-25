// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { saFeedbackKey } from '@/lib/agents/feedback-schema';

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
