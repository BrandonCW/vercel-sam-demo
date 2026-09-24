# Deal Qualification System MVP Specification

Status: ready-for-agent

## Problem Statement

Enterprise Solutions Architects (SAs) and Account Executives (AEs) spend significant time manually parsing unstructured qualification notes against complex sales frameworks like MEDDPICC. During high-velocity sales cycles, critical qualification gaps—such as missing Economic Buyer sign-offs, undefined technical Decision Criteria, and unaddressed competitor counter-offers (e.g., Netlify discounting, AWS Amplify credits)—are frequently overlooked before committing scarce technical architecture resources. Furthermore, recommendations are often buried in conversational chat threads or disparate documents rather than persisted as clear, standardized directives inside Salesforce, resulting in misaligned deal progression and delayed pipeline velocity.

## Solution

The Deal Qualification System is an automated qualification workbench built on Next.js and deployed on Vercel. It integrates a simulated Salesforce CRM in Postgres with a multi-phase agent architecture:
1. **System 1 (Jev)** executes rapid, deterministic scoring across all 8 MEDDPICC dimensions and extracts competitive threats in under 1.5 seconds.
2. **System 2** performs deep gap reasoning, generates targeted competitive battlecards, and compiles declarative JSON Render schemas for interactive qualification questions.
3. The interface enters an explicit **Assessment Session** that pauses at **zero compute/token cost** while awaiting the SA to conduct discovery and provide feedback.
4. Upon SA submission, System 1 executes **Delta Re-scoring**, evaluates sales **Stage Gate** exit criteria, and synthesizes a single standardized **Suggested Next Steps** directive.
5. The system performs an atomic **Writeback** to the Opportunity record in the simulated CRM, instantly updating the deal state and notifying field teams.

---

## User Stories

1. As a Solutions Architect, I want to view a simulated Salesforce Opportunity record with complete AE Notes and SA Notes, so that I have immediate context on the customer's current business and technical posture.
2. As a Solutions Architect, I want to trigger an automated qualification assessment with a single click, so that the Opportunity is immediately evaluated against the MEDDPICC rubric without manual calculation.
3. As a Solutions Architect, I want System 1 to evaluate the deal across all 8 MEDDPICC dimensions (Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition) within 1.5 seconds, so that I get immediate qualification feedback.
4. As a Solutions Architect, I want each MEDDPICC dimension scored from 0 to 10 with an associated status (unaddressed, partial, verified), so that I know exactly how mature our understanding is for each area.
5. As a Solutions Architect, I want to view direct textual citations from AE Notes and SA Notes supporting each dimension score, so that I can verify the agent's reasoning against customer statements. (Citations and gap callouts are produced by System 2; Jev returns no text.)
6. As a Solutions Architect, I want to see explicit gap callouts for every incomplete dimension, so that I know what evidence is still missing before the deal can advance.
7. As a Solutions Architect, I want System 1 to automatically detect competitor mentions (such as Netlify, AWS Amplify, Cloudflare Pages, or DIY Kubernetes) and assign a threat level, so that I am alerted to active bake-offs.
8. As a Solutions Architect, I want System 2 to generate targeted competitive battlecards and counter-positioning tactics based on detected competitors, so that I can expose competitor limitations during customer calls.
9. As a Solutions Architect, I want System 2 to generate dynamic, interactive qualification questions using JSON Render targeting our top deal blind spots, so that I can efficiently gather the missing evidence.
10. As a Solutions Architect, I want the system to enter a paused Assessment Session with a clear visual banner indicating zero compute and token costs, so that I can take hours or days to conduct customer meetings without worrying about background compute burn.
11. As a Solutions Architect, I want to fill out and submit the dynamic qualification form directly within the workbench, so that my new technical findings are captured in a structured format.
12. As a Solutions Architect, I want the system to append my submitted responses directly to SA Notes with a timestamp, so that an immutable audit trail of discovery findings is maintained.
13. As a Solutions Architect, I want System 1 to perform rapid Delta Re-scoring upon feedback submission, so that the composite MEDDPICC score immediately reflects the new information.
14. As a Solutions Architect, I want the system to evaluate Deal Stage Gate criteria (e.g., Gate 2 for Discovery $\rightarrow$ Technical Validation, Gate 3 for Technical Validation $\rightarrow$ Proposal), so that I know whether the deal meets formal stage exit criteria.
15. As a Solutions Architect, I want the agent to synthesize a single, standardized Suggested Next Steps string containing status, immediate milestone action, owners, core focus, and competitive watch points, so that field teams have unambiguous marching orders.
16. As an Account Executive, I want the synthesized Suggested Next Steps string written back atomically to the Opportunity record, so that I immediately see the technical team's guidance in Salesforce without reading through long technical logs.
17. As an Account Executive, I want the Opportunity's Qualification Status (Unqualified, In Review, Qualified, Disqualified) updated automatically upon writeback, so that deal pipelines accurately reflect technical readiness.
18. As a Solutions Architect, I want to select from pre-seeded Scenarios (such as Acme Corp / Netlify, Globex FinTech / AWS Amplify, and Soylent Retail / Headless) from a top navigation bar, so that I can demonstrate different deal qualification paths.
19. As a Solutions Architect, I want an instant Reset button that restores the active Scenario to its baseline unqualified state, so that I can run clean, repeatable demonstrations on demand.
20. As a Solutions Architect, I want to select the System 2 reasoning model from a dropdown in the UI (defaulting to Claude 3.5 Sonnet, with Claude 3.5 Haiku, GPT-4o-mini, and Gemini 2.0 Flash as options), so that I can compare reasoning depth, question phrasing, and execution speed across models.
21. As a Platform Administrator, I want the application protected by a lightweight password gate on Preview and Production environments, so that sensitive deal scenarios and agent endpoints are shielded from unauthorized public access.
22. As a Developer, I want the password authentication gate automatically bypassed when running in local development (`NODE_ENV === 'development'`), so that I can iterate rapidly without repetitive logins.
23. As an Engineering Lead, I want a Git-driven deployment pipeline where pushes to the `mvp` branch automatically trigger Vercel Preview deployments and merges to `main` deploy to Vercel Production, so that releases are predictable and automated.

