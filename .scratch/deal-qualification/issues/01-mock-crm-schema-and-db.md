# Mock Salesforce Schema & Storage Design

Type: task
Status: resolved
Blocked by: none

## Question

How should the simulated Salesforce CRM schema be structured in Postgres/Neon (representing Opportunities with AE notes, SA notes, deal stage, and written-back suggested next steps), and how should the realistic scenario seeding and instant reset mechanism (via UI button or Eve skill) be implemented for clean demo reproducibility?

## Answer

### 1. Simulated Salesforce Schema Design (Postgres/Neon)

The CRM simulation consists of three core tables in Postgres:
1. `opportunities`: Represents Salesforce Enterprise Opportunities with AE/SA discovery notes, qualification state, and agent-updated fields.
2. `deal_scenarios`: Stores immutable template fixtures for fast re-seeding and switching demo scenarios.
3. `deal_interactions`: Audit and telemetry trail storing agent evaluations, generated questions, and SA feedback submissions.

#### DDL Specification (`db/schema.sql`)

```sql
-- Opportunities Table (Primary Mock CRM Entity)
CREATE TABLE IF NOT EXISTS opportunities (
    id VARCHAR(64) PRIMARY KEY,                         -- SFDC Opportunity Id format, e.g. 'opp_acme_corp_001'
    name TEXT NOT NULL,                                  -- Opportunity Name e.g. 'Acme Corp - Next.js Migration'
    account_name TEXT NOT NULL,                         -- Account Name e.g. 'Acme Global'
    stage_name TEXT NOT NULL,                           -- Stage: 'Stage 2 - Discovery', 'Stage 3 - Technical Validation', etc.
    amount NUMERIC(12, 2) DEFAULT 0.00,                 -- Annual Contract Value (ACV)
    close_date DATE NOT NULL,                           -- Projected close date
    ae_name TEXT NOT NULL,                              -- Assigned Account Executive
    ae_notes TEXT NOT NULL,                             -- AE qualitative field notes
    sa_notes TEXT DEFAULT '',                           -- SA technical discovery notes
    suggested_next_steps TEXT DEFAULT NULL,             -- Designated writeback field from Eve Agent
    qualification_status VARCHAR(32) NOT NULL           -- 'unqualified', 'in_review', 'qualified', 'disqualified'
        DEFAULT 'unqualified',
    meddpicc_score INTEGER DEFAULT NULL,                -- Aggregate score (0 - 100)
    meddpicc_breakdown JSONB DEFAULT '{}'::jsonb,       -- Full 8-dimension JSON rubric breakdown
    competitive_flags TEXT[] DEFAULT ARRAY[]::TEXT[],   -- Detected competitors: ['Netlify', 'AWS Amplify', 'Cloudflare Pages']
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities (stage_name);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities (qualification_status);

-- Canonical Scenarios Table (Fixtures for demo repeatability)
CREATE TABLE IF NOT EXISTS deal_scenarios (
    scenario_id VARCHAR(64) PRIMARY KEY,                -- e.g. 'scenario_acme_netlify'
    title TEXT NOT NULL,                                -- e.g. 'Acme Corp (Netlify Renewal Contested)'
    description TEXT NOT NULL,
    default_data JSONB NOT NULL,                        -- Complete opportunity initial payload
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deal Interaction History Table (Telemetry & Re-scoring Audit)
CREATE TABLE IF NOT EXISTS deal_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id VARCHAR(64) NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    actor VARCHAR(32) NOT NULL,                         -- 'system1_jev', 'system2_llm', 'sa_user'
    action VARCHAR(64) NOT NULL,                        -- 'initial_scoring', 'questions_generated', 'sa_feedback', 'writeback'
    payload JSONB NOT NULL,                             -- Input parameters or produced output
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_opp ON deal_interactions (opportunity_id, created_at DESC);
```

### 2. Realistic Demo Scenarios

Three pre-seeded scenarios provide reproducible demo paths:

1. **Scenario 1: Acme Corp (`scenario_acme_netlify`)**
   - **Context**: Large retail brand on legacy Netlify Enterprise facing build queue limits, 45-minute deploy bottlenecks, and preview environment sync issues.
   - **AE Notes**: "Met with VP of E-Commerce. Netlify contract expires in 90 days. Budget allocated ($180k ACV). Customer is frustrated with build times and lack of ISR support on Next.js 14. Competitor Netlify is offering a 30% discount to renew. Technical decision rests with Head of Platform."
   - **Initial SA Notes**: "Current stack: Next.js Pages Router migrating to App Router. Monorepo with Turborepo. Core concerns: CDN cache invalidation, edge middleware latency, zero-downtime migration."
   - **Target Qualification**: Missing formal Paper Process and verified Economic Buyer signoff; strong Pain and Champion.

2. **Scenario 2: Globex FinTech (`scenario_globex_amplify`)**
   - **Context**: Regulated banking portal evaluating AWS Amplify vs Vercel Enterprise.
   - **AE Notes**: "Lead came inbound from CTO's tweet. AWS account team is pushing Amplify heavily with credits. Need SOC2 Type II compliance, VPC peering or secure backend integration, and SSO."
   - **Initial SA Notes**: "Security team has strict egress IP filtering requirements. Investigating Vercel Secure Compute and Edge Functions."
   - **Target Qualification**: High competitive threat from AWS; decision criteria fuzzy regarding AWS credits vs developer productivity.

3. **Scenario 3: Soylent Retail (`scenario_soylent_headless`)**
   - **Context**: Fast-growing DTC brand planning Black Friday replatforming to Shopify Plus + Next.js App Router.
   - **AE Notes**: "Need to launch before Q4 peak freeze (Nov 1). CEO and CMO sponsor. $90k ACV. Decision maker is Head of Engineering."
   - **Initial SA Notes**: "Evaluation criteria: Core Web Vitals (LCP < 1.5s), automated preview branches for marketing team, Sanity CMS webhooks."
   - **Target Qualification**: Very high urgency and clear metrics; requires rapid technical validation.

### 3. Instant Reset & Seeding Mechanism

#### A. Database Reset Implementation
The reset logic is implemented in a database module (`lib/db/crm.ts`) using transaction isolation:
```typescript
export async function resetCrmDatabase(scenarioId?: string): Promise<void> {
  // 1. Truncate opportunities and interactions within a transaction
  // 2. Query deal_scenarios (or fallback to static JSON fixtures)
  // 3. Re-seed default records with suggested_next_steps = NULL and status = 'unqualified'
}
```

#### B. API Endpoint & Server Action (`app/api/crm/reset/route.ts`)
- An endpoint `/api/crm/reset` accepting `{ scenarioId?: string }` via `POST`.
- Resets the database and calls `revalidatePath('/')` so Next.js UI updates immediately without manual reload.

#### C. Frontend UI Reset Control
- A floating or topbar toolbar with:
  - Scenario Selector dropdown (Acme Corp / Globex FinTech / Soylent Retail).
  - "Reset Demo State" button with instant loading feedback.
  - Quick badge showing current database connection (Neon Postgres pool).

#### D. Eve Agent Skill Integration (`skills/reset_crm_data.ts`)
- Exposes an Eve tool/skill `reset_crm_data(scenario_id: string)`:
  - Enables Eve or sub-agents to programmatically restore baseline test states during automated test runs or demo rehearsals without external scripts.
