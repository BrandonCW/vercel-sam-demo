# 23: Enterprise Settings Menu, Sequential Navigation & DESIGN.md Workbench Alignment

**Status:** resolved  
**Type:** task  
**Blocked by:** 22  
**Parent Epic:** [GitHub Issue #6](https://github.com/BrandonCW/vercel-sam-demo/issues/6)

## Implementation & Verification Summary

### Commit Ledger
- `9407e6d` (`feat(workbench): lift TopNavBar controlled state and implement accessible Settings popover`):
  - Task T5: Lifted `<TopNavBar />`, `mode`, `scenarioId`, `selectedModel`, and `settingsOpen` into `QualificationWorkbench.tsx`.
  - Replaced inline debug switches with accessible `<SettingsPopover />` dialog (`role="dialog"`, `aria-label="Workbench settings"`, keyboard Escape and click-outside dismissal, focus trap and return).
  - Cleaned up raw enum status badges and `"Salesforce connected"` pill.
  - Added +4 unit tests in `tests/workbench-shell.test.tsx` (26/26 passed).
- `61eadbe` (`feat(workbench): enforce sequential progression, previous-step navigation, and timer cleanup`):
  - Task T6: Removed raw `{step.state}` subtitles and `JumpToStateButtons` from `StepperBar.tsx`.
  - Added `"← Previous step"` secondary button in `ActionPanel.tsx` (disabled at `READY_TO_ASSESS`, hidden in Live mode).
  - Added `STEP_BACK` reducer handling, delta calculations on `COMPLETED`, delta reset on `STEP_BACK`, and transition timer cleanup with `useRef` in `QualificationWorkbench.tsx`.
  - Added `tests/simulation-engine.test.ts` (+3 tests) and updated `tests/qualification-workbench.test.tsx` (5/5 passed).
- `c08ea16` (`feat(workbench): enforce permanently open 8-row MEDDPICC ledger and DESIGN.md styling`):
  - Task T7: Permanently rendered all 8 MEDDPICC rows open with color-quarantined 10-segment score bars, monospace deltas (`(+Δ)`), and inline buyer evidence and blind spots in `MeddpiccScorecard.tsx`.
  - Supported all 5 field types (`text`, `textarea`, `select`, `radio`, `checkbox_group`) and score chip formatting `"{label}: {score}/10"` in `DynamicDiscoveryForm.tsx`.
  - Removed yellow `$0 compute` banners and aligned design tokens (`#F8F8F6` canvas, `#FFFFFF` surface, `#F1F0EC` wells, `#E2E0D8` hairline borders, `#0F52BA` CTA) in `Banners.tsx`, `app/globals.css`, and `app/layout.tsx`.
  - Added +5 unit tests in `tests/dynamic-form-renderer.test.tsx` (12/12 passed).

### Test Verification
- `tests/workbench-shell.test.tsx`: 26 passed
- `tests/dynamic-form-renderer.test.tsx`: 12 passed
- `tests/simulation-engine.test.ts`: 3 passed
- `tests/qualification-workbench.test.tsx`: 5 passed
- Total verified test suite: 46 passing unit/integration tests across workbench components.

## Context

The workbench header currently exposes raw internal state enum strings (`READY_TO_ASSESS`, `PENDING_FEEDBACK`), a `"Salesforce connected"` pill, `$0 compute` banners, and numeric `Jump to state: [1] [2] [3] [4] [5]` buttons across `components/workbench/TopNavBar.tsx`, `components/workbench/StepperBar.tsx`, and `components/workbench/Banners.tsx`. Furthermore, `components/workbench/MeddpiccScorecard.tsx` hides verbatim evidence quotes and gaps behind collapsible accordions instead of following the radical-monochrome B2B specification in `DESIGN.md`.

## Goals

1. **Top Navigation Bar & Settings Popover (`CEO-2`, `CEO-5`, `DESIGN-5`, `ENG-7`):**
   - Lift `<TopNavBar />`, `scenarioId`, `selectedModel`, and `settingsOpen` into `QualificationWorkbench.tsx` so the navigation bar remains mounted in both Simulation and Live AI modes.
   - Remove `"Salesforce connected"` badge (`TopNavBar.tsx:56-59`), raw internal enum status badge (`TopNavBar.tsx:63-76`), and top-level Simulation/Live pill switcher (`TopNavBar.tsx:122-144`).
   - Implement an accessible modal popover (`role="dialog"`, `aria-label="Workbench settings"`) with keyboard Escape and click-outside dismissal, focus trapping/return, a monochrome `SIM`/`LIVE` mode toggle, Model selector, Scenario selector, and Reset button.
2. **Sequential Stepper & Step-Back Flow (`DESIGN-3`, `DESIGN-6`, `CEO-6`, `ENG-5`, `ENG-6`, `Selective Expansion 1`):**
   - Remove `{step.state}` enum subtitles and arbitrary click handlers from `StepperBar.tsx:35-59` to strictly enforce sequential step progression.
   - Add `"← Previous step"` secondary button in `ActionPanel.tsx` that is disabled at `READY_TO_ASSESS`, hidden in Live AI Mode, and preserves filled discovery inputs.
   - Guard 1200ms transition timer with `useRef` in `QualificationWorkbench.tsx` and cancel it on `STEP_BACK`, `RESET`, or unmount.
   - Compute delta scores on transition to `COMPLETED` and clear on `STEP_BACK`.
3. **Dynamic Discovery Form 5-Type Completeness & Score Chips (`CEO-7`, `ENG-8`, `Selective Expansion 2`):**
   - Add `textarea` and `checkbox_group` rendering branches to `components/workbench/DynamicDiscoveryForm.tsx:133-209`.
   - Render target dimension's compact 10-segment score bar + score chip formatted as `"{targetDim.label}: {targetDim.score}/10"` next to each question.
4. **Permanent 8-Row MEDDPICC Ledger (`CEO-2`, `DESIGN-7`, `ENG-9`):**
   - Remove accordion expansion state (`expandedDimensions` at `MeddpiccScorecard.tsx:35-40`).
   - Permanently render all 8 MEDDPICC rows open showing unassessed state (`0/10` with `"— Awaiting initial assessment"` note), 10-segment color-quarantined bar, and monospace parenthetical deltas (`8/10 (+6)`).
   - Keep `<MeddpiccScorecard />` mounted below `<DynamicDiscoveryForm />` during `PENDING_FEEDBACK`.
   - Preserve `baselineJevResult` on `AssessmentView` for live delta computation.
5. **Normative Token & Font Stack Alignment (`DESIGN-1`, `DESIGN-2`, `DESIGN-4`):**
   - Align canvas to `#F8F8F6`, cards to `#FFFFFF`, recessed wells to `#F1F0EC`, hairline borders to `#E2E0D8`, primary interactive CTA to `#0F52BA`, and status ticks to `#DC2626` (0-3), `#D97706` (4-7), and `#059669` (8-10) with `#E5E5E0` unfilled ticks across `app/globals.css`, `app/layout.tsx`, and all workbench components.
   - Remove `<html className="dark">` in `app/layout.tsx`; load `General Sans`, `Instrument Sans`, and `JetBrains Mono`.
   - Replace high-saturation badges with monochrome pills (`#F1F0EC` background, `#2B2B28` text, `#E2E0D8` border); eliminate yellow `$0 compute` banners.

## Acceptance Criteria

1. `TopNavBar.tsx` renders zero raw enum strings (`READY_TO_ASSESS`, `PENDING_FEEDBACK`), zero `"Salesforce connected"` pills, and houses Execution Mode, System 2 Model selector, Scenario selector, and Reset inside the Settings popover.
2. `StepperBar.tsx` no longer renders `Jump to state (1–5)` numeric buttons; Simulation Mode supports sequential forward progression and stepping back to the previous stage.
3. `MeddpiccScorecard.tsx` renders all 8 MEDDPICC rows permanently open (zero accordion expand/collapse toggles) with 10-segment color-quarantined bars and parenthetical deltas (`(+N)`).
4. `DynamicDiscoveryForm.tsx` supports all 5 field types and formats score chips as `"{label}: {score}/10"`.
5. `Banners.tsx` has zero yellow `$0 compute` banners; surface tokens match `DESIGN.md`.
6. `npm test` and `npm run build` pass with exit code 0.

## Testing Plan

| Layer | What | Count | Test Card |
|---|---|---|---|
| **Component / Integration** | `tests/workbench-shell.test.tsx` (retargeted to `LiveQualificationWorkbench`) — Mounting, settings, live assessment flow | +4 | `protects=live workbench integration and controlled top nav state; fails_when=live workbench fails to mount or desynchronizes from top nav; no_claim=live network socket streaming` |
| **Component** | `tests/dynamic-form-renderer.test.tsx` (retargeted to `DynamicDiscoveryForm`) — 5 field types, score chips, input changes | +5 | `protects=all 5 dynamic field types and score chip formatting; fails_when=renderer throws on textarea/checkbox_group or misformats chip; no_claim=visual styling pixel accuracy` |
| **Integration** | `tests/simulation-engine.test.ts` — Sequential state progression, step-back navigation (`COMPLETED` -> `PENDING_FEEDBACK` -> `READY_TO_ASSESS`), delta computation, and timer safety | +3 | `protects=deterministic simulation state transitions including step-back and timer cleanup; fails_when=stepping back corrupts scores or leaves ghost timers; no_claim=browser DOM rendering` |

## Rollback Plan

`git revert <commit-sha>` cleanly restores previous workbench UI components without affecting database or backend logic.
