# Eve Agent Architecture & Sub-agent Decomposition

Type: task
Status: resolved
Blocked by: none

## Question

How should the Eve agent framework be structured for this system? Specifically, what are the exact definitions and responsibilities for the high-level instructions, available tools (CRM reader/writer, Jev caller, LLM prompt runner), skills (MEDDPICC evaluator, scenario seeder), and sub-agents (e.g. Qualification Assessor, Competitive Playbook Generator)?

## Answer

### 1. High-Level Agent (`DealQualificationAgent`)
- **Role**: Coordinates the entire lifecycle of the deal qualification workflow within an in-memory session.
- **Workflow**:
  1. Ingest deal record and raw AE/SA notes via `crm_read_deal`.
  2. Invoke `QualificationAssessor` to execute rapid rubric assessment via `run_jev_scoring`.
  3. Execute phased System 2 analysis via `run_system2_analysis` (Gap Analysis $\rightarrow$ Competitive Playbook $\rightarrow$ Dynamic Form Generation).
  4. Stream/render dynamic qualification questions in the Next.js frontend via Vercel JSON Render.
  5. Ingest SA feedback and trigger re-scoring.
  6. Finalize "Suggested Next Step" and persist via `crm_update_next_steps`.
- **Session State**: Holds active `dealId`, raw opportunity payload, current MEDDPICC score card, competitive analysis outputs, dynamic question schemas, and SA inputs.

### 2. Core Tools
- `crm_read_deal(dealId: string)`:
  Fetches Opportunity details from Postgres/Neon (name, stage, amount, AE notes, SA notes, current suggested next steps).
- `crm_update_next_steps(dealId: string, nextSteps: string)`:
  Atomic writeback tool that updates only the `suggested_next_steps` column and timestamp on the Opportunity.
- `run_jev_scoring(dealData: DealData)`:
  Invokes Jev (TypeSafe AI System 1) for rapid, deterministic scoring across all 8 MEDDPICC dimensions and competitive mention detection.
- `run_system2_analysis(dealData: DealData, jevScores: RubricScores, phase: 'gap_analysis' | 'competitive_playbook' | 'form_generation')`:
  Unified tool running phased LLM analysis to avoid prompt overload and keep outputs high-fidelity:
  - **Phase 1 (`gap_analysis`)**: Assesses missing MEDDPICC dimensions, highlights ambiguous or unverified assumptions in AE/SA notes, and isolates critical qualification blind spots.
  - **Phase 2 (`competitive_playbook`)**: Leveraged by `PlaybookGenerator` to synthesize counter-positioning strategies for detected competitors (e.g. AWS Amplify, Cloudflare Pages, Netlify) mapped against Vercel platform advantages.
  - **Phase 3 (`form_generation`)**: Compiles structured dynamic question components and input schemas ready for consumption by Vercel JSON Render on the frontend.

### 3. Skills
- `meddpicc-evaluator`: Standardized prompts, weights, and rubric definitions for evaluating Vercel enterprise deals against MEDDPICC criteria (Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition).
- `scenario-seeder`: Seed data definitions and instant database reset handlers for reproducible demo scenarios (e.g., enterprise replatforming, Cloudflare renewal risk, AWS Amplify bake-off).

### 4. Sub-Agents
- `QualificationAssessor`: Specializes in deal intake, baseline scoring coordination via Jev, and subsequent delta evaluation when new SA context is provided.
- `PlaybookGenerator`: Specializes in competitive threat analysis, battlecard extraction, and framing probing questions for the SA.
