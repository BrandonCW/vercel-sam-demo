import { z } from 'zod';

export const DimensionStatusSchema = z.enum(['unaddressed', 'partial', 'verified']);
export type DimensionStatus = z.infer<typeof DimensionStatusSchema>;

export const DimensionResultSchema = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  weight: z.number().optional(),
  score: z.number().int().min(0).max(10),
  status: DimensionStatusSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  gaps: z.array(z.string()),
});
export type DimensionResult = z.infer<typeof DimensionResultSchema>;

export const CompetitiveThreatLevelSchema = z.enum(['low', 'medium', 'high']);
export type CompetitiveThreatLevel = z.infer<typeof CompetitiveThreatLevelSchema>;

export const CompetitiveMentionSchema = z.object({
  name: z.string(),
  threatLevel: CompetitiveThreatLevelSchema,
  evidence: z.string(),
  contextSummary: z.string(),
});
export type CompetitiveMention = z.infer<typeof CompetitiveMentionSchema>;

export const StageGateEvaluationSchema = z.object({
  gateReady: z.boolean(),
  currentStage: z.string(),
  targetStage: z.string(),
  gateBlockers: z.array(z.string()),
});
export type StageGateEvaluation = z.infer<typeof StageGateEvaluationSchema>;

export const JevScoringResultSchema = z.object({
  dealId: z.string(),
  overallScore: z.number().int().min(0).max(100),
  dimensions: z.object({
    metrics: DimensionResultSchema,
    economicBuyer: DimensionResultSchema,
    decisionCriteria: DimensionResultSchema,
    decisionProcess: DimensionResultSchema,
    paperProcess: DimensionResultSchema,
    identifyPain: DimensionResultSchema,
    champion: DimensionResultSchema,
    competition: DimensionResultSchema,
  }),
  competitiveFlags: z.array(CompetitiveMentionSchema),
  stageGate: StageGateEvaluationSchema,
  evaluatedAt: z.string().datetime(),
});
export type JevScoringResult = z.infer<typeof JevScoringResultSchema>;

export interface JevScoringInput {
  dealId: string;
  name?: string;
  accountName?: string;
  stageName: string;
  amount?: number;
  aeNotes: string;
  saNotes: string;
}
