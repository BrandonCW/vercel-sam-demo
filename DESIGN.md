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
  text-muted: "#787C87"
  text-faint: "#A6A7AD"
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
    fontFamily: General Sans
    fontWeight: 700
    fontSize: clamp(1.25rem, 2vw, 1.75rem)
    letterSpacing: -0.03em
  body:
    fontFamily: Instrument Sans
    fontSize: 0.875rem
    lineHeight: 1.5
  label:
    fontFamily: General Sans
    fontSize: 0.6875rem
    letterSpacing: 0.05em
  mono:
    fontFamily: JetBrains Mono
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
- **Clean Inline Parenthetical Deltas:** Stage 3 reflects score gains using plain text `JetBrains Mono` parenthetical notation `(+24)`, `(+6)`, without button or badge styling.
- **Zero Demo Scaffolding:** Internal enums (`READY_TO_ASSESS`, `PENDING_FEEDBACK`), `$0 compute` banners, `"Salesforce Connected"` pills, and `"⚙ Workspace / Dev Controls"` popovers are strictly forbidden.

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

**Faces & Roles:**
- **Display & Section Labels:** `General Sans` (Fontshare / Indian Type Foundry Free Font License). Weights: `600`, `700`. Tracking: `-0.03em` on display, `+0.05em` on uppercase section kickers.
- **Body & UI:** `Instrument Sans` (Google Fonts / SIL OFL). Weights: `400`, `500`, `600`. Line height: `1.5`. Used for all AE/SA briefs, verbatim evidence, and field discovery textareas.
- **Tabular Numerals & Monospace:** `JetBrains Mono` (Google Fonts / Apache 2.0 / SIL OFL). Feature: `tnum` (tabular figures). Used for all scores (`82 / 100`, `8 / 10`), currency (`$420,000 ACV`), dimension codes (`[M]`, `[E]`), diff payloads, and parenthetical score deltas `(+24)`, `(+6)`.

**Scale:**
- Display / Deal Title: `28px` / `1.75rem` (General Sans 700)
- Section Heading: `18px` / `1.125rem` (General Sans 600)
- Score Numeric: `32px` / `2.0rem` (JetBrains Mono 700)
- Body Copy: `14px` / `0.875rem` (Instrument Sans 400)
- UI Semi-Bold: `13px` / `0.8125rem` (Instrument Sans 600)
- Monospace Label / Pill: `11px` / `0.6875rem` (JetBrains Mono 500)
- Uppercase Section Kicker: `11px` / `0.6875rem` (General Sans 600)

## Layout

**Workbench Layout:**
- Primary Split-Pane Grid: `35% / 65%` ratio separated by a `1px solid #E2E0D8` hairline border.
- Left Pane (`35%`): Opportunity Metadata, Neutral Competitor Context, and AE/SA Brief blocks.
- Right Pane (`65%`): Dynamic 3-stage process view container (Audit Ledger, In-Context Discovery Form, Re-scored Qualified Summary).
- Maximum container width: `1440px`, centered with `24px` horizontal gutters.

**3-Stage Operational Process Flow:**
1. **Stage 1: Initial Deal Audit:** All 8 MEDDPICC dimensions open. Low scores highlighted with Crimson/Amber bars. Blocker notice prevents Stage Gate 2 sign-off. Primary CTA triggers discovery: `Answer 3 Discovery Questions →`.
2. **Stage 2: In-Context Field Discovery Checklist:** SA completes targeted questions directly linked to the gap dimensions. Each question displays the live 10-segment bar of the specific dimension it repairs (`Economic Buyer: currently 2/10`).
3. **Stage 3: Updated Assessment & Next Steps:** All 8 dimensions update to qualified states. The header and changed dimensions display clean inline parenthetical deltas (`(+24)`, `(+6)`). Suggested Next Steps action block is revealed with 1-click sync.

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
- **Form Inputs & Textareas:**
  - Neutral `#F1F0EC` recessed background, `1px solid #E2E0D8` border, `6px` radius.
  - Focus state: `1px solid #111215` crisp obsidian ring with zero colored glow.
- **Score Delta Readout (`prev → current (+Δ)`):**
  - Clean inline parenthetical text in `JetBrains Mono` `tabular-nums` (`(+24)`, `(+6)`).
  - Zero button borders, zero background fills, zero badge styling.
  - Unchanged dimensions remain quiet without delta tags.

## Do's and Don'ts

- **Do:** Keep all deal metadata (ACV, Stage, Account, Competitor) strictly monochrome.
- **Do:** Confine all color to the 10-segment MEDDPICC score bars and the primary action button.
- **Do:** Render all 8 MEDDPICC dimensions permanently open in a clean, scannable table ledger.
- **Do:** Format score deltas as clean unadorned parenthetical text `(+Δ)` in JetBrains Mono.
- **Don't:** Never add colored backgrounds (green, orange, red) to ACV pills, stage badges, or competitor pills.
- **Don't:** Never hide MEDDPICC evidence or blind spots behind accordion dropdowns.
- **Don't:** Never display raw internal state enums (`READY_TO_ASSESS`, `PENDING_FEEDBACK`) or demo artifacts.
- **Don't:** Never use drop shadows on standard cards or data tables.

## Motion

- **Approach:** Intentional-functional (motion is reserved strictly to explain state transitions and data re-scoring).
- **Easing:** enter(`cubic-bezier(0, 0, 0.2, 1)` / `ease-out`), exit(`cubic-bezier(0.4, 0, 1, 1)` / `ease-in`), move(`cubic-bezier(0.4, 0, 0.2, 1)` / `ease-in-out`).
- **Duration:** micro(`40–80ms`), short(`150–200ms`), medium(`250–350ms`).
- **The One Authored Moment:**
  - When Field Discovery is submitted, score counters animate from initial to qualified score (`58 → 82`), and 10-segment tick bars update in a staggered `40ms` wave from Blocker Crimson to Verified Emerald, followed by the appearance of the parenthetical deltas `(+24)`, `(+6)`.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-21 | Initial design system created | Created via /design-consultation based on enterprise deal qualification workspace research and competitive audit of Attio, Linear, Ramp, and Clari. |
| 2026-10-21 | Radical Monochrome Restraint | User feedback: eliminated competing colored pills on metadata (ACV, Stage, Competitor) to quarantine color strictly to 10-segment score bars. |
| 2026-10-21 | Zero Demo Artifacts | Removed "Salesforce Connected" indicator, "Workspace / Dev Controls" popovers, and Cmd+K model switcher to ensure 100% production fidelity. |
| 2026-10-21 | Always-Open MEDDPICC Ledger | Replaced accordion dropdowns with permanently open 8-row table for instantaneous vertical scanning of buyer evidence and gaps. |
| 2026-10-21 | 3-Stage Process Walkthrough | Codified the interactive journey: Stage 1 (Audit), Stage 2 (In-Context Field Discovery), and Stage 3 (Qualified Re-score). |
| 2026-10-21 | Clean Parenthetical Score Deltas | User feedback: replaced button-like delta badges with unadorned typographic parentheticals `(+24)` and `(+6)` in JetBrains Mono. |
