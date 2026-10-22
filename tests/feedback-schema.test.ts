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

  it('resolves human-readable field labels and choice option labels when phase3Form is provided', () => {
    const form = {
      sections: [
        {
          id: 'section_blockers',
          title: 'Stage Gate Blockers',
          fields: [
            {
              id: 'eb_sponsorship',
              name: 'eb_sponsorship',
              label: 'Did Jane Doe (VP Engineering) formally confirm sponsorship?',
              type: 'radio' as const,
              required: true,
              options: [
                {
                  label: 'Confirmed sponsorship if build times drop <5 min',
                  value: 'confirmed_sponsorship',
                },
                { label: 'Meeting pending', value: 'meeting_pending' },
              ],
            },
            {
              id: 'technical_criteria',
              name: 'technical_criteria',
              label: 'Confirmed technical decision criteria:',
              type: 'checkbox_group' as const,
              required: true,
              options: [
                {
                  label: 'Build speed <5m + Turborepo caching + ISR',
                  value: 'build_speed_and_isr',
                },
                {
                  label: 'Dedicated static egress IPs',
                  value: 'static_egress_ips',
                },
              ],
            },
            {
              id: 'free_text_follow_up',
              name: 'free_text_follow_up',
              label: 'What is the procurement review SLA?',
              type: 'text' as const,
              required: false,
            },
          ],
        },
      ],
    };

    const block = formatSaDiscoveryDelta(
      {
        eb_sponsorship: 'confirmed_sponsorship',
        technical_criteria: ['build_speed_and_isr', 'static_egress_ips'],
        free_text_follow_up: '10 business days via legal desk',
      },
      'VP Eng joining architecture session Oct 12.',
      '2026-10-01T12:05:00.000Z',
      form
    );

    expect(block).toBe(
      '[SA Discovery Update - 2026-10-01T12:05:00.000Z]\n' +
        '• Did Jane Doe (VP Engineering) formally confirm sponsorship?: Confirmed sponsorship if build times drop <5 min\n' +
        '• Confirmed technical decision criteria: Build speed <5m + Turborepo caching + ISR, Dedicated static egress IPs\n' +
        '• What is the procurement review SLA?: 10 business days via legal desk\n' +
        '• Additional SA Notes: VP Eng joining architecture session Oct 12.'
    );
    expect(block).not.toContain('eb_sponsorship');
    expect(block).not.toContain('confirmed_sponsorship');
    expect(block).not.toContain('technical_criteria');
    expect(block).not.toContain('build_speed_and_isr');
  });
});
