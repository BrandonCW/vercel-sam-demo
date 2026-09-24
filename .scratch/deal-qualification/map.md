## Destination

A complete MVP build specification (`.scratch/deal-qualification/spec.md`) for the Vercel + Eve Deal Qualification System, defining the mock Salesforce CRM in Postgres, Eve agent orchestration (Jev System 1 fast MEDDPICC + competitive scoring and System 2 deep analysis with Vercel JSON Render dynamic UI), password authentication gate, and Vercel preview/production deployment workflow.

## Notes

- **Role & Perspective**: Solution Architect for Vercel evaluating enterprise deal qualification.
- **Tech Stack**: Next.js (App Router) on Vercel, Eve Agent Framework, Jev (TypeSafe AI System 1), System 2 LLM, Vercel JSON Render for dynamic form UI, Postgres/Neon for mock CRM.
- **Tone & Architecture**: Minimal, clean, easily understandable MVP code rather than over-engineered production monoliths.
- **Research Policy**: DO NOT automatically trigger background research subagents for deal personas, mock AE/SA notes, or MEDDPICC criteria. The user will provide or manually trigger those research items as needed.
- **Git & Deployment**: `mvp` branch serves as the Vercel Preview release; `main` branch serves as the Vercel Production release.
- **MEDDPICC Rubric Reference**: Canonical rubric definition, weights, status levels, competitive taxonomy, and stage gate thresholds are maintained at [`docs/meddpicc-rubric.md`](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/docs/meddpicc-rubric.md).
- **Security Command**: To generate a secure random password for preview and production environments:
  ```bash
  openssl rand -base64 32
  ```

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Mock Salesforce Schema & Storage Design](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/01-mock-crm-schema-and-db.md): Defined Postgres/Neon tables (opportunities, deal_scenarios, deal_interactions), three realistic enterprise scenarios (Acme Netlify, Globex Amplify, Soylent DTC), and UI/API/Eve reset mechanisms.
- [Eve Agent Architecture & Sub-agent Decomposition](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/02-eve-agent-structure.md): Structured Eve with DealQualificationAgent orchestrator, phased System 2 analysis tool (gap analysis, competitive playbook, form generation), CRM tools, and QualificationAssessor/PlaybookGenerator sub-agents.
- [Jev System 1 Fast MEDDPICC & Competitive Scoring](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/03-system1-jev-meddpicc-scoring.md): Defined Jev System 1 rubric evaluation with 8-dimension weighted formula, competitive extraction, stage gate readiness thresholds, and Zod schema.
- [Authentication Gate & Vercel Deployment Pipeline](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/06-auth-and-vercel-deployment.md): Defined stateless HMAC-SHA256 session cookie middleware with dev bypass, and two-tier Vercel deployment pipeline (`mvp` for preview, `main` for production).
- [System 2 Deep Analysis, Competitive Playbook & Dynamic JSON Render UI](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/04-system2-deep-analysis-and-json-render.md): Defined 3-phase System 2 reasoning (gap analysis, competitive battlecard synthesis, form generation) and declarative Vercel JSON Render component schema for Next.js.
- [SA Response Ingestion, Jev Re-scoring & CRM Writeback](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/05-sa-feedback-loop-and-crm-writeback.md): Defined feedback ingestion into SA notes, Jev delta re-scoring, standardized Suggested Next Step synthesis, atomic single-field writeback, and serverless telemetry persistence.
- [Interactive UI Flow & Action Controls Prototype](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/07-interactive-ui-prototype.md): Selected Variant A (Split Workbench) with persistent CRM/MEDDPICC left column, dynamic multi-state right stage, high-visibility zero-cost paused banner, and writeback display ([prototype asset](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/prototypes/interactive-ui-flow.html)).

## Not yet specified

- **Production Salesforce Integration**: Real OAuth2/REST API sync with Salesforce standard/custom objects once validated beyond the mock stage.
- **Multi-Tenant SA Workspaces**: Support for multiple concurrent SAs, team-wide deal dashboards, and role-based access control.
- **Custom Playbook Library**: Extensible CMS or repository of competitive battlecards (e.g. AWS Amplify, Cloudflare Pages, Netlify) editable directly by sales leadership.

## Out of scope

- Production-grade Salesforce bidirectional bulk synchronization (strictly mocking AE notes, SA notes, deal stage, and suggested next steps).
- Enterprise SSO/SAML (MVP uses a lightweight environment-variable password gate for Preview and Production).
- Voice/multimodal agent interfaces.
