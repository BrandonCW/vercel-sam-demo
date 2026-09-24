# Jev System 1 Fast MEDDPICC & Competitive Scoring

Type: task
Status: resolved
Blocked by: 01, 02

## Question

How should Jev (TypeSafe AI System 1 model) ingest the AE notes, SA notes, and current deal stage to rapidly score the opportunity against the MEDDPICC rubric, extract explicit competitive mentions, and calculate whether the deal is ready to advance through the sales stage gate?

## Answer

### 1. Architectural Role of Jev (System 1)

Jev functions as the deterministic, type-safe System 1 evaluation layer within the Eve Agent ecosystem:
- **Low Latency**: Executes in $<1.5$ seconds, providing immediate feedback without long multi-turn agent stalls.
- **Strict Typing**: Guaranteed output adherence to a Zod schema (`JevScoringResultSchema`), avoiding downstream parsing failures.
- **Deterministic Rubric Scoring**: Performs objective feature extraction and scoring rather than conversational generation.
- **Canonical Reference**: Complete rubric formulas, weights, evidence criteria, and stage gate thresholds are documented in [docs/meddpicc-rubric.md](file:///Users/brandonwarwick/Documents/Workspace/vercel-sam-demo/docs/meddpicc-rubric.md).

### 2. Ingestion & Input Payload

Jev accepts a normalized `OpportunityPayload`:
```typescript
interface JevScoringInput {
  dealId: string;
  name: string;
  accountName: string;
  stageName: string; // e.g. "Stage 2 - Discovery", "Stage 3 - Technical Validation"
  amount: number;
  aeNotes: string;
  saNotes: string;
}
```

### 3. MEDDPICC 8-Dimension Rubric & Weighting Formula

Jev evaluates the unstructured AE and SA notes across the 8 standard MEDDPICC dimensions:

| Dimension | Weight | Definition & Vercel Evaluation Criteria |
| :--- | :---: | :--- |
| **Metrics (M)** | 10% | Quantifiable ROI, build-time reduction (e.g. 45m $\rightarrow$ 5m), Core Web Vitals targets, conversion gains. |
| **Economic Buyer (EB)** | 15% | Identified individual with final budget sign-off authority (e.g. VP E-Commerce, CTO, CFO). |
| **Decision Criteria (DC)** | 15% | Explicit technical and commercial requirements (App Router support, ISR, SOC2, Edge latency SLA). |
| **Decision Process (DP)** | 10% | Step-by-step milestones, technical proof-of-concept timelines, executive review schedules. |
| **Paper Process (PP)** | 5% | Legal, procurement, security review, MSA negotiations, and vendor onboarding cycles. |
| **Identify Pain (IP)** | 20% | High-impact technical or business blockers (e.g. site outages on release, queuing deploy bottlenecks, cost overruns). |
| **Champion (C)** | 15% | Internal stakeholder actively driving Vercel adoption and providing insider context (e.g. Head of Platform). |
| **Competition (CO)** | 10% | Presence and positioning of competing vendors (Netlify, AWS Amplify, Cloudflare Pages, internal DIY). |

#### Scoring Rules per Dimension:
- `score`: Integer scale from `0` to `10`.
- `status`:
  - `unaddressed` (score $0 - 3$): Missing or negligible mention in discovery notes.
  - `partial` (score $4 - 7$): Qualitative mention present, but lacks empirical validation or confirmed stakeholder signoff.
  - `verified` (score $8 - 10$): Explicitly verified with documented evidence from the customer.
- `evidence`: Direct citations extracted from `aeNotes` or `saNotes`.
- `gaps`: Clear, concise bullet describing what is missing or ambiguous.

#### Overall Composite Score Calculation:
$$\text{Composite Score} = \sum_{i=1}^{8} \left( \text{score}_i \times 10 \times \text{weight}_i \right)$$
The resulting integer is bounded between `0` and `100`.

### 4. Competitive Mention Extraction

Jev scans notes against an enterprise frontend taxonomy:
- **Target Competitors**: `Netlify`, `AWS Amplify`, `Cloudflare Pages`, `Akamai/Fastly`, `DIY Kubernetes / AWS ECS`.
- **Classification Output**:
  - `name`: Normalized competitor name.
  - `threatLevel`: `'low' | 'medium' | 'high'`.
  - `evidence`: Verbatim quote from notes.
  - `contextSummary`: Tactical situation (e.g., "Competitor offering 30% contract discount on annual renewal").

### 5. Stage Gate Readiness Logic

Jev deterministically evaluates whether the Opportunity meets the exit gate requirements for its current `stageName`:

1. **Gate 2: Discovery $\rightarrow$ Technical Validation (Stage 2 $\rightarrow$ Stage 3)**
   - **Prerequisites**:
     - Identify Pain $\ge 6/10$
     - Champion $\ge 5/10$
     - Metrics $\ge 4/10$
     - Overall MEDDPICC score $\ge 50/100$
2. **Gate 3: Technical Validation $\rightarrow$ Proposal (Stage 3 $\rightarrow$ Stage 4)**
   - **Prerequisites**:
     - Decision Criteria $\ge 7/10$
     - Economic Buyer $\ge 6/10$
     - Decision Process $\ge 5/10$
     - Overall MEDDPICC score $\ge 70/100$

Output fields:
- `gateReady`: `boolean`
- `currentStage`: string
- `targetStage`: string
- `gateBlockers`: Array of exact human-readable blockers (e.g., `["Economic Buyer is not verified in discovery notes", "Decision Criteria lack quantitative Core Web Vitals thresholds"]`).

### 6. Type-Safe Schema Specification (`lib/agents/jev-schema.ts`)

```typescript
import { z } from 'zod';

export const DimensionResultSchema = z.object({
  score: z.number().min(0).max(10),
  status: z.enum(['unaddressed', 'partial', 'verified']),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  gaps: z.array(z.string())
});

export const CompetitiveMentionSchema = z.object({
  name: z.string(),
  threatLevel: z.enum(['low', 'medium', 'high']),
  evidence: z.string(),
  contextSummary: z.string()
});

export const StageGateEvaluationSchema = z.object({
  gateReady: z.boolean(),
  currentStage: z.string(),
  targetStage: z.string(),
  gateBlockers: z.array(z.string())
});

export const JevScoringResultSchema = z.object({
  dealId: z.string(),
  overallScore: z.number().min(0).max(100),
  dimensions: z.object({
    metrics: DimensionResultSchema,
    economicBuyer: DimensionResultSchema,
    decisionCriteria: DimensionResultSchema,
    decisionProcess: DimensionResultSchema,
    paperProcess: DimensionResultSchema,
    identifyPain: DimensionResultSchema,
    champion: DimensionResultSchema,
    competition: DimensionResultSchema
  }),
  competitiveFlags: z.array(CompetitiveMentionSchema),
  stageGate: StageGateEvaluationSchema,
  evaluatedAt: z.string().datetime()
});

export type JevScoringResult = z.infer<typeof JevScoringResultSchema>;
```

### 7. Storage & Integration Lifecycle

1. **Caller**: Eve's `QualificationAssessor` sub-agent calls `run_jev_scoring(dealData)`.
2. **Database Update**:
   - Updates `opportunities.meddpicc_score = result.overallScore`
   - Updates `opportunities.meddpicc_breakdown = result.dimensions`
   - Updates `opportunities.competitive_flags = result.competitiveFlags.map(c => c.name)`
3. **Telemetry**: Inserts an audit row into `deal_interactions` with `actor = 'system1_jev'` and `action = 'initial_scoring'`.
4. **Handoff**: Passes `JevScoringResult` directly to System 2 for deep gap analysis and dynamic UI question generation.
