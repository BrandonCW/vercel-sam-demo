import type { JevScoringResult } from '@/lib/agents/jev-schema';
import type { System2AnalysisResult } from '@/lib/agents/system2';
import type { Opportunity, QualificationStatus } from '@/lib/types/crm';

/**
 * What `run_assessment` reports while it runs (each yield is an `action.partial`) and what it
 * returns when the session closes (`action.result`). Client-safe types only; the workbench
 * validates the stream against its own schemas (lib/assessment-results.ts).
 */
export type AssessmentProgress =
  /** Jev has answered; the CRM write is still in flight. */
  | { stage: 'jev_scored'; round: 'baseline' | 'rescore'; jevResult: JevScoringResult }
  /** The Jev scores are persisted. After the baseline round, System 2 runs next. */
  | { stage: 'jev_saved'; round: 'baseline' | 'rescore'; jevResult: JevScoringResult; opportunity: Opportunity }
  /** The validated, persisted System 2 result: its discovery form is what the SA answers. */
  | { stage: 'system2_saved'; system2Result: System2AnalysisResult; opportunity: Opportunity }
  /** The SA answers are recorded (once per session and payload). */
  | { stage: 'feedback_recorded'; feedback: { recorded: boolean; feedbackKey: string } };

/** The session's final result: status and next steps decided in code, written back atomically. */
export interface AssessmentClosed {
  stage: 'closed';
  writeback: { suggestedNextSteps: string; deltaScore: number; qualificationStatus: QualificationStatus };
  opportunity: Opportunity;
}
