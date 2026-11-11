import type {
  SimulationAction,
  SimulationDimension,
  SimulationDimensionFinding,
  SimulationState,
  SubmittedSimulationFeedback,
  WorkflowState,
} from './types';
import type { SimulationFixture } from './fixture-schema';
import type { JevScoringResult } from '@/lib/agents/jev-schema';
import { computeCompositeScore, evaluateStageGate } from '@/lib/agents/jev-scorer';
import { formatSaDiscoveryDelta } from '@/lib/agents/feedback-schema';
import type { MEDDPICCBreakdown, QualificationStatus, StageGateEvaluation } from '@/lib/types/crm';
import acmeFixtureRaw from '@/lib/fixtures/simulation/acme_migration.json';
import globexFixtureRaw from '@/lib/fixtures/simulation/globex_amplify.json';
import soylentFixtureRaw from '@/lib/fixtures/simulation/soylent_retail.json';

export const FIXTURES_BY_SCENARIO: Record<string, SimulationFixture> = {
  scenario_acme_netlify: acmeFixtureRaw as SimulationFixture,
  scenario_acme_nextjs: acmeFixtureRaw as SimulationFixture,
  scenario_globex_amplify: globexFixtureRaw as SimulationFixture,
  scenario_soylent_headless: soylentFixtureRaw as SimulationFixture,
  scenario_soylent_monolith: soylentFixtureRaw as SimulationFixture,
};

export function getSimulationFixture(scenarioId: string = 'scenario_acme_netlify'): SimulationFixture {
  return FIXTURES_BY_SCENARIO[scenarioId] || (acmeFixtureRaw as SimulationFixture);
}

const NEGATIVE_DISCOVERY_ANSWER_PATTERN =
  /(?:^|[^a-z0-9])(no[_ ]contact|undefined|unknown|none|not[_ ]yet|blocked|unconfirmed|unaddressed|rejected|declined)(?:$|[^a-z0-9])/i;

export function isNegativeDiscoveryValue(raw: string): boolean {
  return NEGATIVE_DISCOVERY_ANSWER_PATTERN.test(raw.trim());
}

function statusLabelForQualification(status: QualificationStatus): string {
  switch (status) {
    case 'qualified':
      return '[QUALIFIED]';
    case 'disqualified':
      return '[DISQUALIFIED]';
    case 'in_review':
      return '[IN REVIEW]';
    default:
      return '[UNQUALIFIED]';
  }
}

