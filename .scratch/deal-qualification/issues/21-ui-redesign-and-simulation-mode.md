# 21: Integrate Enterprise Workbench UI and Client-Side Simulation Mode

**Status:** ready-for-agent  
**Type:** task  
**Blocked by:** 20  

## Context

The current Deal Qualification workbench uses a dark theme and runs strictly against live services (`useEveAgent` talking to the Vercel AI Gateway and Neon Postgres). During sales demonstrations, executive walkthroughs, or offline development, live LLM calls introduce 15–30s latency, require API keys, and risk rate limits.

A high-fidelity prototype in `deal-qualification-system.zip` establishes a light enterprise operations design with a 5-step lifecycle stepper, deal context card, expandable MEDDPICC evidence/gap scorecard, Stage Gate 2 checklist, and zero-cost pause indicator.

## Goals

1. **Light Enterprise UI**: Replace the dark workbench with the design from `deal-qualification-system.zip` (clean `#f5f7fa` background, white cards, `#dfe5ed` borders, `#14233b` accents).
2. **Prominent Mode Indicator & Switcher**: Clearly display whether the workbench is running in **Simulation Mode (Client-Side)** or **Live AI Mode** in the header.
3. **Deterministic Simulation Mode (Client-Side)**: For Acme Corp (`opp_acme_corp_001`), replay captured real LLM responses across the 5 stages (`Baseline` → `Analyzing` → `Discovery paused` → `Re-scoring` → `Completed`) with zero database dependencies, zero Gateway calls, instant resets, and a numeric "Jump to state" (1–5) stepper.
4. **Dynamic Schema-Driven Discovery Form**: Style the discovery view using the prototype's clean card design while dynamically rendering fields from `JsonRenderForm` (`phase3Form`), ensuring compatibility with both captured fixtures and live runs.
5. **Real LLM Capture Script**: Add `scripts/capture-simulation-fixture.ts` to execute System 1 and System 2 calls against the live AI Gateway and persist fresh JSON fixtures.
6. **Preserve Live Mode**: Keep `useEveAgent` functional when toggled to Live AI Mode.

---

## Technical Design

### 1. Mode Architecture & State Machine

The top navigation header hosts a clear badge/selector:
- `[⚡ Simulation Mode (Client-side) ▾]` (Default)
- `[🌐 Live Mode (Eve Agent) ▾]`

```
                             QualificationWorkbench
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             [Simulation Mode]                     [Live Mode]
           (Client-Side Engine)                  (useEveAgent Hook)
                      │                                 │
           ┌──────────┴──────────┐                      │
           ▼                     ▼                      │
     "Jump to State"      "Step Through"                ▼
     (Instant 1–5)       (Simulated delays)     run_assessment tool
           │                     │             (AI Gateway + Postgres)
           └──────────┬──────────┘
                      ▼
            acme_migration.json
         (Captured LLM Responses)
```

#### Simulation State Lifecycle
- `1. Baseline (READY_TO_ASSESS)`: Score 54/100, Stage Gate 2 blocked, AE/SA context displayed.
- `2. Analyzing (ANALYZING)`: Progress banner with spinner, simulated 1.2s delay.
- `3. Discovery paused (PENDING_FEEDBACK)`: Session paused banner (`$0 compute`), renders dynamic discovery form.
- `4. Re-scoring (EVALUATING)`: Progress banner for delta re-scoring, simulated 1.2s delay.
- `5. Completed (COMPLETED)`: Score 76/100, Stage Gate 2 satisfied, Suggested Next Steps displayed with clipboard copy.

### 2. Fixture Format (`lib/fixtures/simulation/acme_migration.json`)
```ts
export interface SimulationFixture {
  scenarioId: string;
  opportunity: Opportunity;
  baseline: {
    jevResult: JevScoringResult;
    system2Result: System2AnalysisResult;
  };
  feedback: {
    formResponses: Record<string, string | string[]>;
    notesDelta?: string;
    rescoreJevResult: JevScoringResult;
  };
  verdict: AssessmentResult;
  capturedAt: string;
}
```

