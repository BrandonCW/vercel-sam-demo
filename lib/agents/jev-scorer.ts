import {
  JevScoringInput,
  JevScoringResult,
  JevScoringResultSchema,
  DimensionResult,
  DimensionStatus,
  CompetitiveMention,
  CompetitiveThreatLevel,
  StageGateEvaluation,
} from './jev-schema';

export interface DimensionConfig {
  key: keyof JevScoringResult['dimensions'];
  label: string;
  weight: number;
}

export const CANONICAL_DIMENSIONS: Record<keyof JevScoringResult['dimensions'], DimensionConfig> = {
  identifyPain: { key: 'identifyPain', label: 'Identify Pain', weight: 0.2 },
  champion: { key: 'champion', label: 'Champion', weight: 0.15 },
  economicBuyer: { key: 'economicBuyer', label: 'Economic Buyer', weight: 0.15 },
  decisionCriteria: { key: 'decisionCriteria', label: 'Decision Criteria', weight: 0.15 },
  decisionProcess: { key: 'decisionProcess', label: 'Decision Process', weight: 0.1 },
  metrics: { key: 'metrics', label: 'Metrics', weight: 0.1 },
  competition: { key: 'competition', label: 'Competition', weight: 0.1 },
  paperProcess: { key: 'paperProcess', label: 'Paper Process', weight: 0.05 },
};

export function getDimensionStatus(score: number): DimensionStatus {
  if (score >= 8) return 'verified';
  if (score >= 4) return 'partial';
  return 'unaddressed';
}

export function computeCompositeScore(
  dimensionScores: Record<keyof JevScoringResult['dimensions'], number>
): number {
  let total = 0;
  for (const [key, config] of Object.entries(CANONICAL_DIMENSIONS) as [
    keyof JevScoringResult['dimensions'],
    DimensionConfig,
  ][]) {
    const score = dimensionScores[key] ?? 0;
    total += score * 10 * config.weight;
  }
  return Math.min(100, Math.max(0, Math.round(total)));
}

/**
 * Split text into individual sentences for fine-grained citation extraction.
 */
function extractSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function findMatchingSentences(sentences: string[], regex: RegExp): string[] {
  return sentences.filter((s) => regex.test(s));
}

/**
 * Enterprise Competitive Scanner
 * Detects mentions of: Netlify, AWS Amplify, Cloudflare Pages, Akamai/Fastly, DIY Kubernetes / AWS ECS.
 */
