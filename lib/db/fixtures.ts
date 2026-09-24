import { DealScenario, MEDDPICCBreakdown } from '@/lib/types/crm';

export const INITIAL_MEDDPICC_BREAKDOWN: MEDDPICCBreakdown = {
  identifyPain: {
    key: 'identifyPain',
    label: 'Identify Pain',
    weight: 0.2,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Operational and business impact unquantified'],
  },
  champion: {
    key: 'champion',
    label: 'Champion',
    weight: 0.15,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Internal advocate not yet tested for influence or access'],
  },
  economicBuyer: {
    key: 'economicBuyer',
    label: 'Economic Buyer',
    weight: 0.15,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Budget authority and discretionary sponsor unconfirmed'],
  },
  decisionCriteria: {
    key: 'decisionCriteria',
    label: 'Decision Criteria',
    weight: 0.15,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Technical benchmarks and architecture requirements not locked'],
  },
  decisionProcess: {
    key: 'decisionProcess',
    label: 'Decision Process',
    weight: 0.1,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Formal evaluation stages and milestone timeline not mapped'],
  },
  metrics: {
    key: 'metrics',
    label: 'Metrics',
    weight: 0.1,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Quantifiable business KPIs and CWV targets not specified'],
  },
  competition: {
    key: 'competition',
    label: 'Competition',
    weight: 0.1,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Alternative vendor evaluation criteria not countered'],
  },
  paperProcess: {
    key: 'paperProcess',
    label: 'Paper Process',
    weight: 0.05,
    score: 0,
    status: 'unaddressed',
    confidence: 0,
    evidence: [],
    gaps: ['Procurement, security review, and legal path undefined'],
  },
};

export const SCENARIO_FIXTURES: Record<string, DealScenario> = {
  scenario_acme_netlify: {
    scenario_id: 'scenario_acme_netlify',
    title: 'Acme Corp (Netlify Renewal Contested)',
    description:
      'Large retail brand on legacy Netlify Enterprise facing build queue limits, 45-minute deploy bottlenecks, and preview environment sync issues.',
    created_at: new Date().toISOString(),
    default_data: {
      id: 'opp_acme_corp_001',
      name: 'Acme Corp - Next.js Migration',
      account_name: 'Acme Global',
      stage_name: 'Stage 2 - Discovery',
      amount: 180000.0,
      close_date: '2026-12-15',
      ae_name: 'Sarah Jenkins',
      sa_name: 'David Kross',
      ae_notes:
        'Met with VP of E-Commerce. Netlify contract expires in 90 days. Budget allocated ($180k ACV). Customer is frustrated with build times and lack of ISR support on Next.js 14. Competitor Netlify is offering a 30% discount to renew. Technical decision rests with Head of Platform.',
      sa_notes:
        'Current stack: Next.js Pages Router migrating to App Router. Monorepo with Turborepo. Core concerns: CDN cache invalidation, edge middleware latency, zero-downtime migration.',
      suggested_next_steps: null,
      qualification_status: 'unqualified',
      meddpicc_score: null,
      meddpicc_breakdown: INITIAL_MEDDPICC_BREAKDOWN,
      competitive_flags: ['Netlify'],
    },
  },

  scenario_globex_amplify: {
    scenario_id: 'scenario_globex_amplify',
    title: 'Globex FinTech (AWS Amplify Bake-off)',
    description:
      'Regulated banking portal evaluating AWS Amplify vs Vercel Enterprise with heavy AWS credit incentives.',
    created_at: new Date().toISOString(),
    default_data: {
      id: 'opp_globex_fintech_002',
      name: 'Globex FinTech - Wealth Portal Replatform',
      account_name: 'Globex Financial',
      stage_name: 'Stage 2 - Discovery',
      amount: 240000.0,
      close_date: '2026-11-30',
      ae_name: 'Marcus Vance',
      sa_name: 'Sarah Miller',
      ae_notes:
        "Lead came inbound from CTO's tweet. AWS account team is pushing Amplify heavily with credits. Need SOC2 Type II compliance, VPC peering or secure backend integration, and SSO.",
      sa_notes:
        'Security team has strict egress IP filtering requirements. Investigating Vercel Secure Compute and Edge Functions.',
      suggested_next_steps: null,
      qualification_status: 'unqualified',
      meddpicc_score: null,
      meddpicc_breakdown: INITIAL_MEDDPICC_BREAKDOWN,
      competitive_flags: ['AWS Amplify'],
    },
  },

  scenario_soylent_headless: {
    scenario_id: 'scenario_soylent_headless',
    title: 'Soylent Retail (Shopify Plus Replatforming)',
    description:
      'Fast-growing DTC brand planning Black Friday replatforming to Shopify Plus + Next.js App Router.',
    created_at: new Date().toISOString(),
    default_data: {
      id: 'opp_soylent_retail_003',
      name: 'Soylent Retail - Headless Storefront',
      account_name: 'Soylent Nutrition Inc.',
      stage_name: 'Stage 2 - Discovery',
      amount: 90000.0,
      close_date: '2026-10-31',
      ae_name: 'Elena Rostova',
      sa_name: 'Liam Chen',
      ae_notes:
        'Need to launch before Q4 peak freeze (Nov 1). CEO and CMO sponsor. $90k ACV. Decision maker is Head of Engineering.',
      sa_notes:
        'Evaluation criteria: Core Web Vitals (LCP < 1.5s), automated preview branches for marketing team, Sanity CMS webhooks.',
      suggested_next_steps: null,
      qualification_status: 'unqualified',
      meddpicc_score: null,
      meddpicc_breakdown: INITIAL_MEDDPICC_BREAKDOWN,
      competitive_flags: [],
    },
  },
};

export const DEFAULT_SCENARIO_ID = 'scenario_acme_netlify';
