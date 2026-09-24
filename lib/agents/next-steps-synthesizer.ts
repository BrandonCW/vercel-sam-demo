import { Opportunity, QualificationStatus, StageGateEvaluation } from '@/lib/types/crm';
import { JevScoringResult } from './jev-schema';

export interface NextStepsSynthesisInput {
  opportunity: Pick<Opportunity, 'name' | 'stage_name' | 'ae_notes' | 'sa_notes' | 'competitive_flags'>;
  qualificationStatus: QualificationStatus;
  stageGate: StageGateEvaluation;
  jevResult?: JevScoringResult;
  formResponses?: Record<string, string | string[]>;
  notesDelta?: string;
}

/**
 * Standardized Suggested Next Steps synthesis.
 * Generates a single actionable string formatted strictly as:
 * [<STATUS>] <Immediate Milestone Action> | Owner: <AE/SA> | Focus: <Core Technical or Business Value> | Watch: <Risk/Competitor>
 *
 * Status tag matches [QUALIFIED], [IN REVIEW], or [DISQUALIFIED].
 */
export function synthesizeSuggestedNextSteps(input: NextStepsSynthesisInput): string {
  const { opportunity, qualificationStatus, stageGate, formResponses } = input;
  const combinedNotes = `${opportunity.ae_notes || ''} ${opportunity.sa_notes || ''}`.toLowerCase();

  // 1. Status Tag
  let statusTag: 'QUALIFIED' | 'IN REVIEW' | 'DISQUALIFIED';
  if (qualificationStatus === 'qualified') {
    statusTag = 'QUALIFIED';
  } else if (qualificationStatus === 'disqualified') {
    statusTag = 'DISQUALIFIED';
  } else {
    statusTag = 'IN REVIEW';
  }

  // 2. Owner
  let owner = 'AE/SA';
  if (statusTag === 'QUALIFIED') {
    owner = 'SA (Lead) + AE';
  } else if (statusTag === 'DISQUALIFIED') {
    owner = 'AE';
  } else {
    // In review: if EB is the primary blocker, AE owns resolution; otherwise joint
    const hasEbBlocker = stageGate.gateBlockers.some((b) => /economic buyer|budget|signoff/i.test(b));
    owner = hasEbBlocker ? 'AE' : 'AE (Lead) + SA';
  }

  // 3. Focus (Core Technical or Business Value)
  let focus = 'Enterprise Architecture Validation & Technical Acceptance Benchmarks';
  if (/turborepo|app router|pages router|isr|cache invalidation/i.test(combinedNotes)) {
    focus = 'Demonstrate Turborepo Remote Caching & ISR Cache Invalidation';
  } else if (/vpc|secure compute|egress|soc2|compliance/i.test(combinedNotes)) {
    focus = 'Secure Compute, VPC Peering & Enterprise Security Architecture';
  } else if (/core web vitals|lcp|preview branches|shopify/i.test(combinedNotes)) {
    focus = 'Core Web Vitals Optimization & Headless Storefront Performance';
  }

  // 4. Watch (Risk/Competitor)
  let watch = 'Budget reallocation and timeline slippage prior to quarterly freeze.';
  const primaryCompetitor = opportunity.competitive_flags?.[0]?.toLowerCase() || '';

  if (primaryCompetitor.includes('netlify') || combinedNotes.includes('netlify')) {
    watch = 'Netlify 30% discount renewal offer.';
  } else if (primaryCompetitor.includes('amplify') || combinedNotes.includes('amplify')) {
    watch = 'AWS EDP credit subsidies and native service bundles.';
  } else if (primaryCompetitor.includes('cloudflare') || combinedNotes.includes('cloudflare')) {
    watch = 'Cloudflare zero-egress cost claims.';
  } else if (primaryCompetitor.includes('kubernetes') || combinedNotes.includes('kubernetes') || combinedNotes.includes('k8s')) {
    watch = 'Platform team defending bespoke Kubernetes stack.';
  }

  // 5. Immediate Milestone Action
  let milestoneAction = '';
  if (statusTag === 'QUALIFIED') {
    const target = stageGate.targetStage || 'Stage 3 (Technical Validation)';
    if (/turborepo|app router|isr/i.test(combinedNotes)) {
      milestoneAction = `Advance to ${target}. Schedule 60-min deep dive with VP of E-Commerce to demonstrate Turborepo Remote Caching and Next.js 14 App Router ISR cache-invalidation; prepare POC preview environment on Vercel Enterprise.`;
    } else if (/amplify|vpc|secure compute/i.test(combinedNotes)) {
      milestoneAction = `Advance to ${target}. Coordinate with security and platform leads to demonstrate Vercel Secure Compute and VPC peering connectivity; initiate 2-week technical POC.`;
    } else {
      milestoneAction = `Advance to ${target}. Schedule technical validation kickoff with customer technical leadership and deploy staging benchmark environment.`;
    }
  } else if (statusTag === 'DISQUALIFIED') {
    milestoneAction = 'Archive opportunity. Customer confirmed strict unresolvable architectural constraints incompatible with Vercel edge deployment.';
  } else {
    // In review
    const current = stageGate.currentStage || 'Stage 2 (Discovery)';
    const firstBlocker = stageGate.gateBlockers[0];
    if (stageGate.gateBlockers.some((b) => /economic buyer|budget|signoff/i.test(b))) {
      milestoneAction = `Hold at ${current}. Do not commit dedicated SA architecture resources until Economic Buyer authority is verified. AE to schedule 30-min budget alignment call with VP of E-Commerce.`;
    } else if (firstBlocker) {
      milestoneAction = `Hold at ${current}. Complete technical discovery to clear gate blockers: ${firstBlocker}.`;
    } else {
      milestoneAction = `Hold at ${current}. Complete additional technical discovery before advancing to formal technical validation.`;
    }
  }

  return `[${statusTag}] ${milestoneAction} | Owner: ${owner} | Focus: ${focus} | Watch: ${watch}`;
}
