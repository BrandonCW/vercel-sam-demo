import { describe, it, expect } from 'vitest';
import {
  decideQualificationStatus,
  synthesizeSuggestedNextSteps,
  mergeSystem2Findings,
} from '@/lib/agents/qualification-decision';
import { jev, system2 } from './fixtures/qualification';

const CONTRACT = /^\[(QUALIFIED|IN REVIEW|DISQUALIFIED)\] ([^|]+) \| Owner: ([^|]+) \| Focus: ([^|]+) \| Watch: ([^|]+)$/;

describe('decideQualificationStatus', () => {
  it('disqualifies when System 2 reports a fatal blocker, even if the gate is ready', () => {
    const ready = jev({ stageGate: { ...jev().stageGate, gateReady: true, gateBlockers: [], blockingDimensions: [] } });
    expect(decideQualificationStatus(ready, system2({ fatalBlocker: 'Strict on-premise mandate' }))).toBe('disqualified');
  });

  it('qualifies when the stage gate is ready and nothing is fatal', () => {
    const ready = jev({ stageGate: { ...jev().stageGate, gateReady: true, gateBlockers: [], blockingDimensions: [] } });
    expect(decideQualificationStatus(ready, system2())).toBe('qualified');
  });

  it('keeps the deal in review while the gate is blocked', () => {
    expect(decideQualificationStatus(jev(), system2())).toBe('in_review');
  });
});

describe('synthesizeSuggestedNextSteps', () => {
  it('holds a blocked deal with the AE owning an Economic Buyer blocker and watches the highest threat', () => {
    const text = synthesizeSuggestedNextSteps('in_review', jev(), system2());
    expect(text).toMatch(CONTRACT);
    expect(text).toBe(
      '[IN REVIEW] Hold at Stage 2 - Discovery. Clear gate blocker: Economic Buyer is not verified in discovery notes (score: 3/10, minimum 4/10 required) | Owner: AE | Focus: Turborepo Remote Caching & ISR | Watch: Netlify (high threat)'
    );
  });

  it('gives a joint AE-led owner when the blockers do not involve the Economic Buyer', () => {
    const gate = { ...jev().stageGate, gateBlockers: ['Champion score is 4/10'], blockingDimensions: ['champion'] };
    const text = synthesizeSuggestedNextSteps('in_review', jev({ stageGate: gate }), system2());
    expect(text).toContain('| Owner: AE (Lead) + SA |');
  });

  it('advances a qualified deal with the System 2 milestone, SA leading', () => {
    const gate = { ...jev().stageGate, gateReady: true, gateBlockers: [], blockingDimensions: [] };
    const text = synthesizeSuggestedNextSteps('qualified', jev({ stageGate: gate, competitiveFlags: [] }), system2());
    expect(text).toBe(
      '[QUALIFIED] Advance to Stage 3 - Technical Validation. Run a 2-week POC on Vercel Enterprise. | Owner: SA (Lead) + AE | Focus: Turborepo Remote Caching & ISR | Watch: Budget freeze before Q4'
    );
  });

  it('archives a disqualified deal citing the fatal blocker, and strips pipes from model text', () => {
    const text = synthesizeSuggestedNextSteps(
      'disqualified',
      jev(),
      system2({ fatalBlocker: 'On-prem | air-gapped mandate' })
    );
    expect(text).toMatch(CONTRACT);
    expect(text.startsWith('[DISQUALIFIED] Archive opportunity. On-prem / air-gapped mandate | Owner: AE |')).toBe(true);
  });
});

describe('mergeSystem2Findings', () => {
  it('attaches System 2 citations and gaps to each Jev dimension for the rubric UI', () => {
    const breakdown = mergeSystem2Findings(jev(), system2());
    expect(breakdown.economicBuyer).toMatchObject({
      score: 3,
      evidence: ['VP of E-Commerce mentioned budget'],
      gaps: ['No confirmed sign-off authority'],
    });
    expect(breakdown.metrics).toMatchObject({ score: 6, evidence: [], gaps: [] });
    expect(breakdown.stageGate).toEqual(jev().stageGate);
  });
});
