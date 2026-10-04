import { z } from 'zod';
import { JevScoringResultSchema, type JevScoringResult } from '@/lib/agents/jev-schema';
import { System2AnalysisResultSchema, type System2AnalysisResult } from '@/lib/agents/system2';
import { AssessmentResultSchema, OpportunitySchema, type AssessmentResult } from '@/lib/assessment-progress';
import type { Opportunity } from '@/lib/types/crm';

export const SimulationFeedbackSchema = z.object({
  formResponses: z.record(z.union([z.string(), z.array(z.string())])),
  notesDelta: z.string().optional(),
  rescoreJevResult: JevScoringResultSchema,
});
export type SimulationFeedback = z.infer<typeof SimulationFeedbackSchema>;

export const SimulationBaselineSchema = z.object({
  jevResult: JevScoringResultSchema,
  system2Result: System2AnalysisResultSchema,
});
export type SimulationBaseline = z.infer<typeof SimulationBaselineSchema>;

export const SimulationFixtureSchema = z.object({
  scenarioId: z.string().min(1),
  opportunity: OpportunitySchema,
  baseline: SimulationBaselineSchema,
  feedback: SimulationFeedbackSchema,
  verdict: AssessmentResultSchema,
  capturedAt: z.string(),
});

export type SimulationFixture = {
  scenarioId: string;
  opportunity: Opportunity;
  baseline: {
    jevResult: JevScoringResult;
    system2Result: System2AnalysisResult;
  };
  feedback: {
    formResponses: Record<string, string | string[]>;
    notesDelta?: string;
    rescoreJevResult: JevScoringResult;
  };
  verdict: AssessmentResult;
  capturedAt: string;
};
