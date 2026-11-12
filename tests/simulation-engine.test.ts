import { describe, it, expect, vi } from 'vitest';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import type { SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
  getSimulationFixture,
  simulationReducer,
} from '@/lib/simulation/simulation-engine';

describe('simulation-engine state transitions, cleared gaps, verdict posture & negative SA feedback', () => {
  const fixture = acmeFixtureRaw as SimulationFixture;

  it('progresses sequentially and computes exact weighted delta scores upon reaching COMPLETED', () => {
    let state = createSimulationState(fixture);
    expect(state.workflowState).toBe('READY_TO_ASSESS');
    expect(state.score).toBe(0);
    expect(state.delta).toBeUndefined();

    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
    expect(state.workflowState).toBe('ANALYZING');

    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
    expect(state.workflowState).toBe('PENDING_FEEDBACK');
    expect(state.score).toBe(58);
    expect(state.delta).toBeUndefined();

    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, fixture);
    expect(state.workflowState).toBe('EVALUATING');

    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, fixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.score).toBe(76);
    expect(state.previousScore).toBe(58);
    expect(state.delta).toBe(18);

    expect(state.dimensions.economicBuyer.score).toBe(8);
    expect(state.dimensions.economicBuyer.previousScore).toBe(3);
    expect(state.dimensions.economicBuyer.delta).toBe(5);

    expect(state.dimensions.decisionCriteria.score).toBe(8);
    expect(state.dimensions.decisionCriteria.previousScore).toBe(3);
    expect(state.dimensions.decisionCriteria.delta).toBe(5);
  });

  it('supports sequential step-back navigation and clears delta scores', () => {
    let state = createSimulationState(fixture);
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, fixture);
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, fixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.delta).toBe(18);

    state = simulationReducer(state, { type: 'STEP_BACK' }, fixture);
    expect(state.workflowState).toBe('PENDING_FEEDBACK');
    expect(state.score).toBe(58);
    expect(state.delta).toBeNull();
    expect(state.previousScore).toBeNull();

    state = simulationReducer(state, { type: 'STEP_BACK' }, fixture);
    expect(state.workflowState).toBe('READY_TO_ASSESS');
    expect(state.score).toBe(0);
    expect(state.delta).toBeNull();
    expect(state.previousScore).toBeNull();
    expect(state.stageGate.gateReady).toBe(false);
  });

  it('ensures timer cancellation safety on STEP_BACK and RESET', () => {
    vi.useFakeTimers();
    const timerRef: { current: number | NodeJS.Timeout | null } = { current: null };
    const advanceSpy = vi.fn();
    timerRef.current = setTimeout(advanceSpy, 1200);

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current as number);
      timerRef.current = null;
    }

    vi.advanceTimersByTime(1500);
    expect(advanceSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('clears Stage 3 resolved gaps across all 3 scenarios (including Globex paperProcess & Soylent decisionProcess)', () => {
    // Globex FinTech: paperProcess (2 -> 8) & decisionCriteria (2 -> 8)
    const globexFixture = getSimulationFixture('scenario_globex_amplify');
    let state = createSimulationState(globexFixture);
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, globexFixture);
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, globexFixture);
    expect(state.score).toBe(56);
    expect(state.dimensions.paperProcess.gaps?.length).toBeGreaterThan(0);

    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, globexFixture);
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, globexFixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.score).toBe(80);
    expect(state.previousScore).toBe(56);
    expect(state.delta).toBe(24);
    expect(state.dimensions.decisionCriteria.gaps).toEqual([]);
    expect(state.dimensions.paperProcess.gaps).toEqual([]);
    expect(state.dimensions.paperProcess.gap).toBeUndefined();

    // Soylent Retail: decisionProcess (3 -> 8) & decisionCriteria (3 -> 8)
    const soylentFixture = getSimulationFixture('scenario_soylent_headless');
    state = simulationReducer(state, { type: 'SWITCH_SCENARIO', scenarioId: 'scenario_soylent_headless' });
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, soylentFixture);
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, soylentFixture);
    expect(state.score).toBe(64);
    expect(state.dimensions.decisionProcess.gaps?.length).toBeGreaterThan(0);

    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, soylentFixture);
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, soylentFixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.score).toBe(82);
    expect(state.previousScore).toBe(64);
    expect(state.delta).toBe(18);
    expect(state.dimensions.decisionCriteria.gaps).toEqual([]);
    expect(state.dimensions.decisionProcess.gaps).toEqual([]);
    expect(state.dimensions.decisionProcess.gap).toBeUndefined();
  });

  it('respects fixture.verdict.qualificationStatus when non-qualified', () => {
    const inReviewFixture: SimulationFixture = {
      ...fixture,
      verdict: {
        ...fixture.verdict,
        qualificationStatus: 'in_review',
        nextSteps: '[IN REVIEW] Hold pending CFO alignment.',
      },
    };
    const completed = simulationReducer(
      createSimulationState(inReviewFixture),
      { type: 'JUMP_TO_STATE', target: 'COMPLETED' },
      inReviewFixture
    );
    expect(completed.opportunity.qualification_status).toBe('in_review');
    expect(completed.statusLabel).toBe('[IN REVIEW]');
  });

  it('handles negative/unconfirmed Stage 2 discovery answers honestly instead of faking [QUALIFIED]', () => {
    // Case A: Both Acme discovery answers negative ('no_contact' + 'undefined')
    let state = createSimulationState(fixture);
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
    state = simulationReducer(
      state,
      {
        type: 'SUBMIT_FEEDBACK',
        formResponses: {
          eb_sponsorship: 'no_contact',
          technical_criteria: 'undefined',
        },
        notesDelta: 'Unable to reach Jane Doe yet; architecture benchmarks still open.',
      },
      fixture
    );
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, fixture);

    expect(state.workflowState).toBe('COMPLETED');
    expect(state.score).toBe(58);
    expect(state.previousScore).toBe(58);
    expect(state.delta).toBe(0);
    expect(state.dimensions.economicBuyer.score).toBe(3);
    expect(state.dimensions.economicBuyer.status).toBe('unaddressed');
    expect(state.dimensions.economicBuyer.gaps?.length).toBeGreaterThan(0);
    expect(state.dimensions.decisionCriteria.score).toBe(3);
    expect(state.stageGate.gateReady).toBe(false);
    expect(state.stageGate.gateBlockers.length).toBeGreaterThan(0);
    expect(state.opportunity.qualification_status).toBe('in_review');
    expect(state.statusLabel).toBe('[IN REVIEW]');
    expect(state.suggestedNextSteps).toContain('[IN REVIEW]');
    expect(state.suggestedNextSteps).not.toContain('[QUALIFIED]');
    expect(state.suggestedNextSteps).not.toContain('confirmed sponsorship');

    // Case B: One positive ('build_speed_and_isr' -> decisionCriteria 3->8 = +7.5 pts) + one negative ('no_contact' -> EB stays 3)
    let partialState = createSimulationState(fixture);
    partialState = simulationReducer(partialState, { type: 'START_ASSESSMENT' }, fixture);
    partialState = simulationReducer(partialState, { type: 'ANALYSIS_COMPLETE' }, fixture);
    partialState = simulationReducer(
      partialState,
      {
        type: 'SUBMIT_FEEDBACK',
        formResponses: {
          eb_sponsorship: 'no_contact',
          technical_criteria: 'build_speed_and_isr',
        },
      },
      fixture
    );
    partialState = simulationReducer(partialState, { type: 'EVALUATION_COMPLETE' }, fixture);

    expect(partialState.score).toBe(65); // 57.5 + (8 - 3) * 1.5 = 65.0
    expect(partialState.delta).toBe(7); // 65 - 58
    expect(partialState.dimensions.decisionCriteria.score).toBe(8);
    expect(partialState.dimensions.decisionCriteria.gaps).toEqual([]);
    expect(partialState.dimensions.economicBuyer.score).toBe(3);
    expect(partialState.stageGate.gateReady).toBe(false);
    expect(partialState.opportunity.qualification_status).toBe('in_review');
    expect(partialState.statusLabel).toBe('[IN REVIEW]');
    expect(partialState.opportunity.sa_notes).not.toContain('Economic Buyer verified');
  });
});