---

## Implementation Decisions

### 1. Architectural Overview & Split Workbench UI

The user interface follows a persistent two-column Split Workbench layout (derived from prototype `.scratch/deal-qualification/prototypes/interactive-ui-flow.html`):
- **Header**: Displays Opportunity name, Deal Stage badge, Annual Contract Value (ACV), assigned AE/SA, detected Competitor threat pill, runtime session status, the demo Scenario selector with Reset trigger, and the System 2 Model Selector dropdown (options: Claude 3.5 Sonnet [default], Claude 3.5 Haiku, GPT-4o-mini, Gemini 2.0 Flash).
- **Left Column (Context & Real-Time Rubric)**:
  - Read-only AE Notes card.
  - Cumulative SA Notes card.
  - Real-time MEDDPICC 8-Dimension Rubric card displaying weighted progress bars, dimension maturity badges, and overall composite score (0–100) evaluated against Stage Gate thresholds.
- **Right Column (Stage-Based Action Stage)**:
  - Deterministically transitions through five UI states: `READY_TO_ASSESS`, `ASSESSING`, `PENDING_FEEDBACK`, `EVALUATING`, and `COMPLETED`.
  - In `PENDING_FEEDBACK`, renders an amber Zero-Cost Paused banner and the JSON Render dynamic form.
  - In `COMPLETED`, displays the finalized Suggested Next Steps callout with a 1-click clipboard copy button and audit confirmation of atomic CRM Writeback.

### 2. Simulated Salesforce CRM & Data Model (Postgres/Neon)

The CRM persistence layer simulates Salesforce Enterprise Opportunities in Postgres using three tables:
- **`opportunities`**: Primary mock CRM record storing deal identifiers, name, account, deal stage, ACV, AE notes, SA notes, the designated `suggested_next_steps` writeback field, qualification status (`unqualified`, `in_review`, `qualified`, `disqualified`), composite MEDDPICC score, JSON breakdown, and detected competitive flags.
- **`deal_scenarios`**: Immutable scenario templates containing baseline JSON payloads for demo seeding:
  - `scenario_acme_netlify`: Large retail brand on Netlify Enterprise facing deploy bottlenecks and 30% discount renewal pressure.
  - `scenario_globex_amplify`: Regulated fintech portal evaluating AWS Amplify with enterprise credits vs Vercel Secure Compute.
  - `scenario_soylent_headless`: DTC e-commerce brand replatforming to Shopify Plus + Next.js App Router with urgent Q4 freeze deadlines.
