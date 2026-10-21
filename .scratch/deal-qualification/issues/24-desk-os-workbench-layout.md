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
   - Allow users to click between unlocked stages (e.g., inspecting Stage 1 while in Stage 2 or Stage 3) without losing discovery form inputs.
3. **65% Right Pane — Seamless Stage & Loading Progression**:
   - **Blank Start State (Pre-Audit)**: When a deal is first loaded (`READY_TO_ASSESS` prior to audit), display `-- / 100` with pill `Stage Gate 2 · Unassessed Opportunity`, primary CTA `Run MEDDPICC Deal Audit →` (`#0F52BA`), and the 8-row MEDDPICC ledger in an unscored baseline state (`--/10` and empty 10-segment bars).
   - **Initial Assessment Loading (`ANALYZING`)**: In-place loading state inside the 65% right pane with live status header, elapsed timer, and subtle row shimmer over the 8 MEDDPICC rows (plus abort button in Live mode).
   - **Stage (1) Initial Deal Audit**: Renders `.stage-header-row` with composite score (`58 / 100`), Stage Gate blocker pill (`Stage Gate 2 · 3 Gaps Identified (Score < 75)`), and primary CTA `Answer N Discovery Questions →`, followed by the 8-row MEDDPICC table ledger with `#F1F0EC` recessed blocker rows and bottom summary CTA bar.
   - **Stage (2) Field Discovery Checklist**: Renders inside the 65% right pane (replacing the scorecard view while keeping `← Back to Audit` in the header). Each question card header embeds the target dimension's live 10-segment `TenSegmentBar` (`{Dimension} (Currently {score}/10)`). Bottom action bar provides `Cancel` (returns to Stage 1) and `Submit Findings & Re-Score Deal →`.
   - **Re-Scoring Loading (`EVALUATING`)**: In-place transition state inside the 65% right pane (`Synthesizing Discovery Findings & Re-Scoring Deal...`) before unveiling Stage 3.
   - **Stage (3) Updated Assessment & Next Steps**: Renders `.stage-header-row` with score progression (`58 → 82 / 100 (+24)`), cleared Stage Gate pill, and `↺ Restart Walkthrough` button; places the **Suggested Next Steps Action Block** (with 1-click `Copy Next Steps` / `✓ Copied to Clipboard` toggle) directly above the upgraded 8-row MEDDPICC ledger (`Resolved Status` column + inline `2 → 8 / 10 (+6)` score deltas).

## Scope
- **In Scope**:
  - Refactoring `components/workbench/LiveQualificationWorkbench.tsx` and `components/workbench/QualificationWorkbench.tsx` into the Desk OS 35%/65% split layout.
  - Refactoring `components/workbench/StepperBar.tsx` to the 3-stage Desk OS layout.
  - Updating `components/workbench/DealContextCard.tsx` for the persistent 35% left brief.
  - Embedding `TenSegmentBar` in `components/workbench/DynamicDiscoveryForm.tsx` question cards.
  - Integrating Blank Start, Initial Assessment Loading, Re-Scoring Loading, and Settings Popover into the Desk OS structure.
  - Updating unit and component tests in `tests/unit/`.
- **Out of Scope**:
  - Changes to backend API routes, Postgres schema, or Eve YAML agent definitions.

## Technical Details
| Component / File | Change Summary |
| :--- | :--- |
| `components/workbench/StepperBar.tsx` | Replace 5 engine steps with the 3 Desk OS stages (`1. Initial Deal Audit`, `2. Field Discovery Checklist`, `3. Updated Assessment & Next Steps`); support clicking unlocked stages and showing active loading indicators during `ANALYZING` / `EVALUATING`. |
| `components/workbench/DealContextCard.tsx` | Format as the persistent 35% left pane (`.workbench-left`): 2x2 Opportunity Metadata grid, Competitor Context callout, and scrollable AE Business Brief + SA Technical Assessment sections. |
| `components/workbench/MeddpiccScorecard.tsx` | Export `TenSegmentBar` for reuse in Stage 2; support `unassessed` baseline mode (Blank Start), `loading` shimmer mode, Stage 1 `Open Gap / Blind Spot` mode, and Stage 3 `Resolved Status` + inline transition (`prev → curr / 10 (+Δ)`) mode. |
| `components/workbench/DynamicDiscoveryForm.tsx` | Render Desk OS Stage 2 header (`Field Discovery Checklist` + `← Back to Audit` button), embed `TenSegmentBar` in each `.q-card-header`, include optional SA notes field, and render bottom `Cancel` + `Submit Findings & Re-Score Deal →` action bar. |
| `components/workbench/LiveQualificationWorkbench.tsx` & `QualificationWorkbench.tsx` | Implement `.workbench-shell` + `.workbench-split` (`35% / 65%`), manage `activeStageView` (`'blank' | 'stage1' | 'stage2' | 'stage3'`) synchronized with `WorkflowState`, and inline the Stage 1/3 header lockups and Stage 3 Suggested Next Steps card (retiring the detached 360px right sidebar). |

