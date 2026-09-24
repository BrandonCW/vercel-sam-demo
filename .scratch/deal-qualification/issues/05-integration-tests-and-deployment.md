# 05: End-to-End Workflow Integration Test Suite & Vercel Release Verification

**What to build:**
A comprehensive end-to-end integration test suite exercising the complete qualification lifecycle against the API and component seams, along with production and preview deployment verification on Vercel. Automated tests verify baseline scoring, zero-cost session pausing, feedback submission, delta re-scoring, and atomic CRM writeback across all three enterprise Scenarios (Acme Corp, Globex FinTech, Soylent Retail) using deterministic LLM transport mocks and a test database. Additionally, environment secret configurations and deployment pipelines (`mvp` branch for Preview, `main` branch for Production) are verified for release readiness.

**Blocked by:** 04: SA Feedback Ingestion, Delta Re-scoring & Atomic CRM Writeback

**Status:** ready-for-agent

- [ ] Automated integration test suite targeting the primary API route seam (`POST /api/qualification/assess`, `POST /api/qualification/feedback`, `POST /api/crm/reset`).
- [ ] Deterministic LLM response fixtures for Jev and System 2 (supporting Claude 3.5 Sonnet, Claude 3.5 Haiku, GPT-4o-mini, and Gemini 2.0 Flash schema structures).
- [ ] End-to-end test verifying Acme Corp Scenario: baseline score calculation $\rightarrow$ Netlify competitor detection $\rightarrow$ Stage 2 gate blocker on Economic Buyer $\rightarrow$ dynamic question generation $\rightarrow$ zero-cost session pause $\rightarrow$ SA feedback submission $\rightarrow$ Delta Re-scoring passing Stage 2 gate $\rightarrow$ atomic writeback of `[QUALIFIED]` Suggested Next Steps string.
- [ ] End-to-end test verifying Globex FinTech Scenario: AWS Amplify threat detection $\rightarrow$ VPC egress discovery questions $\rightarrow$ writeback of `[IN REVIEW]` Suggested Next Steps string.
- [ ] End-to-end test verifying CRM reset endpoint cleanly restores default scenario payloads and clears previous interaction telemetry.
- [ ] Component integration tests verifying `DynamicFormRenderer` input generation, field constraints, and payload packaging.
- [ ] Middleware security tests verifying unauthenticated access redirection to `/login` when `NODE_ENV !== 'development'` and bypass when in development mode.
- [ ] Vercel deployment configuration validated for `mvp` branch (Preview) and `main` branch (Production) with required environment variables (`APP_PASSWORD`, `AUTH_SECRET`, `POSTGRES_URL`, `SYSTEM2_MODEL_ID`).
