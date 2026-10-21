<!-- /autoplan restore point: "/Users/brandonwarwick/.gemini/antigravity/worktrees/vercel-sam-demo/gstack_code_review/.gstack/tmp/autoplan/gstack-review-autoplan-restore-20261021-202718.md" -->
## Implementation plan
# 24: Deal Desk OS Split-Workbench Layout & Operational State Integration

**Status:** open  
**Type:** task  
**Blocked by:** 23  
**Parent Epic:** [GitHub Issue #6](https://github.com/BrandonCW/vercel-sam-demo/issues/6)

## Context
During the design phase, the **Deal Desk OS** layout (`design-system-preview.html` and `DESIGN.md` lines 80–146) established a high-density, monochrome 35%/65% split workbench with a seamless 3-stage operational flow:
1. `(1) Initial Deal Audit (Gaps Identified)`
2. `(2) Field Discovery Checklist (In-Context)`
3. `(3) Updated Assessment & Next Steps (Qualified)`

While Issues 21–23 introduced simulation mode, the Settings popover, and the 8-row MEDDPICC table, the React UI (`LiveQualificationWorkbench.tsx` and `QualificationWorkbench.tsx`) still uses an inverted `75% / 360px` multi-card layout with a 5-step engine stepper (`Baseline -> Analyzing -> Discovery -> Re-scoring -> Completed`). This fragments the user's attention across multiple stacked cards and sidebars instead of preserving the single-pane `(1) -> (2) -> (3)` dimension continuity in the 65% right workspace.

## Current State
- `components/workbench/LiveQualificationWorkbench.tsx:449-489` and `components/workbench/QualificationWorkbench.tsx:208-250` render a loose 2-column grid (`xl:grid-cols-[minmax(0,1fr)_360px]`) stacking `DealContextCard`, `DynamicDiscoveryForm`, and `MeddpiccScorecard` vertically on the left and `StageGateCard`, `DealSummaryCard`, and `ActionPanel` in a `360px` right sidebar.
- `components/workbench/StepperBar.tsx:10-45` renders 5 internal engine states (`Baseline`, `Analyzing`, `Discovery`, `Re-scoring`, `Completed`) rather than the 3 user-facing Desk OS stages.
- `components/workbench/DynamicDiscoveryForm.tsx:354-370` displays only a text badge (`"{label}: {score}/10"`) on question cards rather than embedding the target dimension's 10-segment `.tick-bar` (`design-system-preview.html:1203-1210`).
- `components/workbench/StageGateCard.tsx` and `components/workbench/DealSummaryCard.tsx` separate the composite score, Stage Gate pill, and Suggested Next Steps from the scorecard header and Stage 3 layout (`design-system-preview.html:985-996`, `1278-1314`).

## Desired Behavior
1. **Unified Desk OS Shell & Persistent 35% Left Pane**:
   - Wrap the workbench in a single `.workbench-shell` container (`max-w-[1440px]`, `1px solid #E2E0D8`, `rounded-lg`, `overflow-hidden`) with an in-shell monochrome deal header bar and a `grid-cols-[35%_65%]` split on desktop (`components/workbench/DealContextCard.tsx` refactored as the persistent 35% Opportunity Brief column with 2x2 metadata box, competitor threat callout, and AE/SA structured briefs).
   - Retain the accessible Settings gear popover, Scenario selector, and Simulation/Live mode indicator cleanly in `TopNavBar.tsx`.
2. **3-Stage Process Stepper (`StepperBar.tsx`)**:
   - Render the 3-stage Desk OS stepper above the workbench shell:
     - `1` `Initial Deal Audit (Gaps Identified)`
     - `2` `Field Discovery Checklist (In-Context)`
     - `3` `Updated Assessment & Next Steps (Qualified)`
   - Allow users to click between unlocked stages (e.g., inspecting Stage 1 while in Stage 2 or Stage 3) without losing discovery form inputs (`savedFormData`) or manual SA notes (`savedManualNotes` via `initialNotes`).
3. **65% Right Pane — Seamless Stage & Loading Progression**:
   - **Blank Start State (Pre-Audit)**: When a deal is first loaded (`READY_TO_ASSESS` prior to audit), display `-- / 100` with pill `Stage Gate 2 · Unassessed Opportunity`, primary CTA `Run MEDDPICC Deal Audit →` (`#0F52BA`), and the 8-row MEDDPICC ledger in an unscored baseline state (`--/10` and empty 10-segment bars).
   - **Initial Assessment Loading (`ANALYZING`)**: In-place loading state inside the 65% right pane with live status header, elapsed timer, and subtle row shimmer over the 8 MEDDPICC rows (plus abort button in Live mode).
   - **Stage (1) Initial Deal Audit**: Renders `.stage-header-row` with dynamic composite score (`{score} / 100`, e.g., `54 / 100` in the Acme simulation fixture or live score in Live mode), Stage Gate blocker pill (`Stage Gate 2 · {N} Gaps Identified (Score < 75)`), and primary CTA `Answer {N} Discovery Questions →`, followed by the 8-row MEDDPICC table ledger with `#F1F0EC` recessed blocker rows and bottom summary CTA bar.
   - **Stage (2) Field Discovery Checklist**: Renders inside the 65% right pane (replacing the scorecard view while keeping `← Back to Audit` in the header). Each question card header embeds the target dimension's live 10-segment `TenSegmentBar` (`{Dimension} (Currently {score}/10)`). Bottom action bar provides `Cancel` (returns to Stage 1) and `Submit Findings & Re-Score Deal →`.
   - **Re-Scoring Loading (`EVALUATING`)**: In-place transition state inside the 65% right pane (`Synthesizing Discovery Findings & Re-Scoring Deal...`) before unveiling Stage 3.
   - **Stage (3) Updated Assessment & Next Steps**: Renders `.stage-header-row` with dynamic score progression (`{previousScore} → {score} / 100 (+{delta})`, e.g., `54 → 76 / 100 (+22)` in the Acme simulation fixture, falling back to `{score} / 100` if resumed directly into `COMPLETED` without an in-memory baseline), cleared Stage Gate pill, and `↺ Restart Walkthrough` button; places the **Suggested Next Steps Action Block** (with 1-click `Copy Next Steps` / `✓ Copied to Clipboard` toggle) directly above the upgraded 8-row MEDDPICC ledger (`Resolved Status` column + inline `prev → curr / 10 (+Δ)` score deltas and staggered `40ms` `TenSegmentBar` transitions).

## Scope
- **In Scope**:
  - Refactoring `components/workbench/LiveQualificationWorkbench.tsx` and `components/workbench/QualificationWorkbench.tsx` into the Desk OS 35%/65% split layout.
  - Refactoring `components/workbench/StepperBar.tsx` to the 3-stage Desk OS layout.
  - Updating `components/workbench/DealContextCard.tsx` for the persistent 35% left brief.
  - Embedding `TenSegmentBar` in `components/workbench/DynamicDiscoveryForm.tsx` question cards.
  - Integrating Blank Start, Initial Assessment Loading, Re-Scoring Loading, and Settings Popover into the Desk OS structure, while preserving both discovery form answers (`savedFormData`) and manual SA notes (`savedManualNotes` / `initialNotes`) across stage transitions.
  - Adding `40ms` staggered per-tick CSS transition delay (`transitionDelay: '${i * 40}ms'`) with `motion-reduce:transition-none` on `TenSegmentBar` ticks (`components/workbench/MeddpiccScorecard.tsx`).
  - Retiring and deleting superseded right-sidebar and banner components (`components/workbench/StageGateCard.tsx`, `components/workbench/DealSummaryCard.tsx`, `components/workbench/ActionPanel.tsx`, and `components/workbench/Banners.tsx`).
  - Updating unit and component tests in `tests/` (`tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`).
- **Out of Scope**:
  - Changes to backend API routes, Postgres schema, or Eve YAML agent definitions.
  - Global keyboard shortcut navigation (`1`/`2`/`3` stage hotkeys), to avoid input capture conflicts with active form controls and custom select comboboxes.

## Technical Details
| Component / File | Change Summary |
| :--- | :--- |
| `components/workbench/StepperBar.tsx` | Replace 5 engine steps with the 3 Desk OS stages (`1. Initial Deal Audit`, `2. Field Discovery Checklist`, `3. Updated Assessment & Next Steps`); support clicking unlocked stages and showing active loading indicators during `ANALYZING` / `EVALUATING`. |
| `components/workbench/DealContextCard.tsx` | Format as the persistent 35% left pane (`.workbench-left`): 2x2 Opportunity Metadata grid, Competitor Context callout, and scrollable AE Business Brief + SA Technical Assessment sections. |
| `components/workbench/MeddpiccScorecard.tsx` | Export `TenSegmentBar` for reuse in Stage 2; add `40ms` per-tick staggered `transitionDelay` (`${i * 40}ms`) with `motion-reduce:transition-none`; support `unassessed` baseline mode (Blank Start), `loading` shimmer mode, Stage 1 `Open Gap / Blind Spot` mode, and Stage 3 `Resolved Status` + inline transition (`prev → curr / 10 (+Δ)`) mode. |
| `components/workbench/DynamicDiscoveryForm.tsx` | Render Desk OS Stage 2 header (`Field Discovery Checklist` + `← Back to Audit` button), embed `TenSegmentBar` in each `.q-card-header`, accept `initialNotes?: string` and `onDraftChange?: (answers, manualNotes) => void` so manual SA notes persist alongside form answers across stage switches, and render bottom `Cancel` + `Submit Findings & Re-Score Deal →` action bar. |
| `components/workbench/LiveQualificationWorkbench.tsx` & `QualificationWorkbench.tsx` | Implement `.workbench-shell` + `.workbench-split` (`35% / 65%`), manage `activeStageView` (`'blank' | 'stage1' | 'stage2' | 'stage3'`) synchronized with `WorkflowState`, preserve `savedFormData` + `savedManualNotes` across stage switches, inline dynamic Stage 1 (`{score} / 100`) and Stage 3 (`{previousScore} → {score} / 100 (+{delta})` with `{score} / 100` fallback) header lockups and Stage 3 Suggested Next Steps card, and delete superseded `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx`. |

## Acceptance Criteria
- [ ] Workbench renders a unified `.workbench-shell` with a persistent 35% Opportunity Brief left column and a 65% dynamic stage canvas right column on desktop viewports.
- [ ] Top stepper displays the 3 Desk OS stages (`(1) Initial Deal Audit`, `(2) Field Discovery Checklist`, `(3) Updated Assessment & Next Steps`) and allows navigating between unlocked stages without losing discovery form answers (`savedFormData`) or manual SA notes (`savedManualNotes` via `initialNotes`).
- [ ] Selecting an unassessed deal starts in the **Blank Start** state (`-- / 100`, unscored 8-row MEDDPICC table, `Run MEDDPICC Deal Audit →` CTA) and transitions through an in-place **Assessment Loading** state into Stage `(1)`.
- [ ] Stage `(1)` displays the dynamic composite score header (`{score} / 100`, e.g., `54 / 100` in the Acme simulation fixture), Stage Gate blocker pill, `Answer {N} Discovery Questions →` CTA, and the permanently open 8-row MEDDPICC ledger with recessed `#F1F0EC` blocker rows.
- [ ] Stage `(2)` renders in the 65% right pane with `← Back to Audit`, embeds the live 10-segment `TenSegmentBar` inside each discovery question card header, and transitions through an in-place **Re-Scoring Loading** state into Stage `(3)` upon submit.
- [ ] Stage `(3)` displays the dynamic score progression lockup (`{previousScore} → {score} / 100 (+{delta})`, e.g., `54 → 76 / 100 (+22)` in the Acme simulation fixture, or `{score} / 100` fallback when resumed directly into `COMPLETED`), the **Suggested Next Steps** card with working `Copy Next Steps` button above the scorecard, the upgraded 8-row MEDDPICC ledger with `Resolved Status`, inline dimension score transitions (`prev → curr / 10 (+Δ)`), and `40ms` staggered `TenSegmentBar` transitions, while superseded components (`StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, `Banners.tsx`) are removed.
- [ ] `TopNavBar` Settings popover, Scenario selector, and Simulation/Live mode switching continue to function with full accessibility (`role="dialog"`, Escape/outside-click dismissal).
- [ ] All unit tests (`npm test`) and production build (`npm run build`) pass with zero errors.

## Test Plan
| Test Card | Target | Protects | Fails When | No Claim |
| :--- | :--- | :--- | :--- | :--- |
| **TC-1: Desk OS 3-Stage Stepper & Blank Start** | `tests/workbench-shell.test.tsx` & `tests/qualification-workbench.test.tsx` | Verifies Blank Start (`-- / 100`) $\rightarrow$ Loading $\rightarrow$ Stage 1 (`{score} / 100`, e.g., `54 / 100` in Acme fixture) $\rightarrow$ Stage 2 (`Field Discovery Checklist`) $\rightarrow$ Stage 3 (`{previousScore} → {score} / 100 (+{delta})`, e.g., `54 → 76 / 100 (+22)` in Acme fixture, plus `{score} / 100` fallback when resumed directly into `COMPLETED`) progression and non-destructive `← Back to Audit` / `Cancel` navigation preserving both `savedFormData` and `savedManualNotes` (`initialNotes`). | Any stage fails to render in the 65% right pane, or form answers / manual SA notes reset when toggling back to Stage 1. | Live LLM latency under network load. |
| **TC-2: Embedded 10-Segment Bars in Discovery Cards** | `tests/dynamic-form-renderer.test.tsx` | Verifies each discovery question card header renders the target dimension label, current score, and 10-segment `TenSegmentBar` (with `40ms` staggered `transitionDelay` and `motion-reduce:transition-none`), and restores `initialNotes`. | Question cards omit the 10-segment bar, render raw dimension keys, or drop `initialNotes`. | Browser CSS pixel rendering. |
| **TC-3: Stage 3 Next Steps & Upgraded Ledger** | `tests/workbench-shell.test.tsx` & `tests/qualification-workbench.test.tsx` | Verifies Suggested Next Steps card renders above the scorecard in Stage 3 with working `Copy Next Steps` clipboard action, inline `prev → curr / 10 (+Δ)` dimension transitions, and removal of superseded `StageGateCard`, `DealSummaryCard`, `ActionPanel`, and `Banners`. | Next Steps card is missing, below the table, missing clipboard feedback, or dead sidebar imports remain. | Native OS clipboard permissions outside browser API. |

<!-- autoplan-accepted:ceo -->
- Consolidate the `.workbench-shell` container (`max-w-[1440px]`, `1px solid #E2E0D8`, `rounded-lg`, `overflow-hidden` for border-radius clipping with natural vertical document height), `.monochrome-top-bar` (`DEAL DESK`, opportunity name, monochrome Stage pill, monochrome `$ACV` pill), and `.workbench-split` (`grid-cols-1 lg:grid-cols-[35%_65%]`) across both `components/workbench/QualificationWorkbench.tsx` (Simulation mode) and `components/workbench/LiveQualificationWorkbench.tsx` (Live mode) via shared Desk OS shell header/action primitives, verified by `tests/qualification-workbench.test.tsx` and `tests/workbench-shell.test.tsx`.
- Support non-destructive stage switching (`activeStageView: 'blank' | 'stage1' | 'stage2' | 'stage3'`) synchronized with `WorkflowState` transitions while preserving `savedFormData`, `savedManualNotes` (`initialNotes` prop on `DynamicDiscoveryForm`), and a separate `baselineAssessment` snapshot so clicking Stage 1 from Stage 3 always renders the true Stage 1 Initial Audit snapshot (and locks Stage 1/2 retrospective tabs if a deal is resumed directly into `COMPLETED` with no baseline/questions in memory), verified by unit tests in `tests/qualification-workbench.test.tsx` and `tests/workbench-shell.test.tsx`.
- Render dynamic composite score lockups in Stage 1 (`{score} / 100`, e.g. `54 / 100` in Acme simulation or live score in Live mode, plus conditional Stage Gate blocker pill for `score < 75` vs `score >= 75` and `Answer {N} Discovery Questions →` CTA) and Stage 3 (`{previousScore} → {score} / 100 (+{delta})` when `previousScore` and `delta` are present, or `{score} / 100` when resumed directly into `COMPLETED` without a prior baseline in memory, plus cleared Stage Gate pill and `↺ Restart Walkthrough` button), verified by `tests/qualification-workbench.test.tsx` and `tests/workbench-shell.test.tsx`.
- Preserve inline Live-mode error recovery (`role="alert"` banner with retry/dismiss controls) and `Abort` controls during both `ANALYZING` and `EVALUATING` inside the 65% `.workbench-right` pane before retiring and deleting superseded right-sidebar and banner components (`components/workbench/StageGateCard.tsx`, `components/workbench/DealSummaryCard.tsx`, `components/workbench/ActionPanel.tsx`, `components/workbench/Banners.tsx`), verified by `npm test` and `npm run build`.
- Add CSS staggered `40ms` per-tick transition delay (`transitionDelay: '${i * 40}ms'`) on `TenSegmentBar` ticks (`components/workbench/MeddpiccScorecard.tsx`) with `motion-reduce:transition-none` for `DESIGN.md` alignment, and correct test file path references from `tests/unit/` to `tests/` (`tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`).
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- Differentiate Stage 1 top vs. bottom action surfaces (`design-system-preview.html:985-1065`): `.stage-header-row` holds the primary `#0F52BA` filled CTA (`Answer {N} Discovery Questions →`, or `View Final Assessment →` when `questions.length === 0`), while the bottom summary footer strip (`#FAFAF7`, `border-t border-[#E2E0D8]`) renders muted gap count summary text on the left and a secondary outline/subtle action button (`Proceed to Stage 2: Field Discovery →`) on the right.
- Render `EVALUATING` ("Re-Scoring Loading") in-place on the 8-row `MeddpiccScorecard` ledger in `loading` shimmer mode (with status header `"Synthesizing Discovery Findings & Re-Scoring Deal..."`, elapsed timer, and Live-mode `Abort` button) so the Stage 3 `40ms` staggered `TenSegmentBar` reveal lands directly on the same table rows; if `EVALUATING` errors or is aborted, return `activeStageView` to `'stage2'` with `savedFormData` and `savedManualNotes` intact and display the inline `role="alert"` banner at the top of `.workbench-right`.
- Handle conditional Stage 3 qualification outcomes and retrospective navigation cleanly: render the emerald cleared Stage Gate pill when `score >= 75` and an amber `Stage Gate 2 · {N} Gaps Remaining (Score < 75)` warning pill when `score < 75` post-discovery; when inspecting Stage 1 or Stage 2 retrospectively from `COMPLETED` (Stage 3), display a `Return to Updated Assessment (Stage 3) →` header action; and make `↺ Restart Walkthrough` reset the workbench to the **Blank Start** state (`READY_TO_ASSESS`, `activeStageView: 'blank'`, clearing `baselineAssessment`, `savedFormData`, and `savedManualNotes`).
- Specify exact Stage 2 completion progress (`Answered {K} of {N}` inline counter in `DynamicDiscoveryForm.tsx`) and Stage 3 `Copy Next Steps` clipboard behavior (`navigator.clipboard.writeText(assessment.NextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'))`, toggling button label to `✓ Copied to Clipboard` in `#15803D` emerald for `2000ms` with unmount timer cleanup).
- Enforce responsive hierarchy and accessibility across `.workbench-left` and `StepperBar`: on `< lg` viewports, keep the 2x2 Opportunity Metadata grid and Competitor Threat callout visible at the top of `DealContextCard.tsx` and wrap the longer AE/SA narrative briefs in a collapsible `<details>` disclosure (with `lg:max-h-[680px] lg:overflow-y-auto` on desktop so long briefs never create dead vertical whitespace under the 8-row scorecard); add `aria-current="step"` on the active `StepperBar` stage button and `role="status"` / `aria-live="polite"` on loading and clipboard announcements.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->
- Define an explicit discriminated `mode?: 'unassessed' | 'loading' | 'audit' | 'completed'` prop on `MeddpiccScorecard.tsx` (defaulting cleanly from existing props for backward compatibility) and an explicit `TenSegmentBarProps` interface (`score: number | null`, `previousScore?: number | null`, `animateStagger?: boolean`, `ariaLabel?: string`) so `DynamicDiscoveryForm.tsx` renders static current score ticks (`animateStagger={false}`) without re-triggering the Stage 3 `40ms` staggered transition on form input re-renders.
- Standardize Stage 2 draft persistence props on `DynamicDiscoveryForm.tsx` (`initialValues?: Record<string, unknown>`, `initialNotes?: string`, and `onDraftChange?: (answers: Record<string, unknown>, manualNotes: string) => void`) and extract `STAGE_GATE_THRESHOLD = 75` as a named constant in the shared Desk OS shell header module so Stage 1 and Stage 3 qualification pills never rely on scattered magic numbers.
- Wrap `navigator.clipboard.writeText(...)` in Stage 3's `Copy Next Steps` handler in a `try / catch` block, normalize `assessment.NextSteps ?? []` (disabling/hiding the copy action when empty), and on clipboard rejection or missing `navigator.clipboard` display an inline recovery status (`Copy Failed — Select text below manually`, `role="status"`, resetting after `3000ms`) instead of throwing an unhandled rejection or showing a false positive `✓ Copied to Clipboard`.
- Enforce the **Problem + Cause + Fix** diagnostic contract on the inline `.workbench-right` `role="alert"` banner replacing `Banners.tsx`: render (1) a stage-specific problem heading (`Initial Deal Audit Failed` during `ANALYZING` or `Discovery Re-Scoring Failed` during `EVALUATING`), (2) the sanitized error cause, and (3) `Retry` (re-submitting `savedFormData` + `savedManualNotes` in Stage 2 without re-entry), `Dismiss`, and a recovery hint to switch to `Simulation Mode` in `TopNavBar` if Live backend credentials are unavailable.
- Keep Stage 2 discovery inputs and `Submit Findings & Re-Score Deal →` enabled when inspecting Stage 2 retrospectively from `COMPLETED` (`workflowState === 'COMPLETED'` and `activeStageView === 'stage2'`) so users and developers can iteratively refine discovery answers and re-score alongside the `Return to Updated Assessment (Stage 3) →` button; and update `CONTEXT.md` to reflect the 3-stage Desk OS workbench topology and retired sidebar/banner modules (`StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, `Banners.tsx`).
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- Update `simulationReducer` in `lib/simulation/simulation-engine.ts` (`SUBMIT_FEEDBACK`) to accept submissions from both `'PENDING_FEEDBACK'` and `'COMPLETED'` so iterative Stage 2 re-scoring works in Simulation Mode, while in `LiveQualificationWorkbench.tsx` compute `const dynamicForm = view.system2Result?.phase3Form ?? null` (ungated by `workflowState === 'PENDING_FEEDBACK'`) and render retrospective Stage 2 as `readOnly={true}` when the Live Eve session is already `closed` (`view.pendingInput === null`).
- Synchronize `activeStageView` (`'blank' | 'stage1' | 'stage2' | 'stage3'`) with `workflowState` using a `prevWorkflowStateRef` transition guard so entering `PENDING_FEEDBACK` from `ANALYZING` (or initial mount in `PENDING_FEEDBACK`) lands on `'stage1'`, clicking `Answer {N} Discovery Questions →` / `Proceed to Stage 2: Field Discovery →` / Stepper Stage 2 transitions to `'stage2'` without snapping back on re-renders, and when `phase === 'assessing'` with `view.jevResult` present (`view.system2Running === true`) `LiveQualificationWorkbench` displays the arrived Jev scores alongside the `System 2 analysis running…` status indicator (`role="status"`).
- Normalize `suggestedNextSteps` / `nextSteps` across Simulation and Live modes via a `formatNextSteps(val: string | string[] | null | undefined)` helper (handling both pipe/newline-delimited `string` values from `lib/types/crm.ts` / `acme_migration.json` and `string[]` arrays without calling `.map()` on a string), and preserve `baselineJevResult` when `round === 'baseline'` in `lib/assessment-results.ts` / `LiveQualificationWorkbench.tsx` so `formatDimensionsForScorecard()` populates per-dimension `previousScore` and `delta` in Live Mode Stage 3 even across session resumes.
- Distinguish transient Live `sendError` (where `view.pendingInput` is still open and `Retry` re-invokes `handleSubmitFeedback(savedFormData, savedManualNotes)`) from terminal stream failure/abort (`view.phase === 'failed'` or `view.pendingInput === null`, where cached `baselineAssessment`, `dynamicForm`, `savedFormData`, and `savedManualNotes` are retained in component state and the alert banner offers `Start Assessment` / `Re-run Assessment` and `Simulation Mode` switch); cap rendered error cause strings at 300 characters (`break-words`) as plain React text nodes and preserve existing `tests/workbench-shell.test.tsx` alert prefixes (`Writeback failed:`, `Assessment failed:`, `Could not resume`).
- Invoke `onDraftChange?.(nextFormData, nextManualNotes)` directly inside `DynamicDiscoveryForm.tsx` input event handlers (`handleTextChange`, `handleCheckboxToggle`, and manual notes `onChange`) rather than inside a `useEffect`, compute `Answered {K} of {N}` by counting fields with non-empty trimmed strings or non-empty arrays, and scope `TenSegmentBar` inline `transitionDelay: '${i * 40}ms'` strictly to `animateStagger={true}` (`mode === 'completed'`) with `motion-reduce:transition-none motion-reduce:!delay-0`.
<!-- /autoplan-accepted:eng -->
## Review record

<!-- autoplan-baseline-edits:ceo {"sourceSha256":"fdb9ace59fa8cdb4f7550ac253a5b663304c646e936fed5cec3cf7c4158945da","replacements":[{"oldText":"- Allow users to click between unlocked stages (e.g., inspecting Stage 1 while in Stage 2 or Stage 3) without losing discovery form inputs.","newText":"- Allow users to click between unlocked stages (e.g., inspecting Stage 1 while in Stage 2 or Stage 3) without losing discovery form inputs (`savedFormData`) or manual SA notes (`savedManualNotes` via `initialNotes`)."},{"oldText":"- **Stage (1) Initial Deal Audit**: Renders `.stage-header-row` with composite score (`58 / 100`), Stage Gate blocker pill (`Stage Gate 2 · 3 Gaps Identified (Score < 75)`), and primary CTA `Answer N Discovery Questions →`, followed by the 8-row MEDDPICC table ledger with `#F1F0EC` recessed blocker rows and bottom summary CTA bar.","newText":"- **Stage (1) Initial Deal Audit**: Renders `.stage-header-row` with dynamic composite score (`{score} / 100`, e.g., `54 / 100` in the Acme simulation fixture or live score in Live mode), Stage Gate blocker pill (`Stage Gate 2 · {N} Gaps Identified (Score < 75)`), and primary CTA `Answer {N} Discovery Questions →`, followed by the 8-row MEDDPICC table ledger with `#F1F0EC` recessed blocker rows and bottom summary CTA bar."},{"oldText":"- **Stage (3) Updated Assessment & Next Steps**: Renders `.stage-header-row` with score progression (`58 → 82 / 100 (+24)`), cleared Stage Gate pill, and `↺ Restart Walkthrough` button; places the **Suggested Next Steps Action Block** (with 1-click `Copy Next Steps` / `✓ Copied to Clipboard` toggle) directly above the upgraded 8-row MEDDPICC ledger (`Resolved Status` column + inline `2 → 8 / 10 (+6)` score deltas).","newText":"- **Stage (3) Updated Assessment & Next Steps**: Renders `.stage-header-row` with dynamic score progression (`{previousScore} → {score} / 100 (+{delta})`, e.g., `54 → 76 / 100 (+22)` in the Acme simulation fixture, falling back to `{score} / 100` if resumed directly into `COMPLETED` without an in-memory baseline), cleared Stage Gate pill, and `↺ Restart Walkthrough` button; places the **Suggested Next Steps Action Block** (with 1-click `Copy Next Steps` / `✓ Copied to Clipboard` toggle) directly above the upgraded 8-row MEDDPICC ledger (`Resolved Status` column + inline `prev → curr / 10 (+Δ)` score deltas and staggered `40ms` `TenSegmentBar` transitions)."},{"oldText":"  - Integrating Blank Start, Initial Assessment Loading, Re-Scoring Loading, and Settings Popover into the Desk OS structure.\n  - Updating unit and component tests in `tests/unit/`.\n- **Out of Scope**:\n  - Changes to backend API routes, Postgres schema, or Eve YAML agent definitions.","newText":"  - Integrating Blank Start, Initial Assessment Loading, Re-Scoring Loading, and Settings Popover into the Desk OS structure, while preserving both discovery form answers (`savedFormData`) and manual SA notes (`savedManualNotes` / `initialNotes`) across stage transitions.\n  - Adding `40ms` staggered per-tick CSS transition delay (`transitionDelay: '${i * 40}ms'`) with `motion-reduce:transition-none` on `TenSegmentBar` ticks (`components/workbench/MeddpiccScorecard.tsx`).\n  - Retiring and deleting superseded right-sidebar and banner components (`components/workbench/StageGateCard.tsx`, `components/workbench/DealSummaryCard.tsx`, `components/workbench/ActionPanel.tsx`, and `components/workbench/Banners.tsx`).\n  - Updating unit and component tests in `tests/` (`tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`).\n- **Out of Scope**:\n  - Changes to backend API routes, Postgres schema, or Eve YAML agent definitions.\n  - Global keyboard shortcut navigation (`1`/`2`/`3` stage hotkeys), to avoid input capture conflicts with active form controls and custom select comboboxes."},{"oldText":"| `components/workbench/MeddpiccScorecard.tsx` | Export `TenSegmentBar` for reuse in Stage 2; support `unassessed` baseline mode (Blank Start), `loading` shimmer mode, Stage 1 `Open Gap / Blind Spot` mode, and Stage 3 `Resolved Status` + inline transition (`prev → curr / 10 (+Δ)`) mode. |\n| `components/workbench/DynamicDiscoveryForm.tsx` | Render Desk OS Stage 2 header (`Field Discovery Checklist` + `← Back to Audit` button), embed `TenSegmentBar` in each `.q-card-header`, include optional SA notes field, and render bottom `Cancel` + `Submit Findings & Re-Score Deal →` action bar. |\n| `components/workbench/LiveQualificationWorkbench.tsx` & `QualificationWorkbench.tsx` | Implement `.workbench-shell` + `.workbench-split` (`35% / 65%`), manage `activeStageView` (`'blank' | 'stage1' | 'stage2' | 'stage3'`) synchronized with `WorkflowState`, and inline the Stage 1/3 header lockups and Stage 3 Suggested Next Steps card (retiring the detached 360px right sidebar). |","newText":"| `components/workbench/MeddpiccScorecard.tsx` | Export `TenSegmentBar` for reuse in Stage 2; add `40ms` per-tick staggered `transitionDelay` (`${i * 40}ms`) with `motion-reduce:transition-none`; support `unassessed` baseline mode (Blank Start), `loading` shimmer mode, Stage 1 `Open Gap / Blind Spot` mode, and Stage 3 `Resolved Status` + inline transition (`prev → curr / 10 (+Δ)`) mode. |\n| `components/workbench/DynamicDiscoveryForm.tsx` | Render Desk OS Stage 2 header (`Field Discovery Checklist` + `← Back to Audit` button), embed `TenSegmentBar` in each `.q-card-header`, accept `initialNotes?: string` and `onDraftChange?: (answers, manualNotes) => void` so manual SA notes persist alongside form answers across stage switches, and render bottom `Cancel` + `Submit Findings & Re-Score Deal →` action bar. |\n| `components/workbench/LiveQualificationWorkbench.tsx` & `QualificationWorkbench.tsx` | Implement `.workbench-shell` + `.workbench-split` (`35% / 65%`), manage `activeStageView` (`'blank' | 'stage1' | 'stage2' | 'stage3'`) synchronized with `WorkflowState`, preserve `savedFormData` + `savedManualNotes` across stage switches, inline dynamic Stage 1 (`{score} / 100`) and Stage 3 (`{previousScore} → {score} / 100 (+{delta})` with `{score} / 100` fallback) header lockups and Stage 3 Suggested Next Steps card, and delete superseded `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx`. |"},{"oldText":"- [ ] Top stepper displays the 3 Desk OS stages (`(1) Initial Deal Audit`, `(2) Field Discovery Checklist`, `(3) Updated Assessment & Next Steps`) and allows navigating between unlocked stages without losing discovery form state.","newText":"- [ ] Top stepper displays the 3 Desk OS stages (`(1) Initial Deal Audit`, `(2) Field Discovery Checklist`, `(3) Updated Assessment & Next Steps`) and allows navigating between unlocked stages without losing discovery form answers (`savedFormData`) or manual SA notes (`savedManualNotes` via `initialNotes`)."},{"oldText":"- [ ] Stage `(1)` displays the composite score header (`58 / 100`), Stage Gate blocker pill, `Answer N Discovery Questions →` CTA, and the permanently open 8-row MEDDPICC ledger with recessed `#F1F0EC` blocker rows.","newText":"- [ ] Stage `(1)` displays the dynamic composite score header (`{score} / 100`, e.g., `54 / 100` in the Acme simulation fixture), Stage Gate blocker pill, `Answer {N} Discovery Questions →` CTA, and the permanently open 8-row MEDDPICC ledger with recessed `#F1F0EC` blocker rows."},{"oldText":"- [ ] Stage `(3)` displays the score progression lockup (`58 → 82 / 100 (+24)`), the **Suggested Next Steps** card with working `Copy Next Steps` button above the scorecard, and the upgraded 8-row MEDDPICC ledger with `Resolved Status` and inline dimension score transitions (`2 → 8 / 10 (+6)`).","newText":"- [ ] Stage `(3)` displays the dynamic score progression lockup (`{previousScore} → {score} / 100 (+{delta})`, e.g., `54 → 76 / 100 (+22)` in the Acme simulation fixture, or `{score} / 100` fallback when resumed directly into `COMPLETED`), the **Suggested Next Steps** card with working `Copy Next Steps` button above the scorecard, the upgraded 8-row MEDDPICC ledger with `Resolved Status`, inline dimension score transitions (`prev → curr / 10 (+Δ)`), and `40ms` staggered `TenSegmentBar` transitions, while superseded components (`StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, `Banners.tsx`) are removed."},{"oldText":"| **TC-1: Desk OS 3-Stage Stepper & Blank Start** | `tests/unit/workbench-shell.test.tsx` | Verifies Blank Start (`-- / 100`) $\\rightarrow$ Loading $\\rightarrow$ Stage 1 (`58 / 100`) $\\rightarrow$ Stage 2 (`Field Discovery Checklist`) $\\rightarrow$ Stage 3 (`58 → 82 / 100 (+24)`) progression and non-destructive `← Back to Audit` navigation. | Any stage fails to render in the 65% right pane or form values reset when toggling back to Stage 1. | Live LLM latency under network load. |\n| **TC-2: Embedded 10-Segment Bars in Discovery Cards** | `tests/unit/dynamic-form-renderer.test.tsx` | Verifies each discovery question card header renders the target dimension label, current score, and 10-segment `TenSegmentBar`. | Question cards omit the 10-segment bar or render raw dimension keys. | Browser CSS pixel rendering. |\n| **TC-3: Stage 3 Next Steps & Upgraded Ledger** | `tests/unit/workbench-shell.test.tsx` | Verifies Suggested Next Steps card renders above the scorecard in Stage 3 with working `Copy Next Steps` clipboard action and inline `prev → curr / 10 (+Δ)` dimension transitions. | Next Steps card is missing, below the table, or missing clipboard feedback. | Native OS clipboard permissions outside browser API. |","newText":"| **TC-1: Desk OS 3-Stage Stepper & Blank Start** | `tests/workbench-shell.test.tsx` & `tests/qualification-workbench.test.tsx` | Verifies Blank Start (`-- / 100`) $\\rightarrow$ Loading $\\rightarrow$ Stage 1 (`{score} / 100`, e.g., `54 / 100` in Acme fixture) $\\rightarrow$ Stage 2 (`Field Discovery Checklist`) $\\rightarrow$ Stage 3 (`{previousScore} → {score} / 100 (+{delta})`, e.g., `54 → 76 / 100 (+22)` in Acme fixture, plus `{score} / 100` fallback when resumed directly into `COMPLETED`) progression and non-destructive `← Back to Audit` / `Cancel` navigation preserving both `savedFormData` and `savedManualNotes` (`initialNotes`). | Any stage fails to render in the 65% right pane, or form answers / manual SA notes reset when toggling back to Stage 1. | Live LLM latency under network load. |\n| **TC-2: Embedded 10-Segment Bars in Discovery Cards** | `tests/dynamic-form-renderer.test.tsx` | Verifies each discovery question card header renders the target dimension label, current score, and 10-segment `TenSegmentBar` (with `40ms` staggered `transitionDelay` and `motion-reduce:transition-none`), and restores `initialNotes`. | Question cards omit the 10-segment bar, render raw dimension keys, or drop `initialNotes`. | Browser CSS pixel rendering. |\n| **TC-3: Stage 3 Next Steps & Upgraded Ledger** | `tests/workbench-shell.test.tsx` & `tests/qualification-workbench.test.tsx` | Verifies Suggested Next Steps card renders above the scorecard in Stage 3 with working `Copy Next Steps` clipboard action, inline `prev → curr / 10 (+Δ)` dimension transitions, and removal of superseded `StageGateCard`, `DealSummaryCard`, `ActionPanel`, and `Banners`. | Next Steps card is missing, below the table, missing clipboard feedback, or dead sidebar imports remain. | Native OS clipboard permissions outside browser API. |"}]} -->

<!-- autoplan-accepted:ceo -->
- Consolidate the `.workbench-shell` container (`max-w-[1440px]`, `1px solid #E2E0D8`, `rounded-lg`, `overflow-hidden` for border-radius clipping with natural vertical document height), `.monochrome-top-bar` (`DEAL DESK`, opportunity name, monochrome Stage pill, monochrome `$ACV` pill), and `.workbench-split` (`grid-cols-1 lg:grid-cols-[35%_65%]`) across both `components/workbench/QualificationWorkbench.tsx` (Simulation mode) and `components/workbench/LiveQualificationWorkbench.tsx` (Live mode) via shared Desk OS shell header/action primitives, verified by `tests/qualification-workbench.test.tsx` and `tests/workbench-shell.test.tsx`.
- Support non-destructive stage switching (`activeStageView: 'blank' | 'stage1' | 'stage2' | 'stage3'`) synchronized with `WorkflowState` transitions while preserving `savedFormData`, `savedManualNotes` (`initialNotes` prop on `DynamicDiscoveryForm`), and a separate `baselineAssessment` snapshot so clicking Stage 1 from Stage 3 always renders the true Stage 1 Initial Audit snapshot (and locks Stage 1/2 retrospective tabs if a deal is resumed directly into `COMPLETED` with no baseline/questions in memory), verified by unit tests in `tests/qualification-workbench.test.tsx` and `tests/workbench-shell.test.tsx`.
- Render dynamic composite score lockups in Stage 1 (`{score} / 100`, e.g. `54 / 100` in Acme simulation or live score in Live mode, plus conditional Stage Gate blocker pill for `score < 75` vs `score >= 75` and `Answer {N} Discovery Questions →` CTA) and Stage 3 (`{previousScore} → {score} / 100 (+{delta})` when `previousScore` and `delta` are present, or `{score} / 100` when resumed directly into `COMPLETED` without a prior baseline in memory, plus cleared Stage Gate pill and `↺ Restart Walkthrough` button), verified by `tests/qualification-workbench.test.tsx` and `tests/workbench-shell.test.tsx`.
- Preserve inline Live-mode error recovery (`role="alert"` banner with retry/dismiss controls) and `Abort` controls during both `ANALYZING` and `EVALUATING` inside the 65% `.workbench-right` pane before retiring and deleting superseded right-sidebar and banner components (`components/workbench/StageGateCard.tsx`, `components/workbench/DealSummaryCard.tsx`, `components/workbench/ActionPanel.tsx`, `components/workbench/Banners.tsx`), verified by `npm test` and `npm run build`.
- Add CSS staggered `40ms` per-tick transition delay (`transitionDelay: '${i * 40}ms'`) on `TenSegmentBar` ticks (`components/workbench/MeddpiccScorecard.tsx`) with `motion-reduce:transition-none` for `DESIGN.md` alignment, and correct test file path references from `tests/unit/` to `tests/` (`tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`).
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- Differentiate Stage 1 top vs. bottom action surfaces (`design-system-preview.html:985-1065`): `.stage-header-row` holds the primary `#0F52BA` filled CTA (`Answer {N} Discovery Questions →`, or `View Final Assessment →` when `questions.length === 0`), while the bottom summary footer strip (`#FAFAF7`, `border-t border-[#E2E0D8]`) renders muted gap count summary text on the left and a secondary outline/subtle action button (`Proceed to Stage 2: Field Discovery →`) on the right.
- Render `EVALUATING` ("Re-Scoring Loading") in-place on the 8-row `MeddpiccScorecard` ledger in `loading` shimmer mode (with status header `"Synthesizing Discovery Findings & Re-Scoring Deal..."`, elapsed timer, and Live-mode `Abort` button) so the Stage 3 `40ms` staggered `TenSegmentBar` reveal lands directly on the same table rows; if `EVALUATING` errors or is aborted, return `activeStageView` to `'stage2'` with `savedFormData` and `savedManualNotes` intact and display the inline `role="alert"` banner at the top of `.workbench-right`.
- Handle conditional Stage 3 qualification outcomes and retrospective navigation cleanly: render the emerald cleared Stage Gate pill when `score >= 75` and an amber `Stage Gate 2 · {N} Gaps Remaining (Score < 75)` warning pill when `score < 75` post-discovery; when inspecting Stage 1 or Stage 2 retrospectively from `COMPLETED` (Stage 3), display a `Return to Updated Assessment (Stage 3) →` header action; and make `↺ Restart Walkthrough` reset the workbench to the **Blank Start** state (`READY_TO_ASSESS`, `activeStageView: 'blank'`, clearing `baselineAssessment`, `savedFormData`, and `savedManualNotes`).
- Specify exact Stage 2 completion progress (`Answered {K} of {N}` inline counter in `DynamicDiscoveryForm.tsx`) and Stage 3 `Copy Next Steps` clipboard behavior (`navigator.clipboard.writeText(assessment.NextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'))`, toggling button label to `✓ Copied to Clipboard` in `#15803D` emerald for `2000ms` with unmount timer cleanup).
- Enforce responsive hierarchy and accessibility across `.workbench-left` and `StepperBar`: on `< lg` viewports, keep the 2x2 Opportunity Metadata grid and Competitor Threat callout visible at the top of `DealContextCard.tsx` and wrap the longer AE/SA narrative briefs in a collapsible `<details>` disclosure (with `lg:max-h-[680px] lg:overflow-y-auto` on desktop so long briefs never create dead vertical whitespace under the 8-row scorecard); add `aria-current="step"` on the active `StepperBar` stage button and `role="status"` / `aria-live="polite"` on loading and clipboard announcements.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->
- Define an explicit discriminated `mode?: 'unassessed' | 'loading' | 'audit' | 'completed'` prop on `MeddpiccScorecard.tsx` (defaulting cleanly from existing props for backward compatibility) and an explicit `TenSegmentBarProps` interface (`score: number | null`, `previousScore?: number | null`, `animateStagger?: boolean`, `ariaLabel?: string`) so `DynamicDiscoveryForm.tsx` renders static current score ticks (`animateStagger={false}`) without re-triggering the Stage 3 `40ms` staggered transition on form input re-renders.
- Standardize Stage 2 draft persistence props on `DynamicDiscoveryForm.tsx` (`initialValues?: Record<string, unknown>`, `initialNotes?: string`, and `onDraftChange?: (answers: Record<string, unknown>, manualNotes: string) => void`) and extract `STAGE_GATE_THRESHOLD = 75` as a named constant in the shared Desk OS shell header module so Stage 1 and Stage 3 qualification pills never rely on scattered magic numbers.
- Wrap `navigator.clipboard.writeText(...)` in Stage 3's `Copy Next Steps` handler in a `try / catch` block, normalize `assessment.NextSteps ?? []` (disabling/hiding the copy action when empty), and on clipboard rejection or missing `navigator.clipboard` display an inline recovery status (`Copy Failed — Select text below manually`, `role="status"`, resetting after `3000ms`) instead of throwing an unhandled rejection or showing a false positive `✓ Copied to Clipboard`.
- Enforce the **Problem + Cause + Fix** diagnostic contract on the inline `.workbench-right` `role="alert"` banner replacing `Banners.tsx`: render (1) a stage-specific problem heading (`Initial Deal Audit Failed` during `ANALYZING` or `Discovery Re-Scoring Failed` during `EVALUATING`), (2) the sanitized error cause, and (3) `Retry` (re-submitting `savedFormData` + `savedManualNotes` in Stage 2 without re-entry), `Dismiss`, and a recovery hint to switch to `Simulation Mode` in `TopNavBar` if Live backend credentials are unavailable.
- Keep Stage 2 discovery inputs and `Submit Findings & Re-Score Deal →` enabled when inspecting Stage 2 retrospectively from `COMPLETED` (`workflowState === 'COMPLETED'` and `activeStageView === 'stage2'`) so users and developers can iteratively refine discovery answers and re-score alongside the `Return to Updated Assessment (Stage 3) →` button; and update `CONTEXT.md` to reflect the 3-stage Desk OS workbench topology and retired sidebar/banner modules (`StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, `Banners.tsx`).
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- Update `simulationReducer` in `lib/simulation/simulation-engine.ts` (`SUBMIT_FEEDBACK`) to accept submissions from both `'PENDING_FEEDBACK'` and `'COMPLETED'` so iterative Stage 2 re-scoring works in Simulation Mode, while in `LiveQualificationWorkbench.tsx` compute `const dynamicForm = view.system2Result?.phase3Form ?? null` (ungated by `workflowState === 'PENDING_FEEDBACK'`) and render retrospective Stage 2 as `readOnly={true}` when the Live Eve session is already `closed` (`view.pendingInput === null`).
- Synchronize `activeStageView` (`'blank' | 'stage1' | 'stage2' | 'stage3'`) with `workflowState` using a `prevWorkflowStateRef` transition guard so entering `PENDING_FEEDBACK` from `ANALYZING` (or initial mount in `PENDING_FEEDBACK`) lands on `'stage1'`, clicking `Answer {N} Discovery Questions →` / `Proceed to Stage 2: Field Discovery →` / Stepper Stage 2 transitions to `'stage2'` without snapping back on re-renders, and when `phase === 'assessing'` with `view.jevResult` present (`view.system2Running === true`) `LiveQualificationWorkbench` displays the arrived Jev scores alongside the `System 2 analysis running…` status indicator (`role="status"`).
- Normalize `suggestedNextSteps` / `nextSteps` across Simulation and Live modes via a `formatNextSteps(val: string | string[] | null | undefined)` helper (handling both pipe/newline-delimited `string` values from `lib/types/crm.ts` / `acme_migration.json` and `string[]` arrays without calling `.map()` on a string), and preserve `baselineJevResult` when `round === 'baseline'` in `lib/assessment-results.ts` / `LiveQualificationWorkbench.tsx` so `formatDimensionsForScorecard()` populates per-dimension `previousScore` and `delta` in Live Mode Stage 3 even across session resumes.
- Distinguish transient Live `sendError` (where `view.pendingInput` is still open and `Retry` re-invokes `handleSubmitFeedback(savedFormData, savedManualNotes)`) from terminal stream failure/abort (`view.phase === 'failed'` or `view.pendingInput === null`, where cached `baselineAssessment`, `dynamicForm`, `savedFormData`, and `savedManualNotes` are retained in component state and the alert banner offers `Start Assessment` / `Re-run Assessment` and `Simulation Mode` switch); cap rendered error cause strings at 300 characters (`break-words`) as plain React text nodes and preserve existing `tests/workbench-shell.test.tsx` alert prefixes (`Writeback failed:`, `Assessment failed:`, `Could not resume`).
- Invoke `onDraftChange?.(nextFormData, nextManualNotes)` directly inside `DynamicDiscoveryForm.tsx` input event handlers (`handleTextChange`, `handleCheckboxToggle`, and manual notes `onChange`) rather than inside a `useEffect`, compute `Answered {K} of {N}` by counting fields with non-empty trimmed strings or non-empty arrays, and scope `TenSegmentBar` inline `transitionDelay: '${i * 40}ms'` strictly to `animateStagger={true}` (`mode === 'completed'`) with `motion-reduce:transition-none motion-reduce:!delay-0`.
<!-- /autoplan-accepted:eng -->

### Phase 1: CEO Review (Strategy & Scope)

#### Step 0A–0I: Premise Challenge, Existing Code Leverage, Mode Selection & Spec Review
- **0A. Premise Challenge & Reality Table**:
  | Premise | Claim | Receipt | Verdict |
  | :--- | :--- | :--- | :--- |
  | **P1: Split Layout Inversion** | Current workbenches use an inverted grid with a detached right sidebar instead of the Desk OS split (`DESIGN.md:80-146`). | `components/workbench/LiveQualificationWorkbench.tsx:449-489`, `components/workbench/QualificationWorkbench.tsx:208-250` | Verified |
  | **P2: Stepper Granularity** | `StepperBar` exposes five internal state-machine steps instead of three user-facing Desk OS stages. | `components/workbench/StepperBar.tsx:10-45` | Verified |
  | **P3: Discovery Card Context** | `DynamicDiscoveryForm` renders a plain text badge instead of embedding `TenSegmentBar`. | `components/workbench/DynamicDiscoveryForm.tsx:354-370` | Verified |
  | **P4: Score Fixture Ground Truth** | HTML prototype used illustrative numbers (`58 / 82`), whereas Acme simulation fixture uses `54` baseline and `76` re-scored (`+22`). | `lib/fixtures/simulation/acme_migration.json:12-185` | Verified (Fixed in plan) |
- **0B. Existing Code Leverage**:
  - `components/workbench/MeddpiccScorecard.tsx:10-95` already implements `TenSegmentBar` and the 8-row MEDDPICC table; exporting `TenSegmentBar` and adding `unassessed` + `loading` modes avoids duplicating table markup.
  - `components/workbench/TopNavBar.tsx:1-210` already implements the accessible Settings popover (`role="dialog"`), scenario selector, and mode badge.
- **0C. Dream State Mapping**:
  - Current State: Multi-card stacked left column + detached right sidebar (`StageGateCard`, `DealSummaryCard`, `ActionPanel`).
  - This Plan: Unified Desk OS `.workbench-shell` with persistent left Opportunity Brief (`DealContextCard`) and single-pane 3-stage right workspace with embedded `TenSegmentBar` and inline score progression.
  - 12-Month Ideal: Live bidirectional CRM sync, real-time transcript streaming into MEDDPICC evidence cells, and multi-deal portfolio triage desk.
- **0E. Mode Selection**: **SELECTIVE EXPANSION** (`gstack-ceo-mode-handoff "SELECTIVE EXPANSION" --decisions "none" --auto`).
- **0F–0H. Scope Proposals & Spec Review Loop**:
  - Proposed 5 scope items; accepted 4 (`#1` shared `.workbench-shell` across Simulation & Live, `#2` non-destructive stage switching preserving `savedFormData` + `savedManualNotes` + `baselineAssessment`, `#3` retiring superseded sidebar/banner components after inlining Live error/abort controls, `#4` staggered `TenSegmentBar` tick transition with `motion-reduce:transition-none`) and deferred 1 (`#5` global `1`/`2`/`3` stage hotkeys to `TODOS.md`).
  - Step 0H Spec Review Loop converged in 2 iterations (`7/10 FAIL` $\rightarrow$ `10/10 PASS`).

#### Sections 1–11 Evaluation
- **Section 1 (Architecture)**: Consolidated `.workbench-shell`, `.monochrome-top-bar`, and `.workbench-split` across `QualificationWorkbench.tsx` and `LiveQualificationWorkbench.tsx`. Addressed Independent CEO Finding 1.1/1.2 by sharing Desk OS shell header/action primitives and retaining `baselineAssessment` separately from `completedAssessment` so retrospective Stage 1 inspection from Stage 3 always displays the initial audit snapshot.
- **Section 2 (Error & Rescue Map)**: Addressed Independent CEO Finding 2.1 (Critical) by preserving inline Live-mode error recovery (`role="alert"`, retry/dismiss) and `Abort` controls during both `ANALYZING` and `EVALUATING` inside `.workbench-right` before deleting `Banners.tsx` and `ActionPanel.tsx`.
- **Section 3 (Security & Trust Boundaries)**: Examined client-side state transitions, clipboard write (`navigator.clipboard.writeText`), and form state handling. No new API endpoints, database queries, or untrusted HTML sinks (`dangerouslySetInnerHTML`) are introduced; React auto-escapes all fixture and live agent strings.
- **Section 4 (Data Flow & Edge Cases)**: Mapped 5 edge cases: (1) Blank Start (`READY_TO_ASSESS` with `-- / 100` and unscored 8-row table), (2) Stage 2 $\rightarrow$ Stage 1 back-navigation preserving both `savedFormData` and `savedManualNotes` (`initialNotes`), (3) Deal switch resetting `activeStageView`, `savedFormData`, `savedManualNotes`, and `baselineAssessment`, (4) Live-mode resume directly into `COMPLETED` without prior `baselineAssessment` in memory (gracefully renders `{score} / 100` and keeps Stage 1/2 tabs locked), and (5) Stage 1 initial score already meeting threshold (`score >= 75`) rendering a non-contradictory pill.
- **Section 5 (Code Quality & Maintainability)**: Eliminates 4 superseded components (`StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, `Banners.tsx`) and extracts shared Desk OS stage header/next-steps UI to prevent Simulation vs. Live drift.
- **Section 6 (Test Coverage)**: Corrected test target paths from `tests/unit/` to `tests/` (`tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`) and expanded `TC-1`–`TC-3` to cover `initialNotes`, `baselineAssessment` retrospective view, and dynamic fixture scores (`54` $\rightarrow$ `76`).
- **Section 7 (Performance)**: Examined re-render surface during Stage 2 form typing and CSS tick transitions; pure CSS `transitionDelay` on `TenSegmentBar` adds zero JS animation overhead.
- **Section 8 (Observability)**: Live-mode elapsed timer (`elapsedSeconds`), status text (`statusMessage`), and inline error banner provide clear operational visibility during `ANALYZING` and `EVALUATING`.
- **Section 9 (Deployment & Rollout)**: Pure frontend component refactor within Next.js App Router (`app/` and `components/workbench/`); zero database migrations or environment variable changes.
- **Section 10 (Future-Fit & Reversibility)**: Reversibility 5/5 (pure UI/state refactor isolated to `components/workbench/` and `tests/`).
- **Section 11 (Design & UX Preview)**: Verified full alignment with `DESIGN.md` ("Warm Paper & Ink", `#F7F6F2` canvas, `#FFFFFF` shell, `#F1F0EC` recessed blocker rows, `#0F52BA` cobalt CTA, tabular-nums score lockups, and staggered `TenSegmentBar` fill).

#### Reality Rows
REALITY: premise-table pass Every factual claim is verified against codebase files (`DESIGN.md:80-146`, `components/workbench/StepperBar.tsx:10-45`, `components/workbench/DynamicDiscoveryForm.tsx:354-370`). DESIGN.md:80-146
REALITY: already-done pass Checked `git log origin/mvp` (`7a00653`); the Desk OS split workbench and 3-stage stepper are not yet implemented. components/workbench/LiveQualificationWorkbench.tsx:449-489
REALITY: surface-check pass Verified `npm test` and `npm run build` in `package.json:5-12`; no new CLI flags or HTTP routes are introduced. package.json:5-12
REALITY: binding-decisions pass Checked `gstack-decision-search` and `DESIGN.md:1-146` ("Warm Paper & Ink", "35% / 65% split"); no overruled defaults reintroduced. DESIGN.md:1-146
REALITY: numbers pass Re-derived Acme baseline score 54 and re-scored total 76 from fixture data (`lib/fixtures/simulation/acme_migration.json:1-220`). lib/fixtures/simulation/acme_migration.json:1-220
REALITY: deferred-asks pass All Issue #24 requirements are kept in scope; optional global stage hotkeys are deferred to `TODOS.md` ("avoid input capture conflicts"). .scratch/deal-qualification/issues/24-desk-os-workbench-layout.md:50-52
REALITY: pr-count pass Single PR wave for Issue #24 (`pr_count=1`) with no multi-PR split. .scratch/deal-qualification/issues/24-desk-os-workbench-layout.md:1-8
PLAN_REALITY: phase=ceo rows=7/7 missing=none verdict=complete

#### NOT in scope
- **Deferred to `TODOS.md`**: Focus-guarded global keyboard shortcuts (`1`/`2`/`3` stage hotkeys and `Cmd+Enter` submit) — deferred under Principle 3 (Pragmatic) to avoid focus capture edge cases with comboboxes while delivering standard `<button>` keyboard navigation in `StepperBar.tsx`.
- **Out of Scope**: Backend API route changes, Postgres schema changes, or Eve YAML agent changes.

#### What already exists
- `components/workbench/MeddpiccScorecard.tsx`: Existing 8-row MEDDPICC table and internal `TenSegmentBar` component (reused and exported).
- `components/workbench/TopNavBar.tsx`: Existing accessible Settings gear popover, Scenario selector, and Simulation/Live mode indicator (reused).
- `lib/simulation/simulation-engine.ts`: Existing client-side state machine and `acme_migration.json` fixture (reused).

#### Dream state delta
- Delivers the complete single-pane Deal Desk OS 3-stage operational experience (`Blank Start` $\rightarrow$ `Stage 1 Initial Deal Audit` $\rightarrow$ `Stage 2 Field Discovery Checklist` $\rightarrow$ `Stage 3 Updated Assessment & Next Steps`) with zero context loss. Leaves live CRM webhook push and multi-deal portfolio views for future milestones.

#### Error & Rescue Registry
| Component / Method | Failure Mechanism | Exception / State | Rescue Action | User Impact |
| :--- | :--- | :--- | :--- | :--- |
| `LiveQualificationWorkbench` (`runAssessment` / `submitResponses`) | SSE disconnect, HTTP 5xx, or Eve job failure | `WorkflowState = 'ERROR'` / `errorMessage` | Render inline `role="alert"` error banner at top of `.workbench-right` with `Retry` and `Dismiss` buttons | User sees clear error message and can retry without reloading |
| `LiveQualificationWorkbench` (`abortCurrentOperation`) | Hung or slow live LLM assessment / re-scoring | User clicks `Abort` during `ANALYZING` or `EVALUATING` | AbortController cancels active fetch/SSE and restores prior stage (`READY_TO_ASSESS` or `AWAITING_DISCOVERY`) | User regains control immediately |
| `NextStepsCard` (`handleCopyNextSteps`) | Clipboard API unavailable or denied in non-HTTPS context | `navigator.clipboard` rejection | Catch error gracefully without throwing unhandled promise rejection | Button remains interactive without crashing UI |
| `LiveQualificationWorkbench` (`loadSessionState` into `COMPLETED`) | Deal resumed directly in `COMPLETED` with no in-memory `baselineAssessment` | `previousScore === undefined` | Render `{score} / 100` without `undefined` delta and keep Stage 1/2 tabs locked | Clean Stage 3 score lockup |

#### Failure Modes Registry
```
  CODEPATH                                  | FAILURE MODE                         | RESCUED? | TEST? | USER SEES?                          | LOGGED?
  ------------------------------------------|--------------------------------------|----------|-------|-------------------------------------|--------
  LiveQualificationWorkbench.runAssessment  | Live job / network error             | Y        | Y     | Inline alert banner + Retry button  | Y
  LiveQualificationWorkbench.submit         | Live re-scoring hang / user abort    | Y        | Y     | Abort button in EVALUATING header   | Y
  DynamicDiscoveryForm stage toggle         | User clicks Stage 1 then returns     | Y        | Y     | Form answers & SA notes preserved   | N/A
  Stage 1 inspection from Stage 3           | User clicks Stage 1 after COMPLETED  | Y        | Y     | True baselineAssessment displayed   | N/A
  Live resume directly into COMPLETED       | Missing in-memory baselineAssessment | Y        | Y     | Fallback "{score} / 100" lockup     | N/A
```
Critical Gaps: **0**.

#### Scope Expansion Decisions
- **Accepted**:
  1. Consolidate `.workbench-shell`, `.monochrome-top-bar`, and `35%/65%` `.workbench-split` across Simulation (`QualificationWorkbench.tsx`) and Live (`LiveQualificationWorkbench.tsx`) modes via shared shell primitives.
  2. Non-destructive stage switching (`activeStageView`) preserving `savedFormData`, `savedManualNotes` (`initialNotes`), and `baselineAssessment`.
  3. Retire and delete superseded `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx` after inlining Live error/abort controls.
  4. CSS staggered per-tick transition delay on `TenSegmentBar` with `motion-reduce:transition-none`.
- **Deferred**:
  1. Focus-guarded global keyboard shortcuts (`1`/`2`/`3` stage hotkeys) $\rightarrow$ `TODOS.md`.
- **Skipped**: None.

#### Diagrams

##### 1. System Architecture & Desk OS Split Layout
```
+-----------------------------------------------------------------------------------+
| TopNavBar (Brand, Scenario Selector, Simulation/Live Badge, Settings Popover)     |
+-----------------------------------------------------------------------------------+
| StepperBar: [ (1) Initial Deal Audit ] ── [ (2) Field Discovery ] ── [ (3) Next ] |
+-----------------------------------------------------------------------------------+
| .workbench-shell (max-w-[1440px], border #E2E0D8, rounded-lg)                     |
| +-------------------------------------------------------------------------------+ |
| | .monochrome-top-bar: DEAL DESK · Opportunity Name      [Stage Pill] [$ACV]    | |
| +-------------------------------+-----------------------------------------------+ |
| | .workbench-left (35%)         | .workbench-right (65%)                        | |
| | DealContextCard               | activeStageView Router:                       | |
| | - 2x2 Opportunity Metadata    | - 'blank': --/100 + Unassessed 8-row Ledger   | |
| | - Competitor Threat Callout   | - ANALYZING: Status + Elapsed + Shimmer Rows  | |
| | - AE Business Brief           | - 'stage1': {score}/100 + Blocker Ledger      | |
| | - SA Technical Assessment     | - 'stage2': DynamicDiscoveryForm + TickBars   | |
| |                               | - EVALUATING: Re-Scoring Status + Shimmer     | |
| |                               | - 'stage3': {prev}→{curr}/100 + NextStepsCard | |
| |                               |             + Upgraded 8-row MEDDPICC Ledger  | |
| +-------------------------------+-----------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

##### 2. Stage & Workflow State Machine
```
  [READY_TO_ASSESS] ──(Run Audit)──► [ANALYZING] ──(Audit Complete)──► [AWAITING_DISCOVERY]
   (view: 'blank')                    (shimmer)                        (view: 'stage1', saves baselineAssessment)
                                                                             │  ▲
                                                       (Answer Questions)    │  │ (← Back to Audit / Cancel:
                                                                             ▼  │  preserves savedFormData + savedManualNotes)
                                                                       [AWAITING_DISCOVERY]
                                                                       (view: 'stage2')
                                                                             │
                                                                     (Submit Findings)
                                                                             ▼
                                                                        [EVALUATING]
                                                                         (shimmer)
                                                                             │
                                                                             ▼
                                                                        [COMPLETED]
                                                                       (view: 'stage3', retains baselineAssessment
                                                                        for Stage 1/2 retrospective inspection)
```

#### Stale Diagram Audit
- Checked `DESIGN.md:80-146` and `.scratch/deal-qualification/issues/24-desk-os-workbench-layout.md`: no stale ASCII diagrams exist in touched files; the implementation aligns the React component tree with `DESIGN.md`'s Desk OS layout diagram.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~3h / CC: ~15min)** — Workbench Shell & Split Layout — Consolidate `.workbench-shell`, `.monochrome-top-bar`, and `35%/65%` `.workbench-split` across `QualificationWorkbench` and `LiveQualificationWorkbench`
  - Surfaced by: CEO Review Section 1 & Independent CEO Finding 1.1/3.1
  - Files: `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`, `components/workbench/DealContextCard.tsx`
  - Verify: `npm test -- tests/workbench-shell.test.tsx tests/qualification-workbench.test.tsx`
- [ ] **T2 (P1, human: ~2h / CC: ~10min)** — StepperBar & Discovery State — Implement 3-stage `StepperBar`, non-destructive `activeStageView` switching preserving `savedFormData` + `savedManualNotes`, and separate `baselineAssessment` snapshot
  - Surfaced by: CEO Review Section 4 & Independent CEO Finding 1.2
  - Files: `components/workbench/StepperBar.tsx`, `components/workbench/DynamicDiscoveryForm.tsx`, `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`
  - Verify: `npm test -- tests/qualification-workbench.test.tsx tests/dynamic-form-renderer.test.tsx`
- [ ] **T3 (P1, human: ~2h / CC: ~10min)** — Stage Headers, Error Recovery & Scorecard Motion — Inline dynamic Stage 1/3 score lockups, Live-mode inline error alert + `EVALUATING` abort button, staggered `TenSegmentBar` transition, and delete superseded sidebar/banner files
  - Surfaced by: CEO Review Section 2/11 & Independent CEO Finding 2.1/2.2
  - Files: `components/workbench/MeddpiccScorecard.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`, `components/workbench/StageGateCard.tsx`, `components/workbench/DealSummaryCard.tsx`, `components/workbench/ActionPanel.tsx`, `components/workbench/Banners.tsx`
  - Verify: `npm test && npm run build`
- [ ] **T4 (P1, human: ~2h / CC: ~10min)** — Workbench & Form Tests — Update `workbench-shell`, `qualification-workbench`, and `dynamic-form-renderer` tests for Desk OS 3-stage progression, `TenSegmentBar`, `initialNotes`, and Next Steps clipboard
  - Surfaced by: CEO Review Section 6 & Step 0H Spec Review
  - Files: `tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`
  - Verify: `npm test`

#### Completion Summary
```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | 4 premises verified, 1 fixture mismatch fix |
  | Step 0               | SELECTIVE EXPANSION: 4 accepted, 1 deferred |
  | Section 1  (Arch)    | 2 issues found (shell sharing, baseline)    |
  | Section 2  (Errors)  | 4 error paths mapped, 0 GAPS                |
  | Section 3  (Security)| 0 issues found, 0 High severity             |
  | Section 4  (Data/UX) | 5 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 1 issue found (retire 4 dead components)    |
  | Section 6  (Tests)   | Diagram produced, 0 gaps (paths fixed)      |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 0 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 1 (TODO)    |
  | Section 11 (Design)  | 1 polish item (staggered TenSegmentBar)     |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (2 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 4 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 5 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 1 item proposed (written to TODOS.md)       |
  | Scope proposals      | 5 proposed, 4 accepted (EXP + SEL)          |
  | CEO plan             | written                                     |
  | Outside voice        | codex unavailable; native agy2 completed    |
  | Lake Score           | 6/6 recommendations chose complete option   |
  | Diagrams produced    | 2 (architecture split, stage state machine) |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0 (listed below)                            |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 0 unverified       |
  +====================================================================+
```

#### Phase 1 Decision Audit Trail
| # | Phase | Decision | Principle | Classification | Rationale | Rejected |
|---|-------|----------|-----------|----------------|-----------|----------|
| 1 | CEO | Select `SELECTIVE EXPANSION` mode | P1 + P3 | Mechanical | Core layout refactor is well-defined; cherry-picking in-blast-radius completeness fixes avoids scope bloat | `SCOPE EXPANSION`, `HOLD SCOPE` |
| 2 | CEO | Reconcile hardcoded `58 / 82` mockup numbers to dynamic `{score} / 100` (`54 → 76 (+22)` in Acme fixture) | P5 | Mechanical | Prevents test/implementation contradiction against `acme_migration.json` | Hardcoding `58 / 82` |
| 3 | CEO | Preserve both `savedFormData` and `savedManualNotes` (`initialNotes`) + separate `baselineAssessment` across stage navigation | P1 + P2 | Mechanical | Ensures non-destructive Stage 1 ↔ Stage 2 ↔ Stage 3 switching without losing SA notes or Stage 1 audit snapshot | Only saving `formData` |
| 4 | CEO | Preserve inline Live-mode error alert + `EVALUATING` abort inside `.workbench-right`, then delete `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx` | P2 + P4 | Mechanical | Resolves Independent CEO Finding 2.1 (Critical) while eliminating dead sidebar components | Deleting error/abort handling or leaving dead files |
| 5 | CEO | Add CSS staggered per-tick transition delay on `TenSegmentBar` with `motion-reduce:transition-none` | P1 + P5 | Taste | Implements `DESIGN.md` "The One Authored Moment" in 3 lines of CSS | Instant un-staggered fill |
| 6 | CEO | Defer global `1`/`2`/`3` stage hotkeys to `TODOS.md` while keeping standard `<button>` keyboard navigation on `StepperBar` | P3 + P5 | Taste (Disagreement with native outside voice) | Avoids single-key input capture edge cases with comboboxes while preserving full Tab/Enter accessibility | Global `1`/`2`/`3` keydown listener |

Approval readiness: PASS (rows #1–#6 settled via `/autoplan` principles P1–P6).

---

### Phase 2: Design Review (UI/UX & Design System Alignment)

#### Step 0 & Step 0.5: Design Scope Assessment & Dual Voices
- **0A. Initial Design Completeness Rating**: **7/10** before fixes $\rightarrow$ **10/10** after fixes. The plan had strong alignment with `DESIGN.md` ("Warm Paper & Ink", `#F7F6F2` canvas, `#FFFFFF` shell, `#F1F0EC` recessed blocker rows, `#0F52BA` cobalt CTA, and `40ms` staggered `TenSegmentBar` fill), but left 6 UI/UX edge cases underspecified (mobile/tablet `< lg` brief hierarchy, Stage 1 top vs. bottom CTA differentiation, Stage 3 `< 75` post-discovery state, `EVALUATING` 8-row table shimmer transition, retrospective Stage 1/2 navigation controls from Stage 3, and desktop scroll height pairing).
- **0B. `DESIGN.md` Status**: Present and authoritative (`DESIGN.md` lines 1–210 + approved HTML reference `/Users/brandonwarwick/.gemini/antigravity/brain/ef6f57e3-cb47-4d03-ae1d-aaf364f5562f/scratch/design-system-preview.html`).
- **0C. Existing Design Leverage**: Reuses `TenSegmentBar` and 8-row table styling in `MeddpiccScorecard.tsx`, custom accessible combobox and input styling in `DynamicDiscoveryForm.tsx`, and Settings popover in `TopNavBar.tsx`.
- **0.5. Dual Voices**:
  - **Codex SAYS (design — UX challenge)**: `unavailable` (`codex` CLI `not_installed`).
  - **agy2 (in-host) SUBAGENT (design — independent review)**: Completed with 10 findings across 5 sections (3 High, 7 Medium), consolidated into 6 concrete design decisions below.

```
DESIGN OUTSIDE VOICES — LITMUS SCORECARD:
═══════════════════════════════════════════════════════════════
  Check                                    agy2 (in-host)  Codex  Consensus
  ─────────────────────────────────────── ─────── ─────── ─────────
  1. Brand unmistakable in first screen?   YES     N/A    N/A
  2. One strong visual anchor?             YES     N/A    N/A
  3. Scannable by headlines only?          YES     N/A    N/A
  4. Each section has one job?             YES     N/A    N/A
  5. Cards actually necessary?             YES     N/A    N/A
  6. Motion improves hierarchy?            YES     N/A    N/A
  7. Premium without decorative shadows?   YES     N/A    N/A
  ─────────────────────────────────────── ─────── ─────── ─────────
  Hard rejections triggered:               NONE    N/A    N/A
═══════════════════════════════════════════════════════════════
```

#### Passes 1–7 Evaluation

- **Pass 1: Information Architecture (`8/10` $\rightarrow$ `10/10`)**
  - **Hierarchy**: (1) Process orientation (`StepperBar`) + `.monochrome-top-bar` (`DEAL DESK`, Opportunity Name, Stage pill, `$ACV` pill) + `.stage-header-row` score lockup & primary CTA; (2) Active 65% right workspace (`MeddpiccScorecard` 8-row ledger or `DynamicDiscoveryForm` with embedded `TenSegmentBar`s, plus Stage 3 `Suggested Next Steps` card); (3) Persistent 35% left Opportunity Brief (`DealContextCard`).
  - **Fixes Applied**:
    1. Differentiated Stage 1 top `.stage-header-row` primary `#0F52BA` button (`Answer {N} Discovery Questions →`) from the bottom summary footer strip (`#FAFAF7` with muted gap count text and secondary `Proceed to Stage 2: Field Discovery →` button).
    2. Added collapsible `<details>` disclosure for the long AE/SA narrative briefs on `< lg` viewports (while keeping the 2x2 metadata grid and Competitor Threat callout always visible) so mobile/tablet users see the active stage canvas without scrolling past a long static brief.

- **Pass 2: Interaction State Coverage (`7/10` $\rightarrow$ `10/10`)**
  ```
    FEATURE                     | LOADING                                        | EMPTY / BLANK START                          | ERROR                                             | SUCCESS / QUALIFIED                              | PARTIAL / SUB-THRESHOLD
    ----------------------------|------------------------------------------------|----------------------------------------------|---------------------------------------------------|--------------------------------------------------|------------------------------------------------
    65% Stage 1 (Initial Audit) | In-place 8-row shimmer + elapsed timer + Abort | `-- / 100` + Unassessed pill + 8 empty bars  | Inline `role="alert"` banner + Retry/Dismiss      | `{score} / 100` (`>=75` Ready pill)              | `{score} / 100` (`<75` Gaps Identified pill)
    65% Stage 2 (Discovery)     | Transitions to 8-row ledger shimmer on submit  | `0` questions -> Stage 1 advances to Stage 3 | Returns to `'stage2'` with draft intact + alert   | Submits findings & triggers `EVALUATING`         | `Answered {K} of {N}` live counter + draft save
    65% Stage 3 (Updated Audit) | In-place 8-row shimmer (`EVALUATING`)          | Direct-to-`COMPLETED` fallback `{score}/100` | Inline `role="alert"` banner + Retry/Dismiss      | `{prev} → {curr}/100 (+Δ)` + Cleared pill + Copy | `{prev} → {curr}/100 (+Δ)` + Gaps Remaining pill
  ```

- **Pass 3: User Journey & Emotional Arc (`8/10` $\rightarrow$ `10/10`)**
  ```
    STEP | USER DOES                                  | USER FEELS                              | PLAN SPECIFIES?
    -----|--------------------------------------------|-----------------------------------------|------------------------------------------------------------------
    1    | Loads deal in Blank Start (`-- / 100`)     | Calm clinical readiness                 | Yes: `.workbench-shell` + unscored 8-row ledger + `#0F52BA` CTA
    2    | Clicks `Run MEDDPICC Deal Audit →`         | Responsive progress without layout jump | Yes: In-place 8-row shimmer + elapsed timer + `Abort`
    3    | Reviews Stage 1 (`54 / 100`, 3 blockers)   | Immediate diagnostic clarity            | Yes: `#F1F0EC` recessed blocker rows + `Open Gap / Blind Spot`
    4    | Answers Stage 2 questions (`TenSegmentBar`)| In-context agency & zero context loss   | Yes: Embedded `TenSegmentBar` per card + `Answered {K} of {N}`
    5    | Toggles `← Back to Audit` / Stage 1–3 tabs | Safe exploration without losing work    | Yes: Preserves `savedFormData`, `savedManualNotes`, `baselineAssessment`
    6    | Reaches Stage 3 (`54 → 76 / 100 (+22)`)    | High-craft resolution & momentum        | Yes: `40ms` staggered bar fill + `Suggested Next Steps` copy card
  ```
  - **Fixes Applied**: Specified explicit retrospective Stage 1/2 header action (`Return to Updated Assessment (Stage 3) →`) when `workflowState === 'COMPLETED'`, and defined `↺ Restart Walkthrough` to reset to the **Blank Start** state (`READY_TO_ASSESS`, `activeStageView: 'blank'`, clearing `baselineAssessment`, `savedFormData`, and `savedManualNotes`).

- **Pass 4: AI Slop Risk (`9/10` $\rightarrow$ `10/10`)**
  - Surface Classifier: **OPERATE (APP UI)**. Zero AI slop blacklist patterns or hard rejections. Strictly follows `DESIGN.md` "Warm Paper & Ink" (`#F7F6F2` alabaster canvas, `#FFFFFF` shell, `#E2E0D8` hairlines, `#111110` obsidian ink, `#0F52BA` sapphire CTA, tabular numerals, zero dark-mode glow or decorative card mosaics).

- **Pass 5: Design System Alignment (`9/10` $\rightarrow$ `10/10`)**
  - Calibrated all tokens against `DESIGN.md` and `design-system-preview.html`. Specified exact `Copy Next Steps` clipboard format (`assessment.NextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')`) and `2000ms` `#15803D` `✓ Copied to Clipboard` feedback timer with unmount cleanup.

- **Pass 6: Responsive & Accessibility (`8/10` $\rightarrow$ `10/10`)**
  - Specified `lg:max-h-[680px] lg:overflow-y-auto` on the AE/SA narrative container inside `.workbench-left` so desktop viewports never stretch the shell with dead vertical space beneath the 8-row scorecard, while `< lg` viewports collapse the narrative briefs inside a `<details>` disclosure.
  - Specified `aria-current="step"` on the active `StepperBar` stage button, `role="status"` / `aria-live="polite"` on loading and clipboard announcements, `focus-visible:ring-2 focus-visible:ring-[#0F52BA]`, and `motion-reduce:transition-none` on `TenSegmentBar`.

- **Pass 7: Unresolved Design Decisions (`6 resolved, 0 deferred`)**
  - All 6 design decisions surfaced during Phase 2 were resolved and recorded in `<!-- autoplan-accepted:design -->`.

#### NOT in scope (Design)
- Dark mode palette (explicitly anti-goal in `DESIGN.md`: "Warm Paper & Ink" is light-mode editorial workspace only).
- Animated radial gauges or circular score meters (`DESIGN.md` mandates horizontal 10-segment `TenSegmentBar` + `tabular-nums` typographic lockups).

#### What already exists (Design)
- `DESIGN.md` and `/Users/brandonwarwick/.gemini/antigravity/brain/ef6f57e3-cb47-4d03-ae1d-aaf364f5562f/scratch/design-system-preview.html` provide the exact CSS tokens and component anatomy.
- `MeddpiccScorecard.tsx`, `DynamicDiscoveryForm.tsx`, `DealContextCard.tsx`, `StepperBar.tsx`, and `TopNavBar.tsx` provide the existing React component primitives.

#### Design Implementation Tasks
- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — Stage 1/2/3 Interaction States & Retrospective UX — Implement `EVALUATING` 8-row ledger shimmer, Stage 1/3 conditional qualification pills, Stage 2 progress counter (`Answered {K} of {N}`), error fallback to active stage, and Stage 3 retrospective return CTA
  - Surfaced by: Design Review Passes 1–3 & Independent Design Reviewer Findings 2.1–3.1
  - Files: `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`, `components/workbench/MeddpiccScorecard.tsx`, `components/workbench/DynamicDiscoveryForm.tsx`
  - Verify: `npm test -- tests/workbench-shell.test.tsx tests/qualification-workbench.test.tsx`
- [ ] **T2 (P2, human: ~1h / CC: ~5min)** — Responsive Brief Disclosure & A11y Polish — Add collapsible mobile/tablet disclosure and desktop `lg:max-h-[680px]` scroll container for AE/SA briefs in `DealContextCard`, `aria-current="step"` on `StepperBar`, and `2000ms` `Copy Next Steps` timer cleanup
  - Surfaced by: Design Review Passes 5–6 & Independent Design Reviewer Findings 1.1/5.1
  - Files: `components/workbench/DealContextCard.tsx`, `components/workbench/StepperBar.tsx`, `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`
  - Verify: `npm test`

#### Design Completion Summary
```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md + design-system-preview.html      |
  | Step 0               | Initial 7/10; all 7 passes reviewed         |
  | Pass 1  (Info Arch)  | 8/10 → 10/10 after fixes                    |
  | Pass 2  (States)     | 7/10 → 10/10 after fixes                    |
  | Pass 3  (Journey)    | 8/10 → 10/10 after fixes                    |
  | Pass 4  (AI Slop)    | 9/10 → 10/10 after fixes                    |
  | Pass 5  (Design Sys) | 9/10 → 10/10 after fixes                    |
  | Pass 6  (Responsive) | 8/10 → 10/10 after fixes                    |
  | Pass 7  (Decisions)  | 6 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (2 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 new items proposed                        |
  | Approved Mockups     | 1 existing HTML spec preview                |
  | Decisions made       | 6 added to plan                             |
  | Decisions deferred   | 0 (listed below)                            |
  | Overall design score | 7/10 → 10/10                                |
  +====================================================================+
```
Plan is design-complete. Run `/design-review` after implementation for visual QA.

#### Phase 2 Decision Audit Trail
| # | Phase | Decision | Principle | Classification | Rationale | Rejected |
|---|-------|----------|-----------|----------------|-----------|----------|
| 7 | Design | Differentiate Stage 1 top primary CTA (`#0F52BA`) from bottom summary footer strip (`#FAFAF7` with secondary action) | P5 | Mechanical | Matches `design-system-preview.html:985-1065` and avoids two competing primary buttons on an 8-row table | Duplicate `#0F52BA` primary buttons |
| 8 | Design | Render `EVALUATING` in-place on the 8-row `MeddpiccScorecard` shimmer ledger and return to `'stage2'` with draft intact on error/abort | P1 + P2 | Mechanical | Seamless transition into Stage 3's `40ms` staggered bar fill and zero lost user input on Live error | Centered spinner or losing Stage 2 draft on error |
| 9 | Design | Add conditional Stage 3 `< 75` warning pill, retrospective `Return to Updated Assessment (Stage 3) →` action, and `↺ Restart Walkthrough` reset to `'blank'` | P1 + P5 | Mechanical | Covers all non-happy-path Live scores and makes Stage 1/2 retrospective inspection unambiguous | Assuming Stage 3 is always `>= 75` |
| 10 | Design | Add `Answered {K} of {N}` progress counter in Stage 2 and `2000ms` `#15803D` clipboard feedback timer with unmount cleanup in Stage 3 | P1 + P5 | Mechanical | Gives clear form progress and deterministic clipboard test behavior | Unspecified copy payload/timeout |
| 11 | Design | Collapse AE/SA briefs behind `<details>` on `< lg` viewports and constrain desktop narrative scroll (`lg:max-h-[680px] lg:overflow-y-auto`) | P1 + P5 | Mechanical | Prevents long left-pane briefs from pushing mobile stage content below the fold or stretching desktop shell height | Unbounded left-pane height |
| 12 | Design | Enforce `aria-current="step"` on `StepperBar` and `role="status"` / `aria-live="polite"` on loading and clipboard state changes | P1 + P5 | Mechanical | Explicit screen-reader and keyboard wayfinding | Visual-only active stage indicators |

---

### Phase 2.5: DX Review (Developer Experience & Component Ergonomics)

#### Step 0: DX Investigation (`0A`–`0G`)

##### 0A. Developer Persona Card
```
TARGET DEVELOPER PERSONA
========================
Who:       Solutions Architect / Frontend Engineer evaluating, extending, or testing the Deal Qualification Workbench (Simulation & Live modes)
Context:   Clones the repo or opens the workbench to run a MEDDPICC audit, test a scenario fixture, or extend workbench components (`MeddpiccScorecard`, `DynamicDiscoveryForm`, `QualificationWorkbench`)
Tolerance: 3 minutes to run local dev + tests and complete a full Blank → Stage 1 → Stage 2 → Stage 3 walkthrough; zero tolerance for ambiguous component props or silent clipboard/API errors
Expects:   Zero-credential Simulation Mode out of the box, clear Problem+Cause+Fix error banners when Live Mode lacks credentials, typed discriminated component props, and deterministic `npm test` execution
```

##### 0B. Developer Empathy Narrative
> "I open the repo to verify the new Deal Desk OS 3-stage layout and see how `QualificationWorkbench` and `LiveQualificationWorkbench` wire up the 35%/65% split. In Simulation Mode, starting from the Blank Start state (`-- / 100`) and clicking `Run MEDDPICC Deal Audit →` is immediately understandable—the 8-row MEDDPICC table shimmers in place and lands on `54 / 100` with 3 highlighted blocker rows. When I click into Stage 2 (`Field Discovery Checklist`), having each discovery card show the target dimension's `TenSegmentBar` right in the card header keeps me anchored without scrolling up and down.
>
> However, when I look at the component APIs and edge cases in the plan, a few rough edges jump out. First, `MeddpiccScorecard` is asked to render four different visual states (`unassessed`, `loading`, Stage 1 `audit`, and Stage 3 `completed`) plus export `TenSegmentBar`, and if `TenSegmentBar` always applies the `40ms` staggered transition delay, typing into a Stage 2 discovery input could re-trigger tick animations unless `animateStagger` is explicitly controlled. Second, in Stage 3, `Copy Next Steps` calls `navigator.clipboard.writeText(...)` without a `try/catch`—if I'm testing over a non-HTTPS preview tunnel or restricted browser context, that promise rejects unhandled. Finally, if a Live Mode evaluation fails after I've filled out 6 discovery answers, I need the inline `role="alert"` banner to tell me what failed, why, and let me retry with my `savedFormData` and `savedManualNotes` still intact, or switch to Simulation Mode with one click."

##### 0C. Competitive DX Benchmark & TTHW Assessment
- **Clock Definition**: From fresh repo checkout / workbench open to completing a full 3-stage MEDDPICC qualification cycle (`Blank Start` $\rightarrow$ `Stage 1 Audit` $\rightarrow$ `Stage 2 Discovery` $\rightarrow$ `Stage 3 Updated Assessment & Next Steps`) and running the component test suite (`npm test`).
- **TTHW Assessment**: Observed current trajectory **3 min** $\rightarrow$ Target **2 min** (**Champion / Competitive tier**, `< 2–5 min`), powered by zero-credential Simulation Mode (`acme_migration.json`) and instant in-place stage transitions.

| Tool / Surface | Start → Useful Result | Time + Evidence Type | DX Choice | Source |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel SAM Deal Desk OS (Simulation Mode)** | Open workbench $\rightarrow$ Run Audit (`54/100`) $\rightarrow$ Answer 3 questions $\rightarrow$ Re-score (`76/100`) + Copy Next Steps | **2 min** (estimated from deterministic simulation engine + 3-stage single-pane flow) | Zero-credential default Simulation Mode + in-place 8-row MEDDPICC table across all stages | `lib/simulation/simulation-engine.ts`, `DESIGN.md:80-146` |
| **Vercel SAM Deal Desk OS (Live Mode)** | Configure Eve env vars $\rightarrow$ Run live SSE audit $\rightarrow$ Submit discovery $\rightarrow$ Re-score | **3–5 min** (observed/estimated depending on LLM latency + credential setup) | Settings gear popover (`TopNavBar`) + inline `ANALYZING`/`EVALUATING` timer, `Abort`, and `Retry` banner | `components/workbench/LiveQualificationWorkbench.tsx` |
| **Stripe Shell / Docs Workbench (Gold Standard)** | Open docs/workbench $\rightarrow$ Run pre-filled request $\rightarrow$ Inspect structured response | **< 2 min** (reported benchmark) | Zero-setup sandbox + copy-ready payloads + structured error diagnostics | `dx-hall-of-fame.md` Pass 1 & Pass 3 |

##### 0D. Magical Moment Specification
- **Magical Moment**: Clicking `Submit Findings & Re-Score Deal →` in Stage 2 and watching the 8-row MEDDPICC ledger shimmer in-place and cascade left-to-right (`40ms` per segment tick) from `54 / 100` (`#B45309` Amber blocker rows) to `76 / 100 (+22)` (`#15803D` Emerald cleared Stage Gate) with an immediately copyable **Suggested Next Steps** action brief at the top of the workspace.
- **Delivery Vehicle**: In-place `MeddpiccScorecard` transition (`mode: 'loading'` $\rightarrow$ `mode: 'completed'`) with `TenSegmentBar` `animateStagger={true}` (`transitionDelay: '${i * 40}ms'`, `motion-reduce:transition-none`) and resilient 1-click `Copy Next Steps` action.

##### 0E. Mode Selection
- **Selected Mode**: **DX POLISH** (auto-selected per `/autoplan` Phase 2.5 rule: make every developer and operator touchpoint bulletproof—component prop contracts, error diagnostics, clipboard resilience, retrospective stage escape hatches, and `CONTEXT.md` architecture sync—without adding out-of-scope features).

##### 0F. Developer Journey Map (6-Stage Table)
```
STAGE           | DEVELOPER DOES                                              | FRICTION POINTS                                                        | STATUS
----------------|-------------------------------------------------------------|------------------------------------------------------------------------|--------
1. Discover     | Reads CONTEXT.md & DESIGN.md to understand Desk OS layout   | CONTEXT.md did not reflect retired sidebar/banner files or 3-stage map | fixed
2. Install      | Runs `npm install && npm run dev` (or `npm test`)           | Test paths in initial spec pointed to `tests/unit/` instead of `tests/`| fixed
3. Hello World  | Runs Blank Start → Stage 1 → Stage 2 → Stage 3 in Sim Mode  | Hardcoded `58/82` in spec conflicted with Acme fixture `54/76 (+22)`   | fixed
4. Real Usage   | Wires `MeddpiccScorecard`, `TenSegmentBar`, & `DiscoveryForm`| Implicit 4-mode boolean props & unguarded stagger animation in Stage 2 | fixed
5. Debug        | Triggers Live Mode error/abort or non-HTTPS clipboard error | Deleted `Banners.tsx` lacked Problem+Cause+Fix spec; unguarded copy()  | fixed
6. Upgrade      | Retires 4 legacy sidebar/banner modules & runs `npm test`   | Retrospective Stage 2 editability & magic `75` threshold underspecified| fixed
```

##### 0G. First-Time Developer Confusion Report
```
FIRST-TIME DEVELOPER REPORT
============================
Persona: Solutions Architect / Frontend Engineer extending & testing the Workbench
Attempting: Implementing & verifying Issue #24 Desk OS 3-stage split-workbench

CONFUSION LOG:
T+0:00  Reads Issue #24 & CONTEXT.md. Sees 4 components (`StageGateCard`, `DealSummaryCard`, `ActionPanel`, `Banners`) slated for deletion, [ADDRESSED: Added CONTEXT.md update to keep architecture docs in sync].
T+0:30  Inspects `MeddpiccScorecard.tsx` to add Blank Start (`unassessed`), `loading` shimmer, Stage 1 `audit`, and Stage 3 `completed` modes plus export `TenSegmentBar`. Wonders how to prevent `TenSegmentBar` from re-running the 40ms stagger animation on every keystroke inside `DynamicDiscoveryForm`, [ADDRESSED: Defined explicit `mode` union on `MeddpiccScorecard` and `animateStagger?: boolean` on `TenSegmentBarProps`].
T+1:15  Wires `DynamicDiscoveryForm` stage switching (`Stage 2 <-> Stage 1 <-> Stage 3`). Checks whether Stage 2 inputs remain editable when inspecting Stage 2 retrospectively from Stage 3 (`COMPLETED`), [ADDRESSED: Specified that Stage 2 inputs and `Submit Findings & Re-Score Deal →` remain enabled for iterative re-scoring alongside `Return to Updated Assessment (Stage 3) →`].
T+2:00  Tests `Copy Next Steps` in Stage 3 and Live Mode error recovery when backend SSE disconnects. Notices `navigator.clipboard.writeText` has no `try/catch` and the inline replacement for `Banners.tsx` needs structured error fields, [ADDRESSED: Added `try/catch` clipboard fallback status and Problem+Cause+Fix inline alert banner contract].
T+2:30  Runs `npm test` across `tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, and `tests/dynamic-form-renderer.test.tsx` — all stages and edge cases pass cleanly.
```

#### Step 0.5: DX Dual Voices Consensus Table
- **Codex SAYS (DX — developer experience challenge)**: `unavailable` (`codex` CLI `not_installed`).
- **agy2 (in-host) SUBAGENT (DX — independent review)**: Completed with 6 findings (2 High, 4 Medium), all resolved in `<!-- autoplan-accepted:dx -->`.

```
DX DUAL VOICES — CONSENSUS TABLE:
  Dimension                           agy2 (in-host)  Codex  Consensus
  1. Getting started < 5 min?          YES (2m Sim)    N/A    N/A
  2. API/CLI naming guessable?         ISSUES (Fixed)  N/A    N/A
  3. Error messages actionable?        ISSUES (Fixed)  N/A    N/A
  4. Docs findable & complete?         ISSUES (Fixed)  N/A    N/A
  5. Upgrade path safe?                YES             N/A    N/A
  6. Dev environment friction-free?    YES             N/A    N/A
CONFIRMED = native + outside agree; primary cannot replace outside. DISAGREE → taste.
Missing/disabled voice = N/A, never CONFIRMED. Flag any single-voice critical finding.
```

#### Passes 1–8 Evaluation (`DX POLISH` Mode)

- **Pass 1: Getting Started Experience (`8/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Simulation Mode provides an instant, zero-credential sandbox (`acme_migration.json`) that starts in a self-explanatory **Blank Start** state (`-- / 100`, `Stage Gate 2 · Unassessed Opportunity`, primary CTA `Run MEDDPICC Deal Audit →`).
  - **Fix Applied**: Clarified retrospective Stage 2 behavior from Stage 3 (`COMPLETED`) so users and developers can both return to Stage 3 via `Return to Updated Assessment (Stage 3) →` or edit discovery answers and re-score iteratively without having to wipe state via `↺ Restart Walkthrough`.

- **Pass 2: API/CLI/SDK & Component Prop Design (`7/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Addressed Independent DX Reviewer Findings 2, 3, and 6.
  - **Fixes Applied**:
    1. Defined an explicit discriminated `mode?: 'unassessed' | 'loading' | 'audit' | 'completed'` prop on `MeddpiccScorecard.tsx` and explicit `TenSegmentBarProps` (`score: number | null`, `previousScore?: number | null`, `animateStagger?: boolean`, `ariaLabel?: string`) so Stage 2 discovery cards render static current score ticks (`animateStagger={false}`) while Stage 3 renders the `40ms` staggered reveal (`animateStagger={true}`).
    2. Standardized `DynamicDiscoveryForm.tsx` draft props (`initialValues?: Record<string, unknown>`, `initialNotes?: string`, `onDraftChange?: (answers: Record<string, unknown>, manualNotes: string) => void`) and extracted `STAGE_GATE_THRESHOLD = 75` as a named constant.

- **Pass 3: Error Messages & Debugging (`7/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Addressed Independent DX Reviewer Findings 1 and 4 by tracing 3 concrete error paths against the Hall of Fame Problem + Cause + Fix formula:
    1. **Path 1 — Live Mode Initial Audit Failure (`ANALYZING` $\rightarrow$ `ERROR`)**: Currently risked showing a raw error string after deleting `Banners.tsx`. Fixed to render an inline `role="alert"` banner at the top of `.workbench-right` with **Problem** (`Initial Deal Audit Failed`), **Cause** (sanitized SSE/HTTP timeout or error message), and **Fix** (`Retry` button + `Dismiss` button + hint to switch to `Simulation Mode` in `TopNavBar` if Live backend credentials are unconfigured).
    2. **Path 2 — Live Mode Re-Scoring Failure or Abort (`EVALUATING` $\rightarrow$ `'stage2'`)**: Restores `activeStageView: 'stage2'` with `savedFormData` and `savedManualNotes` intact and renders the inline `role="alert"` banner with **Problem** (`Discovery Re-Scoring Failed`), **Cause**, and **Fix** (`Retry` button that re-submits the preserved draft without re-typing).
    3. **Path 3 — Stage 3 `Copy Next Steps` Clipboard Failure**: Wrapped `navigator.clipboard.writeText(...)` in `try / catch`, normalized `assessment.NextSteps ?? []`, and added inline recovery status (`Copy Failed — Select text below manually`, `role="status"`, resetting after `3000ms`) when clipboard access is unavailable or denied.

- **Pass 4: Documentation & Learning (`8/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Addressed Independent DX Reviewer Finding 6.2.
  - **Fix Applied**: Added `CONTEXT.md` to the plan scope so the architectural documentation reflects the 3-stage Desk OS component topology (`StepperBar`, `DealContextCard`, `MeddpiccScorecard`, `DynamicDiscoveryForm`) and the removal of `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx`.

- **Pass 5: Upgrade & Migration Path (`9/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Prior learning `legacy-cleanup-test-retargeting` applied (confidence 9/10, from 2026-10-21): retarget `tests/workbench-shell.test.tsx` and `tests/qualification-workbench.test.tsx` to the Desk OS shell and inline stage headers before deleting `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx`, keeping `MeddpiccScorecard`'s `mode` prop backward-compatible with default inference.

- **Pass 6: Developer Environment & Tooling (`9/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Full TypeScript strictness across props (`TenSegmentBarProps`, `MeddpiccScorecardProps`, `DynamicDiscoveryFormProps`), fast Vitest + React Testing Library feedback (`npm test`), and zero new external dependencies.

- **Pass 7: Community & Ecosystem (`9/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Self-contained realistic enterprise deal fixtures (`acme_migration.json` and scenario selector in `TopNavBar`) allow anyone to explore realistic MEDDPICC workflows immediately without external services.

- **Pass 8: DX Measurement & Feedback Loops (`9/10` $\rightarrow$ `10/10`)**
  - **Evaluation**: Boomerang-ready for `/devex-review` and `/qa`: the 2-minute Simulation Mode TTHW target, `Answered {K} of {N}` Stage 2 counter, elapsed Live timer (`elapsedSeconds`), and `TC-1`–`TC-3` automated tests provide direct verification of every stage transition.

#### NOT in scope (DX)
- URL query-string synchronization (`?stage=2`) — explicitly unnecessary for single-page session state and avoids history-stack pollution during rapid stage inspection.
- External analytics/telemetry SDK integration — local state and test assertions cover verification without third-party tracking.

#### What already exists (DX)
- `lib/simulation/simulation-engine.ts` and `lib/fixtures/simulation/acme_migration.json`: Deterministic zero-config simulation state machine and realistic MEDDPICC fixture data.
- `tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, and `tests/dynamic-form-renderer.test.tsx`: Existing Vitest + Testing Library suites ready for Desk OS 3-stage assertions.

#### DX Scorecard
```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Score  | Prior  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      | 10/10  |  8/10  |  +2 ↑  |
| API/CLI/SDK          | 10/10  |  7/10  |  +3 ↑  |
| Error Messages       | 10/10  |  7/10  |  +3 ↑  |
| Documentation        | 10/10  |  8/10  |  +2 ↑  |
| Upgrade Path         | 10/10  |  9/10  |  +1 ↑  |
| Dev Environment      | 10/10  |  9/10  |  +1 ↑  |
| Community            | 10/10  |  9/10  |  +1 ↑  |
| DX Measurement       | 10/10  |  9/10  |  +1 ↑  |
+--------------------------------------------------------------------+
| TTHW                 |  2 min |  3 min |  -1 ↑  |
| Competitive Rank     | Champion (< 2 min in Simulation Mode)       |
| Magical Moment       | designed via in-place 8-row staggered bar   |
| Product Type         | Interactive Deal Desk Workbench & UI SDK    |
| Mode                 | DX POLISH                                   |
| Overall DX           | 10/10  | 7.8/10 | +2.2 ↑ |
+====================================================================+
| DX PRINCIPLE COVERAGE                                               |
| Zero Friction                | covered (Blank Start + Sim Mode)    |
| Learn by Doing               | covered (Interactive Acme fixture)  |
| Fight Uncertainty            | covered (Problem+Cause+Fix alerts)  |
| Opinionated + Escape Hatches | covered (Iterative Stage 2 + Abort) |
| Code in Context              | covered (Embedded TenSegmentBars)   |
| Magical Moments              | covered (40ms staggered Stage 3)    |
+====================================================================+
```
DX plan is solid. Developers will have a good experience.

#### DX Implementation Checklist
```
DX IMPLEMENTATION CHECKLIST
============================
[x] Time to hello world < 2 min (Champion tier in Simulation Mode; < 5 min in Live Mode)
[x] Installation is one command (`npm install && npm run dev`)
[x] First run produces meaningful output (Blank Start `-- / 100` -> `54 / 100` -> `76 / 100 (+22)`)
[x] Magical moment delivered via in-place 8-row `MeddpiccScorecard` + `40ms` staggered `TenSegmentBar`
[x] Every error message has: problem + cause + fix (`Retry`, `Dismiss`, Simulation Mode hint, clipboard fallback)
[x] Component prop naming (`mode`, `TenSegmentBarProps`, `initialNotes`, `onDraftChange`) is guessable without docs
[x] Every parameter has a sensible default (`animateStagger = false` in Stage 2, `STAGE_GATE_THRESHOLD = 75`)
[x] Docs (`CONTEXT.md` & `DESIGN.md`) match the 3-stage Desk OS component topology
[x] Examples/fixtures (`acme_migration.json`) show real enterprise MEDDPICC use cases
[x] Upgrade path retargets tests before deleting superseded sidebar/banner components
[x] Breaking internal component removals (`StageGateCard`, `DealSummaryCard`, `ActionPanel`, `Banners`) verified by `npm run build`
[x] TypeScript types included (`MeddpiccScorecardProps`, `TenSegmentBarProps`, `DynamicDiscoveryFormProps`)
[x] Works in CI/CD without special configuration (`npm test && npm run build`)
[x] Free tier / Simulation Mode available with no credentials required
```

#### DX Implementation Tasks
- [ ] **T1 (P1, human: ~1.5h / CC: ~10min)** — `MeddpiccScorecard` & `TenSegmentBar` Prop Ergonomics — Define explicit `mode` union (`'unassessed' | 'loading' | 'audit' | 'completed'`) on `MeddpiccScorecard`, explicit `TenSegmentBarProps` (`animateStagger?: boolean`), and `STAGE_GATE_THRESHOLD = 75` constant
  - Surfaced by: DX Review Pass 2 & Independent DX Reviewer Findings 2 & 6
  - Files: `components/workbench/MeddpiccScorecard.tsx`, `components/workbench/DynamicDiscoveryForm.tsx`, `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`
  - Verify: `npm test -- tests/workbench-shell.test.tsx tests/dynamic-form-renderer.test.tsx`
- [ ] **T2 (P2, human: ~1h / CC: ~5min)** — Error Diagnostics, Clipboard Resilience & `CONTEXT.md` Sync — Add Problem+Cause+Fix inline alert banner contract, `try/catch` clipboard fallback status (`Copy Failed — Select text below manually`), iterative Stage 2 re-scoring from Stage 3, and `CONTEXT.md` update
  - Surfaced by: DX Review Passes 3–5 & Independent DX Reviewer Findings 1, 4, 5, 6
  - Files: `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`, `CONTEXT.md`, `tests/workbench-shell.test.tsx`
  - Verify: `npm test && npm run build`

#### Phase 2.5 Decision Audit Trail
| # | Phase | Decision | Principle | Classification | Rationale | Rejected |
|---|-------|----------|-----------|----------------|-----------|----------|
| 13 | DX | Define explicit `mode: 'unassessed' \| 'loading' \| 'audit' \| 'completed'` on `MeddpiccScorecard` and `animateStagger?: boolean` on `TenSegmentBarProps` | P1 + P5 | Mechanical | Prevents boolean prop soup and stops Stage 2 keystrokes from re-triggering Stage 3's `40ms` staggered bar animation | Implicit boolean flags |
| 14 | DX | Wrap Stage 3 `Copy Next Steps` `navigator.clipboard.writeText` in `try/catch` with inline `Copy Failed — Select text below manually` fallback status | P1 + P2 | Mechanical | Prevents unhandled promise rejections or false positive copy feedback in non-HTTPS/restricted contexts | Unguarded `clipboard.writeText` |
| 15 | DX | Enforce structured Problem + Cause + Fix (`Retry`, `Dismiss`, Simulation Mode hint) on the inline `.workbench-right` `role="alert"` banner replacing `Banners.tsx` | P1 + P2 | Mechanical | Preserves actionable diagnostics when retiring `Banners.tsx` | Raw error string alert |
| 16 | DX | Keep Stage 2 inputs and `Submit Findings & Re-Score Deal →` enabled during retrospective inspection from Stage 3 alongside `Return to Updated Assessment (Stage 3) →` | P1 + P5 | Mechanical | Gives SAs and developers an escape hatch to iteratively tweak discovery answers and re-score without wiping state | Read-only locked Stage 2 after completion |
| 17 | DX | Extract `STAGE_GATE_THRESHOLD = 75` constant and update `CONTEXT.md` to reflect retired sidebar/banner components | P4 + P5 | Mechanical | Eliminates magic numbers across Stage 1/3 headers and keeps `CONTEXT.md` synchronized with the codebase | Hardcoded `75` and stale `CONTEXT.md` |

---

### Phase 3: Eng Review (Architecture, Code Quality, Tests & Performance)

#### Step 0: Scope Challenge & Reality Verification
- **Scope Challenge Result**: `scope accepted as-is` (`MODE: FULL_REVIEW`). The plan touches 7 existing implementation files (`StepperBar.tsx`, `DealContextCard.tsx`, `MeddpiccScorecard.tsx`, `DynamicDiscoveryForm.tsx`, `QualificationWorkbench.tsx`, `LiveQualificationWorkbench.tsx`, `lib/simulation/simulation-engine.ts` + `lib/assessment-results.ts`), deletes 4 superseded sidebar/banner files (`StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, `Banners.tsx`), updates 3 test files (`tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`), and updates `CONTEXT.md`. Zero new services or classes are introduced.
- **Search Before Building Classification**:
  - **[Layer 1]** Reuse existing `MeddpiccScorecard` (`TenSegmentBar`), `TopNavBar` Settings popover, `useEveAgent` (`lib/assessment-results.ts`), and `simulationReducer` (`lib/simulation/simulation-engine.ts`).
  - **[Layer 3]** First-principles stage view decoupling (`activeStageView: 'blank' | 'stage1' | 'stage2' | 'stage3'` guarded by `prevWorkflowStateRef`) so the 2-stage pause inside `PENDING_FEEDBACK` (`Stage 1 Initial Deal Audit` vs `Stage 2 Field Discovery Checklist`) never snaps back on React re-renders.
- **Prior Learnings Applied**:
  - `Prior learning applied: desk_os_layout_spec (confidence 9/10, from 2026-10-21)`
  - `Prior learning applied: legacy-cleanup-test-retargeting (confidence 9/10, from 2026-10-21)`

#### Reality Rows (Eng)
REALITY: premise-table pass Verified all component interfaces and reducer contracts (`components/workbench/StepperBar.tsx:7-26`, `components/workbench/MeddpiccScorecard.tsx:7-72`, `components/workbench/DynamicDiscoveryForm.tsx:20-55`, `lib/simulation/simulation-engine.ts:299-303`, `lib/assessment-results.ts:104-149`, `tests/workbench-shell.test.tsx:48-260`); unverified=0. components/workbench/MeddpiccScorecard.tsx:7-72
REALITY: already-done pass Checked `git log origin/mvp` (`7a00653`); Desk OS 3-stage split-workbench and Stage 3 Next Steps header lockup are not yet on `origin/mvp`. components/workbench/LiveQualificationWorkbench.tsx:449-489
REALITY: surface-check pass Verified `npm test` (`vitest run`) and `npm run build` (`next build`) in `package.json:5-12`. package.json:5-12
REALITY: binding-decisions pass Verified `DESIGN.md:80-146` and prior branch decisions; all CEO, Design, and DX decisions are preserved without contradiction. DESIGN.md:80-146
REALITY: numbers pass Verified Acme simulation baseline `54` and re-scored `76` (`+22`) in `lib/fixtures/simulation/acme_migration.json:12-185` (`[measured: lib/fixtures/simulation/acme_migration.json]`) and Live test fixture `56` -> `89` in `tests/workbench-shell.test.tsx:77-142` (`[measured: tests/workbench-shell.test.tsx]`). lib/fixtures/simulation/acme_migration.json:12-185
REALITY: deferred-asks pass All Issue #24 requirements are included; only optional global `1`/`2`/`3` keyboard shortcuts remain deferred in `TODOS.md` ("avoid input capture conflicts with active form controls"). TODOS.md:1-19
REALITY: pr-count pass Single atomic PR wave (`pr_count=1`) for Issue #24. .scratch/deal-qualification/issues/24-desk-os-workbench-layout.md:1-8
PLAN_REALITY: phase=eng rows=7/7 missing=none verdict=complete

#### Step 0.5: Eng Dual Voices Consensus Table
- **Codex SAYS (eng — architecture challenge)**: `unavailable` (`codex` CLI `not_installed`).
- **agy2 (in-host) SUBAGENT (eng — independent review)**: Completed (`7b1bb4a5-8c47-441f-907d-60f08148ea49`) with 9 findings (`[ENG-1]`–`[ENG-9]`: 4 High, 3 Medium, 2 Low), all resolved in `<!-- autoplan-accepted:eng -->`.

```
ENG DUAL VOICES — CONSENSUS TABLE:
  Dimension                           agy2 (in-host)  Codex  Consensus
  1. Architecture sound?               ISSUES (Fixed)  N/A    N/A
  2. Test coverage sufficient?         ISSUES (Fixed)  N/A    N/A
  3. Performance risks addressed?      YES             N/A    N/A
  4. Security threats covered?         YES             N/A    N/A
  5. Error paths handled?              ISSUES (Fixed)  N/A    N/A
  6. Deployment risk manageable?       YES             N/A    N/A
CONFIRMED = native + outside agree; primary cannot replace outside. DISAGREE → taste.
Missing/disabled voice = N/A, never CONFIRMED. Flag any single-voice critical finding.
```

#### Section 1: Architecture Review
- **Findings**:
  1. `[P1] (confidence: 10/10) lib/simulation/simulation-engine.ts:299-303 & components/workbench/LiveQualificationWorkbench.tsx:301-341 — Retrospective Stage 2 re-submission and form hydration across Simulation vs. Live modes ([ENG-1])`:
     - In `lib/simulation/simulation-engine.ts:299`, `case 'SUBMIT_FEEDBACK': if (state.workflowState !== 'PENDING_FEEDBACK') return state;` silently drops re-submissions when `workflowState === 'COMPLETED'`.
     - In `LiveQualificationWorkbench.tsx:341`, `dynamicForm` was gated by `workflowState === 'PENDING_FEEDBACK'`, causing Stage 2 to lose `view.system2Result?.phase3Form` once `workflowState === 'COMPLETED'`, and Live Eve sessions (`view.phase === 'closed'`) have `pendingInput: null`.
     - **Disposition**: Accepted (`#18` in Audit Trail). Update `simulationReducer` to accept `SUBMIT_FEEDBACK` from `'PENDING_FEEDBACK' | 'COMPLETED'`, compute `dynamicForm = view.system2Result?.phase3Form ?? null` ungated in `LiveQualificationWorkbench.tsx`, and set `readOnly={workflowState === 'COMPLETED'}` in Live Mode retrospective Stage 2 (where the single-turn Eve workflow is already closed) while keeping Simulation Mode retrospective Stage 2 editable for iterative re-scoring.
  2. `[P1] (confidence: 9/10) components/workbench/LiveQualificationWorkbench.tsx:160-210 — Two user-facing stages ('stage1' and 'stage2') share one engine state ('PENDING_FEEDBACK') ([ENG-2])`:
     - Deriving `activeStageView` naively on every render when `workflowState === 'PENDING_FEEDBACK'` would snap users back from `'stage2'` to `'stage1'`.
     - **Disposition**: Accepted (`#19` in Audit Trail). Track `prevWorkflowStateRef` so `activeStageView` transitions to `'stage1'` only when `workflowState` *enters* `'PENDING_FEEDBACK'` (from `'ANALYZING'` or initial mount in `'PENDING_FEEDBACK'`), while user actions (`Answer {N} Discovery Questions →`, `Proceed to Stage 2: Field Discovery →`, Stepper Stage 2, `← Back to Audit`, `Cancel`) toggle `activeStageView` between `'stage1'` and `'stage2'` deterministically.

##### Architecture Dependency & Data Flow Diagram
```
                       +-------------------------------------------+
                       |                app/page.tsx               |
                       |   (Mode Switch: Simulation vs Live AI)    |
                       +---------------------+---------------------+
                                             |
                   +-------------------------+-------------------------+
                   |                                                   |
                   v                                                   v
+-------------------------------------+             +-------------------------------------+
|     QualificationWorkbench.tsx      |             |   LiveQualificationWorkbench.tsx    |
|  (useReducer: simulationReducer)    |             |  (useEveAgent: assessmentReducer)   |
|  - SUBMIT_FEEDBACK allowed in       |             |  - Preserves baselineJevResult      |
|    PENDING_FEEDBACK | COMPLETED     |             |  - Ungated dynamicForm from system2 |
+------------------+------------------+             +------------------+------------------+
                   |                                                   |
                   +-------------------------+-------------------------+
                                             |
                   +-------------------------v-------------------------+
                   |           Desk OS Shared Shell Structure          |
                   |  1. TopNavBar (Scenario, Mode, Settings Dialog)   |
                   |  2. StepperBar (3 Stages + aria-current="step")   |
                   |  3. .workbench-shell (.monochrome-top-bar +       |
                   |     .workbench-split grid-cols-[35%_65%])         |
                   +------------+-------------------------+------------+
                                |                         |
        +-----------------------v------+           +------v-----------------------+
        |   .workbench-left (35%)      |           |   .workbench-right (65%)     |
        |   DealContextCard.tsx        |           |   Stage Canvas Router:       |
        |   - 2x2 Opportunity Grid     |           |   - Inline Alert Banner      |
        |   - Competitor Callout       |           |   - Stage 1/3 Header Lockup  |
        |   - <details> (<lg) /        |           |   - NextSteps Action Card    |
        |     max-h-[680px] (lg+)      |           |   - MeddpiccScorecard        |
        |     AE & SA Briefs           |           |     (unassessed|loading|     |
        +------------------------------+           |      audit|completed)        |
                                                   |   - DynamicDiscoveryForm     |
                                                   |     (embeds TenSegmentBar)   |
                                                   +------------------------------+
```

#### Section 2: Code Quality & Shared-Code Evaluation
- **Findings**:
  1. `[P1] (confidence: 10/10) lib/types/crm.ts & components/workbench/ActionPanel.tsx:14 — NextSteps type mismatch: suggestedNextSteps is string | null, not string[] ([ENG-3])`:
     - Calling `assessment.NextSteps.map(...)` on a `string` (such as `"[QUALIFIED] Run POC | Owner: AE | Focus: ISR | Watch: Netlify"` in `tests/workbench-shell.test.tsx:134` or `acme_migration.json`) throws `TypeError: nextSteps.map is not a function`.
     - **Disposition**: Accepted (`#20` in Audit Trail). Implement a shared `formatNextSteps(val: string | string[] | null | undefined): { items: string[]; copyText: string }` helper that handles both `string` and `string[]` cleanly (preserving the exact string text in DOM so `screen.getByText(steps)` in `tests/workbench-shell.test.tsx:141` passes AND formatting clean clipboard text).
  2. `[P2] (confidence: 9/10) lib/assessment-results.ts:104-108 & components/workbench/LiveQualificationWorkbench.tsx:70-120 — Live Mode overwrites baseline jevResult on rescore, losing per-dimension previousScore and delta ([ENG-4])`:
     - **Disposition**: Accepted (`#21` in Audit Trail). Preserve `baselineJevResult` on `AssessmentView` when `p.round === 'baseline'` in `lib/assessment-results.ts` and pass `baselineJevResult?.dimensions` into `formatDimensionsForScorecard()` in `LiveQualificationWorkbench.tsx` so Stage 3 renders per-dimension `previousScore` and `delta` (`prev → curr / 10 (+Δ)`) even after `localStorage` session replay.
  3. `[P2] (confidence: 9/10) components/workbench/LiveQualificationWorkbench.tsx:240-315 — Distinguishing transient sendError from closed/failed Eve stream in Stage 2 retry ([ENG-5] & [ENG-7])`:
     - **Disposition**: Accepted (`#21` in Audit Trail). When `sendError` occurs while `view.pendingInput` is still open, `Retry` re-submits `handleSubmitFeedback(savedFormData, savedManualNotes)`; when `view.phase === 'failed'` (`pendingInput === null`), retain `savedFormData` and `savedManualNotes` in memory and render `Start Assessment` / `Re-run Assessment` (`aria-label` compatible with `tests/workbench-shell.test.tsx:150,157,219`) while preserving verbatim alert prefixes (`Writeback failed:`, `Assessment failed:`, `Could not resume`) capped at 300 chars as plain React text nodes.
  4. `[P2] (confidence: 9/10) components/workbench/DynamicDiscoveryForm.tsx:48-85 — Avoid useEffect draft sync loops and miscounting empty strings in Answered {K} of {N} ([ENG-8])`:
     - **Disposition**: Accepted (`#22` in Audit Trail). Call `onDraftChange?.(nextFormData, nextManualNotes)` directly inside `handleTextChange`, `handleCheckboxToggle`, and the manual notes `onChange` handler, and compute `{K}` by counting fields whose value in `formData[field.id]` is a non-empty trimmed string (`val.trim().length > 0`) or non-empty array (`val.length > 0`).
- **Shared-Code Evaluation Rubric**:
  - **Callers Proven**: `components/workbench/QualificationWorkbench.tsx:208-250` and `components/workbench/LiveQualificationWorkbench.tsx:449-489` both render the Desk OS `.workbench-shell` top deal header bar, Stage 1/3 composite score lockup (`STAGE_GATE_THRESHOLD = 75`), and Stage 3 Suggested Next Steps card (`formatNextSteps` + `Copy Next Steps` button).
  - **Helper & Line Accounting**: Co-locating or sharing lightweight Desk OS presentation helpers (`STAGE_GATE_THRESHOLD`, `formatNextSteps`, and stage header/next-steps lockup markup) while deleting `StageGateCard.tsx` (104 lines), `DealSummaryCard.tsx` (98 lines), `ActionPanel.tsx` (68 lines), and `Banners.tsx` (112 lines) removes ~382 lines of superseded sidebar/banner code and adds ~140 lines of unified Desk OS shell/header code (net savings: ~242 implementation lines).

#### Section 3: Test Review (Never Skip or Compress)
- **Test Framework Detected**: Vitest + React Testing Library (`happy-dom`, `npm test` -> `vitest run` in `package.json`).
- **Regression Rule Analysis (`[ENG-6]`)**:
  - Read `tests/workbench-shell.test.tsx:1-308` in full. Identified 5 existing test assertions that must be preserved or updated deliberately:
    1. `tests/workbench-shell.test.tsx:58,150,157,163,219`: Queries `getByRole('button', { name: /Start Assessment|Re-run Assessment/i })`. In Blank Start and failed states, include `Start Assessment` in the button's accessible label/text (`Run MEDDPICC Deal Audit — Start Assessment`) and `Evaluating Opportunity` when `status === 'submitted'` (`line 170`).
    2. `tests/workbench-shell.test.tsx:68,82-86`: Expects `System 1 scoring + System 2 reasoning in progress` during `assessing`, and when `jevResult` arrives (`overallScore: 56`, `system2Running: true`), expects `role="status"` (`System 2 analysis running`) and score `56` in the DOM. In `LiveQualificationWorkbench`, when `phase === 'assessing'` and `view.jevResult` is already populated, render the arrived Jev scores in `MeddpiccScorecard` alongside the `System 2 analysis running…` status pill.
    3. `tests/workbench-shell.test.tsx:100-131`: Tests `phase: 'awaiting_feedback'`. Because Stage 1 (`MeddpiccScorecard`) and Stage 2 (`DynamicDiscoveryForm`) are now separate views in the 65% right pane (`activeStageView: 'stage1'` vs `'stage2'`), update these 2 tests to assert Stage 1 (`56 / 100`, evidence & gaps) first and click `Answer {N} Discovery Questions →` (or Stage 2 in `StepperBar`) to fill `Who signs?` and click `Submit Discovery Findings`.
    4. `tests/workbench-shell.test.tsx:133-143`: Expects `screen.getByText(steps)` and `/Qualification Finalized \(89\/100\)/` when `phase === 'closed'`. Render the raw `suggestedNextSteps` string inside the Suggested Next Steps card and include `Qualification Finalized ({score}/100)` in the Stage 3 status subtitle/aria-label.
    5. `tests/workbench-shell.test.tsx:145-165,204-220`: Expects `role="alert"` text matching `/Writeback failed:.*Jev 402 payment required/`, `/Assessment failed:.*HTTP 401 Unauthorized/`, `/Could not resume.*The session is no longer active\./`, and `/older version of the agent.*Start a new assessment/`. Preserve these exact diagnostic strings inside the Problem + Cause + Fix inline alert banner.

##### ASCII Codepath & User-Flow Coverage Diagram
```
CODE PATHS                                                      USER FLOWS
[+] components/workbench/StepperBar.tsx                         [+] 3-Stage Desk OS Navigation
  ├── StepperBar(activeStageView, workflowState, onSelectStage)   ├── [★★★ TESTED] Blank → Stage 1 → Stage 2 → Stage 3
  │   ├── [★★★ TESTED] Stage 1/2/3 active + aria-current="step"   ├── [★★★ TESTED] Stage 2 ← Back to Audit / Cancel preserves
  │   ├── [★★★ TESTED] Locked future stages disabled              │                savedFormData + savedManualNotes
  │   └── [★★★ TESTED] Locked Stage 1/2 on direct COMPLETED resume└── [★★★ TESTED] Stage 3 → Stage 1 retrospective view shows
                                                                                   true baselineAssessment snapshot
[+] components/workbench/MeddpiccScorecard.tsx
  ├── TenSegmentBar(score, animateStagger)                      [+] Stage 1 & Stage 3 Scorecard States
  │   ├── [★★★ TESTED] 10 ticks + role="meter" + aria-valuenow    ├── [★★★ TESTED] Blank Start (-- / 100, unassessed 8 rows)
  │   └── [★★★ TESTED] 40ms transitionDelay + motion-reduce       ├── [★★★ TESTED] Loading shimmer + progressive Jev 56/100
  └── MeddpiccScorecard(mode, score, previousScore, delta)        ├── [★★★ TESTED] Stage 1 <75 blocker pill & #F1F0EC rows
      ├── [★★★ TESTED] mode='unassessed' (--/10)                  └── [★★★ TESTED] Stage 3 prev→curr/100 (+Δ) & ≥75 vs <75 pill
      ├── [★★★ TESTED] mode='loading' shimmer rows
      ├── [★★★ TESTED] mode='audit' Open Gap / Blind Spot       [+] Stage 2 Discovery Form & Drafts
      └── [★★★ TESTED] mode='completed' Resolved + prev→curr/10   ├── [★★★ TESTED] Embedded static TenSegmentBar per card
                                                                  ├── [★★★ TESTED] Answered {K} of {N} non-empty counter
[+] components/workbench/DynamicDiscoveryForm.tsx                 └── [★★★ TESTED] Sim iterative re-score vs Live readOnly
  ├── handleTextChange / handleCheckboxToggle / notes onChange
  │   └── [★★★ TESTED] Direct onDraftChange(answers, notes)     [+] Stage 3 Next Steps & Error Recovery
  └── validate() & handleSubmit()                                 ├── [★★★ TESTED] Copy Next Steps (string | string[]) +
      └── [★★★ TESTED] Required field validation + payload        │                2000ms ✓ Copied & try/catch error fallback
                                                                  └── [★★★ TESTED] Inline role="alert" Problem+Cause+Fix banner
[+] lib/simulation/simulation-engine.ts & assessment-results.ts                    + Abort / Retry / Start Assessment recovery
  ├── simulationReducer(SUBMIT_FEEDBACK in PENDING | COMPLETED)
  │   └── [★★★ TESTED] Iterative re-scoring in Simulation Mode
  └── assessmentReducer(round='baseline' -> baselineJevResult)
      └── [★★★ TESTED] Per-dimension previousScore & delta in Live

LLM integration: No prompt/YAML/model changes (out of scope — UI & client state refactor only).

COVERAGE: 18/18 paths planned & covered (100%)  |  Code paths: 10/10 (100%)  |  User flows: 8/8 (100%)
QUALITY: ★★★:18 ★★:0 ★:0  |  GAPS: 0 (all gaps converted into explicit test requirements in TC-1..TC-3)
```

- **Test Plan Artifact Written to Disk**:
  `/Users/brandonwarwick/.gstack/projects/BrandonCW-vercel-sam-demo/brandonwarwick-gstack-review-eng-review-test-plan-20261021-210937.md`

#### Section 4: Performance Review
- **Findings**:
  1. `[P3] (confidence: 8/10) components/workbench/MeddpiccScorecard.tsx:34-45 — Scope inline 40ms transitionDelay strictly to animateStagger={true} (mode === 'completed') with motion-reduce:!delay-0 ([ENG-9])`:
     - **Scale**: 8 rows $\times$ 10 ticks = 80 `<span>` nodes in `MeddpiccScorecard` plus $N \times 10$ ticks in `DynamicDiscoveryForm`. Scoping `transitionDelay` strictly to `animateStagger={true}` (`mode === 'completed'`) and calling `onDraftChange` in event handlers prevents unnecessary style recalculations or delayed unfill animations when switching stages or typing in Stage 2.
     - **Disposition**: Accepted (`#23` in Audit Trail).
  - **Database / Network / Memory**: Zero new API calls or database queries; `setTimeout` timers for `Copy Next Steps` (`2000ms` / `3000ms`) and `setInterval` timers for `elapsedSeconds` (`1000ms`) are cleaned up on component unmount.

#### NOT in scope (Eng)
- Backend Eve agent YAML definitions, SSE route handlers (`app/api/`), or Postgres schema changes.
- Global `1`/`2`/`3` keyboard shortcut listeners (deferred to `TODOS.md`).

#### What already exists (Eng)
- `lib/assessment-results.ts` (`assessmentReducer`) and `lib/simulation/simulation-engine.ts` (`simulationReducer`) already manage the core Live and Simulation state transitions; extending `baselineJevResult` and `SUBMIT_FEEDBACK` (`'PENDING_FEEDBACK' | 'COMPLETED'`) requires <15 lines across both reducers.
- `components/workbench/MeddpiccScorecard.tsx`, `DynamicDiscoveryForm.tsx`, `DealContextCard.tsx`, `StepperBar.tsx`, and `TopNavBar.tsx` already exist and are refactored in place.

#### Failure Modes Registry (Eng)
| Codepath / Flow | Realistic Production Failure | Rescued? | Test Coverage | User Sees | Critical Gap? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `LiveQualificationWorkbench` (`ANALYZING` / `EVALUATING`) | Eve SSE stream disconnects, HTTP 401/402/500, or user clicks `Abort` | Yes | `tests/workbench-shell.test.tsx` | Inline `role="alert"` Problem+Cause+Fix banner with `Start Assessment` / `Retry` / `Dismiss` | No |
| `LiveQualificationWorkbench` (`EVALUATING` transient `sendError`) | `agent.respond` rejects before stream closes (`pendingInput` still open) | Yes | `tests/workbench-shell.test.tsx` | Returns to Stage 2 with `savedFormData` + `savedManualNotes` intact and `Retry` button | No |
| `Stage 3 NextSteps Copy` (`handleCopyNextSteps`) | `suggestedNextSteps` is a `string` (not array) or `navigator.clipboard.writeText` rejects | Yes | `tests/workbench-shell.test.tsx` & `tests/qualification-workbench.test.tsx` | `formatNextSteps` normalizes string/array; rejected copy shows `Copy Failed — Select text below manually` (`role="status"`) | No |
| `LiveQualificationWorkbench` (`localStorage` session resume in `COMPLETED`) | Replayed session overwrote `view.jevResult` with `rescore` or has no prior baseline | Yes | `tests/workbench-shell.test.tsx` | `baselineJevResult` preserves Stage 1 baseline; if absent, falls back to `{score} / 100` and locks Stage 1/2 tabs | No |
| `DynamicDiscoveryForm` (`Stage 2 <-> Stage 1` round-trip) | User types answers + manual SA notes, clicks `← Back to Audit`, then returns to Stage 2 | Yes | `tests/qualification-workbench.test.tsx` & `tests/dynamic-form-renderer.test.tsx` | `savedFormData` and `savedManualNotes` (`initialNotes`) restored with accurate `Answered {K} of {N}` count | No |

Critical Gaps Flagged: **0**.

#### Worktree Parallelization Strategy
Sequential implementation, no parallelization opportunity (`components/workbench/` and `tests/` share tightly coupled props across `MeddpiccScorecard`, `DynamicDiscoveryForm`, `StepperBar`, `QualificationWorkbench`, and `LiveQualificationWorkbench`). Recommended single-worktree execution order:
1. Update `lib/simulation/simulation-engine.ts` (`SUBMIT_FEEDBACK` in `COMPLETED`) and `lib/assessment-results.ts` (`baselineJevResult`).
2. Update leaf workbench components (`StepperBar.tsx`, `DealContextCard.tsx`, `MeddpiccScorecard.tsx` + `TenSegmentBar`, `DynamicDiscoveryForm.tsx`).
3. Refactor `QualificationWorkbench.tsx` and `LiveQualificationWorkbench.tsx` into the Desk OS 35%/65% split shell, verify all tests, delete `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx`, and update `CONTEXT.md`.

#### Eng Implementation Tasks
- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — State Machine, Baseline Snapshot & `NextSteps` Normalization — Support `SUBMIT_FEEDBACK` from `COMPLETED` in `simulationReducer`, preserve `baselineJevResult` in `assessmentReducer` for Live dimension deltas, guard `PENDING_FEEDBACK` `'stage1'`/`'stage2'` sync via `prevWorkflowStateRef`, and normalize `string | string[]` `suggestedNextSteps`
  - Surfaced by: Eng Review Sections 1–2 & Independent Eng Reviewer Findings ENG-1, ENG-2, ENG-3, ENG-4, ENG-5
  - Files: `lib/simulation/simulation-engine.ts`, `lib/assessment-results.ts`, `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`
  - Verify: `npm test -- tests/workbench-shell.test.tsx tests/qualification-workbench.test.tsx`
- [ ] **T2 (P1, human: ~2h / CC: ~10min)** — Discovery Draft Event Handlers & Regression Test Suite — Emit `onDraftChange` directly in `DynamicDiscoveryForm` input handlers, compute non-empty `Answered {K} of {N}`, preserve progressive Jev score display in Live `assessing`, scope `TenSegmentBar` `transitionDelay` with `motion-reduce:!delay-0`, and update `workbench-shell`, `qualification-workbench`, and `dynamic-form-renderer` tests
  - Surfaced by: Eng Review Sections 2–4 & Independent Eng Reviewer Findings ENG-6, ENG-7, ENG-8, ENG-9
  - Files: `components/workbench/DynamicDiscoveryForm.tsx`, `components/workbench/MeddpiccScorecard.tsx`, `tests/workbench-shell.test.tsx`, `tests/qualification-workbench.test.tsx`, `tests/dynamic-form-renderer.test.tsx`
  - Verify: `npm test && npm run build`

#### Suppressed Findings Appendix
- None (all 9 engineering findings scored confidence 8–10/10 and were addressed directly in the main report).

#### Eng Completion Summary
- **Step 0: Scope Challenge** — `scope accepted as-is` (`FULL_REVIEW`)
- **Reality rows** — `7/7` applicable rows emitted (`PLAN_REALITY: phase=eng rows=7/7 missing=none verdict=complete`), `0` unverified premises
- **Architecture Review** — `2` issues found and resolved (`ENG-1` retrospective Stage 2 re-scoring in Sim vs Live, `ENG-2` `prevWorkflowStateRef` guard for `PENDING_FEEDBACK`)
- **Code Quality Review** — `4` issues found and resolved (`ENG-3` `string | null` `nextSteps` normalization, `ENG-4` `baselineJevResult` preservation, `ENG-5`/`ENG-7` Live error recovery & 300-char cause cap, `ENG-8` event-driven `onDraftChange` & non-empty `Answered {K} of {N}` count)
- **Test Review** — diagram produced, `1` regression-contract alignment item (`ENG-6` `tests/workbench-shell.test.tsx` Stage 1/2 split & progressive Jev score display) resolved, `0` remaining gaps, Test Plan Artifact written to `/Users/brandonwarwick/.gstack/projects/BrandonCW-vercel-sam-demo/brandonwarwick-gstack-review-eng-review-test-plan-20261021-210937.md`
- **Performance Review** — `1` polish item resolved (`ENG-9` scoping `transitionDelay` to `animateStagger={true}` with `motion-reduce:!delay-0`)
- **NOT in scope** — written
- **What already exists** — written
- **TODOS.md updates** — `1` item persisted across all phases (focus-guarded `1`/`2`/`3` keyboard shortcuts in `TODOS.md`)
- **Failure modes** — `0` critical gaps flagged
- **Unresolved decisions** — `0` in this review
- **Outside voice** — `codex` unavailable (`not_installed`); `agy2 (in-host)` native subagent completed (`9` findings, all resolved)
- **Parallelization** — `1` sequential lane (`0` parallel / `1` sequential)
- **Lake Score** — `6/6` engineering decisions chose the complete `10/10` option

#### Phase 3 Decision Audit Trail
| # | Phase | Decision | Principle | Classification | Rationale | Rejected |
|---|-------|----------|-----------|----------------|-----------|----------|
| 18 | Eng | Support `SUBMIT_FEEDBACK` from `COMPLETED` in `simulationReducer`, ungated `dynamicForm` in `LiveQualificationWorkbench`, and `readOnly={true}` for closed Live sessions in retrospective Stage 2 | P1 + P5 | Mechanical | Fixes `[ENG-1]` where `simulationReducer` ignored re-submissions in `COMPLETED` and Live `closed` sessions lacked `pendingInput` | Calling `agent.respond` on a closed Live session |
| 19 | Eng | Guard `activeStageView` (`'stage1'` vs `'stage2'`) transitions during `PENDING_FEEDBACK` with `prevWorkflowStateRef` | P5 | Mechanical | Fixes `[ENG-2]` so re-renders while `workflowState === 'PENDING_FEEDBACK'` never snap the user back from Stage 2 to Stage 1 | Unconditional `useEffect([workflowState])` reset |
| 20 | Eng | Normalize `suggestedNextSteps` (`string \| string[] \| null`) via `formatNextSteps` helper instead of calling `.map()` directly | P1 + P5 | Mechanical | Fixes `[ENG-3]` runtime `TypeError` since `suggested_next_steps` in `crm.ts` and `acme_migration.json` is a `string \| null` | Assuming `NextSteps` is always `string[]` |
| 21 | Eng | Preserve `baselineJevResult` (`round === 'baseline'`) in `lib/assessment-results.ts` for Live Stage 3 dimension deltas and distinguish transient `sendError` from terminal stream failure | P1 + P2 | Mechanical | Fixes `[ENG-4]` and `[ENG-5]` so Live Mode Stage 3 renders `prev → curr / 10 (+Δ)` even after session resume and never calls `respond()` when `pendingInput` is null | Losing baseline dimension scores on `rescore` |
| 22 | Eng | Trigger `onDraftChange` directly in `DynamicDiscoveryForm` input handlers, count non-empty answers for `Answered {K} of {N}`, and scope `TenSegmentBar` `transitionDelay` with `motion-reduce:!delay-0` | P1 + P5 | Mechanical | Fixes `[ENG-8]` and `[ENG-9]` to avoid `useEffect` render loops, empty-string miscounts, and unfill lag | `useEffect` draft sync and `Object.keys(formData).length` |
| 23 | Eng | Preserve progressive Jev score display when `system2Running === true` and align `tests/workbench-shell.test.tsx` with Stage 1 $\rightarrow$ Stage 2 navigation and alert prefixes | P1 + P4 | Mechanical | Fixes `[ENG-6]` and `[ENG-7]` so all 16 existing `useEveAgent` contract tests in `tests/workbench-shell.test.tsx` pass alongside new Desk OS 3-stage assertions | Breaking existing `useEveAgent` streaming assertions |

Approval readiness: PASS (rows #1–#23 settled via `/autoplan` principles P1–P6).

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Select `SELECTIVE EXPANSION` mode | Mechanical | P1 + P3 | Core layout refactor is well-defined; cherry-picking in-blast-radius completeness fixes avoids scope bloat | `SCOPE EXPANSION`, `HOLD SCOPE` |
| 2 | CEO | Reconcile hardcoded `58 / 82` mockup numbers to dynamic `{score} / 100` (`54 → 76 (+22)` in Acme fixture) | Mechanical | P5 | Prevents test/implementation contradiction against `acme_migration.json` | Hardcoding `58 / 82` |
| 3 | CEO | Preserve both `savedFormData` and `savedManualNotes` (`initialNotes`) + separate `baselineAssessment` across stage navigation | Mechanical | P1 + P2 | Ensures non-destructive Stage 1 ↔ Stage 2 ↔ Stage 3 switching without losing SA notes or Stage 1 audit snapshot | Only saving `formData` |
| 4 | CEO | Preserve inline Live-mode error alert + `EVALUATING` abort inside `.workbench-right`, then delete `StageGateCard.tsx`, `DealSummaryCard.tsx`, `ActionPanel.tsx`, and `Banners.tsx` | Mechanical | P2 + P4 | Resolves Independent CEO Finding 2.1 (Critical) while eliminating dead sidebar components | Deleting error/abort handling or leaving dead files |
| 5 | CEO | Add CSS staggered per-tick transition delay (`40ms`) on `TenSegmentBar` with `motion-reduce:transition-none` | Taste | P1 + P5 | Implements `DESIGN.md` "The One Authored Moment" in 3 lines of CSS | Instant un-staggered fill |
| 6 | CEO | Defer global `1`/`2`/`3` stage hotkeys to `TODOS.md` while keeping standard `<button>` keyboard navigation on `StepperBar` | Taste (Disagreement with native outside voice) | P3 + P5 | Avoids single-key input capture edge cases with comboboxes while preserving full Tab/Enter accessibility | Global `1`/`2`/`3` keydown listener |
| 7 | Design | Differentiate Stage 1 top primary CTA (`#0F52BA`) from bottom summary footer strip (`#FAFAF7` with secondary action) | Mechanical | P5 | Matches `design-system-preview.html:985-1065` and avoids two competing primary buttons on an 8-row table | Duplicate `#0F52BA` primary buttons |
| 8 | Design | Render `EVALUATING` in-place on the 8-row `MeddpiccScorecard` shimmer ledger and return to `'stage2'` with draft intact on error/abort | Mechanical | P1 + P2 | Seamless transition into Stage 3's `40ms` staggered bar fill and zero lost user input on Live error | Centered spinner or losing Stage 2 draft on error |
| 9 | Design | Add conditional Stage 3 `< 75` warning pill, retrospective `Return to Updated Assessment (Stage 3) →` action, and `↺ Restart Walkthrough` reset to `'blank'` | Mechanical | P1 + P5 | Covers all non-happy-path Live scores and makes Stage 1/2 retrospective inspection unambiguous | Assuming Stage 3 is always `>= 75` |
| 10 | Design | Add `Answered {K} of {N}` progress counter in Stage 2 and `2000ms` `#15803D` clipboard feedback timer with unmount cleanup in Stage 3 | Mechanical | P1 + P5 | Gives clear form progress and deterministic clipboard test behavior | Unspecified copy payload/timeout |
| 11 | Design | Collapse AE/SA briefs behind `<details>` on `< lg` viewports and constrain desktop narrative scroll (`lg:max-h-[680px] lg:overflow-y-auto`) | Mechanical | P1 + P5 | Prevents long left-pane briefs from pushing mobile stage content below the fold or stretching desktop shell height | Unbounded left-pane height |
| 12 | Design | Enforce `aria-current="step"` on `StepperBar` and `role="status"` / `aria-live="polite"` on loading and clipboard state changes | Mechanical | P1 + P5 | Explicit screen-reader and keyboard wayfinding | Visual-only active stage indicators |
| 13 | DX | Define explicit `mode: 'unassessed' \| 'loading' \| 'audit' \| 'completed'` on `MeddpiccScorecard` and `animateStagger?: boolean` on `TenSegmentBarProps` | Mechanical | P1 + P5 | Prevents boolean prop soup and stops Stage 2 keystrokes from re-triggering Stage 3's `40ms` staggered bar animation | Implicit boolean flags |
| 14 | DX | Wrap Stage 3 `Copy Next Steps` `navigator.clipboard.writeText` in `try/catch` with inline `Copy Failed — Select text below manually` fallback status | Mechanical | P1 + P2 | Prevents unhandled promise rejections or false positive copy feedback in non-HTTPS/restricted contexts | Unguarded `clipboard.writeText` |
| 15 | DX | Enforce structured Problem + Cause + Fix (`Retry`, `Dismiss`, Simulation Mode hint) on the inline `.workbench-right` `role="alert"` banner replacing `Banners.tsx` | Mechanical | P1 + P2 | Preserves actionable diagnostics when retiring `Banners.tsx` | Raw error string alert |
| 16 | DX | Keep Stage 2 inputs and `Submit Findings & Re-Score Deal →` enabled during retrospective inspection from Stage 3 in Simulation Mode alongside `Return to Updated Assessment (Stage 3) →` | Mechanical | P1 + P5 | Gives SAs and developers an escape hatch to iteratively tweak discovery answers and re-score without wiping state | Read-only locked Stage 2 in Simulation Mode |
| 17 | DX | Extract `STAGE_GATE_THRESHOLD = 75` constant and update `CONTEXT.md` to reflect retired sidebar/banner components | Mechanical | P4 + P5 | Eliminates magic numbers across Stage 1/3 headers and keeps `CONTEXT.md` synchronized with the codebase | Hardcoded `75` and stale `CONTEXT.md` |
| 18 | Eng | Support `SUBMIT_FEEDBACK` from `COMPLETED` in `simulationReducer`, ungated `dynamicForm` in `LiveQualificationWorkbench`, and `readOnly={true}` for closed Live sessions in retrospective Stage 2 | Mechanical | P1 + P5 | Fixes `[ENG-1]` where `simulationReducer` ignored re-submissions in `COMPLETED` and Live `closed` sessions lacked `pendingInput` | Calling `agent.respond` on a closed Live session |
| 19 | Eng | Guard `activeStageView` (`'stage1'` vs `'stage2'`) transitions during `PENDING_FEEDBACK` with `prevWorkflowStateRef` | Mechanical | P5 | Fixes `[ENG-2]` so re-renders while `workflowState === 'PENDING_FEEDBACK'` never snap the user back from Stage 2 to Stage 1 | Unconditional `useEffect([workflowState])` reset |
| 20 | Eng | Normalize `suggestedNextSteps` (`string \| string[] \| null`) via `formatNextSteps` helper instead of calling `.map()` directly | Mechanical | P1 + P5 | Fixes `[ENG-3]` runtime `TypeError` since `suggested_next_steps` in `crm.ts` and `acme_migration.json` is a `string \| null` | Assuming `NextSteps` is always `string[]` |
| 21 | Eng | Preserve `baselineJevResult` (`round === 'baseline'`) in `lib/assessment-results.ts` for Live Stage 3 dimension deltas and distinguish transient `sendError` from terminal stream failure | Mechanical | P1 + P2 | Fixes `[ENG-4]` and `[ENG-5]` so Live Mode Stage 3 renders `prev → curr / 10 (+Δ)` even after session resume and never calls `respond()` when `pendingInput` is null | Losing baseline dimension scores on `rescore` |
| 22 | Eng | Trigger `onDraftChange` directly in `DynamicDiscoveryForm` input handlers, count non-empty answers for `Answered {K} of {N}`, and scope `TenSegmentBar` `transitionDelay` with `motion-reduce:!delay-0` | Mechanical | P1 + P5 | Fixes `[ENG-8]` and `[ENG-9]` to avoid `useEffect` render loops, empty-string miscounts, and unfill lag | `useEffect` draft sync and `Object.keys(formData).length` |
| 23 | Eng | Preserve progressive Jev score display when `system2Running === true` and align `tests/workbench-shell.test.tsx` with Stage 1 $\rightarrow$ Stage 2 navigation and alert prefixes | Mechanical | P1 + P4 | Fixes `[ENG-6]` and `[ENG-7]` so all 16 existing `useEveAgent` contract tests in `tests/workbench-shell.test.tsx` pass alongside new Desk OS 3-stage assertions | Breaking existing `useEveAgent` streaming assertions |

### Implementation Tasks (aggregated across phases)

- [ ] **T3 (P1, human: ~2h / CC: ~10min) — Stage Headers, Error Recovery & Scorecard Motion** — Inline dynamic Stage 1/3 score lockups, Live-mode inline error alert + EVALUATING abort button, 40ms staggered TenSegmentBar transition, and delete superseded sidebar/banner files
  - Surfaced by: ceo-review — CEO Review Section 2/11 & Independent CEO Finding 2.1/2.2
  - Files: components/workbench/MeddpiccScorecard.tsx, components/workbench/LiveQualificationWorkbench.tsx, components/workbench/StageGateCard.tsx, components/workbench/DealSummaryCard.tsx, components/workbench/ActionPanel.tsx, components/workbench/Banners.tsx
- [ ] **T2 (P1, human: ~2h / CC: ~10min) — StepperBar & Discovery State** — Implement 3-stage StepperBar, non-destructive activeStageView switching preserving savedFormData + savedManualNotes, and separate baselineAssessment snapshot
  - Surfaced by: ceo-review — CEO Review Section 4 & Independent CEO Finding 1.2
  - Files: components/workbench/StepperBar.tsx, components/workbench/DynamicDiscoveryForm.tsx, components/workbench/QualificationWorkbench.tsx, components/workbench/LiveQualificationWorkbench.tsx
- [ ] **T4 (P1, human: ~2h / CC: ~10min) — Workbench & Form Tests** — Update workbench-shell, qualification-workbench, and dynamic-form-renderer tests for Desk OS 3-stage progression, TenSegmentBar, initialNotes, and Next Steps clipboard
  - Surfaced by: ceo-review — CEO Review Section 6 & Step 0H Spec Review
  - Files: tests/workbench-shell.test.tsx, tests/qualification-workbench.test.tsx, tests/dynamic-form-renderer.test.tsx
- [ ] **T1 (P1, human: ~3h / CC: ~15min) — Workbench Shell & Split Layout** — Consolidate .workbench-shell, .monochrome-top-bar, and 35%/65% .workbench-split across QualificationWorkbench and LiveQualificationWorkbench
  - Surfaced by: ceo-review — CEO Review Section 1 & Independent CEO Finding 1.1/3.1
  - Files: components/workbench/QualificationWorkbench.tsx, components/workbench/LiveQualificationWorkbench.tsx, components/workbench/DealContextCard.tsx
- [ ] **T1 (P1, human: ~2h / CC: ~10min) — Stage 1/2/3 Interaction States & Retrospective UX** — Implement EVALUATING 8-row ledger shimmer, Stage 1/3 conditional qualification pills, Stage 2 progress counter, error fallback to active stage, and Stage 3 retrospective return CTA
  - Surfaced by: design-review — Design Review Passes 1-3 & Independent Design Reviewer Findings 2.1-3.1
  - Files: components/workbench/QualificationWorkbench.tsx, components/workbench/LiveQualificationWorkbench.tsx, components/workbench/MeddpiccScorecard.tsx, components/workbench/DynamicDiscoveryForm.tsx
- [ ] **T2 (P1, human: ~2h / CC: ~10min) — Discovery Draft Event Handlers & Regression Test Suite** — Emit onDraftChange directly in DynamicDiscoveryForm event handlers, compute non-empty Answered {K} of {N}, preserve progressive Jev score display in Live assessing, and update workbench-shell / qualification-workbench / dynamic-form-renderer tests
  - Surfaced by: eng-review — Eng Review Sections 2–4 & Independent Eng Reviewer Findings ENG-6, ENG-7, ENG-8, ENG-9
  - Files: components/workbench/DynamicDiscoveryForm.tsx, components/workbench/MeddpiccScorecard.tsx, tests/workbench-shell.test.tsx, tests/qualification-workbench.test.tsx, tests/dynamic-form-renderer.test.tsx
- [ ] **T1 (P1, human: ~2h / CC: ~10min) — State Machine, Baseline Snapshot & NextSteps Normalization** — Support SUBMIT_FEEDBACK from COMPLETED in simulationReducer, preserve baselineJevResult for Live deltas, guard PENDING_FEEDBACK stage1/stage2 sync via prevWorkflowStateRef, and normalize string|string[] NextSteps
  - Surfaced by: eng-review — Eng Review Sections 1–2 & Independent Eng Reviewer Findings ENG-1, ENG-2, ENG-3, ENG-4, ENG-5
  - Files: lib/simulation/simulation-engine.ts, lib/assessment-results.ts, components/workbench/QualificationWorkbench.tsx, components/workbench/LiveQualificationWorkbench.tsx
- [ ] **T1 (P1, human: ~1.5h / CC: ~10min) — MeddpiccScorecard & TenSegmentBar API** — Define explicit mode union on MeddpiccScorecard, static vs staggered TenSegmentBarProps, and STAGE_GATE_THRESHOLD = 75 constant
  - Surfaced by: devex-review — DX Review Pass 2 & Independent DX Reviewer Findings 2 & 6
  - Files: components/workbench/MeddpiccScorecard.tsx, components/workbench/DynamicDiscoveryForm.tsx, components/workbench/QualificationWorkbench.tsx, components/workbench/LiveQualificationWorkbench.tsx
- [ ] **T2 (P2, human: ~1h / CC: ~5min) — Responsive Brief Disclosure & A11y Polish** — Add collapsible mobile/tablet disclosure and desktop max-h scroll container for AE/SA briefs in DealContextCard, aria-current=step on StepperBar, and 2000ms Copy Next Steps timer cleanup
  - Surfaced by: design-review — Design Review Passes 5-6 & Independent Design Reviewer Findings 1.1/5.1
  - Files: components/workbench/DealContextCard.tsx, components/workbench/StepperBar.tsx, components/workbench/QualificationWorkbench.tsx, components/workbench/LiveQualificationWorkbench.tsx
- [ ] **T2 (P2, human: ~1h / CC: ~5min) — Error Recovery, Clipboard Fallback & Architecture Docs** — Add Problem+Cause+Fix inline alert diagnostics, clipboard try/catch fallback, iterative Stage 2 re-scoring from Stage 3, and CONTEXT.md sync
  - Surfaced by: devex-review — DX Review Passes 3–5 & Independent DX Reviewer Findings 1, 4, 5, 6
  - Files: components/workbench/QualificationWorkbench.tsx, components/workbench/LiveQualificationWorkbench.tsx, CONTEXT.md, tests/workbench-shell.test.tsx

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 2 | CLEAR (PLAN via /autoplan) | 5 proposals, 4 accepted, 1 deferred |
| Outside Review | `agy2 (in-host)` (codex not_installed) | Independent 2nd opinion | 4 | completed (native fallback; no completed external review) | CEO: 7 findings (6 resolved, 1 deferred); Design: 10 findings (resolved); DX: 6 findings (resolved); Eng: 9 findings (resolved) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | CLEAR (PLAN via /autoplan) | 8 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | CLEAR (FULL via /autoplan) | score: 7/10 → 10/10, 6 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 2 | CLEAR (via /autoplan) | score: 7.8/10 → 10/10, TTHW: 3m → 2m |

- **OUTSIDE COVERAGE:** `codex` unavailable (`not_installed`, no completed external review); `agy2 (in-host)` native subagents completed Phase 1 (CEO: 7 findings), Phase 2 (Design: 10 findings), Phase 2.5 (DX: 6 findings), and Phase 3 (Eng: 9 findings, all resolved).
- **FINAL GATE APPROVAL:** APPROVED (`gate_rev=1`, reply `all` $\rightarrow$ `d1a`, `d2a`, `p1a` decided on `2026-10-21`).
- **VERDICT:** CEO + DESIGN + DX + ENG CLEARED & APPROVED — ready to implement.

NO UNRESOLVED DECISIONS
