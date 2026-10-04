import type {
  SimulationAction,
  SimulationDimension,
  SimulationDimensionFinding,
  SimulationState,
  WorkflowState,
} from './types';
import type { SimulationFixture } from './fixture-schema';

function buildDimensions(
  dimensionsInput: Record<string, any>,
  findingsInput: Record<string, any>,
  isCompleted: boolean
): Record<string, SimulationDimension> {
  const result: Record<string, SimulationDimension> = {};
  for (const [key, dim] of Object.entries(dimensionsInput)) {
    const finding = findingsInput[key] || { citations: [], gaps: [] };
    const quotes = finding.citations || [];
    const gaps = isCompleted && (key === 'economicBuyer' || key === 'decisionCriteria')
      ? []
      : (finding.gaps || []);
    result[key] = {
      key,
      label: dim.label || key,
      weight: dim.weight ?? 0.1,
      score: dim.score,
      status: dim.status,
      confidence: dim.confidence,
      quote: quotes[0],
      quotes,
      gap: gaps[0],
      gaps,
    };
  }
  return result;
}

function buildDimensionFindings(
  findingsInput: Record<string, any>
): Record<string, SimulationDimensionFinding> {
  const result: Record<string, SimulationDimensionFinding> = {};
  for (const [key, finding] of Object.entries(findingsInput)) {
    const citations = finding.citations || [];
    const gaps = finding.gaps || [];
    result[key] = {
      citations,
      quotes: citations,
      gaps,
    };
  }
  return result;
}

export function getStateForWorkflow(
  workflowState: WorkflowState,
  fixture: SimulationFixture
): SimulationState {
  const dimensionFindings = buildDimensionFindings(
    fixture.baseline.system2Result.dimensionFindings
  );

  switch (workflowState) {
    case 'READY_TO_ASSESS': {
      const dimensions = buildDimensions(
        fixture.baseline.jevResult.dimensions,
        fixture.baseline.system2Result.dimensionFindings,
        false
      );
      return {
        workflowState: 'READY_TO_ASSESS',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'unqualified',
          meddpicc_score: fixture.baseline.jevResult.overallScore,
          suggested_next_steps: null,
        },
        score: fixture.baseline.jevResult.overallScore,
        dimensionFindings,
        dimensions,
        stageGate: fixture.baseline.jevResult.stageGate,
        statusLabel: '[READY TO ASSESS]',
        suggestedNextSteps: null,
        discoveryForm: null,
      };
    }

    case 'ANALYZING': {
      const dimensions = buildDimensions(
        fixture.baseline.jevResult.dimensions,
        fixture.baseline.system2Result.dimensionFindings,
        false
      );
      return {
        workflowState: 'ANALYZING',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'in_review',
          meddpicc_score: fixture.baseline.jevResult.overallScore,
          suggested_next_steps: null,
        },
        score: fixture.baseline.jevResult.overallScore,
        dimensionFindings,
        dimensions,
        stageGate: fixture.baseline.jevResult.stageGate,
        statusLabel: '[IN REVIEW]',
        suggestedNextSteps: null,
        discoveryForm: null,
      };
    }

    case 'PENDING_FEEDBACK': {
      const dimensions = buildDimensions(
        fixture.baseline.jevResult.dimensions,
        fixture.baseline.system2Result.dimensionFindings,
        false
      );
      return {
        workflowState: 'PENDING_FEEDBACK',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'in_review',
          meddpicc_score: fixture.baseline.jevResult.overallScore,
          suggested_next_steps: null,
        },
        score: fixture.baseline.jevResult.overallScore,
        dimensionFindings,
        dimensions,
        stageGate: fixture.baseline.jevResult.stageGate,
        statusLabel: '[IN REVIEW]',
        suggestedNextSteps: null,
        discoveryForm: fixture.baseline.system2Result.phase3Form,
      };
    }

    case 'EVALUATING': {
      const dimensions = buildDimensions(
        fixture.baseline.jevResult.dimensions,
        fixture.baseline.system2Result.dimensionFindings,
        false
      );
      return {
        workflowState: 'EVALUATING',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'in_review',
          meddpicc_score: fixture.baseline.jevResult.overallScore,
          suggested_next_steps: null,
        },
        score: fixture.baseline.jevResult.overallScore,
        dimensionFindings,
        dimensions,
        stageGate: fixture.baseline.jevResult.stageGate,
        statusLabel: '[IN REVIEW]',
        suggestedNextSteps: null,
        discoveryForm: fixture.baseline.system2Result.phase3Form,
      };
    }

    case 'COMPLETED': {
      const dimensions = buildDimensions(
        fixture.feedback.rescoreJevResult.dimensions,
        fixture.baseline.system2Result.dimensionFindings,
        true
      );
      return {
        workflowState: 'COMPLETED',
        opportunity: {
          ...fixture.verdict.opportunity,
          qualification_status: 'qualified',
          meddpicc_score: fixture.feedback.rescoreJevResult.overallScore,
          suggested_next_steps: fixture.verdict.nextSteps,
        },
        score: fixture.feedback.rescoreJevResult.overallScore,
        dimensionFindings,
        dimensions,
        stageGate: fixture.feedback.rescoreJevResult.stageGate,
        statusLabel: '[QUALIFIED]',
        suggestedNextSteps: fixture.verdict.nextSteps,
        discoveryForm: fixture.baseline.system2Result.phase3Form,
      };
    }
  }
}

export function createSimulationState(fixture: SimulationFixture): SimulationState {
  return getStateForWorkflow('READY_TO_ASSESS', fixture);
}

function resolveTargetState(target?: WorkflowState | number): WorkflowState | null {
  if (!target) return null;
  if (typeof target === 'number') {
    switch (target) {
      case 1:
        return 'READY_TO_ASSESS';
      case 2:
        return 'ANALYZING';
      case 3:
        return 'PENDING_FEEDBACK';
      case 4:
        return 'EVALUATING';
      case 5:
        return 'COMPLETED';
      default:
        return null;
    }
  }
  return target;
}

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
  fixture: SimulationFixture
): SimulationState {
  switch (action.type) {
    case 'START_ASSESSMENT':
      if (state.workflowState === 'READY_TO_ASSESS') {
        return getStateForWorkflow('ANALYZING', fixture);
      }
      return state;

    case 'ANALYSIS_COMPLETE':
      if (state.workflowState === 'ANALYZING') {
        return getStateForWorkflow('PENDING_FEEDBACK', fixture);
      }
      return state;

    case 'SUBMIT_FEEDBACK':
      if (state.workflowState === 'PENDING_FEEDBACK') {
        return getStateForWorkflow('EVALUATING', fixture);
      }
      return state;

    case 'EVALUATION_COMPLETE':
      if (state.workflowState === 'EVALUATING') {
        return getStateForWorkflow('COMPLETED', fixture);
      }
      return state;

    case 'JUMP_TO_STATE': {
      const rawTarget = action.target ?? action.targetState;
      const target = resolveTargetState(rawTarget);
      if (target) {
        return getStateForWorkflow(target, fixture);
      }
      return state;
    }

    case 'RESET':
      return createSimulationState(fixture);

    default:
      return state;
  }
}