export function scanCompetitiveMentions(notesA: string, notesB: string = ''): CompetitiveMention[] {
  const combinedNotes = notesB ? `${notesA} ${notesB}` : notesA;
  const mentions: CompetitiveMention[] = [];
  const sentences = extractSentences(combinedNotes);

  // 1. Netlify
  if (/\bnetlify\b/i.test(combinedNotes)) {
    const matchedSentences = findMatchingSentences(sentences, /\bnetlify\b/i);
    const evidence = matchedSentences[0] || 'Netlify mentioned in opportunity notes.';
    let threatLevel: CompetitiveThreatLevel = 'medium';
    let contextSummary = 'Active frontend cloud evaluation / bake-off.';

    if (/(discount|renew|contract expires|30%|incumbent|multi-year)/i.test(combinedNotes)) {
      threatLevel = 'high';
      contextSummary = 'Incumbent contract renewal with discounting pressure.';
    } else if (/(legacy|replac|migrat)/i.test(combinedNotes)) {
      threatLevel = 'low';
      contextSummary = 'Legacy deployment tool targeted for Next.js migration.';
    }

    mentions.push({
      name: 'Netlify',
      threatLevel,
      evidence,
      contextSummary,
    });
  }

  // 2. AWS Amplify
  if (/\b(aws amplify|amplify)\b/i.test(combinedNotes)) {
    const matchedSentences = findMatchingSentences(sentences, /\b(aws amplify|amplify)\b/i);
    const evidence = matchedSentences[0] || 'AWS Amplify mentioned in notes.';
    let threatLevel: CompetitiveThreatLevel = 'medium';
    let contextSummary = 'Hyperscaler native alternative evaluated against Vercel.';

    if (/(credit|edp|commit|pushing|enterprise agreement)/i.test(combinedNotes)) {
      threatLevel = 'high';
      contextSummary = 'AWS account team pushing Amplify with enterprise credits and EDP commits.';
    }

    mentions.push({
      name: 'AWS Amplify',
      threatLevel,
      evidence,
      contextSummary,
    });
  }

  // 3. Cloudflare Pages
  if (/\b(cloudflare(\s+pages)?)\b/i.test(combinedNotes)) {
    const matchedSentences = findMatchingSentences(sentences, /\b(cloudflare(\s+pages)?)\b/i);
    const evidence = matchedSentences[0] || 'Cloudflare Pages mentioned in notes.';
    let threatLevel: CompetitiveThreatLevel = 'low';
    let contextSummary = 'Edge / CDN solution under consideration.';

    if (/(zero-egress|egress|dns|waf|incumbent)/i.test(combinedNotes)) {
      threatLevel = 'medium';
      contextSummary = 'Incumbent DNS/WAF footprint with zero-egress cost claims.';
    }

    mentions.push({
      name: 'Cloudflare Pages',
      threatLevel,
      evidence,
      contextSummary,
    });
  }

  // 4. Akamai/Fastly
  if (/\b(akamai|fastly)\b/i.test(combinedNotes)) {
    const matchedSentences = findMatchingSentences(sentences, /\b(akamai|fastly)\b/i);
    const evidence = matchedSentences[0] || 'Akamai/Fastly mentioned in notes.';
    let threatLevel: CompetitiveThreatLevel = 'low';
    let contextSummary = 'Traditional CDN vendor under consideration.';

    if (/(incumbent|contract|edge caching)/i.test(combinedNotes)) {
      threatLevel = 'medium';
      contextSummary = 'Legacy CDN incumbent with existing caching contracts.';
    }

    mentions.push({
      name: 'Akamai/Fastly',
      threatLevel,
      evidence,
      contextSummary,
    });
  }

  // 5. DIY Kubernetes / AWS ECS
  if (/\b(kubernetes|k8s|ecs|diy|in-house)\b/i.test(combinedNotes)) {
    const matchedSentences = findMatchingSentences(
      sentences,
      /\b(kubernetes|k8s|ecs|diy|in-house)\b/i
    );
    const evidence = matchedSentences[0] || 'In-house container infrastructure mentioned.';
    let threatLevel: CompetitiveThreatLevel = 'medium';
    let contextSummary = 'In-house container stack under consideration.';

    if (/(defend|platform team|bespoke|custom|resistan)/i.test(combinedNotes)) {
      threatLevel = 'high';
      contextSummary = 'Internal platform engineering team defending custom Kubernetes/ECS stack.';
    }

    mentions.push({
      name: 'DIY Kubernetes / AWS ECS',
      threatLevel,
      evidence,
      contextSummary,
    });
  }

  return mentions;
}

/**
 * Stage Gate Evaluation
 * Evaluates readiness for:
 * - Gate 2: Discovery -> Technical Validation (Stage 2 -> Stage 3)
 * - Gate 3: Technical Validation -> Proposal (Stage 3 -> Stage 4)
 */
