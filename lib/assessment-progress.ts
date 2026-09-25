import { z } from 'zod';
import { JevScoringResultSchema } from '@/lib/agents/jev-schema';
import { System2AnalysisResultSchema } from '@/lib/agents/system2';
import type { Opportunity } from '@/lib/types/crm';

/**
 * What `run_assessment` reports while it runs (each yield is an `action.partial`) and what it
 * returns when the session closes (`action.result`). One definition for both sides: the tool is
 * typed by these schemas, and the workbench validates the stream against them. Client-safe.
 */

// The Opportunity is a CRM row read from Postgres; check the fields the workbench relies on.
export const OpportunitySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    meddpicc_score: z.number().nullable(),
    qualification_status: z.enum(['unqualified', 'in_review', 'qualified', 'disqualified']),
    suggested_next_steps: z.string().nullable(),
    meddpicc_breakdown: z.record(z.unknown()),
  })
  .passthrough()
  .transform((o) => o as unknown as Opportunity);

const Round = z.enum(['baseline', 'rescore']);

export const AssessmentProgressSchema = z.discriminatedUnion('stage', [
  /** Jev has answered; the CRM write is still in flight. */
  z.object({ stage: z.literal('jev_scored'), round: Round, jevResult: JevScoringResultSchema }),
  /** The Jev scores are persisted. After the baseline round, System 2 runs next. */
  z.object({ stage: z.literal('jev_saved'), round: Round, jevResult: JevScoringResultSchema, opportunity: OpportunitySchema }),
  /** The validated, persisted System 2 result: its discovery form is what the SA answers. */
  z.object({ stage: z.literal('system2_saved'), system2Result: System2AnalysisResultSchema, opportunity: OpportunitySchema }),
  /** The SA answers are recorded (once per session and payload). */
  z.object({ stage: z.literal('feedback_recorded'), feedback: z.object({ recorded: z.boolean(), feedbackKey: z.string() }) }),
]);
export type AssessmentProgress = z.infer<typeof AssessmentProgressSchema>;

/** The session's final result: status and next steps decided in code, written back atomically. */
export const AssessmentClosedSchema = z.object({
  stage: z.literal('closed'),
  writeback: z.object({
    suggestedNextSteps: z.string().min(1),
    deltaScore: z.number(),
    qualificationStatus: z.enum(['unqualified', 'in_review', 'qualified', 'disqualified']),
  }),
  opportunity: OpportunitySchema,
});
export type AssessmentClosed = z.infer<typeof AssessmentClosedSchema>;
