import { JevScoringResult } from './jev-schema';
import {
  JsonRenderForm,
  JsonRenderSection,
  FormField,
  JsonRenderFormSchema,
  DimensionTarget,
} from '@/lib/ui/json-render-schema';
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

const DIMENSION_TARGET_KEYS: DimensionTarget[] = [
  'metrics',
  'economicBuyer',
  'decisionCriteria',
  'decisionProcess',
  'paperProcess',
  'identifyPain',
  'champion',
  'competition',
];

const DIMENSION_LABELS: Record<DimensionTarget, string> = {
  metrics: 'Metrics',
  economicBuyer: 'Economic Buyer',
  decisionCriteria: 'Decision Criteria',
  decisionProcess: 'Decision Process',
  paperProcess: 'Paper Process',
  identifyPain: 'Identify Pain',
  champion: 'Champion',
  competition: 'Competition',
};

/**
 * Phase 1: Gap Synthesis & Risk Analysis
 * Evaluates unaddressed and partial dimensions and Stage Gate blockers from System 1 Jev output,
 * isolating verified facts from Account Executive assumptions.
 */
export function runPhase1GapAnalysis(
  input: System2Input
): QualificationGap[] {
  const { opportunity, jevResult } = input;
  const gaps: QualificationGap[] = [];
  const blockers = jevResult.stageGate.gateBlockers;
  const combinedNotes = `${opportunity.aeNotes}\n${opportunity.saNotes}`;

  for (const dimKey of DIMENSION_TARGET_KEYS) {
    const dimResult = jevResult.dimensions[dimKey];
    if (dimResult.status === 'verified') continue;

    const isStageGateBlocker = blockers.some((b) =>
      b.toLowerCase().includes(DIMENSION_LABELS[dimKey].toLowerCase())
    );

    let riskLevel: QualificationGap['riskLevel'] = 'low';
    if (isStageGateBlocker || dimResult.score <= 3) {
      riskLevel = isStageGateBlocker ? 'critical' : 'high';
    } else if (dimResult.status === 'partial') {
      riskLevel = 'medium';
    }

    // Isolate verified facts vs AE assumptions
    let verifiedFact = 'No documented evidence in notes.';
    let aeAssumption = 'AE assumed criteria would be resolved during standard cycle.';
    let riskAnalysis = dimResult.gaps[0] || 'Dimension lacks verification.';

    if (dimKey === 'economicBuyer') {
      if (/met with vp of e-commerce/i.test(combinedNotes)) {
        verifiedFact = 'Meeting occurred with VP of E-Commerce and budget figure was referenced.';
        aeAssumption = 'AE assumed VP holds unilateral discretionary sign-off authority without checking CFO or Procurement approval matrices.';
        riskAnalysis = 'If VP lacks sole sign-off authority, deal will stall at contract review stage.';
      } else if (/cto|cfo|ceo/i.test(combinedNotes)) {
        verifiedFact = 'Executive stakeholder mentioned as sponsor in inbound or notes.';
        aeAssumption = 'AE assumed executive endorsement equates to committed budget allocation.';
        riskAnalysis = 'Budget allocation unconfirmed; risk of deal slipping past planned close date.';
      } else {
        verifiedFact = 'No direct engagement with economic buyer documented.';
        aeAssumption = 'AE assumed technical champion has purchasing authority.';
        riskAnalysis = 'Critical risk of advancing technical validation without budget sponsor.';
      }
    } else if (dimKey === 'metrics') {
      if (/45-minute|45m|build\s*times?/i.test(combinedNotes)) {
        verifiedFact = 'Prospect reported slow build times and deploy delays causing developer frustration.';
        aeAssumption = 'AE assumed build-time reduction alone justifies enterprise pricing without calculating exact developer idle cost.';
        riskAnalysis = 'Need documented target benchmarks (e.g. <5 min build with Turborepo Remote Cache, Core Web Vitals targets).';
      } else if (/lcp|core web vitals/i.test(combinedNotes)) {
        verifiedFact = 'Prospect stated interest in Core Web Vitals (LCP < 1.5s).';
        aeAssumption = 'AE assumed frontend performance is directly tied to revenue conversion without baseline data.';
        riskAnalysis = 'Target metrics need formal sign-off as acceptance criteria.';
      } else {
        verifiedFact = 'No quantifiable KPIs documented.';
        aeAssumption = 'AE assumed qualitative satisfaction suffices for business justification.';
        riskAnalysis = 'Without quantifiable metrics, business case will fail CFO review.';
      }
    } else if (dimKey === 'decisionCriteria') {
      if (/app router|turborepo/i.test(combinedNotes)) {
        verifiedFact = 'Prospect evaluating Next.js App Router and Turborepo.';
        aeAssumption = 'AE assumed Vercel is the only viable deployment platform without locking SLA and edge latency specs.';
        riskAnalysis = 'Technical criteria must explicitly specify Vercel-exclusive capabilities to box out competitors.';
      } else if (/soc2|vpc/i.test(combinedNotes)) {
        verifiedFact = 'Security requirements (SOC2 Type II, VPC/egress IP filtering) mentioned.';
        aeAssumption = 'AE assumed standard enterprise package satisfies compliance without SA architecture review.';
        riskAnalysis = 'Security architecture must be validated before commercial stage.';
      }
    } else if (dimKey === 'competition') {
      const flags = jevResult.competitiveFlags;
      if (flags.length > 0) {
        verifiedFact = `Competitor ${flags.map((f) => f.name).join(', ')} actively positioned with customer.`;
        aeAssumption = 'AE assumed product superiority alone wins against competitor discounting.';
        riskAnalysis = 'Discounting pressure or bundled credits could derail deal if counter-positioning is delayed.';
      }
    } else if (dimKey === 'decisionProcess') {
      if (/launch before|peak freeze|nov 1/i.test(combinedNotes)) {
        verifiedFact = 'Hard target launch deadline noted before Q4 peak freeze.';
        aeAssumption = 'AE assumed standard procurement schedule fits within timeline.';
        riskAnalysis = 'Evaluation schedule and architecture review board milestones must be mapped backwards from launch date.';
      }
    } else if (dimKey === 'paperProcess') {
      verifiedFact = 'No legal, procurement, or MSA review timeline documented.';
      aeAssumption = 'AE assumed standard terms will be accepted quickly.';
      riskAnalysis = 'Enterprise legal review typically adds 3–6 weeks; unmapped paper process risks closing delay.';
    }

    gaps.push({
      dimension: dimKey,
      dimensionLabel: DIMENSION_LABELS[dimKey],
      score: dimResult.score,
      status: dimResult.status as 'unaddressed' | 'partial',
      isStageGateBlocker,
      riskLevel,
      verifiedFact,
      aeAssumption,
      riskAnalysis,
    });
  }

  // Sort: Stage Gate blockers first, then highest risk
  return gaps.sort((a, b) => {
    if (a.isStageGateBlocker && !b.isStageGateBlocker) return -1;
    if (!a.isStageGateBlocker && b.isStageGateBlocker) return 1;
    const riskRank = { critical: 4, high: 3, medium: 2, low: 1 };
    return riskRank[b.riskLevel] - riskRank[a.riskLevel];
  });
}

