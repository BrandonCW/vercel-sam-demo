---
# gstack: design-md-format=spec
name: Deal Qualification System
description: High-density, radical-monochrome B2B deal qualification workbench with precision MEDDPICC scoring
colors:
  primary: "#0F52BA"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  surface-canvas: "#F8F8F6"
  surface-recessed: "#F1F0EC"
  text: "#111215"
  text-secondary: "#52545D"
  text-muted: "#636772"
  text-faint: "#636772"
  border-hairline: "#E2E0D8"
  border-subtle: "#ECEAE3"
  border-focus: "#111215"
  accent: "#0F52BA"
  success: "#059669"
  warning: "#D97706"
  error: "#DC2626"
  score-blocker: "#DC2626"
  score-partial: "#D97706"
  score-verified: "#059669"
  score-unfilled: "#E5E5E0"
typography:
  display:
    fontFamily: Instrument Sans
    fontWeight: 700
    fontSize: clamp(1.25rem, 2vw, 1.75rem)
    letterSpacing: -0.025em
  body:
    fontFamily: Instrument Sans
    fontSize: 0.875rem
    lineHeight: 1.5
  label:
    fontFamily: Instrument Sans
    fontSize: 0.6875rem
    letterSpacing: 0.05em
  mono:
    fontFamily: Instrument Sans
    fontFeature: tnum
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#0C4196"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  input:
    borderColor: "{colors.border-hairline}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text}"
---

# Deal Qualification System

## Overview

**Creative North Star:** High-density, radical-monochrome architectural workspace where color is quarantined strictly to 10-segment MEDDPICC score indicators and primary actions, providing instant cognitive orientation for enterprise sales engineers and deal desk leaders.

**Product context:** B2B SaaS Deal Qualification Platform for Enterprise Solutions Architects (SAs) and Account Executives (AEs). Replaces ad-hoc spreadsheets and CRM free-text fields with a structured MEDDPICC qualification engine and bi-directional CRM writeback.

**Mode per surface:**
- **Persuade:** Not applicable (pure internal enterprise daily driver; marketing landing pages do not exist in this workspace).
- **Operate:** Full Deal Desk Workbench (Opportunity briefs, 8-row MEDDPICC ledger, 10-segment bars, interactive field discovery checklist).
- **Read:** Evidence and blind spot audit inspection (buyer verbatim quotes, RFP criteria, legal procurement turnaround notes).
- **Experience:** Staggered animation moment upon field discovery submission and stage gate clearance.

**Reference sites:**
- **Linear (`https://linear.app`):** Benchmark for keyboard-first operational speed, hairline borders, tabular monospace identifiers, and quiet chrome.
- **Attio (`https://attio.com`):** Benchmark for composable CRM data models, flat surface hierarchy, and zero drop shadows.
- **Ramp (`https://ramp.com`):** Benchmark for Swiss neo-grotesk data tables, enterprise financial discipline, and tabular currency values.
- **Clari (`https://www.clari.com`):** Benchmark for revenue intelligence and pipeline risk indicators.

**Key characteristics:**
- **Radical Monochrome Restraint:** All surfaces, top navigation chrome, metadata badges, ACV amounts, stage tags, and competitor pills are strictly neutral monochrome.
- **Quarantined Color Domain:** Color exists exclusively on the 10-segment MEDDPICC score bars (`0–3` Crimson, `4–7` Amber, `8–10` Emerald) and the primary action button (`#0F52BA`).
- **All 8 MEDDPICC Dimensions Always Open:** Zero collapsible dropdowns or accordions; all 8 pillars show dimension, 10-segment bar, score, verified evidence, and open gap inline for instantaneous vertical scanning.
- **Clean Inline Parenthetical Deltas:** Stage 3 reflects score gains using plain text `Instrument Sans` `tabular-nums` parenthetical notation `(+24)`, `(+6)` directly beside the updated score (`82 / 100 (+24)`, `8/10 (+6)`), without `prev →` prefixes, button borders, or badge styling.
- **Zero Demo Scaffolding:** Internal enums (`READY_TO_ASSESS`, `PENDING_FEEDBACK`), `$0 compute` banners, `"Salesforce Connected"` pills, and `"⚙ Workspace / Dev Controls"` popovers are strictly forbidden; the sole permitted operational exception is a single strictly monochrome `SIMULATION` / `LIVE` AI execution-mode pill in `TopNavBar` so operators can distinguish deterministic AI fixture replay from live inference without breaking the Quarantined Color Domain.