function buildDimensions(
  dimensionsInput: Record<string, any>,
  findingsInput: Record<string, any>,
  isCompleted: boolean,
  fallbackBreakdown?: MEDDPICCBreakdown
): Record<string, SimulationDimension> {
  const result: Record<string, SimulationDimension> = {};
  for (const [key, dim] of Object.entries(dimensionsInput)) {
    const finding = findingsInput[key] || { citations: [], gaps: [] };
    const fbEntry = fallbackBreakdown?.[key];
    const fb = fbEntry && 'score' in fbEntry ? fbEntry : undefined;
    const quotes =
      isCompleted && fb?.evidence?.length
        ? fb.evidence
        : finding.citations?.length
        ? finding.citations
        : fb?.evidence?.length
        ? fb.evidence
        : dim.evidence?.length
        ? dim.evidence
        : dim.quote
        ? [dim.quote]
        : [];
    const gaps = isCompleted
      ? Array.isArray(fb?.gaps)
        ? fb.gaps
        : dim.status === 'verified'
        ? []
        : finding.gaps || []
      : finding.gaps || [];
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

const UNASSESSED_STAGE_GATE: StageGateEvaluation = {
  gateReady: false,
  currentStage: 'Stage 2 - Discovery',
  targetStage: 'Stage 3 - Technical Validation',
  gateBlockers: [
    'identifyPain (score: 0, minimum: 6)',
    'champion (score: 0, minimum: 5)',
    'metrics (score: 0, minimum: 4)',
    'economicBuyer (score: 0, minimum: 4)',
    'Composite score 0 is below the Gate 2 threshold (50)',
  ],
  blockingDimensions: ['identifyPain', 'champion', 'metrics', 'economicBuyer'],
};

interface EvaluatedFeedbackOutcome {
  hasNegativeAnswers: boolean;
  unresolvedDimensions: Set<string>;
  positivelyConfirmedDimensions: Set<string>;
}

function inspectSubmittedFeedback(
  fixture: SimulationFixture,
  submitted?: SubmittedSimulationFeedback | null
): EvaluatedFeedbackOutcome {
  const unresolvedDimensions = new Set<string>();
  const positivelyConfirmedDimensions = new Set<string>();

  if (!submitted || !submitted.explicitFormSubmission) {
    return {
      hasNegativeAnswers: false,
      unresolvedDimensions,
      positivelyConfirmedDimensions,
    };
  }

  const { formResponses } = submitted;
  const fields = fixture.baseline.system2Result.phase3Form.sections.flatMap((s) => s.fields);
  let hasNegativeAnswers = false;

  for (const field of fields) {
    const rawValue = formResponses[field.name] ?? formResponses[field.id];
    const values = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim()
      ? [rawValue]
      : [];

    if (values.length === 0) {
      continue;
    }

    const matchesNegative = values.some((val) => {
      if (isNegativeDiscoveryValue(val)) return true;
      const option = field.options?.find((opt) => opt.value === val);
      return Boolean(option && isNegativeDiscoveryValue(option.label));
    });

    if (matchesNegative) {
      hasNegativeAnswers = true;
      if (field.dimensionTarget) {
        unresolvedDimensions.add(field.dimensionTarget);
      }
    } else if (field.dimensionTarget) {
      positivelyConfirmedDimensions.add(field.dimensionTarget);
    }
  }

  for (const [key, rawValue] of Object.entries(formResponses)) {
    if (!(key in DIMENSION_LABELS)) continue;
    const values = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim()
      ? [rawValue]
      : [];
    if (values.some((val) => isNegativeDiscoveryValue(val))) {
      hasNegativeAnswers = true;
      unresolvedDimensions.add(key);
      positivelyConfirmedDimensions.delete(key);
    }
  }

  return {
    hasNegativeAnswers,
    unresolvedDimensions,
    positivelyConfirmedDimensions,
  };
}

function buildCompletedStateFromFeedback(
  fixture: SimulationFixture,
  submitted?: SubmittedSimulationFeedback | null,
  updatedSaNotes?: string
): SimulationState {
  const dimensionFindings = buildDimensionFindings(
    fixture.baseline.system2Result.dimensionFindings
  );
  const previousScore = fixture.baseline.jevResult.overallScore;
  const outcome = inspectSubmittedFeedback(fixture, submitted);

  if (!outcome.hasNegativeAnswers) {
    const dimensions = buildDimensions(
      fixture.feedback.rescoreJevResult.dimensions,
      fixture.baseline.system2Result.dimensionFindings,
      true,
      fixture.verdict.opportunity.meddpicc_breakdown
    );
    const currentScore = fixture.feedback.rescoreJevResult.overallScore;
    const overallDelta = currentScore - previousScore;
    const qualificationStatus: QualificationStatus =
      fixture.verdict.qualificationStatus || 'qualified';

    for (const [key, dim] of Object.entries(dimensions)) {
      const baseDim = (fixture.baseline.jevResult.dimensions as Record<string, { score: number }>)[key];
      if (baseDim) {
        dim.previousScore = baseDim.score;
        dim.delta = dim.score - baseDim.score;
      }
    }

    return {
      workflowState: 'COMPLETED',
      opportunity: {
        ...fixture.verdict.opportunity,
        ...(updatedSaNotes ? { sa_notes: updatedSaNotes } : {}),
        qualification_status: qualificationStatus,
        meddpicc_score: currentScore,
        suggested_next_steps: fixture.verdict.nextSteps,
      },
      score: currentScore,
      previousScore,
      delta: overallDelta,
      dimensionFindings,
      dimensions,
      stageGate: fixture.feedback.rescoreJevResult.stageGate,
      statusLabel: statusLabelForQualification(qualificationStatus),
      suggestedNextSteps: fixture.verdict.nextSteps,
      discoveryForm: fixture.baseline.system2Result.phase3Form,
      submittedFeedback: submitted ?? null,
    };
  }

  // Honest re-score when 1+ discovery checklist answers remain negative / unconfirmed:
  const baseDims = fixture.baseline.jevResult.dimensions;
  const rescoreDims = fixture.feedback.rescoreJevResult.dimensions;
  const effectiveJevDimensions = {} as JevScoringResult['dimensions'];
  const effectiveBreakdown: MEDDPICCBreakdown = {};

  for (const key of Object.keys(DIMENSION_LABELS) as (keyof JevScoringResult['dimensions'])[]) {
    const isResolvedPositive =
      outcome.positivelyConfirmedDimensions.has(key) && !outcome.unresolvedDimensions.has(key);

    if (isResolvedPositive) {
      effectiveJevDimensions[key] = rescoreDims[key];
      const verdictDim = fixture.verdict.opportunity.meddpicc_breakdown?.[key];
      if (verdictDim && 'score' in verdictDim) {
        effectiveBreakdown[key] = verdictDim;
      }
    } else {
      effectiveJevDimensions[key] = baseDims[key];
      const baseFinding = fixture.baseline.system2Result.dimensionFindings[key];
      effectiveBreakdown[key] = {
        key,
        label: baseDims[key].label,
        weight: baseDims[key].weight,
        score: baseDims[key].score,
        status: baseDims[key].status,
        confidence: baseDims[key].confidence,
        evidence: baseFinding?.citations || [],
        gaps: baseFinding?.gaps || [],
      };
    }
  }

  const scoreMap = Object.fromEntries(
    Object.entries(effectiveJevDimensions).map(([k, d]) => [k, d.score])
  ) as Record<keyof JevScoringResult['dimensions'], number>;

  const currentScore = computeCompositeScore(scoreMap);
  const overallDelta = currentScore - previousScore;

  const dimensions = buildDimensions(
    effectiveJevDimensions,
    fixture.baseline.system2Result.dimensionFindings,
    true,
    effectiveBreakdown
  );

  for (const [key, dim] of Object.entries(dimensions)) {
    const baseDim = (baseDims as Record<string, { score: number }>)[key];
    if (baseDim) {
      dim.previousScore = baseDim.score;
      dim.delta = dim.score - baseDim.score;
    }
  }

  const computedGate = evaluateStageGate(
    fixture.opportunity.stage_name,
    effectiveJevDimensions,
    currentScore
  );
  const blockingDimensions = new Set<string>(computedGate.blockingDimensions || []);
  const gateBlockers = [...computedGate.gateBlockers];

  const baseGate = fixture.baseline.jevResult.stageGate;
  for (const dimKey of outcome.unresolvedDimensions) {
    blockingDimensions.add(dimKey);
    const matchingBaseBlocker = baseGate.gateBlockers.find((msg) =>
      msg.toLowerCase().includes((DIMENSION_LABELS[dimKey] || dimKey).toLowerCase())
    );
    if (matchingBaseBlocker && !gateBlockers.includes(matchingBaseBlocker)) {
      gateBlockers.push(matchingBaseBlocker);
    } else if (!matchingBaseBlocker) {
      const dim = effectiveJevDimensions[dimKey as keyof JevScoringResult['dimensions']];
      const fallbackMsg = `${DIMENSION_LABELS[dimKey] || dimKey} remains unconfirmed in discovery (${dim?.score ?? 0}/10)`;
      if (!gateBlockers.includes(fallbackMsg)) {
        gateBlockers.push(fallbackMsg);
      }
    }
  }

  const stageGate: StageGateEvaluation = {
    gateReady: gateBlockers.length === 0,
    currentStage: computedGate.currentStage,
    targetStage: computedGate.targetStage,
    gateBlockers,
    blockingDimensions: Array.from(blockingDimensions),
  };

  const unresolvedLabels = Array.from(outcome.unresolvedDimensions).map(
    (k) => DIMENSION_LABELS[k] || k
  );
  const focusSummary =
    unresolvedLabels.length > 0
      ? `Close unconfirmed ${unresolvedLabels.join(' & ')} gaps before advancing to ${stageGate.targetStage}`
      : `Resolve remaining discovery gaps before advancing to ${stageGate.targetStage}`;
  const honestNextSteps = `[IN REVIEW] Hold in ${fixture.opportunity.stage_name} | Owner: ${fixture.opportunity.sa_name} (SA) | Focus: ${focusSummary} | Watch: ${fixture.baseline.system2Result.primaryRisk}`;

  return {
    workflowState: 'COMPLETED',
    opportunity: {
      ...fixture.opportunity,
      ...(updatedSaNotes ? { sa_notes: updatedSaNotes } : {}),
      qualification_status: 'in_review',
      meddpicc_score: currentScore,
      meddpicc_breakdown: effectiveBreakdown,
      suggested_next_steps: honestNextSteps,
    },
    score: currentScore,
    previousScore,
    delta: overallDelta,
    dimensionFindings,
    dimensions,
    stageGate,
    statusLabel: '[IN REVIEW]',
    suggestedNextSteps: honestNextSteps,
    discoveryForm: fixture.baseline.system2Result.phase3Form,
    submittedFeedback: submitted,
  };
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
      const dimensions = buildUnassessedDimensions();
      return {
        workflowState: 'READY_TO_ASSESS',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'unqualified',
          meddpicc_score: null,
          suggested_next_steps: null,
        },
        score: 0,
        dimensionFindings: {},
        dimensions,
        stageGate: UNASSESSED_STAGE_GATE,
        statusLabel: '[READY TO ASSESS]',
        suggestedNextSteps: null,
        discoveryForm: null,
        submittedFeedback: null,
      };
    }

    case 'ANALYZING': {
      const dimensions = buildUnassessedDimensions();
      return {
        workflowState: 'ANALYZING',
        opportunity: {
          ...fixture.opportunity,
          qualification_status: 'in_review',
          meddpicc_score: null,
          suggested_next_steps: null,
        },
        score: 0,
        dimensionFindings: {},
        dimensions,
        stageGate: UNASSESSED_STAGE_GATE,
        statusLabel: '[IN REVIEW]',
        suggestedNextSteps: null,
        discoveryForm: null,
        submittedFeedback: null,
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
        submittedFeedback: null,
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
        submittedFeedback: null,
      };
    }

    case 'COMPLETED': {
      return buildCompletedStateFromFeedback(fixture, null);
    }
  }
}

