# Interactive UI Flow & Action Controls Prototype

Type: prototype
Status: resolved
Blocked by: 05

## Question

How should the Deal Qualification user interface be structured to provide a clear, intuitive visual hierarchy for the Solutions Architect—specifically detailing the placement and states of the interactive action controls (e.g., "Start Assessment" trigger, the "Pending Feedback" paused state with zero-cost indicator, the dynamic JSON Render qualification form, the "Submit Feedback" trigger, and the final CRM Writeback & Suggested Next Steps display) across the Opportunity view?

## Answer

### 1. Selected Architecture: Variant A (Split Workbench)
The Solutions Architect interface adopts a persistent two-column Split Workbench layout, separating background CRM context and real-time rubric tracking from active, stage-based interactive workflows.

- **Primary Source Prototype Asset**: [`.scratch/deal-qualification/prototypes/interactive-ui-flow.html`](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/.scratch/deal-qualification/prototypes/interactive-ui-flow.html)

### 2. Opportunity Header & Global Metadata
- **Deal Identity**: Opportunity Name, Stage Pill (e.g., `Stage 2: Discovery`), Target ARR, and Lead AE/SA.
- **Threat Indicator**: Prominent competitor badge (e.g., `Netlify (High Threat)` or `AWS Amplify (Medium Threat)`).
- **Agent Runtime Status**: Live status badge reflecting the active lifecycle (`Idle (Ready)`, `Running (Jev & System 2)`, `Paused (0 Tokens / $0.00)`, `Completed & Synced`).
- **Demo Controls**: Scenario selector dropdown (`Acme Corp`, `Globex Industries`, `Soylent Corp`) with instant Reset button.

### 3. Left Column: Context & Real-Time Rubric
- **Raw CRM Context Cards**:
  - **Account Executive Notes**: Read-only display of incoming qualitative business context, initial budget claims, and competitor mentions.
  - **Solutions Architect Notes**: Cumulative log of technical architecture observations and gap validations.
- **MEDDPICC 8-Dimension Rubric Card**:
  - Live progress bars for all 8 weighted dimensions (`identifyPain` 20%, `champion` 15%, `economicBuyer` 15%, `decisionCriteria` 15%, `decisionProcess` 10%, `metrics` 10%, `competition` 10%, `paperProcess` 5%) color-coded by maturity (Red: 0–3, Amber: 4–7, Green: 8–10).
  - **Composite Score Banner**: Dynamic 0–100 integer score compared against stage gate thresholds (Stage 3: 50 / Stage 4: 70).

### 4. Right Column: Stage-Based Action Stage
The right column morphs deterministically according to the qualification lifecycle:

1. **`READY_TO_ASSESS` (Initial State)**:
   - Primary card with clear description of the upcoming automated checks and the primary action trigger: **"Start Assessment"**.
2. **`ASSESSING` (Running State)**:
   - Non-blocking loading state displaying dual progress: Jev System 1 rubric calculation $\rightarrow$ System 2 gap identification and JSON Render schema generation.
3. **`PENDING_FEEDBACK` (Paused State - HITL)**:
   - **Zero-Cost Banner**: Prominent amber notification emphasizing *"Agent Paused: Zero Cost — In-memory session preserved, 0 tokens/sec compute incurred while awaiting SA"*, displaying session token count and accrued cost.
   - **Dynamic Qualification Form (Vercel JSON Render)**: Declarative inputs generated specifically for the detected qualification gaps (e.g., Economic Buyer authorization radios, Netlify caching benchmarks, technical validation timelines).
   - **Action Trigger**: Primary **"Submit Feedback & Re-score"** button.
4. **`EVALUATING` (Delta Re-scoring State)**:
   - Re-evaluating rubric deltas and synthesizing the final next steps.
5. **`COMPLETED` (Final Writeback State)**:
   - **CRM Writeback Card**: High-contrast blue highlight container showcasing the single synthesized **Suggested Next Steps** string written back to Postgres/Neon.
   - **Affordances**: "Written back to Salesforce CRM" confirmation badge, 1-click **"Copy to Clipboard"** button, and **"Re-evaluate Deal"** trigger.
   - **Audit View**: Card displaying the newly appended notes added to the Opportunity's `sa_notes`.