- **`deal_interactions`**: Telemetry and audit table capturing every agent action (`initial_scoring`, `questions_generated`, `sa_feedback`, `writeback`), actor, and payload.

### 3. Eve Agent Framework & Sub-Agent Structure

The Eve Agent framework coordinates the deal qualification lifecycle:
- **`DealQualificationAgent`**: Orchestrates the end-to-end evaluation flow, session state management, tool invocation, and handoffs.
- **`QualificationAssessor` Sub-Agent**: Specializes in deal intake, calling System 1 (Jev) for baseline evaluation, and executing Delta Re-scoring when SA feedback is received.
- **`PlaybookGenerator` Sub-Agent**: Specializes in competitor threat analysis, extracting battlecard counter-positioning from the taxonomy, and formulating targeted technical trap questions.
- **Agent Tools**:
  - `crm_read_deal`: Ingests Opportunity records from Postgres.
  - `crm_update_next_steps`: Executes atomic writeback of Suggested Next Steps and qualification fields to Postgres.
  - `run_jev_scoring`: Executes fast System 1 deterministic rubric scoring.
  - `run_system2_analysis`: Executes phased System 2 LLM reasoning (`gap_analysis`, `competitive_playbook`, `form_generation`).
  - `reset_crm_data`: Programmatically resets the database to a selected demo scenario.

### 4. System 1 (Jev) Deterministic MEDDPICC & Stage Gate Scoring

System 1 is TypeSafe AI's `typesafe-ai/jev` evaluation model, called through Vercel AI Gateway with `evaluate` from `eve/ai` (`zeroDataRetention` temporarily off; see Amendments). It is not an LLM prompt and returns no text. Jev answers one `score` question per MEDDPICC dimension (10 levels, level p = round(p × 10 / 9) on 0–10, worded from `docs/meddpicc-rubric.md`) and one `choice` question per taxonomy competitor (`absent | low | medium | high`). Per-dimension confidence comes from `providerMetadata.typesafe.confidence`. Status, the weighted composite and the stage gates are computed deterministically in code from those answers. Citations and gap callouts come from System 2.
- **Weighted 8-Dimension Formula**:
  $$\text{Composite Score} = \sum_{i=1}^{8} \left( \text{Dimension Score}_i \times 10 \times \text{Weight}_i \right)$$
  - Identify Pain: 20%
  - Champion: 15%
  - Economic Buyer: 15%
  - Decision Criteria: 15%
  - Decision Process: 10%
  - Metrics: 10%
  - Competition: 10%
  - Paper Process: 5%
- **Dimension Evaluation Levels**:
  - `0 - 3` (`unaddressed`): Missing or speculative mention.
  - `4 - 7` (`partial`): Qualitative mention present, lacking confirmed stakeholder sign-off or metrics.
  - `8 - 10` (`verified`): Documented evidence or confirmed stakeholder agreement.
- **Stage Gate Rules**:
  - **Gate 2 (Discovery $\rightarrow$ Technical Validation)**: Requires Identify Pain $\ge 6$, Champion $\ge 5$, Metrics $\ge 4$, Economic Buyer $\ge 4$, Composite Score $\ge 50$.
  - **Gate 3 (Technical Validation $\rightarrow$ Proposal)**: Requires Decision Criteria $\ge 7$, Economic Buyer $\ge 6$, Decision Process $\ge 5$, Identify Pain $\ge 7$, Champion $\ge 7$, Composite Score $\ge 70$.
- **Competitive Mention Extraction**: Scans against taxonomy (`Netlify`, `AWS Amplify`, `Cloudflare Pages`, `Akamai/Fastly`, `DIY Kubernetes / AWS ECS`) and assigns threat levels (`low`, `medium`, `high`).
- **Type-Safe Contract**: Enforced via Zod schema (`JevScoringResultSchema`).

### 5. System 2 Deep Reasoning & JSON Render Form Specification

