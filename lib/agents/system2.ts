import { JevScoringResult } from './jev-schema';
import { JsonRenderForm, DimensionTarget } from '@/lib/ui/json-render-schema';
import { System2ModelOption } from '@/lib/types/crm';

export interface System2Input {
  opportunity: {
    id: string;
    name: string;
    stageName: string;
    amount: number;
    aeNotes: string;
    saNotes: string;
  };
  jevResult: JevScoringResult;
  model?: System2ModelOption;
}

export interface QualificationGap {
  dimension: DimensionTarget;
  dimensionLabel: string;
  score: number;
  status: 'unaddressed' | 'partial';
  isStageGateBlocker: boolean;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  verifiedFact: string;
  aeAssumption: string;
  riskAnalysis: string;
}

export interface CompetitiveCounterPoint {
  competitor: string;
  threatLevel: 'low' | 'medium' | 'high';
  competitorClaim: string;
  vercelDifferentiator: string;
  tacticalAngle: string;
  trapQuestion: string;
}

export interface System2AnalysisResult {
  opportunityId: string;
  modelUsed: System2ModelOption;
  phase1Gaps: QualificationGap[];
  phase2Competitive: CompetitiveCounterPoint[];
  phase3Form: JsonRenderForm;
  summary: string;
}