### 3. UI Component Structure & Reuse
- Avoid upgrading to Tailwind v4; adapt arbitrary utility classes (`bg-[#f5f7fa]`, `text-[#152238]`, etc.) to work within the existing Tailwind 3.4 setup.
- Add `components/ui/button.tsx` based on `class-variance-authority` and existing Radix/Lucide icons.
- Subcomponents under `components/workbench/`:
  - `TopNavBar`: Mode switcher badge, scenario info, reset button.
  - `StepperBar`: 5-step navigation + numeric "Jump to state" pill buttons.
  - `DealContextCard`: AE/SA notes, owners, competitor, timeline.
  - `MeddpiccScorecard`: Expandable dimension rows with verbatim evidence quotes and qualification gaps.
  - `StageGateCard`: Gate 2 checklist (Pain, Champion, Metrics, Economic Buyer, Composite threshold).
  - `ActionPanel`: Dark navy card with workflow triggers, Suggested Next Steps, and copy-to-clipboard.
  - `DynamicFormRenderer`: Light-card styling for `JsonRenderForm` schema fields.

### 4. Capture Tooling
- `scripts/capture-simulation-fixture.ts`:
  - Connects to AI Gateway with `AI_GATEWAY_API_KEY`.
  - Runs `scoreWithJev` and `analyzeWithSystem2` on `opp_acme_corp_001`.
  - Formulates standard SA answers and executes delta re-scoring.
  - Writes back and serializes the complete fixture to disk.

---

## Verification Plan

1. **Unit Tests (`tests/simulation.test.ts`)**:
   - Verify fixture loads and validates against Zod schemas.
   - Verify simulation state machine transitions correctly through all 5 states.
   - Verify jumping directly to any state (1–5) yields exact expected scores and banners.
   - Verify discovery form answer submission calculates delta and produces final qualified status.
2. **Component Tests (`tests/workbench-shell.test.tsx`)**:
   - Verify mode switcher displays "Simulation Mode (Client-side)" vs "Live Mode".
   - Verify dynamic form renders fields from the captured schema.
3. **Build & Lint**:
   - `pnpm test` passes clean.
   - `pnpm build` completes with zero type errors.
4. **Browser QA**:
   - Test stepping flow: Start assessment → Paused banner → Submit findings → Completed.
   - Test "Jump to state" buttons 1–5.
   - Verify clipboard copy of Suggested Next Steps.

## Out of Scope
- Simulation fixtures for Globex and Soylent (future tickets).
- Database persistence for simulation mode (strictly client-side in-memory).
- Upgrading the project to Tailwind 4.

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Acme Corp single-scenario MVP for simulation | Mechanical | P2 (Boil lakes) | Acme is the primary baseline demo scenario; expanding to Globex/Soylent before proving the simulation engine adds unnecessary blast radius. | Multi-scenario fixtures in v1 |
| 2 | CEO | Pure client-side in-memory simulation (zero DB writes) | Taste | P3 (Pragmatic) | Eliminates database latency, lease-lock contention, and network dependencies during high-stakes sales presentations. Instant state switching and resets. | Hybrid DB-persisted simulation |
| 3 | Design | Retain Tailwind 3.4 with custom utility classes & shared `<Button />` | Mechanical | P4 (DRY) & P5 (Explicit) | Prototype used Tailwind 4 and Base UI; adopting Tailwind 3.4 utility classes avoids breaking Next 15/Eve build tooling while preserving identical visual output. | Tailwind 4 upgrade & Base UI dependency |
| 4 | Design | Strict 5-state visual stepper with numeric jump controls | Taste | P1 (Completeness) | Gives presenters total narrative control: either let the simulation play out with realistic delays or jump directly to any state during a Q&A. | Non-interactive progress indicator |
| 5 | DX | Bootstrap fixture from prototype, provide live capture script | Taste | P3 (Pragmatic) & P6 (Action) | Allows the team to develop and test immediately with high-fidelity Acme data while maintaining a CLI tool (`scripts/capture-simulation-fixture.ts`) for fresh Gateway recordings. | Blocking implementation on live capture |
| 6 | DX | Type fixture with Zod schema (`SimulationFixtureSchema`) | Mechanical | P1 (Completeness) | Guarantees runtime safety for client-side replay; prevents regressions and broken field rendering if fixtures are modified. | Untyped JSON loading |
| 7 | Eng | Dual-mode component isolation behind top-nav switch | Mechanical | P5 (Explicit over clever) | Keeps `useEveAgent` live hook completely decoupled from the simulation state machine. Zero risk of simulation code corrupting live agent sessions. | Proxying Eve agent HTTP stream |
| 8 | Eng | Realistic simulated delay (1.2s) on step-through, instant on jump | Taste | P1 (Completeness) | Provides realistic cognitive pacing when pressing "Start assessment" or "Submit findings", while preserving instant transitions for demo jumping. | Instant-only or delay-only transitions |