export function evaluateStageGate(
  stageName: string,
  dimensions: JevScoringResult['dimensions'],
  overallScore: number
): StageGateEvaluation {
  const isStage2 = /stage\s*2|discovery/i.test(stageName);
  const isStage3 = /stage\s*3|technical validation|validation/i.test(stageName);

  if (isStage2) {
    const blockers: string[] = [];
    const targetStage = 'Stage 3 - Technical Validation';

    // Gate 2 Rules:
    // Identify Pain >= 6
    if (dimensions.identifyPain.score < 6) {
      blockers.push(
        `Identify Pain score is ${dimensions.identifyPain.score}/10 (minimum 6/10 required with validated business pain)`
      );
    }

    // Champion >= 5
    if (dimensions.champion.score < 5) {
      blockers.push(
        `Champion score is ${dimensions.champion.score}/10 (minimum 5/10 required with identified advocate)`
      );
    }

    // Metrics >= 4
    if (dimensions.metrics.score < 4) {
      blockers.push(
        `Metrics score is ${dimensions.metrics.score}/10 (minimum 4/10 required with preliminary measurable targets)`
      );
    }

    // Economic Buyer >= 4 (Blocked on Acme Corp baseline where EB = 3)
    if (dimensions.economicBuyer.score < 4) {
      blockers.push(
        `Economic Buyer is not verified in discovery notes (score: ${dimensions.economicBuyer.score}/10, minimum 4/10 required)`
      );
    }

    // Overall Score >= 50
    if (overallScore < 50) {
      blockers.push(
        `Overall MEDDPICC score is ${overallScore}/100 (minimum 50/100 required for Gate 2)`
      );
    }

    return {
      gateReady: blockers.length === 0,
      currentStage: stageName,
      targetStage,
      gateBlockers: blockers,
    };
  }

  if (isStage3) {
    const blockers: string[] = [];
    const targetStage = 'Stage 4 - Proposal';

    // Gate 3 Rules:
    // Decision Criteria >= 7
    if (dimensions.decisionCriteria.score < 7) {
      blockers.push(
        `Decision Criteria score is ${dimensions.decisionCriteria.score}/10 (minimum 7/10 required with locked technical benchmarks)`
      );
    }

    // Economic Buyer >= 6
    if (dimensions.economicBuyer.score < 6) {
      blockers.push(
        `Economic Buyer score is ${dimensions.economicBuyer.score}/10 (minimum 6/10 required with direct sponsor sign-off)`
      );
    }

    // Decision Process >= 5
    if (dimensions.decisionProcess.score < 5) {
      blockers.push(
        `Decision Process score is ${dimensions.decisionProcess.score}/10 (minimum 5/10 required with formal evaluation steps mapped)`
      );
    }

    // Identify Pain >= 7
    if (dimensions.identifyPain.score < 7) {
      blockers.push(
        `Identify Pain score is ${dimensions.identifyPain.score}/10 (minimum 7/10 required for commercial proposal)`
      );
    }

    // Champion >= 7
    if (dimensions.champion.score < 7) {
      blockers.push(
        `Champion score is ${dimensions.champion.score}/10 (minimum 7/10 required with executive access)`
      );
    }

    // Overall Score >= 70
    if (overallScore < 70) {
      blockers.push(
        `Overall MEDDPICC score is ${overallScore}/100 (minimum 70/100 required for Gate 3 exit)`
      );
    }

    return {
      gateReady: blockers.length === 0,
      currentStage: stageName,
      targetStage,
      gateBlockers: blockers,
    };
  }

  // Non-gated stage
  return {
    gateReady: true,
    currentStage: stageName,
    targetStage: stageName,
    gateBlockers: [],
  };
}

/**
 * Deterministic Jev Scoring Engine (System 1)
 */