/**
 * Phase 2: Competitive Playbook & Battlecard Synthesis
 * Generates tactical counter-positioning points against detected competitors
 * using Vercel enterprise differentiators.
 */
export function runPhase2CompetitivePlaybook(
  input: System2Input
): CompetitiveCounterPoint[] {
  const { jevResult } = input;
  const points: CompetitiveCounterPoint[] = [];

  for (const comp of jevResult.competitiveFlags) {
    const compName = comp.name.toLowerCase();

    if (compName.includes('netlify')) {
      points.push({
        competitor: 'Netlify',
        threatLevel: comp.threatLevel,
        competitorClaim:
          'Netlify offers multi-year renewal discounts (20–40%) and familiar developer ergonomics for static and hybrid Next.js sites.',
        vercelDifferentiator:
          'Next.js first-party optimization, App Router native streaming, Incremental Static Regeneration (ISR) at scale, Turborepo remote caching, and Edge Middleware latency parity.',
        tacticalAngle:
          'Expose Netlify cache skew on dynamic Next.js App Router updates, deploy queue concurrency bottlenecks, and cold-start execution delays.',
        trapQuestion:
          'Has the team observed cache invalidation skew or build concurrency queueing during peak product drops on Netlify?',
      });
    } else if (compName.includes('amplify')) {
      points.push({
        competitor: 'AWS Amplify',
        threatLevel: comp.threatLevel,
        competitorClaim:
          'AWS account team offering bundled Enterprise Agreement (EDP) credits and consolidated cloud billing.',
        vercelDifferentiator:
          'Purpose-built frontend cloud with sub-second preview deployments, Edge Middleware, deep framework optimization, and zero container orchestration overhead.',
        tacticalAngle:
          'Shift evaluation from hosting credits to developer velocity, preview deployment workflows, and high maintenance costs of generic container wrappers.',
        trapQuestion:
          'How many platform engineering hours are currently spent troubleshooting Amplify build failures and CloudFormation container deployments?',
      });
    } else if (compName.includes('cloudflare')) {
      points.push({
        competitor: 'Cloudflare Pages',
        threatLevel: comp.threatLevel,
        competitorClaim:
          'Zero-egress cost claims and existing enterprise DNS/WAF infrastructure footprint.',
        vercelDifferentiator:
          'Full-stack serverless compute capabilities, native Node.js ecosystem runtime compatibility, and dynamic ISR cache invalidation without sandbox restrictions.',
        tacticalAngle:
          'Highlight V8 isolate package incompatibilities, lack of full Node.js API runtime support, and developer friction in complex e-commerce monoliths.',
        trapQuestion:
          'Are all target npm dependencies and backend integration libraries fully supported in Cloudflare workers without polyfill bloat?',
      });
    } else if (compName.includes('kubernetes') || compName.includes('ecs') || compName.includes('diy')) {
      points.push({
        competitor: 'DIY Kubernetes / AWS ECS',
        threatLevel: comp.threatLevel,
        competitorClaim:
          'In-house platform engineering team advocating for custom Kubernetes/Terraform infrastructure to preserve internal control.',
        vercelDifferentiator:
          'Zero-ops infrastructure, automatic multi-zone high availability, sub-second preview branches for marketing/QA, and elimination of cluster upgrades.',
        tacticalAngle:
          'Quantify Total Cost of Ownership (TCO), ongoing patch management, and high opportunity cost of platform engineers maintaining ingress controllers instead of business features.',
        trapQuestion:
          'What is the estimated fully loaded engineering cost of maintaining bespoke frontend Kubernetes clusters, ingress controllers, and CI/CD pipelines annually?',
      });
    } else {
      points.push({
        competitor: comp.name,
        threatLevel: comp.threatLevel,
        competitorClaim: comp.contextSummary,
        vercelDifferentiator:
          'Vercel Enterprise high-performance frontend cloud, native Next.js optimization, ISR, and Turborepo remote caching.',
        tacticalAngle:
          'Position Vercel as the industry standard for modern web architecture and Core Web Vitals leadership.',
        trapQuestion:
          'How does the incumbent solution guarantee Core Web Vitals SLAs and sub-second global edge response times under peak load?',
      });
    }
  }

  // If no competitors detected, provide proactive defensive positioning
  if (points.length === 0) {
    points.push({
      competitor: 'Status Quo / In-house Infrastructure',
      threatLevel: 'low',
      competitorClaim: 'Prospect relying on legacy hosting or unoptimized container architecture.',
      vercelDifferentiator:
        'Managed frontend cloud with instant preview deployments, Edge Middleware, and Turborepo remote caching.',
      tacticalAngle: 'Demonstrate immediate speed-to-market and Core Web Vitals gains.',
      trapQuestion:
        'How does your current deployment workflow support instant staging previews for cross-functional stakeholders prior to production releases?',
    });
  }

  return points;
}