## Colors

**Strategy:** Restrained (1 action accent + strictly quarantined 3-tier semantic score palette; all chrome, surfaces, text, and metadata remain pure monochrome).

**Light or dark:** Light-first default (`#F8F8F6` Warm Stone canvas / `#FFFFFF` operational sheets) designed for daytime desk work; dark mode (`#090A0C` obsidian night / `#101114` charcoal sheet / `#22252C` hairlines) supported via CSS custom properties.

**Quarantined Semantic Tokens:**
- **Score Blocker (`0–3` points):** `#DC2626` (Muted Crimson) in light, `#EF4444` in dark.
- **Score Partial (`4–7` points):** `#D97706` (Warm Amber) in light, `#F59E0B` in dark.
- **Score Verified (`8–10` points):** `#059669` (Emerald Green) in light, `#10B981` in dark.
- **Score Unfilled Tick:** `#E5E5E0` in light, `#22252C` in dark.
- **Primary Interactive Accent:** `#0F52BA` (Sapphire Blue), hover `#0C4196`.

Neutrals derive from a warm architectural stone palette (`#F8F8F6` canvas, `#E2E0D8` hairline grid, `#111215` deep text). Dark mode preserves the same relative contrast steps rather than merely inverting lightness.

## Typography

**Unified Single-Typeface System (`Instrument Sans` + `tabular-nums`):**
- **One Cohesive Typeface:** `Instrument Sans` (Google Fonts / SIL OFL, weights `400`, `500`, `600`, `700`) serves every typographic role across display headings, uppercase section kickers, body prose, UI controls, and numeric readouts (`--font-sans`, `--font-display`, and `--font-mono` all resolve to `Instrument Sans`).
- **Tabular Numerals Everywhere:** All scores (`82 / 100`, `8/10`), currency (`$420,000 ACV`), counters (`Answered 2 of 2`), dates, step numbers, and parenthetical score deltas `(+24)`, `(+6)` apply `font-variant-numeric: tabular-nums` (`"tnum" 1`) in `Instrument Sans`, preserving crisp vertical alignment without jarring font-family or x-height switches.
- **Zero Bracketed Code Clutter:** Dimension rows and discovery cards display clean human labels (`Identify Pain`, `Economic Buyer: 3/10`) without `[I]` / `[E]` monospace prefix brackets.

**Scale:**
- Display / Deal Title: `28px` / `1.75rem` (Instrument Sans 700, `-0.025em`)
- Composite Score Numeric: `24px` / `1.5rem` (Instrument Sans 600 `tabular-nums`)
- Section Heading: `16px–18px` / `1rem–1.125rem` (Instrument Sans 600)
- Body Copy & Form Controls: `14px` / `0.875rem` (Instrument Sans 400, line-height `1.5`)
- UI Medium / Semi-Bold: `12px–14px` / `0.75rem–0.875rem` (Instrument Sans 500/600)
- Uppercase Section Kicker: `11px` / `0.6875rem` (Instrument Sans 600, `+0.05em`)

## Layout

- **Workbench Layout:**
  - Primary Split-Pane Grid: `35% / 65%` ratio inside `.workbench-shell` separated by a `1px solid #E2E0D8` hairline border.
  - Affordance-Only Borders & Zero Nested Cards: Reserve bordered pill/chip containers strictly for interactive controls (`Simulation`/`Live`, `Settings`, `Copy`, buttons, inputs, selects). Static metadata (`Stage`, `ACV`, `CRM Status`, `Stage Gate Readiness`) renders as unboxed typography separated by hairlines (`|`), middle dots (`·`), or a status dot. Inside `.workbench-shell`, sections divide with full-bleed horizontal hairlines (`border-b border-[#E2E0D8]`) rather than nested 4-sided bordered cards.
  - Top Navigation & Deal Header: `TopNavBar` holds brand title (`<span>`) + `Simulation`/`Live` button + `Settings` trigger (no static placeholder user avatars). `MonochromeTopBar` surfaces Opportunity Name (`<h1>`), CRM Stage, and ACV once at the top of the sheet.
  - Left Pane (`35%`): Non-redundant 2x2 Opportunity Metadata (`Account Executive`, `Solutions Architect`, `Account`, `Target Close` + unboxed CRM status indicator), Neutral Competitor Context, and AE/SA Brief blocks separated by hairlines. Never duplicates CRM stage or Stage 3's Next Steps writeback in the left pane.
  - Right Pane (`65%`): Dynamic 3-stage process view container navigated via a clean horizontal underline tab bar `StepperBar` (`Initial Deal Audit`, `Field Discovery`, `Updated Assessment`) with zero nested pill boxes, parenthetical outcome spoilers, or duplicate spinners.
  - Maximum container width: `1440px`, centered with `24px` horizontal gutters.