export function createSimulationState(fixture?: SimulationFixture): SimulationState {
  return getStateForWorkflow('READY_TO_ASSESS', fixture || getSimulationFixture());
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
  fixture?: SimulationFixture
): SimulationState {
  const actionFixture = 'fixture' in action ? action.fixture : undefined;
  const activeFixture = actionFixture || fixture || getSimulationFixture();
  switch (action.type) {
    case 'SWITCH_SCENARIO': {
      const targetFixture = action.fixture || getSimulationFixture(action.scenarioId);
      return createSimulationState(targetFixture);
    }

    case 'START_ASSESSMENT':
      if (state.workflowState === 'READY_TO_ASSESS') {
        return getStateForWorkflow('ANALYZING', activeFixture);
      }
      return state;

    case 'ANALYSIS_COMPLETE':
      if (state.workflowState === 'ANALYZING') {
        return getStateForWorkflow('PENDING_FEEDBACK', activeFixture);
      }
      return state;

    case 'SUBMIT_FEEDBACK':
      if (state.workflowState === 'PENDING_FEEDBACK' || state.workflowState === 'COMPLETED') {
        const nextState = getStateForWorkflow('EVALUATING', activeFixture);
        const explicitFormSubmission = action.formResponses !== undefined;
        const submittedResponses = action.formResponses ?? activeFixture.feedback.formResponses;
        const submittedNotes =
          action.notesDelta !== undefined ? action.notesDelta : activeFixture.feedback.notesDelta;
        const deltaBlock = formatSaDiscoveryDelta(
          submittedResponses,
          submittedNotes,
          activeFixture.feedback.rescoreJevResult.evaluatedAt,
          activeFixture.baseline.system2Result.phase3Form
        );
        return {
          ...nextState,
          opportunity: {
            ...nextState.opportunity,
            sa_notes: `${activeFixture.opportunity.sa_notes.trim()}\n\n${deltaBlock}`.trim(),
          },
          submittedFeedback: {
            formResponses: submittedResponses,
            notesDelta: submittedNotes,
            explicitFormSubmission,
          },
        };
      }
      return state;

    case 'EVALUATION_COMPLETE':
      if (state.workflowState === 'EVALUATING') {
        const hasDiscoveryUpdate = state.opportunity.sa_notes.includes('[SA Discovery Update -');
        return buildCompletedStateFromFeedback(
          activeFixture,
          state.submittedFeedback,
          hasDiscoveryUpdate ? state.opportunity.sa_notes : undefined
        );
      }
      return state;

    case 'STEP_BACK': {
      if (state.workflowState === 'COMPLETED' || state.workflowState === 'EVALUATING') {
        const nextState = getStateForWorkflow('PENDING_FEEDBACK', activeFixture);
        return {
          ...nextState,
          previousScore: null,
          delta: null,
          submittedFeedback: null,
        };
      }
      if (state.workflowState === 'PENDING_FEEDBACK' || state.workflowState === 'ANALYZING') {
        const nextState = getStateForWorkflow('READY_TO_ASSESS', activeFixture);
        return {
          ...nextState,
          previousScore: null,
          delta: null,
          submittedFeedback: null,
        };
      }
      return state;
    }

    case 'JUMP_TO_STATE': {
      const rawTarget = action.target ?? action.targetState;
      const target = resolveTargetState(rawTarget);
      if (target) {
        return getStateForWorkflow(target, activeFixture);
      }
      return state;
    }

    case 'RESET': {
      const targetFixture = action.fixture || activeFixture;
      return createSimulationState(targetFixture);
    }

    default:
      return state;
  }
}