/**
 * Phase 3: Dynamic JSON Render Form Generation
 * Formulates 3–5 interactive discovery questions targeting primary qualification blind spots,
 * grouped logically into sections: Stage Gate Blockers, Competitive Validation, Architecture & Metrics.
 */
export function runPhase3FormGeneration(
  input: System2Input,
  gaps: QualificationGap[],
  competitivePoints: CompetitiveCounterPoint[]
): JsonRenderForm {
  const { opportunity, jevResult } = input;
  const oppId = opportunity.id;
  const stageGate = jevResult.stageGate;

  const sections: JsonRenderSection[] = [];

  // Section 1: Stage Gate Blockers
  const blockerGaps = gaps.filter((g) => g.isStageGateBlocker || g.riskLevel === 'critical');
  const stageGateFields: FormField[] = [];

  // Check Economic Buyer blocker
  const ebGap = gaps.find((g) => g.dimension === 'economicBuyer');
  if (ebGap && (ebGap.isStageGateBlocker || ebGap.score < 6)) {
    stageGateFields.push({
      id: 'q_economic_buyer',
      name: 'economicBuyerAuthority',
      label: 'Who holds discretionary budget sign-off authority for this Opportunity?',
      description: 'Confirm whether the primary executive sponsor can unilaterally commit budget or if committee/CFO approval is required.',
      type: 'radio' as const,
      required: true,
      dimensionTarget: 'economicBuyer' as const,
      helpCallout: 'Stage Gate requirement: Direct executive sponsor engagement with verified budget authority is required before commercial proposal.',
      options: [
        {
          label: 'Executive Sponsor (Direct unilateral budget authority confirmed)',
          value: 'unilateral_sponsor_confirmed',
          description: 'Sponsor has signed off on ACV and has authority to execute.',
        },
        {
          label: 'Technical Recommender Only (Needs CFO / Committee approval)',
          value: 'recommender_only',
          description: 'Sponsor supports Vercel but formal approval rests with executive committee.',
        },
        {
          label: 'Procurement / Finance Sign-off Pending',
          value: 'finance_pending',
          description: 'Budget is earmarked but formal purchase order process has not started.',
        },
        {
          label: 'Unconfirmed / Not Yet Verified',
          value: 'unconfirmed',
          description: 'Budget sign-off authority has not been directly validated in discovery.',
        },
      ],
    });
  }

  // Check Pain or Decision Process blocker
  const painGap = gaps.find((g) => g.dimension === 'identifyPain');
  if (painGap && painGap.isStageGateBlocker) {
    stageGateFields.push({
      id: 'q_pain_dollar_impact',
      name: 'painQuantification',
      label: 'What is the quantified business or revenue impact of current deployment bottlenecks?',
      description: 'Document estimated revenue loss, outage impact, or developer idle cost caused by existing infrastructure.',
      type: 'textarea' as const,
      placeholder: 'e.g. 45-min build queues delay 8 deploys/day, costing ~$120k in developer downtime per quarter; risk of flash sale outage.',
      required: true,
      dimensionTarget: 'identifyPain' as const,
    });
  }

  const dpGap = gaps.find((g) => g.dimension === 'decisionProcess');
  if (dpGap && dpGap.isStageGateBlocker) {
    stageGateFields.push({
      id: 'q_decision_process_milestones',
      name: 'evaluationMilestones',
      label: 'What are the formal decision milestones and target sign-off dates?',
      description: 'Map architecture review board dates, security review approval, and contract signing timeline.',
      type: 'text' as const,
      placeholder: 'e.g. Architecture sign-off Oct 15; Security review Oct 22; Contract execution Nov 1.',
      required: true,
      dimensionTarget: 'decisionProcess' as const,
    });
  }

  if (stageGateFields.length > 0) {
    sections.push({
      id: 'section_stage_gate',
      title: 'Stage Gate Blockers',
      description: 'Address critical exit criteria required before advancing this Opportunity to the next pipeline milestone.',
      calloutType: 'warning' as const,
      calloutText: stageGate.gateBlockers.length > 0
        ? `Stage Gate Blocked: ${stageGate.gateBlockers[0]}`
        : 'Critical qualification criteria must be validated to protect SA technical hours.',
      fields: stageGateFields,
    });
  }

  // Section 2: Competitive Validation
  const primaryComp = competitivePoints[0];
  const compFields: FormField[] = [];

  if (primaryComp) {
    const isNetlify = primaryComp.competitor.toLowerCase().includes('netlify');
    const isAmplify = primaryComp.competitor.toLowerCase().includes('amplify');

    if (isNetlify) {
      compFields.push({
        id: 'q_competitive_counter',
        name: 'competitiveCounterPositioning',
        label: `How does the prospect perceive Vercel differentiators vs ${primaryComp.competitor}?`,
        description: 'Position App Router native streaming, ISR, and Turborepo remote caching against incumbent renewal discounts.',
        type: 'select' as const,
        required: true,
        dimensionTarget: 'competition' as const,
        helpCallout: 'Counter-positioning: Frame Netlify renewal discounts as high technical debt due to cache skew and build queue limits.',
        options: [
          {
            label: 'Confirmed Pain: Frustrated with build queues and cache invalidation lag',
            value: 'confirmed_pain_seeking_switch',
          },
          {
            label: 'Neutral: Evaluating renewal discount vs Vercel developer experience',
            value: 'evaluating_discount_vs_dx',
          },
          {
            label: 'At Risk: Executive leaning toward discounted incumbent renewal',
            value: 'at_risk_price_pressure',
          },
          {
            label: 'Not Yet Discussed: Need to introduce trap-setting questions',
            value: 'untested',
          },
        ],
      });
    } else if (isAmplify) {
      compFields.push({
        id: 'q_competitive_amplify',
        name: 'amplifyEvaluationState',
        label: 'How is the customer evaluating AWS Amplify vs Vercel Enterprise?',
        description: 'Test whether AWS credits are the sole driver or if engineering has real architectural concerns.',
        type: 'select' as const,
        required: true,
        dimensionTarget: 'competition' as const,
        helpCallout: 'Counter-positioning: Emphasize sub-second preview deployments and developer velocity over generic AWS container credits.',
        options: [
          {
            label: 'Engineering Prefers Vercel: Pushing back against AWS account team credits',
            value: 'engineering_prefers_vercel',
          },
          {
            label: 'Active POC: Running direct side-by-side build and preview comparison',
            value: 'active_side_by_side_poc',
          },
          {
            label: 'Management Mandate: Executive mandate to utilize existing AWS EDP credits',
            value: 'edp_mandate_risk',
          },
          {
            label: 'Uncertain: Technical evaluation criteria not yet formally locked',
            value: 'criteria_unlocked',
          },
        ],
      });
    } else {
      compFields.push({
        id: 'q_competitive_counter',
        name: 'competitiveCounterPositioning',
        label: `What is the customer's evaluation status regarding ${primaryComp.competitor}?`,
        description: primaryComp.tacticalAngle,
        type: 'select' as const,
        required: true,
        dimensionTarget: 'competition' as const,
        options: [
          { label: 'Vercel is clear technical favorite', value: 'vercel_favorite' },
          { label: 'Competitive bake-off currently ongoing', value: 'ongoing_bakeoff' },
          { label: 'Competitor has incumbent advantage', value: 'competitor_incumbent' },
          { label: 'Not yet evaluated', value: 'not_evaluated' },
        ],
      });
    }
  }

  if (compFields.length > 0) {
    sections.push({
      id: 'section_competitive',
      title: `Competitive Strategy (${primaryComp?.competitor || 'Market Counter-Positioning'})`,
      description: 'Tactical positioning to protect deal margin and highlight Vercel enterprise differentiators.',
      calloutType: 'tip' as const,
      calloutText: primaryComp?.tacticalAngle || 'Highlight Vercel native Next.js optimization and global edge reliability.',
      fields: compFields,
    });
  }

  // Section 3: Architecture & Metrics
  const archFields: FormField[] = [];
  const metricsGap = gaps.find((g) => g.dimension === 'metrics');
  const dcGap = gaps.find((g) => g.dimension === 'decisionCriteria');

  if (metricsGap) {
    archFields.push({
      id: 'q_metrics_targets',
      name: 'targetPerformanceMetrics',
      label: 'Documented Current vs Target Performance Targets',
      description: 'Specify documented build-time benchmarks, Core Web Vitals (LCP/INP), or conversion lift expectations.',
      type: 'text' as const,
      placeholder: 'e.g. Current build: 45 min on Netlify; Target: <5 min with Turborepo Remote Cache; LCP < 1.5s',
      required: true,
      dimensionTarget: 'metrics' as const,
    });
  }

  if (dcGap && dcGap.score < 8) {
    archFields.push({
      id: 'q_decision_criteria_architecture',
      name: 'architecturalRequirements',
      label: 'Which core architectural capabilities are mandatory for technical sign-off?',
      description: 'Select all technical requirements verified with the prospect engineering team.',
      type: 'checkbox_group' as const,
      required: false,
      dimensionTarget: 'decisionCriteria' as const,
      options: [
        { label: 'Next.js 14 App Router & React Server Components', value: 'app_router_rsc' },
        { label: 'Incremental Static Regeneration (ISR) with tag-based invalidation', value: 'isr_tags' },
        { label: 'Turborepo Remote Caching for CI/CD acceleration', value: 'turborepo_remote_cache' },
        { label: 'Edge Middleware for low-latency routing & personalization', value: 'edge_middleware' },
        { label: 'SOC2 Type II compliance & Enterprise SLA (99.99%)', value: 'soc2_enterprise_sla' },
        { label: 'Vercel Secure Compute / Dedicated Egress IP filtering', value: 'secure_compute' },
      ],
    });
  }

  if (archFields.length > 0) {
    sections.push({
      id: 'section_architecture_metrics',
      title: 'Architecture & Metrics Validation',
      description: 'Lock in technical decision criteria and quantitative success metrics to anchor the enterprise business case.',
      calloutType: 'info' as const,
      calloutText: 'Technical validation requires documented quantitative metrics to defend enterprise value during CFO review.',
      fields: archFields,
    });
  }

  // Ensure total fields is between 3 and 5
  let totalFields = sections.reduce((acc, s) => acc + s.fields.length, 0);

  // If less than 3 fields, add an additional high-leverage field
  if (totalFields < 3) {
    const targetSection: JsonRenderSection = sections[0] || {
      id: 'section_general',
      title: 'General Technical Qualification',
      description: 'Key qualification discovery questions',
      fields: [],
    };
    if (!sections.includes(targetSection)) {
      sections.push(targetSection);
    }
    targetSection.fields.push({
      id: 'q_champion_influence',
      name: 'championInfluenceTest',
      label: 'How has the internal champion demonstrated influence with executive leadership?',
      description: 'Validate whether champion can arrange direct access to the Economic Buyer and defend Vercel pricing.',
      type: 'textarea' as const,
      placeholder: 'e.g. Champion arranged 1:1 with VP E-Commerce and provided competitor renewal contract details.',
      required: false,
      dimensionTarget: 'champion' as const,
    });
  }

  const form: JsonRenderForm = {
    opportunityId: oppId,
    title: 'Technical Qualification & Discovery Validation',
    summary: `System 1 scored ${opportunity.name} at ${jevResult.overallScore}/100 with ${jevResult.stageGate.gateBlockers.length} Stage Gate blockers. System 2 identified ${gaps.length} qualification blind spots requiring Solutions Architect discovery.`,
    sections,
  };

  // Validate strictly against schema
  return JsonRenderFormSchema.parse(form);
}

/**
 * End-to-end Phased System 2 Reasoning Pipeline
 */
export function executeSystem2Pipeline(input: System2Input): System2AnalysisResult {
  const modelUsed: System2ModelOption = input.model || 'claude-3-5-sonnet';

  // Phase 1: Gap Synthesis & Risk Analysis
  const phase1Gaps = runPhase1GapAnalysis(input);

  // Phase 2: Competitive Playbook & Battlecard Synthesis
  const phase2Competitive = runPhase2CompetitivePlaybook(input);

  // Phase 3: Dynamic JSON Render Form Generation
  const phase3Form = runPhase3FormGeneration(input, phase1Gaps, phase2Competitive);

  const summary = `System 2 (${modelUsed}) completed deep reasoning across 3 sequential phases: ${phase1Gaps.length} gaps identified, ${phase2Competitive.length} competitive counter-angles formulated, and ${phase3Form.sections.reduce((acc, s) => acc + s.fields.length, 0)} interactive discovery questions generated.`;

  return {
    opportunityId: input.opportunity.id,
    modelUsed,
    phase1Gaps,
    phase2Competitive,
    phase3Form,
    summary,
  };
}