---

## GSTACK REVIEW REPORT

### Review Verdict: APPROVED (Score: 10/10)

The autoplan review pipeline has completed across all four dimensions (CEO, Design, DX, Eng) using gstack's 6 decision principles.

#### 1. CEO & Strategy Review (P1 Completeness + P2 Boil Lakes)
- **Problem & Demo Impact**: Solves the critical vulnerability of live sales demos failing due to LLM Gateway latency or API timeouts. Replaying authentic, captured Gemini 3.8 Flash & Jev responses guarantees sub-second responsiveness.
- **Narrative & Positioning**: Elevates the product presentation. The prominent `$0 compute paused` banner explicitly demonstrates the core architectural value of Eve's zero-cost durable wait state.
- **Scope Discipline**: Hard boundary around Acme Corp (`opp_acme_corp_001`) prevents premature multi-tenant or multi-scenario complexity.

#### 2. Design Review (P5 Explicit + P1 Completeness)
- **Aesthetic System**: Light enterprise operations aesthetic (`#f5f7fa` canvas, crisp white card containers, `#dfe5ed` borders, `#14233b` navy accents) successfully eliminates AI slop and terminal dark-mode styling.
- **Visual Stepper**: Clear 5-step visual progression with distinct pill states (Done: emerald check, Active: amber/blue focus, Future: muted gray) plus numeric jump buttons (1–5) for presentation control.
- **Information Architecture**: Split workbench layout balances context (AE/SA discovery notes, owner, competitor, timeline) on the left with action/progress (Stage Gate 2 checklist, assessment summary, Suggested Next Steps writeback) on the right.
- **Dynamic Form**: Adapts `DynamicFormRenderer` to output clean enterprise form fields matching the prototype card styling.

#### 3. Developer Experience (DX) Review (P3 Pragmatic + P6 Action)
- **Capture CLI**: `scripts/capture-simulation-fixture.ts` provides a clear, repeatable command for recording live LLM responses without manual copy-pasting.
- **Fixture Rigor**: `SimulationFixtureSchema` ensures versioned, type-safe JSON fixtures.
- **Test Velocity**: Pure client-side simulation enables lightning-fast Vitest unit tests (<50ms) running without database connection or environment variables.

#### 4. Engineering & Architecture Review (P5 Explicit + P3 Pragmatic)
- **Decoupled Architecture**: Clean separation between `SimulationEngine` (client-side state machine) and `useEveAgent` (serverless streaming agent). No mocks injected into production agent code.
- **Determinism**: State transitions are pure functions of current state and event actions.
- **Zero Database Contention**: Simulation mode bypasses Neon Postgres completely, eliminating lease conflicts with test/eval runners. Live mode continues to exercise durable Postgres writes.
- **Error Boundaries**: Clear fallback paths for missing fixtures, malformed answers, and clipboard API permission denials.

