## Destination

A complete MVP build specification (`.scratch/deal-qualification/spec.md`) for the Vercel + Eve Deal Qualification System, defining the mock Salesforce CRM in Postgres, Eve agent orchestration (Jev System 1 fast MEDDPICC + competitive scoring and System 2 deep analysis with Vercel JSON Render dynamic UI), password authentication gate, and Vercel preview/production deployment workflow.

## Notes

- **Role & Perspective**: Solution Architect for Vercel evaluating enterprise deal qualification.
- **Tech Stack**: Next.js (App Router) on Vercel, Eve Agent Framework, Jev (TypeSafe AI System 1), System 2 LLM, Vercel JSON Render for dynamic form UI, Postgres/Neon for mock CRM.
- **Tone & Architecture**: Minimal, clean, easily understandable MVP code rather than over-engineered production monoliths.
- **Research Policy**: DO NOT automatically trigger background research subagents for deal personas, mock AE/SA notes, or MEDDPICC criteria. The user will provide or manually trigger those research items as needed.
- **Git & Deployment**: `mvp` branch serves as the Vercel Preview release; `main` branch serves as the Vercel Production release.
- **Security Command**: To generate a secure random password for preview and production environments:
  ```bash
  openssl rand -base64 32
  ```

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Mock Salesforce Schema & Storage Design](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/01-mock-crm-schema-and-db.md): Defined Postgres/Neon tables (opportunities, deal_scenarios, deal_interactions), three realistic enterprise scenarios (Acme Netlify, Globex Amplify, Soylent DTC), and UI/API/Eve reset mechanisms.
- [Eve Agent Architecture & Sub-agent Decomposition](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/issues/02-eve-agent-structure.md): Structured Eve with DealQualificationAgent orchestrator, phased System 2 analysis tool (gap analysis, competitive playbook, form generation), CRM tools, and QualificationAssessor/PlaybookGenerator sub-agents.

## Not yet specified

- **Production Salesforce Integration**: Real OAuth2/REST API sync with Salesforce standard/custom objects once validated beyond the mock stage.
- **Multi-Tenant SA Workspaces**: Support for multiple concurrent SAs, team-wide deal dashboards, and role-based access control.
- **Custom Playbook Library**: Extensible CMS or repository of competitive battlecards (e.g. AWS Amplify, Cloudflare Pages, Netlify) editable directly by sales leadership.

## Out of scope

- Production-grade Salesforce bidirectional bulk synchronization (strictly mocking AE notes, SA notes, deal stage, and suggested next steps).
- Enterprise SSO/SAML (MVP uses a lightweight environment-variable password gate for Preview and Production).
- Voice/multimodal agent interfaces.
