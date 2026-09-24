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
