import { z } from 'zod';
import { JevScoringResult } from './jev-schema';
import { JsonRenderFormSchema, DimensionTargetSchema } from '@/lib/ui/json-render-schema';
import { System2ModelSchema, System2ModelOption } from '@/lib/models';


export const QualificationGapSchema = z.object({
  dimension: DimensionTargetSchema,
  dimensionLabel: z.string(),
  score: z.number(),
  status: z.enum(['unaddressed', 'partial']),
  isStageGateBlocker: z.boolean(),
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']),
  verifiedFact: z.string(),
  aeAssumption: z.string(),
  riskAnalysis: z.string(),
});
export type QualificationGap = z.infer<typeof QualificationGapSchema>;

export const CompetitiveCounterPointSchema = z.object({
  competitor: z.string(),
  threatLevel: z.enum(['low', 'medium', 'high']),
  competitorClaim: z.string(),
  vercelDifferentiator: z.string(),
  tacticalAngle: z.string(),
  trapQuestion: z.string(),
});
export type CompetitiveCounterPoint = z.infer<typeof CompetitiveCounterPointSchema>;

/** Per-dimension citations (verbatim note quotes) and gap callouts. Jev returns no text, so these come from System 2. */
export const DimensionFindingSchema = z.object({
  citations: z.array(z.string()),
  gaps: z.array(z.string()),
});
export type DimensionFinding = z.infer<typeof DimensionFindingSchema>;

export const DimensionFindingsSchema = z.object({
  metrics: DimensionFindingSchema,
  economicBuyer: DimensionFindingSchema,
  decisionCriteria: DimensionFindingSchema,
  decisionProcess: DimensionFindingSchema,
  paperProcess: DimensionFindingSchema,
  identifyPain: DimensionFindingSchema,
  champion: DimensionFindingSchema,
  competition: DimensionFindingSchema,
});

/** What the System 2 model must return. Code, not the model, turns this into status and next steps. */
export const System2ModelOutputSchema = z.object({
  phase1Gaps: z.array(QualificationGapSchema),
  phase2Competitive: z.array(CompetitiveCounterPointSchema),
  phase3Form: JsonRenderFormSchema,
  dimensionFindings: DimensionFindingsSchema,
  fatalBlocker: z
    .string()
    .nullable()
    .describe('An unresolvable constraint that rules out Vercel (e.g. strict on-premise mandate), or null.'),
  valueFocus: z.string().describe('Core technical or business value to focus on, a short phrase.'),
  primaryRisk: z.string().describe('Primary non-competitor risk to watch, a short phrase.'),
  nextMilestone: z.string().describe('The single next milestone action if the deal advances, one sentence.'),
  summary: z.string(),
});

export const System2AnalysisResultSchema = System2ModelOutputSchema.extend({
  opportunityId: z.string(),
  modelUsed: System2ModelSchema,
});
export type System2AnalysisResult = z.infer<typeof System2AnalysisResultSchema>;
