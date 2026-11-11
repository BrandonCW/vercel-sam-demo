import { describe, it, expect } from 'vitest';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import globexFixtureRaw from '@/lib/fixtures/simulation/globex_amplify.json';
import soylentFixtureRaw from '@/lib/fixtures/simulation/soylent_retail.json';
import { CANONICAL_DIMENSIONS, computeCompositeScore, getDimensionStatus } from '@/lib/agents/jev-scorer';
import { SimulationFixtureSchema, type SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
  simulationReducer,
} from '@/lib/simulation/simulation-engine';

describe('Simulation Engine & Fixture Math Invariants', () => {
  const fixture = acmeFixtureRaw as SimulationFixture;
  const allFixtures: Array<{ name: string; fixture: SimulationFixture; expectedBaseline: number; expectedFinal: number }> = [
    { name: 'Acme Corp', fixture: acmeFixtureRaw as SimulationFixture, expectedBaseline: 58, expectedFinal: 76 },
    { name: 'Globex FinTech', fixture: globexFixtureRaw as SimulationFixture, expectedBaseline: 56, expectedFinal: 80 },
    { name: 'Soylent Retail', fixture: soylentFixtureRaw as SimulationFixture, expectedBaseline: 64, expectedFinal: 82 },
  ];

  describe('Fixture Schema & Weighted-Sum Invariants Across All 3 Scenarios', () => {
    it.each(allFixtures)(
      'validates $name against SimulationFixtureSchema with exact weighted overallScore and delta',
      ({ fixture: fx, expectedBaseline, expectedFinal }) => {
        const parsed = SimulationFixtureSchema.safeParse(fx);
        expect(parsed.success).toBe(true);

        const baseScores = Object.fromEntries(
          Object.entries(fx.baseline.jevResult.dimensions).map(([k, d]) => [k, d.score])
        ) as Record<keyof typeof CANONICAL_DIMENSIONS, number>;
        const rescoreScores = Object.fromEntries(
          Object.entries(fx.feedback.rescoreJevResult.dimensions).map(([k, d]) => [k, d.score])
        ) as Record<keyof typeof CANONICAL_DIMENSIONS, number>;

        const computedBaseline = computeCompositeScore(baseScores);
        const computedFinal = computeCompositeScore(rescoreScores);

        expect(computedBaseline).toBe(expectedBaseline);
        expect(computedFinal).toBe(expectedFinal);

        expect(fx.opportunity.meddpicc_score).toBe(computedBaseline);
        expect(fx.baseline.jevResult.overallScore).toBe(computedBaseline);
        expect(fx.feedback.rescoreJevResult.overallScore).toBe(computedFinal);
        expect(fx.verdict.baselineScore).toBe(computedBaseline);
        expect(fx.verdict.finalScore).toBe(computedFinal);
        expect(fx.verdict.delta).toBe(computedFinal - computedBaseline);
        expect(fx.verdict.opportunity.meddpicc_score).toBe(computedFinal);

        for (const [key, dim] of Object.entries(fx.baseline.jevResult.dimensions)) {
          expect(dim.weight).toBe(CANONICAL_DIMENSIONS[key as keyof typeof CANONICAL_DIMENSIONS].weight);
          expect(dim.status).toBe(getDimensionStatus(dim.score));
        }
        for (const [key, dim] of Object.entries(fx.feedback.rescoreJevResult.dimensions)) {
          expect(dim.weight).toBe(CANONICAL_DIMENSIONS[key as keyof typeof CANONICAL_DIMENSIONS].weight);
          expect(dim.status).toBe(getDimensionStatus(dim.score));
        }
      }
    );

    it('aligns Acme Corp sa_name to David Kross and paperProcess baseline (4/10 -> partial, non-blocker) so blocker count matches 2 Stage 2 questions', () => {
      expect(fixture.opportunity.sa_name).toBe('David Kross');
      expect(fixture.verdict.opportunity.sa_name).toBe('David Kross');
      expect(fixture.verdict.nextSteps).toContain('Owner: David Kross (SA)');

      const dims = fixture.baseline.jevResult.dimensions;
      expect(dims.paperProcess.score).toBe(4);
      expect(dims.paperProcess.status).toBe('partial');
      expect(fixture.baseline.system2Result.dimensionFindings.paperProcess.gaps).toEqual([]);

      const unaddressedCount = Object.values(dims).filter(
        (d) => d.score <= 3 || d.status === 'unaddressed'
      ).length;
      const questionCount = fixture.baseline.system2Result.phase3Form.sections.reduce(
        (sum, s) => sum + s.fields.length,
        0
      );
      expect(unaddressedCount).toBe(2);
      expect(questionCount).toBe(2);
    });

    it('contains dynamic discovery form with EB authority and technical criteria questions', () => {
      const form = fixture.baseline.system2Result.phase3Form;
      expect(form.opportunityId).toBe('opp_acme_corp_001');
      const allFields = form.sections.flatMap((s) => s.fields);
      const ebField = allFields.find((f) => f.dimensionTarget === 'economicBuyer');
      const criteriaField = allFields.find((f) => f.dimensionTarget === 'decisionCriteria');

      expect(ebField).toBeDefined();
      expect(criteriaField).toBeDefined();
    });
  });

  describe('Simulation State Machine', () => {
    it('initializes to READY_TO_ASSESS with baseline score 0 and gate 2 blocked', () => {
      const state = createSimulationState(fixture);
      expect(state.workflowState).toBe('READY_TO_ASSESS');
      expect(state.score).toBe(0);
      expect(state.statusLabel).toBe('[READY TO ASSESS]');
      expect(state.stageGate.gateReady).toBe(false);
      expect(state.stageGate.gateBlockers.length).toBeGreaterThan(0);
      expect(state.suggestedNextSteps).toBeNull();
      expect(state.discoveryForm).toBeNull();
      expect(state.dimensions.identifyPain.score).toBe(0);
      expect(state.dimensions.identifyPain.status).toBe('unaddressed');
    });

    it('transitions READY_TO_ASSESS -> ANALYZING -> PENDING_FEEDBACK -> EVALUATING -> COMPLETED cleanly', () => {
      let state = createSimulationState(fixture);
      state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
      expect(state.workflowState).toBe('ANALYZING');
      expect(state.score).toBe(0);

      state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
      expect(state.workflowState).toBe('PENDING_FEEDBACK');
      expect(state.score).toBe(58);
      expect(state.discoveryForm?.title).toBe(fixture.baseline.system2Result.phase3Form.title);

      state = simulationReducer(
        state,
        {
          type: 'SUBMIT_FEEDBACK',
          formResponses: fixture.feedback.formResponses,
          notesDelta: fixture.feedback.notesDelta,
        },
        fixture
      );
      expect(state.workflowState).toBe('EVALUATING');
      expect(state.score).toBe(58);

      state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, fixture);
      expect(state.workflowState).toBe('COMPLETED');
      expect(state.score).toBe(76);
      expect(state.previousScore).toBe(58);
      expect(state.delta).toBe(18);
      expect(state.statusLabel).toBe('[QUALIFIED]');
      expect(state.stageGate.gateReady).toBe(true);
      expect(state.stageGate.gateBlockers).toEqual([]);
      expect(state.dimensions.economicBuyer.score).toBe(8);
      expect(state.dimensions.economicBuyer.gaps).toEqual([]);
      expect(state.dimensions.decisionCriteria.score).toBe(8);
      expect(state.dimensions.decisionCriteria.gaps).toEqual([]);
      expect(state.opportunity.qualification_status).toBe('qualified');
      expect(state.opportunity.meddpicc_score).toBe(76);
      expect(state.suggestedNextSteps).toBe(fixture.verdict.nextSteps);
      expect(state.opportunity.sa_notes).toContain(
        '• Did Jane Doe (VP Engineering) formally confirm sponsorship?: Confirmed sponsorship if build times drop <5 min'
      );
    });

    it('jumps directly to states 1..5 and resets back to READY_TO_ASSESS', () => {
      const state0 = createSimulationState(fixture);
      const state3 = simulationReducer(state0, { type: 'JUMP_TO_STATE', target: 'PENDING_FEEDBACK' }, fixture);
      expect(state3.score).toBe(58);

      const state5 = simulationReducer(state0, { type: 'JUMP_TO_STATE', target: 5 }, fixture);
      expect(state5.workflowState).toBe('COMPLETED');
      expect(state5.score).toBe(76);

      const reset = simulationReducer(state5, { type: 'RESET' }, fixture);
      expect(reset.workflowState).toBe('READY_TO_ASSESS');
      expect(reset.score).toBe(0);
    });
  });
});
