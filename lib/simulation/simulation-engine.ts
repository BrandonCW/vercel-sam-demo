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

const INITIAL_GAPS: Record<string, string[]> = {
  identifyPain: ['Operational and business impact unquantified'],
  champion: ['Internal advocate not yet tested for influence or access'],
  economicBuyer: ['Budget authority and discretionary sponsor unconfirmed'],
  decisionCriteria: ['Technical benchmarks and architecture requirements not locked'],
  decisionProcess: ['Formal evaluation stages and milestone timeline not mapped'],
  metrics: ['Quantifiable business KPIs and CWV targets not specified'],
  competition: ['Alternative vendor evaluation criteria not countered'],
  paperProcess: ['Procurement, security review, and legal path undefined'],
};

const INITIAL_WEIGHTS: Record<string, number> = {
  identifyPain: 0.2,
  champion: 0.15,
  economicBuyer: 0.15,
  decisionCriteria: 0.15,
  decisionProcess: 0.1,
  metrics: 0.1,
  competition: 0.1,
  paperProcess: 0.05,
};

const DIMENSION_LABELS: Record<string, string> = {
  identifyPain: 'Identify Pain',
  champion: 'Champion',
  economicBuyer: 'Economic Buyer',
  decisionCriteria: 'Decision Criteria',
  decisionProcess: 'Decision Process',
  metrics: 'Metrics',
  competition: 'Competition',
  paperProcess: 'Paper Process',
};

function buildUnassessedDimensions(): Record<string, SimulationDimension> {
  const result: Record<string, SimulationDimension> = {};
  for (const [key, label] of Object.entries(DIMENSION_LABELS)) {
    const gaps = INITIAL_GAPS[key] || [];
    result[key] = {
      key,
      label,
      weight: INITIAL_WEIGHTS[key] || 0.1,
      score: 0,
      status: 'unaddressed',
      confidence: 0,
      quotes: [],
      gap: gaps[0],
      gaps,
    };
  }
  return result;
}

const UNASSESSED_STAGE_GATE = {
  gate: 'Gate 2',
  gateReady: false,
  gateBlockers: [
    'identifyPain (score: 0, minimum: 6)',
    'champion (score: 0, minimum: 5)',
    'metrics (score: 0, minimum: 4)',
    'economicBuyer (score: 0, minimum: 4)',
    'Composite score 0 is below the Gate 2 threshold (50)',
  ],
  satisfiedCriteria: [],
};

export function getStateForWorkflow(
  workflowState: WorkflowState,
  fixture: SimulationFixture
): SimulationState {
  const dimensionFindings = buildDimensionFindings(
    fixture.baseline.system2Result.dimensionFindings
  );

  switch (workflowState) {
    case 'READY_TO_ASSESS': {
      const dimensions = buildUnassessedDimensions();
      return {
        workflowState: 'READY_TO_ASSESS',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'unqualified',
          meddpicc_score: null as any,
          suggested_next_steps: null,
        },
        score: 0,
        dimensionFindings: {},
        dimensions,
        stageGate: UNASSESSED_STAGE_GATE as any,
        statusLabel: '[READY TO ASSESS]',
        suggestedNextSteps: null,
        discoveryForm: null,
      };
    }

    case 'ANALYZING': {
      const dimensions = buildUnassessedDimensions();
      return {
        workflowState: 'ANALYZING',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'in_review',
          meddpicc_score: null as any,
          suggested_next_steps: null,
        },
        score: 0,
        dimensionFindings: {},
        dimensions,
        stageGate: UNASSESSED_STAGE_GATE as any,
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
      const previousScore = fixture.baseline.jevResult.overallScore;
      const currentScore = fixture.feedback.rescoreJevResult.overallScore;
      const overallDelta = currentScore - previousScore;

      for (const [key, dim] of Object.entries(dimensions)) {
        const baseDim = (fixture.baseline.jevResult.dimensions as any)[key];
        if (baseDim) {
          dim.previousScore = baseDim.score;
          dim.delta = dim.score - baseDim.score;
        }
      }

      return {
        workflowState: 'COMPLETED',
        opportunity: {
          ...fixture.verdict.opportunity,
          qualification_status: 'qualified',
          meddpicc_score: currentScore,
          suggested_next_steps: fixture.verdict.nextSteps,
        },
        score: currentScore,
        previousScore,
        delta: overallDelta,
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

    case 'STEP_BACK': {
      if (state.workflowState === 'COMPLETED' || state.workflowState === 'EVALUATING') {
        const nextState = getStateForWorkflow('PENDING_FEEDBACK', fixture);
        return {
          ...nextState,
          previousScore: null,
          delta: null,
        };
      }
      if (state.workflowState === 'PENDING_FEEDBACK' || state.workflowState === 'ANALYZING') {
        const nextState = getStateForWorkflow('READY_TO_ASSESS', fixture);
        return {
          ...nextState,
          previousScore: null,
          delta: null,
        };
      }
      return state;
    }

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