## Acceptance Criteria
- [ ] Workbench renders a unified `.workbench-shell` with a persistent 35% Opportunity Brief left column and a 65% dynamic stage canvas right column on desktop viewports.
- [ ] Top stepper displays the 3 Desk OS stages (`(1) Initial Deal Audit`, `(2) Field Discovery Checklist`, `(3) Updated Assessment & Next Steps`) and allows navigating between unlocked stages without losing discovery form state.
- [ ] Selecting an unassessed deal starts in the **Blank Start** state (`-- / 100`, unscored 8-row MEDDPICC table, `Run MEDDPICC Deal Audit →` CTA) and transitions through an in-place **Assessment Loading** state into Stage `(1)`.
- [ ] Stage `(1)` displays the composite score header (`58 / 100`), Stage Gate blocker pill, `Answer N Discovery Questions →` CTA, and the permanently open 8-row MEDDPICC ledger with recessed `#F1F0EC` blocker rows.
- [ ] Stage `(2)` renders in the 65% right pane with `← Back to Audit`, embeds the live 10-segment `TenSegmentBar` inside each discovery question card header, and transitions through an in-place **Re-Scoring Loading** state into Stage `(3)` upon submit.
- [ ] Stage `(3)` displays the score progression lockup (`58 → 82 / 100 (+24)`), the **Suggested Next Steps** card with working `Copy Next Steps` button above the scorecard, and the upgraded 8-row MEDDPICC ledger with `Resolved Status` and inline dimension score transitions (`2 → 8 / 10 (+6)`).
- [ ] `TopNavBar` Settings popover, Scenario selector, and Simulation/Live mode switching continue to function with full accessibility (`role="dialog"`, Escape/outside-click dismissal).
- [ ] All unit tests (`npm test`) and production build (`npm run build`) pass with zero errors.

## Test Plan
| Test Card | Target | Protects | Fails When | No Claim |
| :--- | :--- | :--- | :--- | :--- |
| **TC-1: Desk OS 3-Stage Stepper & Blank Start** | `tests/unit/workbench-shell.test.tsx` | Verifies Blank Start (`-- / 100`) $\rightarrow$ Loading $\rightarrow$ Stage 1 (`58 / 100`) $\rightarrow$ Stage 2 (`Field Discovery Checklist`) $\rightarrow$ Stage 3 (`58 → 82 / 100 (+24)`) progression and non-destructive `← Back to Audit` navigation. | Any stage fails to render in the 65% right pane or form values reset when toggling back to Stage 1. | Live LLM latency under network load. |
| **TC-2: Embedded 10-Segment Bars in Discovery Cards** | `tests/unit/dynamic-form-renderer.test.tsx` | Verifies each discovery question card header renders the target dimension label, current score, and 10-segment `TenSegmentBar`. | Question cards omit the 10-segment bar or render raw dimension keys. | Browser CSS pixel rendering. |
| **TC-3: Stage 3 Next Steps & Upgraded Ledger** | `tests/unit/workbench-shell.test.tsx` | Verifies Suggested Next Steps card renders above the scorecard in Stage 3 with working `Copy Next Steps` clipboard action and inline `prev → curr / 10 (+Δ)` dimension transitions. | Next Steps card is missing, below the table, or missing clipboard feedback. | Native OS clipboard permissions outside browser API. |