**3-Stage Operational Process Flow:**
1. **Stage 1: Initial Deal Audit:** All 8 MEDDPICC dimensions open with zero redundant sub-label status pills (`Unassessed`/`Partial`/`Verified`) or `Blocker` badges—the 10-segment bar and score communicate tier directly. Primary CTA triggers discovery: `Answer N Discovery Questions →`.
2. **Stage 2: Field Discovery:** SA completes targeted questions directly linked to gap dimensions (`Economic Buyer: 3/10` + 10-segment bar), using custom-styled `40px` inputs/selects and quiet 1-line helper captions.
3. **Stage 3: Updated Assessment:** Composite header and changed rows display updated scores with inline parenthetical deltas (`76 / 100 (+18)`, `8/10 (+5)`). `SuggestedNextStepsCard` renders lead action prose above a structured 3-column `OWNER` / `FOCUS` / `WATCH` strip.

## Elevation & Depth

- **Zero Card Shadows:** Standard data tables, cards, and metadata boxes sit flat on the `#F8F8F6` canvas or `#FFFFFF` sheet, separated exclusively by `1px solid #E2E0D8` hairline borders.
- **Surface Luminance Steps:** Depth is communicated through background tone steps (`#F8F8F6` canvas → `#FFFFFF` sheet → `#F1F0EC` recessed inputs) rather than drop shadows.
- **Floating Overlays:** Minimal soft shadow (`0 10px 25px -5px rgba(0,0,0,0.1)`) reserved strictly for modal dialogs and dropdown menus. Zero-offset colored glow halos are strictly banned.

## Shapes

- **Radius Tokens:**
  - `sm: 4px`: Badges, monospace chips, and 10-segment score bar ticks.
  - `md: 6px`: Interactive buttons, form inputs, and nested sub-cards.
  - `lg: 8px`: Main workbench container shell and primary cards.
  - `full: 9999px`: Reserved strictly for toggle switches and round avatars.
- **Nested Radii Rule:** Nested inner containers follow `inner_radius = outer_radius - padding`.

## Components

- **10-Segment Discrete Tick Bar:**
  - 10 rectangular ticks (`width: 6px`, `height: 14px`, `gap: 3px`, `border-radius: 1px`).
  - Filled ticks inherit the dimensional score color (`#DC2626`, `#D97706`, `#059669`).
  - Unfilled ticks use subtle neutral `#E5E5E0` (`#22252C` in dark mode).
- **Buttons:**
  - Primary Action: `#0F52BA` background, `#FFFFFF` text, `6px` radius. Hover: `#0C4196`. Active: scale `0.98`.
  - Secondary Action: `#FFFFFF` background, `#111215` text, `1px solid #E2E0D8` border.
- **Form Inputs, Textareas & Custom `<select>` Controls:**
  - Recessed `#F8F8F6` surface (`#F1F0EC` when disabled), `1px solid #E2E0D8` border (`hover:border-[#C8C5BA]`), `6px` radius, `min-h-10` (`40px`) height, `14px` (`text-sm`) `Instrument Sans`.
  - `<select>` elements MUST use `appearance-none` wrapped in `<div class="relative">` with `pr-10` and a custom right-aligned `ChevronDown` (`size-4`) so macOS/browser native Aqua popup buttons never render.
  - Focus state: `1px solid #111215` crisp obsidian border on `#FFFFFF` surface with zero colored glow.
  - Field helper guidance renders as a quiet 1-line caption (`mt-1.5 text-xs text-[#636772]`) — never inside a bordered beige callout box with a `(?)` icon.
- **Score Delta Readout (`current (+Δ)`):**
  - Clean inline parenthetical text in `Instrument Sans` `tabular-nums` (`76 / 100 (+18)`, `8/10 (+5)`).
  - Zero `prev →` prefixes, zero button borders, zero background fills, zero badge styling.
  - Unchanged dimensions remain quiet without delta tags.

## Do's and Don'ts