export function scoreOpportunityWithJev(input: JevScoringInput): JevScoringResult {
  const aeNotes = input.aeNotes || '';
  const saNotes = input.saNotes || '';
  const combined = `${aeNotes}\n${saNotes}`;
  const sentences = extractSentences(combined);

  // 1. Identify Pain (20%)
  const painEvidence = findMatchingSentences(
    sentences,
    /(build\s*time|deploy|bottleneck|outage|queue|flash\s*sale|timeout|cache invalidation|latency|frustrated|downtime)/i
  );
  let painScore = 0;
  const painGaps: string[] = [];

  if (
    (/(build\s*times?|deploy).*?(bottleneck|queue|slow|45-minute|45m|lack of isr)/i.test(combined) ||
      /frustrated with build times/i.test(combined)) &&
    /(timeout|outage|frustrated|cache invalidation|latency|lack of isr)/i.test(combined)
  ) {
    painScore = 8;
  } else if (
    /(build\s*time|deploy|frustrated|timeout|bottleneck|egress|peak\s*freeze)/i.test(combined)
  ) {
    painScore = 6;
  } else if (painEvidence.length > 0) {
    painScore = 4;
  } else {
    painScore = 1;
    painGaps.push('Operational and business impact unquantified in discovery notes');
  }

  if (painScore < 8) {
    painGaps.push('Customer has not quantified dollar cost of deploy queue bottlenecks or downtime');
  }

  const identifyPain: DimensionResult = {
    key: 'identifyPain',
    label: CANONICAL_DIMENSIONS.identifyPain.label,
    weight: CANONICAL_DIMENSIONS.identifyPain.weight,
    score: painScore,
    status: getDimensionStatus(painScore),
    confidence: painEvidence.length >= 2 ? 0.9 : painEvidence.length === 1 ? 0.75 : 0.2,
    evidence: painEvidence,
    gaps: painGaps,
  };

  // 2. Champion (15%)
  const championEvidence = findMatchingSentences(
    sentences,
    /(head of platform|head of engineering|vp eng|vp of engineering|tech lead|architect|advocate|champion|decision rests with)/i
  );
  let champScore = 0;
  const champGaps: string[] = [];

  if (
    /(technical decision rests with|driving vercel|actively advocating)/i.test(combined) &&
    /(head of platform|vp eng|staff architect)/i.test(combined)
  ) {
    champScore = 7;
  } else if (/(head of engineering|head of platform|vp eng|tech lead)/i.test(combined)) {
    champScore = 6;
  } else if (championEvidence.length > 0) {
    champScore = 4;
  } else {
    champScore = 2;
    champGaps.push('No technical advocate or internal champion identified');
  }

  if (champScore < 8) {
    champGaps.push('Internal advocate has not been tested for influence or direct access to Economic Buyer');
  }

  const champion: DimensionResult = {
    key: 'champion',
    label: CANONICAL_DIMENSIONS.champion.label,
    weight: CANONICAL_DIMENSIONS.champion.weight,
    score: champScore,
    status: getDimensionStatus(champScore),
    confidence: championEvidence.length >= 1 ? 0.8 : 0.2,
    evidence: championEvidence,
    gaps: champGaps,
  };

  // 3. Economic Buyer (15%)
  const ebEvidence = findMatchingSentences(
    sentences,
    /(vp of e-commerce|cto|cfo|ceo|cmo|budget allocated|\$\d+|acv|signoff|sign-off|unilateral)/i
  );
  let ebScore = 0;
  const ebGaps: string[] = [];

  // Check if verified unilateral sign-off authority confirmed
  if (/(unilateral|verified signoff|signoff authority up to|cto approval co-signed)/i.test(combined)) {
    ebScore = 8;
  } else if (
    /(ceo and cmo sponsor|budget signed off|authorized executive)/i.test(combined)
  ) {
    ebScore = 6;
  } else if (
    /(met with vp of e-commerce|budget allocated|\$\d+k acv)/i.test(combined)
  ) {
    // In Acme Corp baseline, met with VP of E-Commerce and budget mentioned, but signoff authority unconfirmed
    ebScore = 3;
    ebGaps.push('Discretionary budget sign-off authority not verified; need to confirm whether VP holds unilateral signoff');
  } else if (/(cto|cfo|ceo)/i.test(combined)) {
    ebScore = 2;
    ebGaps.push('Executive sponsor mentioned casually without budget allocation confirmation');
  } else {
    ebScore = 1;
    ebGaps.push('Economic Buyer unaddressed; no budget authority identified');
  }

  const economicBuyer: DimensionResult = {
    key: 'economicBuyer',
    label: CANONICAL_DIMENSIONS.economicBuyer.label,
    weight: CANONICAL_DIMENSIONS.economicBuyer.weight,
    score: ebScore,
    status: getDimensionStatus(ebScore),
    confidence: ebEvidence.length >= 1 ? 0.75 : 0.2,
    evidence: ebEvidence,
    gaps: ebGaps,
  };

  // 4. Decision Criteria (15%)
  const dcEvidence = findMatchingSentences(
    sentences,
    /(app router|turborepo|next\.js|isr|cache invalidation|edge middleware|latency|zero-downtime|soc2|vpc|sso|egress|core web vitals|lcp|sanity)/i
  );
  let dcScore = 0;
  const dcGaps: string[] = [];

  if (
    /(app router|turborepo)/i.test(combined) &&
    /(cache invalidation|edge middleware|zero-downtime|isr)/i.test(combined)
  ) {
    dcScore = 7;
  } else if (
    /(soc2|vpc|egress|sso|core web vitals|preview branches)/i.test(combined)
  ) {
    dcScore = 6;
  } else if (dcEvidence.length > 0) {
    dcScore = 4;
  } else {
    dcScore = 2;
    dcGaps.push('Technical criteria and architectural benchmarks undefined');
  }

  if (dcScore < 8) {
    dcGaps.push('Formal quantitative edge latency SLAs and technical acceptance benchmarks not locked in writing');
  }

  const decisionCriteria: DimensionResult = {
    key: 'decisionCriteria',
    label: CANONICAL_DIMENSIONS.decisionCriteria.label,
    weight: CANONICAL_DIMENSIONS.decisionCriteria.weight,
    score: dcScore,
    status: getDimensionStatus(dcScore),
    confidence: dcEvidence.length >= 2 ? 0.85 : dcEvidence.length === 1 ? 0.7 : 0.2,
    evidence: dcEvidence,
    gaps: dcGaps,
  };

  // 5. Decision Process (10%)
  const dpEvidence = findMatchingSentences(
    sentences,
    /(contract expires|90 days|q4 peak freeze|nov 1|timeline|milestone|poc|review|schedule)/i
  );
  let dpScore = 0;
  const dpGaps: string[] = [];

  if (/(launch before|peak freeze|nov 1)/i.test(combined)) {
    dpScore = 5;
  } else if (/(contract expires in 90 days|expires in \d+ days)/i.test(combined)) {
    dpScore = 4;
  } else if (dpEvidence.length > 0) {
    dpScore = 3;
  } else {
    dpScore = 2;
    dpGaps.push('Evaluation workflow, milestone dates, and decision schedule undefined');
  }

  if (dpScore < 8) {
    dpGaps.push('Formal evaluation committee dates, architecture review board milestones, and security review schedule undefined');
  }

  const decisionProcess: DimensionResult = {
    key: 'decisionProcess',
    label: CANONICAL_DIMENSIONS.decisionProcess.label,
    weight: CANONICAL_DIMENSIONS.decisionProcess.weight,
    score: dpScore,
    status: getDimensionStatus(dpScore),
    confidence: dpEvidence.length >= 1 ? 0.7 : 0.2,
    evidence: dpEvidence,
    gaps: dpGaps,
  };

  // 6. Metrics (10%)
  const metricsEvidence = findMatchingSentences(
    sentences,
    /(core web vitals|lcp\s*<\s*1\.5s|lcp|inp|45-minute|45m|build times|\$\d+k acv)/i
  );
  let metricsScore = 0;
  const metricsGaps: string[] = [];

  if (/(core web vitals|lcp\s*<\s*1\.5s)/i.test(combined)) {
    metricsScore = 6;
  } else if (/(45-minute|45m|build times)/i.test(combined) && /\$\d+/i.test(combined)) {
    metricsScore = 5;
  } else if (metricsEvidence.length > 0) {
    metricsScore = 3;
  } else {
    metricsScore = 2;
    metricsGaps.push('No quantitative KPIs or performance targets defined');
  }

  if (metricsScore < 8) {
    metricsGaps.push('Quantifiable business ROI, conversion targets, and build-time reduction metrics not fully specified');
  }

  const metrics: DimensionResult = {
    key: 'metrics',
    label: CANONICAL_DIMENSIONS.metrics.label,
    weight: CANONICAL_DIMENSIONS.metrics.weight,
    score: metricsScore,
    status: getDimensionStatus(metricsScore),
    confidence: metricsEvidence.length >= 1 ? 0.75 : 0.2,
    evidence: metricsEvidence,
    gaps: metricsGaps,
  };

  // 7. Competition (10%)
  const competitiveFlags = scanCompetitiveMentions(combined);
  const compEvidence = findMatchingSentences(
    sentences,
    /(netlify|amplify|cloudflare|akamai|fastly|kubernetes|k8s|ecs|competitor|discount)/i
  );
  let compScore = 0;
  const compGaps: string[] = [];

  if (competitiveFlags.length === 0) {
    // No competitors detected
    compScore = 6;
  } else {
    const hasHighThreat = competitiveFlags.some((c) => c.threatLevel === 'high');
    if (hasHighThreat) {
      compScore = 4;
      compGaps.push('Incumbent competitor offering aggressive renewal discount; counter-positioning required');
    } else {
      compScore = 5;
      compGaps.push('Competitor under active evaluation; Vercel enterprise differentiators need to be demonstrated');
    }
  }

  const competition: DimensionResult = {
    key: 'competition',
    label: CANONICAL_DIMENSIONS.competition.label,
    weight: CANONICAL_DIMENSIONS.competition.weight,
    score: compScore,
    status: getDimensionStatus(compScore),
    confidence: competitiveFlags.length > 0 ? 0.85 : 0.5,
    evidence: compEvidence,
    gaps: compGaps,
  };

  // 8. Paper Process (5%)
  const ppEvidence = findMatchingSentences(
    sentences,
    /(procurement|legal|msa|dpa|security team|vendor onboarding)/i
  );
  let ppScore = 0;
  const ppGaps: string[] = [];

  if (/(soc2|security team)/i.test(combined)) {
    ppScore = 3;
  } else if (ppEvidence.length > 0) {
    ppScore = 3;
  } else {
    ppScore = 2;
  }
  ppGaps.push('Procurement onboarding timeline, standard Enterprise MSA terms, and legal/security review path undefined');

  const paperProcess: DimensionResult = {
    key: 'paperProcess',
    label: CANONICAL_DIMENSIONS.paperProcess.label,
    weight: CANONICAL_DIMENSIONS.paperProcess.weight,
    score: ppScore,
    status: getDimensionStatus(ppScore),
    confidence: ppEvidence.length > 0 ? 0.6 : 0.2,
    evidence: ppEvidence,
    gaps: ppGaps,
  };

  const dimensions = {
    identifyPain,
    champion,
    economicBuyer,
    decisionCriteria,
    decisionProcess,
    metrics,
    competition,
    paperProcess,
  };

  const overallScore = computeCompositeScore({
    identifyPain: identifyPain.score,
    champion: champion.score,
    economicBuyer: economicBuyer.score,
    decisionCriteria: decisionCriteria.score,
    decisionProcess: decisionProcess.score,
    metrics: metrics.score,
    competition: competition.score,
    paperProcess: paperProcess.score,
  });

  const stageGate = evaluateStageGate(input.stageName, dimensions, overallScore);

  const rawResult: JevScoringResult = {
    opportunityId: input.opportunityId || input.dealId || '',
    overallScore,
    dimensions,
    competitiveFlags,
    stageGate,
    evaluatedAt: new Date().toISOString(),
  };

  // Strict validation against Zod schema
  return JevScoringResultSchema.parse(rawResult);
}
