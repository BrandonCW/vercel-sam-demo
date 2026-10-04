import { describe, it, expect } from 'vitest';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import { SimulationFixtureSchema, type SimulationFixture } from '@/lib/simulation/fixture-schema';
import {
  createSimulationState,
  simulationReducer,
} from '@/lib/simulation/simulation-engine';
import type { SimulationState, WorkflowState } from '@/lib/simulation/types';

describe('Simulation Engine & Acme Fixture (TDD)', () => {
  const fixture = acmeFixtureRaw as SimulationFixture;

  describe('Fixture Schema Validation', () => {
    it('validates Acme Corp simulation fixture against SimulationFixtureSchema', () => {
      const parsed = SimulationFixtureSchema.safeParse(fixture);
      expect(parsed.success).toBe(true);
      if (!parsed.success) {
        console.error(parsed.error);
        return;
      }
      expect(parsed.data.scenarioId).toBe('opp_acme_corp_001');
      expect(parsed.data.baseline.jevResult.overallScore).toBe(54);
      expect(parsed.data.feedback.rescoreJevResult.overallScore).toBe(76);
      expect(parsed.data.verdict.finalScore).toBe(76);
      expect(parsed.data.verdict.qualificationStatus).toBe('qualified');
    });

    it('matches authentic Acme Corp baseline dimensions and citations/gaps', () => {
      const dims = fixture.baseline.jevResult.dimensions;
      expect(dims.identifyPain.score).toBe(9);
      expect(dims.identifyPain.status).toBe('verified');
      expect(fixture.baseline.system2Result.dimensionFindings.identifyPain.citations).toContain(
        'Netlify deploy times exceed 45 minutes blocking daily releases'
      );

      expect(dims.champion.score).toBe(7);
      expect(dims.champion.status).toBe('partial');
      expect(fixture.baseline.system2Result.dimensionFindings.champion.citations).toContain(
        'Lead Architect confirmed advocacy for Next.js App Router'
      );
      expect(fixture.baseline.system2Result.dimensionFindings.champion.gaps).toContain(
        'Needs formal validation with Director of E-Commerce'
      );

      expect(dims.economicBuyer.score).toBe(3);
      expect(dims.economicBuyer.status).toBe('unaddressed');
      expect(fixture.baseline.system2Result.dimensionFindings.economicBuyer.gaps).toContain(
        'Jane Doe (VP Eng) has not participated in discovery calls'
      );

      expect(dims.decisionCriteria.score).toBe(3);
      expect(dims.decisionCriteria.status).toBe('unaddressed');
      expect(fixture.baseline.system2Result.dimensionFindings.decisionCriteria.gaps).toContain(
        'Technical SLA and build time benchmark criteria unconfirmed'
      );

      expect(dims.decisionProcess.score).toBe(5);
      expect(dims.decisionProcess.status).toBe('partial');
      expect(fixture.baseline.system2Result.dimensionFindings.decisionProcess.citations).toContain(
        'Renewal deadline in 60 days sets timeline'
      );
      expect(fixture.baseline.system2Result.dimensionFindings.decisionProcess.gaps).toContain(
        'Procurement security review steps undefined'
      );

      expect(dims.metrics.score).toBe(6);
      expect(dims.metrics.status).toBe('partial');
      expect(fixture.baseline.system2Result.dimensionFindings.metrics.citations).toContain(
        'Targeting sub-5 minute build pipelines'
      );
      expect(fixture.baseline.system2Result.dimensionFindings.metrics.gaps).toContain(
        'Revenue impact of build delays unquantified'
      );

      expect(dims.competition.score).toBe(7);
      expect(dims.competition.status).toBe('verified');
      expect(fixture.baseline.system2Result.dimensionFindings.competition.citations).toContain(
        'Netlify Enterprise offering 30% defensive renewal discount'
      );
      expect(fixture.baseline.system2Result.dimensionFindings.competition.gaps).toContain(
        'Counter-discount playbook required'
      );

      expect(dims.paperProcess.score).toBe(4);
      expect(dims.paperProcess.status).toBe('unaddressed');
      expect(fixture.baseline.system2Result.dimensionFindings.paperProcess.gaps).toContain(
        'Standard enterprise MSA and DPA review required'
      );
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

    it('contains completed verdict with expected Suggested Next Steps', () => {
      const expectedSteps =
        '[QUALIFIED] Advance to Stage 3 - Technical Validation. Owner: Alex Chen (SA). Action: Schedule POC kick-off architecture session with VP Eng Jane Doe by Oct 12. Counter Netlify 30% discount with developer productivity TCO model.';
      expect(fixture.verdict.nextSteps).toBe(expectedSteps);
      expect(fixture.feedback.rescoreJevResult.stageGate.gateReady).toBe(true);
      expect(fixture.feedback.rescoreJevResult.dimensions.economicBuyer.score).toBe(8);
      expect(fixture.feedback.rescoreJevResult.dimensions.decisionCriteria.score).toBe(8);
    });
  });

  describe('Simulation State Machine', () => {
    it('initializes to READY_TO_ASSESS with baseline score 54 and gate 2 blocked', () => {
      const state = createSimulationState(fixture);
      expect(state.workflowState).toBe('READY_TO_ASSESS');
      expect(state.score).toBe(54);
      expect(state.statusLabel).toBe('[READY TO ASSESS]');
      expect(state.stageGate.gateReady).toBe(false);
      expect(state.stageGate.gateBlockers.length).toBeGreaterThan(0);
      expect(state.suggestedNextSteps).toBeNull();
      expect(state.discoveryForm).toBeNull();
      expect(state.dimensions.identifyPain.score).toBe(9);
      expect(state.dimensions.economicBuyer.score).toBe(3);
    });

    it('transitions READY_TO_ASSESS -> ANALYZING on START_ASSESSMENT', () => {
      let state = createSimulationState(fixture);
      state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);

      expect(state.workflowState).toBe('ANALYZING');
      expect(state.score).toBe(54);
      expect(state.statusLabel).toBe('[IN REVIEW]');
      expect(state.stageGate.gateReady).toBe(false);
      expect(state.suggestedNextSteps).toBeNull();
    });

    it('transitions ANALYZING -> PENDING_FEEDBACK with discoveryForm on ANALYSIS_COMPLETE', () => {
      let state = createSimulationState(fixture);
      state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
      state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);

      expect(state.workflowState).toBe('PENDING_FEEDBACK');
      expect(state.score).toBe(54);
      expect(state.statusLabel).toBe('[IN REVIEW]');
      expect(state.discoveryForm).not.toBeNull();
      expect(state.discoveryForm?.title).toBe(fixture.baseline.system2Result.phase3Form.title);
      expect(state.stageGate.gateReady).toBe(false);
      expect(state.suggestedNextSteps).toBeNull();
    });

    it('transitions PENDING_FEEDBACK -> EVALUATING on SUBMIT_FEEDBACK', () => {
      let state = createSimulationState(fixture);
      state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
      state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
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
      expect(state.score).toBe(54);
      expect(state.statusLabel).toBe('[IN REVIEW]');
      expect(state.stageGate.gateReady).toBe(false);
      expect(state.suggestedNextSteps).toBeNull();
    });

    it('transitions EVALUATING -> COMPLETED with score 76, gate ready, and Suggested Next Steps', () => {
      let state = createSimulationState(fixture);
      state = simulationReducer(state, { type: 'START_ASSESSMENT' }, fixture);
      state = simulationReducer(state, { type: 'ANALYSIS_COMPLETE' }, fixture);
      state = simulationReducer(
        state,
        {
          type: 'SUBMIT_FEEDBACK',
          formResponses: fixture.feedback.formResponses,
          notesDelta: fixture.feedback.notesDelta,
        },
        fixture
      );
      state = simulationReducer(state, { type: 'EVALUATION_COMPLETE' }, fixture);

      expect(state.workflowState).toBe('COMPLETED');
      expect(state.score).toBe(76);
      expect(state.statusLabel).toBe('[QUALIFIED]');
      expect(state.stageGate.gateReady).toBe(true);
      expect(state.stageGate.gateBlockers).toEqual([]);
      expect(state.dimensions.economicBuyer.score).toBe(8);
      expect(state.dimensions.economicBuyer.status).toBe('verified');
      expect(state.dimensions.decisionCriteria.score).toBe(8);
      expect(state.dimensions.decisionCriteria.status).toBe('verified');
      expect(state.opportunity.qualification_status).toBe('qualified');
      expect(state.opportunity.meddpicc_score).toBe(76);
      expect(state.suggestedNextSteps).toBe(fixture.verdict.nextSteps);
    });

    it('jumps directly to state 1, 2, 3, 4, 5 (and named states) with exact data', () => {
      const state0 = createSimulationState(fixture);

      // Jump to 2 / ANALYZING
      const state2 = simulationReducer(state0, { type: 'JUMP_TO_STATE', target: 2 }, fixture);
      expect(state2.workflowState).toBe('ANALYZING');
      expect(state2.score).toBe(54);
      expect(state2.statusLabel).toBe('[IN REVIEW]');
      expect(state2.stageGate.gateReady).toBe(false);

      // Jump to 3 / PENDING_FEEDBACK
      const state3 = simulationReducer(state0, { type: 'JUMP_TO_STATE', target: 'PENDING_FEEDBACK' }, fixture);
      expect(state3.workflowState).toBe('PENDING_FEEDBACK');
      expect(state3.score).toBe(54);
      expect(state3.discoveryForm).not.toBeNull();
      expect(state3.statusLabel).toBe('[IN REVIEW]');

      // Jump to 4 / EVALUATING
      const state4 = simulationReducer(state0, { type: 'JUMP_TO_STATE', target: 4 }, fixture);
      expect(state4.workflowState).toBe('EVALUATING');
      expect(state4.score).toBe(54);
      expect(state4.statusLabel).toBe('[IN REVIEW]');

      // Jump to 5 / COMPLETED
      const state5 = simulationReducer(state0, { type: 'JUMP_TO_STATE', target: 5 }, fixture);
      expect(state5.workflowState).toBe('COMPLETED');
      expect(state5.score).toBe(76);
      expect(state5.statusLabel).toBe('[QUALIFIED]');
      expect(state5.stageGate.gateReady).toBe(true);
      expect(state5.suggestedNextSteps).toBe(fixture.verdict.nextSteps);

      // Jump back to 1 / READY_TO_ASSESS
      const state1 = simulationReducer(state5, { type: 'JUMP_TO_STATE', target: 1 }, fixture);
      expect(state1.workflowState).toBe('READY_TO_ASSESS');
      expect(state1.score).toBe(54);
      expect(state1.statusLabel).toBe('[READY TO ASSESS]');
      expect(state1.stageGate.gateReady).toBe(false);
      expect(state1.suggestedNextSteps).toBeNull();
    });

    it('resets state back to baseline READY_TO_ASSESS on RESET action', () => {
      let state = createSimulationState(fixture);
      state = simulationReducer(state, { type: 'JUMP_TO_STATE', target: 'COMPLETED' }, fixture);
      expect(state.workflowState).toBe('COMPLETED');
      expect(state.score).toBe(76);

      state = simulationReducer(state, { type: 'RESET' }, fixture);
      expect(state.workflowState).toBe('READY_TO_ASSESS');
      expect(state.score).toBe(54);
      expect(state.statusLabel).toBe('[READY TO ASSESS]');
      expect(state.stageGate.gateReady).toBe(false);
      expect(state.suggestedNextSteps).toBeNull();
      expect(state.discoveryForm).toBeNull();
    });
  });
});
