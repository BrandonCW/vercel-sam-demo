import type { JevScoringResult } from './jev-schema';
import type { System2AnalysisResult } from './system2';
import type { MEDDPICCBreakdown, Opportunity, QualificationStatus } from '@/lib/types/crm';

/**
 * Deterministic qualification decisions. The models supply typed facts (Jev
 * scores and gate, System 2 findings); these functions decide the outcome.
 */

export function decideQualificationStatus(
  jev: JevScoringResult,
  system2: System2AnalysisResult
): QualificationStatus {
  if (system2.fatalBlocker) return 'disqualified';
  return jev.stageGate.gateReady ? 'qualified' : 'in_review';
}

const THREAT_RANK = { high: 3, medium: 2, low: 1 } as const;

/** Model text must not break the pipe-delimited contract. */
function clean(text: string): string {
  return text.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

/**
 * Standardized Suggested Next Steps:
 * [<STATUS>] <Immediate Milestone Action> | Owner: <AE/SA> | Focus: <Value> | Watch: <Risk/Competitor>
 */
export function synthesizeSuggestedNextSteps(
  status: QualificationStatus,
  jev: JevScoringResult,
  system2: System2AnalysisResult
): string {
  const gate = jev.stageGate;
  let tag: string;
  let action: string;
  let owner: string;

  if (status === 'disqualified') {
    tag = 'DISQUALIFIED';
    action = `Archive opportunity. ${system2.fatalBlocker ?? 'Disqualifying constraint confirmed.'}`;
    owner = 'AE';
  } else if (status === 'qualified') {
    tag = 'QUALIFIED';
    action = `Advance to ${gate.targetStage}. ${system2.nextMilestone}`;
    owner = 'SA (Lead) + AE';
  } else {
    tag = 'IN REVIEW';
    action = gate.gateBlockers[0]
      ? `Hold at ${gate.currentStage}. Clear gate blocker: ${gate.gateBlockers[0]}`
      : `Hold at ${gate.currentStage}. Complete discovery before advancing.`;
    owner = gate.blockingDimensions.includes('economicBuyer') ? 'AE' : 'AE (Lead) + SA';
  }

  const top = [...jev.competitiveFlags].sort(
    (a, b) => THREAT_RANK[b.threatLevel] - THREAT_RANK[a.threatLevel]
  )[0];
  const watch = top ? `${top.name} (${top.threatLevel} threat)` : system2.primaryRisk;

  return `[${tag}] ${clean(action)} | Owner: ${owner} | Focus: ${clean(system2.valueFocus)} | Watch: ${clean(watch)}`;
}

/** Jev dimensions plus System 2 citations (evidence) and gap callouts, as persisted for the rubric UI. */
export function mergeSystem2Findings(
  jev: JevScoringResult,
  system2: System2AnalysisResult
): MEDDPICCBreakdown {
  const breakdown: MEDDPICCBreakdown = { stageGate: jev.stageGate };
  for (const [key, dimension] of Object.entries(jev.dimensions) as [
    keyof JevScoringResult['dimensions'],
    JevScoringResult['dimensions'][keyof JevScoringResult['dimensions']],
  ][]) {
    const finding = system2.dimensionFindings[key];
    breakdown[key] = { ...dimension, evidence: finding.citations, gaps: finding.gaps };
  }
  return breakdown;
}

/** The Opportunity fields a System 1 result sets (persisted by recordJevScoring). */
export function jevOpportunityFields(jev: JevScoringResult): {
  meddpicc_score: number;
  meddpicc_breakdown: MEDDPICCBreakdown;
  competitive_flags: string[];
} {
  return {
    meddpicc_score: jev.overallScore,
    meddpicc_breakdown: { ...jev.dimensions, stageGate: jev.stageGate },
    competitive_flags: jev.competitiveFlags.map((c) => c.name),
  };
}

/**
 * The Opportunity as it will read once a System 1 result is written: the same fields
 * recordJevScoring writes, and an unqualified deal moves to in_review. Pure, for the
 * workbench to show scores before the write lands.
 */
export function withJevScores(opportunity: Opportunity, jev: JevScoringResult): Opportunity {
  return {
    ...opportunity,
    ...jevOpportunityFields(jev),
    qualification_status: opportunity.qualification_status === 'unqualified' ? 'in_review' : opportunity.qualification_status,
  };
}