- **Do:** Keep all deal metadata (ACV, Stage, Account, Competitor) strictly monochrome.
- **Do:** Confine all color to the 10-segment MEDDPICC score bars and the primary action button.
- **Do:** Render all 8 MEDDPICC dimensions permanently open in a clean, scannable table ledger without redundant `Unassessed`/`Partial`/`Verified`/`Blocker` pills.
- **Do:** Use `Instrument Sans` with `tabular-nums` for all scores, currency, counters, and parenthetical deltas `(+Δ)` on a single cohesive baseline.
- **Do:** Style every `<select>` with `appearance-none`, `min-h-10`, `text-sm`, and an explicit `ChevronDown` icon, and show at most one active loading indicator at a time.
- **Don't:** Never leave native unstyled `<select>` elements or wrap input helper captions in bordered `(?)` boxes.
- **Don't:** Never duplicate CRM writeback in `DealContextCard` or spoil outcomes in `StepperBar` labels (`(Gaps Identified)`, `(Qualified)`).
- **Don't:** Never add colored backgrounds (green, orange, red) to ACV pills, stage badges, or competitor pills.
- **Don't:** Never hide MEDDPICC evidence or blind spots behind accordion dropdowns.
- **Don't:** Never display raw internal state enums (`READY_TO_ASSESS`, `PENDING_FEEDBACK`) or demo artifacts.
- **Don't:** Never use drop shadows on standard cards or data tables.

## Motion

- **Approach:** Intentional-functional (motion is reserved strictly to explain state transitions and data re-scoring).
- **Easing:** enter(`cubic-bezier(0, 0, 0.2, 1)` / `ease-out`), exit(`cubic-bezier(0.4, 0, 1, 1)` / `ease-in`), move(`cubic-bezier(0.4, 0, 0.2, 1)` / `ease-in-out`).
- **Duration:** micro(`40–80ms`), short(`150–200ms`), medium(`250–350ms`).
- **The One Authored Moment:**
  - When Field Discovery is submitted, 10-segment tick bars update in a staggered `40ms` wave from Blocker Crimson to Verified Emerald alongside updated `Instrument Sans` `tabular-nums` scores and parenthetical deltas `(+24)`, `(+6)`.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-21 | Initial design system created | Created via /design-consultation based on enterprise deal qualification workspace research and competitive audit of Attio, Linear, Ramp, and Clari. |
| 2026-10-21 | Radical Monochrome Restraint | User feedback: eliminated competing colored pills on metadata (ACV, Stage, Competitor) to quarantine color strictly to 10-segment score bars. |
| 2026-10-21 | Zero Demo Artifacts | Removed "Salesforce Connected" indicator, "Workspace / Dev Controls" popovers, and Cmd+K model switcher to ensure 100% production fidelity. |
| 2026-10-21 | Always-Open MEDDPICC Ledger | Replaced accordion dropdowns with permanently open 8-row table for instantaneous vertical scanning of buyer evidence and gaps. |
| 2026-10-21 | 3-Stage Process Walkthrough | Codified the interactive journey: Stage 1 (Audit), Stage 2 (In-Context Field Discovery), and Stage 3 (Qualified Re-score). |
| 2026-10-21 | Clean Parenthetical Score Deltas | User feedback: replaced button-like delta badges with unadorned typographic parentheticals `(+24)` and `(+6)`. |
| 2026-11-11 | Monochrome AI Execution-Mode Pill Carve-Out | Amended Zero Demo Scaffolding to permit a single strictly monochrome `SIMULATION` / `LIVE` pill in `TopNavBar` so operators can tell deterministic AI fixture replay from live Gateway inference while keeping color strictly quarantined. |
| 2026-11-12 | Single-Typeface Unification, Custom `<select>` Controls & UI De-duplication | Unified all typography onto `Instrument Sans` + `tabular-nums` (retiring `JetBrains Mono` switching, `prev →` score prefixes, and `[I]`/`[E]` brackets), standardized `40px` `appearance-none` `<select>` controls and quiet 1-line helper captions, and removed duplicate left-pane CRM writeback, `DD` avatar, redundant `StepperBar` spoilers/spinners, and redundant dimension/blocker badges. |
| 2026-11-12 | Affordance-Only Borders, Split-Pane Hairlines & WCAG AA `#636772` Muted Ink | Darkened muted ink from `#787C87` to `#636772` (`>5.0:1` contrast across `#FFFFFF`, `#F8F8F6`, and `#F1F0EC`), unboxed static metadata pills (`Stage`, `ACV`, `CRM Status`, `Stage Gate Readiness`) so borders belong exclusively to interactive controls, converted `StepperBar` to a clean horizontal underline tab bar, and replaced nested cards inside `.workbench-shell` with full-bleed hairline sections. |
