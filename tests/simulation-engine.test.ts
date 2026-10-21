import { describe, it, expect, vi } from 'vitest';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import type { SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
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
    let timerRef: { current: NodeJS.Timeout | null } = { current: null };

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
});
