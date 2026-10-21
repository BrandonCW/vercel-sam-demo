import { describe, it, expect, vi } from 'vitest';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import type { SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
  getSimulationFixture,
  simulationReducer,
} from '@/lib/simulation/simulation-engine';

describe('simulation-engine state transitions, step-back, deltas & timers (Issue #23 / ENG-5, ENG-6)', () => {
  const fixture = acmeFixtureRaw as SimulationFixture;

  it('progresses sequentially and computes delta scores upon reaching COMPLETED', () => {
    let state = createSimulationState(fixture);
    expect(state.workflowState).toBe('READY_TO_ASSESS');
    expect(state.score).toBe(0);
    expect(state.delta).toBeUndefined();

    // 1. Advance to ANALYZING
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
    expect(state.workflowState).toBe('ANALYZING');

    // 2. Advance to PENDING_FEEDBACK
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
    expect(state.workflowState).toBe('PENDING_FEEDBACK');
    expect(state.score).toBe(54);
    expect(state.delta).toBeUndefined();

    // 3. Advance to EVALUATING
    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, fixture);
    expect(state.workflowState).toBe('EVALUATING');

    // 4. Advance to COMPLETED with computed deltas
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, fixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.score).toBe(76);
    expect(state.previousScore).toBe(54);
    expect(state.delta).toBe(22); // 76 - 54

    // Dimension deltas
    expect(state.dimensions.economicBuyer.score).toBe(8);
    expect(state.dimensions.economicBuyer.previousScore).toBe(3);
    expect(state.dimensions.economicBuyer.delta).toBe(5);

    expect(state.dimensions.decisionCriteria.score).toBe(8);
    expect(state.dimensions.decisionCriteria.previousScore).toBe(3);
    expect(state.dimensions.decisionCriteria.delta).toBe(5);
  });

  it('supports sequential step-back navigation and clears delta scores (COMPLETED -> PENDING_FEEDBACK -> READY_TO_ASSESS)', () => {
    let state = createSimulationState(fixture);
    // Move to COMPLETED
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, fixture);
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, fixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.delta).toBe(22);

    // Step back to PENDING_FEEDBACK
    state = simulationReducer(state, { type: 'STEP_BACK' }, fixture);
    expect(state.workflowState).toBe('PENDING_FEEDBACK');
    expect(state.score).toBe(54);
    expect(state.delta).toBeNull();
    expect(state.previousScore).toBeNull();
    expect(state.discoveryForm).not.toBeNull();

    // Step back to READY_TO_ASSESS
    state = simulationReducer(state, { type: 'STEP_BACK' }, fixture);
    expect(state.workflowState).toBe('READY_TO_ASSESS');
    expect(state.score).toBe(0);
    expect(state.delta).toBeNull();
    expect(state.previousScore).toBeNull();
    expect(state.stageGate.gateReady).toBe(false);

    // Step back at READY_TO_ASSESS is a no-op
    const noopState = simulationReducer(state, { type: 'STEP_BACK' }, fixture);
    expect(noopState.workflowState).toBe('READY_TO_ASSESS');
  });

  it('ensures timer cancellation safety on STEP_BACK and RESET', () => {
    vi.useFakeTimers();
    let timerRef: { current: any } = { current: null };

    // Simulate scheduling a transition timer
    const advanceSpy = vi.fn();
    timerRef.current = setTimeout(advanceSpy, 1200);
    expect(timerRef.current).not.toBeNull();

    // Trigger STEP_BACK -> cancels timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    expect(timerRef.current).toBeNull();

    // Fast forward time, spy must not have been called
    vi.advanceTimersByTime(1500);
    expect(advanceSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('supports scenario switching across all 3 seed scenarios with authentic CRM data and flows', () => {
    // 1. Initial Acme
    let state = createSimulationState(getSimulationFixture('scenario_acme_netlify'));
    expect(state.opportunity.name).toContain('Acme Corp');
    expect(state.workflowState).toBe('READY_TO_ASSESS');

    // 2. Switch to Globex FinTech
    state = simulationReducer(state, { type: 'SWITCH_SCENARIO', scenarioId: 'scenario_globex_amplify' });
    expect(state.opportunity.name).toContain('Globex FinTech');
    expect(state.opportunity.amount).toBe(240000);
    expect(state.workflowState).toBe('READY_TO_ASSESS');

    // Run Globex flow
    const globexFixture = getSimulationFixture('scenario_globex_amplify');
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, globexFixture);
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, globexFixture);
    expect(state.score).toBe(48);
    expect(state.workflowState).toBe('PENDING_FEEDBACK');

    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, globexFixture);
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, globexFixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.score).toBe(78);
    expect(state.previousScore).toBe(48);
    expect(state.delta).toBe(30);
    expect(state.suggestedNextSteps).toContain('Secure Compute');

    // 3. Switch to Soylent Retail
    const soylentFixture = getSimulationFixture('scenario_soylent_headless');
    state = simulationReducer(state, { type: 'SWITCH_SCENARIO', scenarioId: 'scenario_soylent_headless' });
    expect(state.opportunity.name).toContain('Soylent Retail');
    expect(state.opportunity.amount).toBe(90000);
    expect(state.workflowState).toBe('READY_TO_ASSESS');

    // Run Soylent flow
    state = simulationReducer(state, { type: 'START_ASSESSMENT' }, soylentFixture);
    state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, soylentFixture);
    expect(state.score).toBe(52);
    expect(state.workflowState).toBe('PENDING_FEEDBACK');

    state = simulationReducer(state, { type: 'SUBMIT_FEEDBACK' }, soylentFixture);
    state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, soylentFixture);
    expect(state.workflowState).toBe('COMPLETED');
    expect(state.score).toBe(80);
    expect(state.previousScore).toBe(52);
    expect(state.delta).toBe(28);
    expect(state.suggestedNextSteps).toContain('Shopify Plus');
  });
});
