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

/**
 * The session's verdict: `run_assessment`'s return value, built in code. A completed action whose
 * output parses as this is a pass; any failure is a thrown error, so eve marks the action failed.
 */
export const AssessmentResultSchema = z.object({
  status: z.literal('written_back'),
  opportunityId: z.string().min(1),
  qualificationStatus: z.enum(['unqualified', 'in_review', 'qualified', 'disqualified']),
  baselineScore: z.number(),
  finalScore: z.number(),
  delta: z.number(),
  nextSteps: z.string().min(1),
  /** Id of the session's single `writeback` audit row. */
  writebackId: z.string().min(1),
  /** Whether SA answers were recorded, or the writeback was requested without them. */
  feedback: z.enum(['recorded', 'skipped']),
  opportunity: OpportunitySchema,
});
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;
