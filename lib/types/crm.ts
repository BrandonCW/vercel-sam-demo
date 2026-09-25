export type QualificationStatus = 'unqualified' | 'in_review' | 'qualified' | 'disqualified';

export type DimensionStatus = 'unaddressed' | 'partial' | 'verified';

export interface DimensionEvaluation {
  key?: string;
  label?: string;
  weight?: number; // e.g. 0.20
  score: number; // 0 - 10
  status: DimensionStatus;
  confidence: number; // 0.0 - 1.0
  evidence?: string[];
  gaps?: string[];
}

export interface StageGateEvaluation {
  gateReady: boolean;
  currentStage: string;
  targetStage: string;
  gateBlockers: string[];
  blockingDimensions?: string[];
}

export type MEDDPICCBreakdown = {
  identifyPain?: DimensionEvaluation;
  champion?: DimensionEvaluation;
  economicBuyer?: DimensionEvaluation;
  decisionCriteria?: DimensionEvaluation;
  decisionProcess?: DimensionEvaluation;
  metrics?: DimensionEvaluation;
  competition?: DimensionEvaluation;
  paperProcess?: DimensionEvaluation;
  stageGate?: StageGateEvaluation;
  [key: string]: DimensionEvaluation | StageGateEvaluation | undefined;
};

export interface Opportunity {
  id: string;
  name: string;
  account_name: string;
  stage_name: string;
  amount: number;
  close_date: string;
  ae_name: string;
  sa_name: string;
  ae_notes: string;
  sa_notes: string;
  suggested_next_steps: string | null;
  qualification_status: QualificationStatus;
  meddpicc_score: number | null;
  meddpicc_breakdown: MEDDPICCBreakdown;
  competitive_flags: string[];
  stage_gate?: StageGateEvaluation;
  created_at: string;
  updated_at: string;
  /**
   * When the Opportunity was last reset to its scenario baseline (database time), if
   * read with it. A reset deletes every Assessment Session's results, so a session
   * saved before this marker is stale.
   */
  last_reset_at?: string | null;
}

export interface DealScenario {
  scenario_id: string;
  title: string;
  description: string;
  default_data: Omit<Opportunity, 'created_at' | 'updated_at'>;
  created_at: string;
}

export interface DealInteraction {
  id: string;
  opportunity_id: string;
  actor: 'system1_jev' | 'system2_llm' | 'sa_user';
  action: 'initial_scoring' | 'questions_generated' | 'sa_feedback' | 'writeback' | 'reset';
  payload: Record<string, unknown>;
  created_at: string;
}

export { SYSTEM2_MODELS, DEFAULT_SYSTEM2_MODEL } from '@/lib/models';
export type { System2ModelOption, ModelConfig } from '@/lib/models';

export type AssessmentSessionState =
  | 'initiated'
  | 'analyzing'
  | 'pending_feedback'
  | 'resumed'
  | 'delta_scoring'
  | 'writeback'
  | 'closed';

