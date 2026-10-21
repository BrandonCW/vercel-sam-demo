import type { Opportunity, StageGateEvaluation } from '@/lib/types/crm';
import type { DimensionStatus } from '@/lib/agents/jev-schema';
import type { JsonRenderForm } from '@/lib/ui/json-render-schema';
import type { SimulationFixture } from './fixture-schema';

export type WorkflowState =
  | 'READY_TO_ASSESS'
  | 'ANALYZING'
  | 'PENDING_FEEDBACK'
  | 'EVALUATING'
  | 'COMPLETED';

export type WorkbenchMode = 'simulation' | 'live';

export interface SimulationDimensionFinding {
  citations: string[];
  quotes: string[];
  gaps: string[];
}

export interface SimulationDimension {
  key?: string;
  label: string;
  weight: number;
  score: number;
  status: DimensionStatus;
  confidence?: number;
  quote?: string;
  gap?: string;
  quotes?: string[];
  gaps?: string[];
  previousScore?: number | null;
  delta?: number | null;
}

export interface SimulationState {
  workflowState: WorkflowState;
  opportunity: Opportunity;
  score: number;
  previousScore?: number | null;
  delta?: number | null;
  dimensionFindings: Record<string, SimulationDimensionFinding>;
  dimensions: Record<string, SimulationDimension>;
  stageGate: StageGateEvaluation;
  statusLabel: string;
  suggestedNextSteps: string | null;
  discoveryForm: JsonRenderForm | null;
}

export type SimulationAction =
  | { type: 'START_ASSESSMENT' }
  | { type: 'ANALYSIS_COMPLETE' }
  | {
      type: 'SUBMIT_FEEDBACK';
      formResponses?: Record<string, string | string[]>;
      notesDelta?: string;
    }
  | { type: 'EVALUATION_COMPLETE' }
  | { type: 'STEP_BACK' }
  | {
      type: 'JUMP_TO_STATE';
      target?: WorkflowState | number;
      targetState?: WorkflowState | number;
    }
  | { type: 'RESET'; fixture?: SimulationFixture }
  | { type: 'SWITCH_SCENARIO'; scenarioId: string; fixture?: SimulationFixture };