System 2 executes sequentially across three phases to maintain high fidelity:
- **Phase 1: Gap Synthesis**: Analyzes `unaddressed` or `partial` dimensions and Stage Gate blockers, isolating assumptions vs confirmed facts.
- **Phase 2: Competitive Playbook**: Maps detected competitors to Vercel enterprise differentiators (App Router native streaming, Incremental Static Regeneration, Edge Middleware, Turborepo remote caching) and constructs strategic discovery questions.
- **Phase 3: Form Generation**: Synthesizes a structured JSON Render schema grouping 3–5 interactive questions under `Stage Gate Blockers`, `Competitive Validation`, and `Architecture & Metrics`.

#### JSON Render Schema Definition (from Prototype):
*(Derived from prototype `.scratch/deal-qualification/issues/04-system2-deep-analysis-and-json-render.md`)*
```typescript
interface JsonRenderForm {
  opportunityId: string;
  title: string;
  summary: string;
  sections: Array<{
    id: string;
    title: string;
    description?: string;
    calloutType?: 'info' | 'warning' | 'tip';
    calloutText?: string;
    fields: Array<{
      id: string;
      name: string;
      label: string;
      description?: string;
      type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox_group';
      placeholder?: string;
      required: boolean;
      options?: Array<{ label: string; value: string; description?: string }>;
      dimensionTarget: 'metrics' | 'economicBuyer' | 'decisionCriteria' | 'decisionProcess' | 'paperProcess' | 'identifyPain' | 'champion' | 'competition';
      helpCallout?: string;
    }>;
  }>;
}
```

### 6. Assessment Session Lifecycle & Zero-Cost Paused State

The qualification workflow is bounded within an explicit Assessment Session state machine:
- **`initiated` $\rightarrow$ `analyzing`**: Baseline scoring via System 1 and form generation via System 2.
- **`pending_feedback` (PAUSED)**: Session checkpoint is persisted to Postgres. The agent run completes its active compute cycle. **Zero compute, zero container, and zero token costs** are incurred while the SA reviews questions and conducts customer discovery.
- **`resumed` $\rightarrow$ `delta_scoring`**: SA submits form responses. Notes are appended to `sa_notes`. System 1 re-scores the Opportunity to determine new dimension scores and Stage Gate status.
- **`writeback` $\rightarrow$ `closed`**: Agent synthesizes the single Suggested Next Step, atomically writes to Postgres, marks the session as `closed`, and triggers Next.js path revalidation.

### 7. Suggested Next Steps Synthesis & Atomic CRM Writeback

To prevent CRM clutter, the agent synthesizes a single, standardized directive formatted as:
`[<STATUS>] <Immediate Milestone Action> | Owner: <AE/SA> | Focus: <Core Technical or Business Value> | Watch: <Risk/Competitor>`

- **Writeback Guarantee**: The writeback operation modifies **ONLY** `suggested_next_steps`, `sa_notes`, `qualification_status`, `meddpicc_score`, `meddpicc_breakdown`, and `updated_at`. Raw `ae_notes` are strictly immutable and preserved.

### 8. Authentication Gate & Deployment Pipeline

- **Stateless Authentication Gate**: Next.js App Router Edge Middleware verifies an HMAC-SHA256 signed session cookie (`deal_qual_session`) using `AUTH_SECRET` and `APP_PASSWORD`. Bypassed when `NODE_ENV === 'development'`.
- **Vercel Git Release Pipeline**:
  - `mvp` branch triggers automatic Vercel Preview deployments connected to the staging database branch.
  - `main` branch deploys to Vercel Production connected to the production database branch.

---

## Testing Decisions

### What Makes a Good Test
Tests must verify external system behavior and observable state transitions rather than private implementation details. A test should interact with the system through public interfaces (API routes, database queries, and rendered component interactions) and assert on end-state data contracts (e.g. correct score updates in the database, proper Stage Gate blocker calculations, valid JSON Render schemas, and atomic writebacks).

### Proposed Testing Seams

The architecture defines two primary seams, keeping the total number of seams to the absolute minimum:

