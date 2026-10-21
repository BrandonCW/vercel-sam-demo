# 23: Enterprise Settings Menu, Sequential Navigation & DESIGN.md Workbench Alignment

**Status:** ready-for-agent  
**Type:** task  
**Blocked by:** 22  
**Parent Epic:** [GitHub Issue #6](https://github.com/BrandonCW/vercel-sam-demo/issues/6)

## Context

The workbench header currently exposes raw internal state enum strings (`READY_TO_ASSESS`, `PENDING_FEEDBACK`), a `"Salesforce connected"` pill, `$0 compute` banners, and numeric `Jump to state: [1] [2] [3] [4] [5]` buttons across `components/workbench/TopNavBar.tsx`, `components/workbench/StepperBar.tsx`, and `components/workbench/Banners.tsx`. Furthermore, `components/workbench/MeddpiccScorecard.tsx` hides verbatim evidence quotes and gaps behind collapsible accordions instead of following the radical-monochrome B2B specification in `DESIGN.md`.

## Goals

1. **Top Navigation Bar & Settings Popover (`components/workbench/TopNavBar.tsx`):**
   - Remove `"Salesforce connected"` badge (`TopNavBar.tsx:56-59`), raw internal enum status badge (`TopNavBar.tsx:63-76`), and top-level Simulation/Live pill switcher (`TopNavBar.tsx:122-144`).
   - Add clean enterprise Settings popover trigger (`aria-label="Workbench settings"`) housing:
     - Execution Mode (`Simulation` vs. `Live AI`)
     - Analysis Model (`SYSTEM2_MODELS`)
     - Opportunity Scenario (`Acme Corp`, `Globex Corp`, `Soylent Corp`)
     - Reset Opportunity State button
2. **Sequential Lifecycle Stepper & Back Navigation (`components/workbench/StepperBar.tsx`, `components/workbench/ActionPanel.tsx`, `components/workbench/QualificationWorkbench.tsx`):**
   - Remove `JumpToStateButtons` (`Jump to state: [1] [2] [3] [4] [5]`) from `StepperBar.tsx:58-92`.
   - In Simulation Mode, support sequential forward progression via the primary CTA and secondary `"← Previous step"` back navigation (`COMPLETED` -> `PENDING_FEEDBACK` -> `READY_TO_ASSESS`) alongside `"Reset"`.
3. **Always-Open 8-Row MEDDPICC Ledger (`components/workbench/MeddpiccScorecard.tsx`):**
   - Remove accordion expansion state (`expandedDimensions` at `MeddpiccScorecard.tsx:35-40`).
   - Render all 8 MEDDPICC rows permanently open with Dimension Name + Weight, 10-segment color-quarantined bar (`0–3` `#DC2626`, `4–7` `#D97706`, `8–10` `#059669`), tabular monospace score with parenthetical delta (`8/10 (+6)`), inline verbatim evidence quotes, and open gaps.
4. **Enforce `DESIGN.md` Radical Monochrome Restraint (`components/workbench/Banners.tsx`, `DealSummaryCard.tsx`, `StageGateCard.tsx`):**
   - Remove yellow `⚡ Discovery paused ($0 compute)` demo banner from `Banners.tsx:17-31`.
   - Align surface tokens (`#F9F9F8` canvas, `#FFFFFF` cards, `#F3F2EE` muted wells, `#E2E0D8` hairline borders, `#0F52BA` primary action button, `0px` box-shadows) and parenthetical composite score deltas (`78 (+24)`) with `DESIGN.md:36-208`.

## Acceptance Criteria

1. `TopNavBar.tsx` renders zero raw enum strings (`READY_TO_ASSESS`, `PENDING_FEEDBACK`, `ANALYZING`), zero `"Salesforce connected"` pills, and houses Execution Mode, System 2 Model selector, Scenario selector, and Reset inside the Settings popover.
2. `StepperBar.tsx` no longer renders `Jump to state (1–5)` numeric buttons; Simulation Mode supports sequential forward progression and stepping back to the previous stage.
3. `MeddpiccScorecard.tsx` renders all 8 MEDDPICC rows permanently open (zero accordion expand/collapse toggles) with 10-segment color-quarantined bars and parenthetical deltas (`(+N)`).
4. `Banners.tsx` has zero yellow `$0 compute` banners; surface tokens match `DESIGN.md`.
5. `npm test` and `npm run build` pass with exit code 0.

## Testing Plan

| Layer | What | Count | Test Card |
|---|---|---|---|
| **Integration** | `tests/simulation-engine.test.ts` — Sequential state progression, step-back navigation (`COMPLETED` -> `PENDING_FEEDBACK` -> `READY_TO_ASSESS`), and fixture validation | +2 | `protects=deterministic simulation state transitions including step-back and slimmed fixture compatibility; fails_when=stepping back corrupts scores/opportunity state or fixture fails Zod validation; no_claim=browser DOM layout` |
| **Component / E2E** | `tests/workbench-ui.test.tsx` — Settings popover interactions (Mode, Model, Scenario, Reset), absence of demo artifacts (`$0 compute`, `READY_TO_ASSESS`, `Jump to state`), and always-open 8-row MEDDPICC ledger | +4 | `protects=enterprise Settings popover controls and DESIGN.md always-open 8-row MEDDPICC ledger without demo chrome; fails_when=accordions hide MEDDPICC quotes/gaps, JumpToStateButtons render, or mode/model/scenario controls fail to trigger callbacks; no_claim=visual pixel rendering in headless Chromium (verified in /qa)` |

## Rollback Plan

`git revert <commit-sha>` cleanly restores previous workbench UI components without affecting database or backend logic.