1. **Primary Seam: API Route & Workflow Integration Seam (Highest Seam)**
   - **Target**: Next.js API Route Handlers (`/api/qualification/assess`, `/api/qualification/feedback`, `/api/crm/reset`).
   - **Mechanism**: Execute HTTP requests against route handlers connected to a test Postgres database (or local Neon test branch).
   - **Isolation Boundary**: LLM model endpoints (Jev and System 2) are mocked at the network/client transport level using deterministic canned response fixtures matching the Zod schemas (`JevScoringResultSchema` and `JsonRenderFormSchema`).
   - **Behaviors Verified**:
     - Baseline scoring calculation and database persistence.
     - Zero-cost session checkpoint creation (`pending_feedback`).
     - Feedback submission, note appending, Delta Re-scoring, Stage Gate exit check, and atomic Suggested Next Steps writeback.
     - CRM database reset and scenario re-seeding.

2. **Secondary Seam: JSON Render Component Contract Seam**
   - **Target**: `DynamicFormRenderer` React component.
   - **Mechanism**: Render the component using React Testing Library with valid `JsonRenderForm` fixture objects.
   - **Behaviors Verified**:
     - Form controls (radios, selects, text inputs) render correctly according to schema.
     - Required field validations prevent premature submission.
     - Form submission compiles the expected `{ fieldId: value }` dictionary for the feedback endpoint.

### Prior Art & Test Scenarios
- **Baseline Scoring Test**: Seed `scenario_acme_netlify` $\rightarrow$ trigger assessment $\rightarrow$ verify overall score is within expected range (e.g., 50–58), Identify Pain $\ge 8$, Netlify detected with `high` threat, and Stage 2 exit blocked by Economic Buyer.
- **Delta Re-scoring & Writeback Test**: Ingest verified Economic Buyer and build-time metrics $\rightarrow$ verify Delta Re-scoring increases composite score $\ge 70$, Stage 2 exit passes, qualification status updates to `qualified`, and `suggested_next_steps` contains the standardized `[QUALIFIED]` directive.
- **Auth Gate Middleware Test**: Verify unauthenticated requests redirect to `/login` in production mode and pass through unhindered when `NODE_ENV === 'development'`.

---

## Out of Scope

- Direct bidirectional synchronization with live, production Salesforce instances (OAuth2, Bulk API, custom Apex triggers); the simulated Postgres CRM serves as the system of record for this MVP.
- Enterprise SSO/SAML 2.0 (Okta, Azure AD) or role-based multi-tenancy; access is governed by the shared environment-variable password gate.
- Voice, telephony, or multimodal recording ingestion (e.g. Gong / Chorus transcript auto-sync).
- Custom user-facing battlecard CMS or interactive rubric weight editor.

---

## Further Notes

- **Interactive UI Prototype Asset**: Available for visual and state reference at [`.scratch/deal-qualification/prototypes/interactive-ui-flow.html`](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/prototypes/interactive-ui-flow.html).
- **MEDDPICC Rubric Reference**: Formal dimension definitions, weights, and stage exit gate thresholds are documented in [`docs/meddpicc-rubric.md`](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/docs/meddpicc-rubric.md).
- **Issue Tracking**: Implementation tickets 01 through 07 in `.scratch/deal-qualification/issues/` document the individual technical decisions leading to this master specification.

---

## Amendments (2026-09-25, eve review)

Tracked in issues 06–10.

- **Fail loudly**: No runtime fallbacks (regex scoring, canned System 2 output, in-memory CRM). Missing config or upstream failure throws. Supersedes any fallback behavior implied above.
- **§4 System 1**: Jev is TypeSafe AI's `typesafe-ai/jev` evaluation model via AI Gateway (`evaluate` from `eve/ai`), answering typed score/choice questions. Composite and stage gates computed in code from its answers.
- **User story 5 / citations**: Jev returns no text; per-dimension citations and gap callouts are produced by System 2.
- **§1 / user story 20 models**: Claude 3.5 / GPT-4o-mini / Gemini 2.0 options are retired; replaced with current Gateway IDs (see 08).
- **§6 Assessment Session**: implemented as a two-turn durable eve session (see 09).
- **Testing**: fixture-based tests allowed only for pure logic, and only alongside live eve evals against the real Gateway and a Postgres test branch (see 10). Supersedes "LLM endpoints mocked at transport level" as the sole integration strategy.
- **Jev request details (issue 07)**: `zeroDataRetention` is temporarily **off**, because the Gateway refuses it on the Pro Trial plan. Restore it once the team is on a paid Pro plan. Score questions use 10 levels, because Jev allows at most 10. Level p stands for round(p × 10 / 9), worded with that value's rubric band.
