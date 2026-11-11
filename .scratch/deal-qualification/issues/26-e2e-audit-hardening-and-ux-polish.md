# 26: E2E Audit Hardening, Progressive Eve Latency & Deal Desk UX Polish

**Status:** in_progress  
**Type:** task  
**Blocked by:** 25  
**Parent Epic:** [GitHub Issue #6](https://github.com/BrandonCW/vercel-sam-demo/issues/6)

## Context

Following the Issue #24 Deal Desk OS split-workbench refactor and Issue #25 Eve workflow data-flow alignment, a full end-to-end production audit across security, dependency health, runtime latency, scoring math, and visual design compliance surfaced four cohesive areas requiring hardening before release:

1. **Infrastructure, Dependencies & Tooling (`deps-infra`)**: `pnpm audit` reports 51 advisories (3 Critical, 19 High) across `next`, `tinypool`, `undici`, `postcss`, `sharp`, `happy-dom`, and `vite`; `.nvmrc` and `package.json#engines` are unpinned; `npm run lint` lacks a non-interactive ESLint configuration; `next.config.ts` exposes `X-Powered-By` and `vercel.json` omits `Permissions-Policy`; and offline `npm test` runs without `.env.test.local` fail on unguarded Postgres-dependent test suites.
2. **Eve Latency, Scoring Math & Writeback Integrity (`eve-backend`)**: Baseline rubric scoring waits serially on DB persistence before starting deep gap analysis; Gemini models can spend 15–30s in unbounded hidden thinking tokens; Turn 2 re-queries Neon redundantly and waits ~3.9s after writeback for `turn.completed` before closing the UI phase; `jev-scorer.ts` needs explicit documentation around `SCORE_LEVELS = 10` (the AI Gateway `typesafe-ai/jev` 10-rung cap returning continuous expected positions in `[0, 9]` so `5/10` remains reachable without HTTP `400`); early/unrecognized stages default `gateReady` to `true`; Turn-2 writeback retains stale Turn-1 gaps on newly verified dimensions; orphaned workflows lack a `last_reset_at` write guard; and Eve channel `POST` requests lack a cross-origin `Origin` CSRF check.
3. **Auth, API Hardening & Simulation Realism (`auth-sim`)**: `/login` still renders legacy dark-mode styling (`#09090b`), leaks `"NODE_ENV=development"` scaffolding copy, bails out to CSR on `useSearchParams()`, and permits protocol-relative open redirects (`?redirect=//evil.example`); `POST /api/auth/login` returns `500` on malformed JSON, compares passwords non-constant-time, and lacks IP rate limiting; `POST /api/auth/logout` returns `401` when a session cookie is expired; `POST /api/crm/reset` allows `{ "full": true }` wipes in production; `validateLiveEnv` rejects `VERCEL_OIDC_TOKEN`-only deployments; and simulation JSON fixtures have rounding drift vs MEDDPICC weights and ignore negative SA discovery answers.
4. **Progressive Deal Desk UI, Mode Clarity & `DESIGN.md` Polish (`workbench-ui`)**: Operators lack an immediate top-bar indicator distinguishing simulated AI replay from live Gateway inference; Live mode blocks Stage 1 rendering until deep synthesis finishes instead of hydrating baseline MEDDPICC scores immediately on `jev_scored` (while hiding `Abort`, popping a layout-shifting blue banner, leaking seeded fallback gaps, and repeating `"Pending System 2..."` 16 times); internal architecture jargon (`"System 1"`, `"System 2"`, `"Jev"`, `"Eve"`, `"Demo"`) leaks into user-facing labels; `STAGE_GATE_THRESHOLD = 75` overrides actual `stageGate` blocker verdicts; negative deltas and pipe-delimited `SuggestedNextSteps` render poorly; switching Simulation → Live can show stale scenario data or leave orphaned runs; and Google Fonts `@import` + stray color pills deviate from `DESIGN.md`.

## Architectural Constraints & Non-Negotiables

1. **Eve-Only Execution Surface (`Option A`)**:
   - Do **NOT** introduce any `/api/assessment/*` Next.js routes. `tests/eve-only-surface.test.ts` MUST stay 100% green.
   - All progressive Stage 1 updates, parallel DB persistence, Gemini `thinkingBudget` bounds, and Turn-2 fast-close state transitions execute inside the `eve` `run_assessment` workflow tool (`agent/tools/run_assessment.ts` + `agent/lib/assessment-steps.ts`) and `assessmentReducer` (`lib/assessment-results.ts`).
2. **`DESIGN.md` Carve-Out & Quarantined Color Domain**:
   - Amend `DESIGN.md` ("Zero Demo Scaffolding" + Decisions Log) with an explicit 1-sentence carve-out permitting **one strictly monochrome `SIMULATION` / `LIVE` AI execution-mode pill** in `TopNavBar` so operators can distinguish deterministic AI fixture replay from live inference (noting that the Salesforce CRM layer is always simulated).
   - `simulation` remains the default mode. Color remains strictly quarantined to the 10-segment MEDDPICC score bars (`#DC2626`, `#D97706`, `#059669`) and `#0F52BA` primary action buttons.
3. **Complete User-Facing Jargon Scrub (Internal Contracts Preserved)**:
   - Remove all user-visible `"System 1"`, `"System 2"`, `"Jev"`, `"Eve"`, `"Demo"`, and `"NODE_ENV=development"` strings from UI components, step labels, and `ProblemCauseFix` messages, replacing them with Deal Desk operational copy.
   - Preserve internal TypeScript identifiers, JSON payload keys (`jevResult`, `system2Result`, `jev_scored`, `run_assessment`), and `evals/**` assertions intact.

## Work Packages (4 Orthogonal Workstreams)

### WP-1 (`deps-infra`): Spec/Docs, Node & CVE Remediation, Security Headers, ESLint & Offline DB Guards
- **Files**: `.scratch/deal-qualification/issues/26-e2e-audit-hardening-and-ux-polish.md`, `DESIGN.md`, `TODOS.md`, `agent/skills/scenario_seeder.md`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`, `next.config.ts`, `vercel.json`, `.eslintrc.json` (or `eslint.config.mjs`), `tests/{seed,assessment-session,crm,live-run-lease,eve-agent}.test.ts`.
- **Deliverables**:
  - Pin Node runtime via `.nvmrc` (`24`) and `"engines": { "node": ">=22.0.0" }` in `package.json`.
  - Upgrade `next` within Next 15 to patched `^15.5.28` and remediate transitive/dev CVEs via safe version bumps and `pnpm.overrides` (`sharp >=0.35.5`, `postcss >=8.5.23`, `source-map-js >=1.2.2`, `postcss-selector-parser >=6.1.5`, major-scoped `undici >=7.30.1` for v7 and `>=8.12.2` for v8, `happy-dom >=21.0.4`, `vite >=7.3.7`, `tinypool >=2.1.2` / compatible `vitest`), keeping `zod` on v3 (`^3.25.76`) to preserve 100% schema/type compatibility with `ai@7.0.112`, `eve@0.64.1`, and single-arg `z.record(...)` schemas.
  - Configure non-interactive ESLint (`eslint` + `eslint-config-next` matching Next 15.5) so `CI=true npm run lint` exits `0` with zero interactive prompts.
  - Set `poweredByHeader: false` in `next.config.ts` and add `Permissions-Policy: camera=(), microphone=(), geolocation=()` to `vercel.json`.
  - Sync `agent/skills/scenario_seeder.md` with `lib/db/scenarios.ts` (Globex: `Stage 2 - Discovery` / `$240,000`; Soylent: `$90,000` / `Akamai/Fastly`).
  - Guard Postgres-dependent `describe` blocks in the 5 owned DB test files with `describe.skipIf(!process.env.POSTGRES_URL)`.

### WP-2 (`eve-backend`): Progressive Eve `Option A` Latency, MEDDPICC Math, Writeback Guards & Jargon Scrub
- **Files**: `agent/agent.ts`, `agent/instructions.md`, `agent/lib/assessment-steps.ts`, `agent/tools/run_assessment.ts`, `agent/channels/eve.ts`, `lib/agents/{jev-scorer,qualification-decision,system2}.ts`, `lib/assessment-{progress,results,session,turns}.ts`, `lib/db/{assessments,crm,scenarios}.ts`, `tests/{assessment-results,assessment-turns,jev,qualification-decision,system2-output,e2e-workflow,run-assessment,writeback}.test.ts`.
- **Deliverables**:
  - Yield `{ stage: 'jev_scored', round: 'baseline', jevResult }` immediately on baseline completion; run `saveJevScoring` concurrently (`Promise.all`) with `analyzeWithSystem2` and pass loaded `Opportunity` directly to avoid redundant Neon reads.
  - Bound Google Gemini hidden reasoning latency via `providerOptions: { google: { thinkingConfig: { thinkingBudget: 1024 } } }` strictly when `model.startsWith('google/')`.
  - Pass in-memory Turn-2 results (`baselineJevResult`, `postFeedbackJevResult`, `rescoredOpportunity`, `system2Result`) into `writeBack` / `finalizeAssessmentWriteback` (keeping DB lookup as fallback).
  - In `assessmentReducer`: set `system2Running: true` immediately on baseline `jev_scored`; transition `view.phase = 'closed'` immediately on completed `action.result` (eliminating the ~3.9s post-writeback freeze while treating trailing `turn.completed` as a no-op); and reset `phase = 'awaiting_feedback'` cleanly on `ctx.ask` retry `input.requested`.
  - Retain `SCORE_LEVELS = 10` in `jev-scorer.ts` (preserving the AI Gateway `typesafe-ai/jev` 10-level `criteria` cap while documenting continuous `[0, 9]` expected-position scaling), tighten Stage Gate regex + `gateReady: false` default for unrecognized early stages, clear stale Turn-1 `gaps` on post-feedback `'verified'` dimensions, enforce `last_reset_at <= sessionStartedAt` write guards in `lib/db/crm.ts`, add cross-origin `Origin` CSRF validation in `agent/channels/eve.ts`, scrub user-visible backend jargon, and add `describe.skipIf(!process.env.POSTGRES_URL)` to owned DB tests.

### WP-3 (`auth-sim`): Auth/Route Hardening, `/login` Desk OS Redesign, OIDC Env & Simulation Engine Fixes
- **Files**: `middleware.ts`, `lib/{auth,eve-auth,env}.ts`, `app/login/page.tsx`, `app/page.tsx`, `app/api/auth/{login,logout}/route.ts`, `app/api/crm/{opportunity,reset}/route.ts`, `lib/simulation/{simulation-engine,fixture-schema,types}.ts`, `lib/fixtures/simulation/{acme_migration,globex_amplify,soylent_retail}.json`, `tests/{auth,env,eve-channel-auth,middleware,simulation-engine,simulation}.test.ts`.
- **Deliverables**:
  - Redesign `/login` to Warm Stone Desk OS (`#F8F8F6` canvas, `#FFFFFF` flat operational sheet, `1px solid #E2E0D8` hairline, zero shadow, `#F1F0EC` input, `#0F52BA` CTA), wrap `useSearchParams()` in `<Suspense>` for full SSR HTML prerendering, remove `autoFocus` and `"NODE_ENV=development"` copy, and sanitize `redirect` against `CWE-601` open redirects.
  - Harden `POST /api/auth/login` (`400` on malformed JSON, SHA-256 `crypto.timingSafeEqual`, sliding-window IP rate limiter returning `429`, same-origin `Origin` check, sanitized `500` errors).
  - Whitelist `/api/auth/logout` in `middleware.ts` `PUBLIC_PATHS` (with same-origin check) so expired cookies still receive `200` + cookie deletion.
  - Guard `POST /api/crm/reset` `{ "full": true }` in production unless `ALLOW_FULL_CRM_RESET === 'true'` (`403` otherwise) + same-origin check; add safe `DEMO_SCENARIOS` fallback in `GET /api/crm/opportunity` when `POSTGRES_URL` is unset; accept `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` in `validateLiveEnv`.
  - Fix weighted `overallScore` and `verdict.delta` math across all 3 simulation fixtures, align Acme `sa_name` (`"David Kross"`) and `paperProcess` partial status, derive Stage 3 gaps dynamically in `simulation-engine.ts`, and honor negative/unconfirmed Stage 2 SA answers with honest `in_review` rescoring.

### WP-4 (`workbench-ui`): Progressive Stage 1 UI, `SIMULATION`/`LIVE` Pill, Stage Gate Accuracy & `DESIGN.md` Polish
- **Files**: `app/{layout.tsx,globals.css}`, `tailwind.config.ts`, `components/ui/button.tsx`, `components/workbench/{TopNavBar,desk-os-shared,StepperBar,DealContextCard,MeddpiccScorecard,DynamicDiscoveryForm,QualificationWorkbench,LiveQualificationWorkbench}.tsx`, `tests/{workbench-shell,qualification-workbench,dynamic-form-renderer}.test.tsx`.
- **Deliverables**:
  - Render the interactive monochrome `○ SIMULATION` / `● LIVE` pill in `TopNavBar.tsx` left of `Settings`, clarify AI simulation vs live inference copy inside Settings, lock mode toggle while a turn is in flight, dim model selector in Simulation mode, and stabilize operator avatar.
  - Enable `prewarm: true` on `useEveAgent`; unblock Stage 1 immediately when `view.jevResult !== null`; eliminate seeded gap fallback during synthesis; keep `Abort` visible throughout both baseline scoring and gap synthesis; replace layout-shifting banner and 16x `"Pending System 2..."` lines with progressive disabled CTA (`⟳ Generating Discovery Checklist…`) + 2-line bone shimmers (`bg-[#E2E0D8]/50 animate-pulse`); mirror 2-step progressive cadence (`~350ms` -> `~950ms`) in `QualificationWorkbench.tsx`.
  - Scrub all remaining `"System 1"`, `"System 2"`, `"Jev"`, `"Eve"`, and `"Demo"` UI strings; fix `"Run MEDDPICC Deal Audit →"` CTA label.
  - Delete `STAGE_GATE_THRESHOLD = 75` and drive Stage 1/3 gate pills strictly from `stageGate` + `qualificationStatus`; gate `"✓ Verified in discovery"` on `status === 'verified' && gaps.length === 0`; preserve negative deltas `(-3)`; parse pipe-delimited `SuggestedNextSteps` cleanly and surface CRM writeback state in `DealContextCard.tsx`; fix Simulation → Live scenario sync, double-fetch, `await agent.stop()` on reset/switch, retrospective Stage 2 baseline scores, and non-destructive `"Re-run Deal Audit"`.
  - Load `Instrument_Sans` and `JetBrains_Mono` via `next/font/google`, remove render-blocking CSS `@import`, enforce Quarantined Color Domain across all pills/icons, fix `DealContextCard` responsive border, align `TopNavBar` `max-w-[1440px]`, and replace legacy `#0070f3` tokens with `#0F52BA`.

## Engineering Review (`/plan-eng-review`)

### Progressive Eve Execution Swimlane (`Option A`)
```
Client (LiveQualificationWorkbench)     Eve Reducer (assessmentReducer)        Workflow (run_assessment)
───────────────────────────────────     ───────────────────────────────        ─────────────────────────
Click "Run MEDDPICC Deal Audit →"  ───► phase: 'assessing'                ───► scoreWithJev(oppId)
                                                                               yield { stage: 'jev_scored', jevResult }
Stage 1 renders IMMEDIATELY!       ◄─── jevResult set, system2Running: true ◄──┘
  • 8 bars + real Stage Gate pill                                              Promise.all([
  • 2-line bone shimmer on Cols 3-4                                              saveJevScoring(opp, jevResult),
  • [⟳ Generating Checklist…] + [Abort]                                          analyzeWithSystem2(opp, jevResult,
                                                                                   gemini ? thinkingBudget:1024 : {})
CTA morphs to [Answer N Questions] ◄─── phase: 'awaiting_feedback'        ◄─── ctx.ask(DISCOVERY_PROMPT)
Submit Stage 2 Answers             ───► phase: 'submitting_feedback'      ───► recordFeedback -> scoreWithJev -> writeBack
Stage 3 renders IMMEDIATELY (0s)!  ◄─── action.result -> phase: 'closed'  ◄─── return final AssessmentTurnResult
  (trailing turn.completed = no-op)
```

### Security, Concurrency & Dependency Decisions
- **CSRF & Same-Origin Enforcement**: Mutating session/CRM endpoints (`/api/auth/login`, `/api/auth/logout`, `/api/crm/reset`, and `agent/channels/eve.ts`) validate `Origin` against `Host` / `X-Forwarded-Host` whenever `Origin` is present, blocking browser cross-origin POSTs while allowing headless CLI / `eve eval` requests without an `Origin` header.
- **Orphaned Workflow Write Guard**: `last_reset_at <= sessionStartedAt` in `lib/db/crm.ts` guarantees that if an operator resets an opportunity while a background workflow step was in flight, the stale workflow cannot clobber the freshly reset baseline.
- **Dependency Override Safety Matrix**:
  - `pnpm-workspace.yaml` holds `overrides` (required by `pnpm@12.x`, which ignores `package.json#pnpm.overrides`), keeping every override major-bounded (`^`) so transitive updates never jump across incompatible major releases.
  - `next` stays on Next 15 (`^15.5.28`, resolved `15.5.29`) to guarantee zero peer/bundler friction with `eve@0.64.1` (`withEve`).
  - `undici` overrides are major-scoped (`"undici@>=7.0.0 <7.30.1": "^7.30.1"` and `"undici@>=8.0.0 <8.12.2": "^8.12.2"`) so `@ai-sdk/provider-utils` stays on `undici@7.x` while `eve` stays on `undici@8.x`.
  - `vitest` stays on `^3.2.7` with `vite: "^7.3.7"` and `tinypool: "^2.1.2"` overrides (resolving both Critical `tinypool` RCE CVEs and all 5 `vite` CVEs while preserving native esbuild `.tsx` JSX transformation without Rolldown config changes).
  - `zod` stays on v3 (`^3.25.76`) because `agent/` and `lib/` schemas rely on single-argument `z.record(valueSchema)` which is a breaking signature change in Zod v4 (`>=4.6.6`).

## Design Review (`/plan-design-review`)

- **Monochrome Execution-Mode Pill (`DESIGN.md` Carve-Out)**:
  - `SIMULATION` (default): `#F1F0EC` recessed stone fill, `1px solid #E2E0D8` hairline border, `#52545D` secondary ink, `6px` hollow circle (`border-[#787C87]`), `JetBrains Mono` `11px` uppercase.
  - `LIVE`: `#111215` deep ink fill, `1px solid #111215` border, `#FFFFFF` text, `6px` solid white dot, `JetBrains Mono` `11px` uppercase.
  - Zero green/amber/blue status dots—preserving 100% fidelity to the Quarantined Color Domain.
- **Calm Progressive Hydration**:
  - Eliminates the jarring layout-shifting blue status banner and 16x `"Pending System 2..."` text repetition during synthesis; Stage 1 anchors visually the moment rubric scores land while Columns 3 & 4 breathe with subtle warm-stone bone shimmers (`bg-[#E2E0D8]/50 animate-pulse`) and persistent `Abort` control.
- **`/login` Desk OS Surface**:
  - Replaces legacy dark-mode `#09090b` + `shadow-2xl` card with a flat `#FFFFFF` operational sheet on `#F8F8F6` Warm Stone canvas, `1px solid #E2E0D8` border, `#F1F0EC` recessed input (`1px solid #111215` focus ring, zero glow), and `#0F52BA` primary button.

## Verification & Acceptance Checklist

| Gate | Command / Probe | Pass Criteria |
| :--- | :--- | :--- |
| **Typecheck** | `npx tsc --noEmit` | Exits `0` with zero TypeScript errors across app, agent, lib, and tests. |
| **Lint** | `CI=true npm run lint` | Runs non-interactively with zero prompts and exits `0`. |
| **Offline Unit Suite** | `CI=true npm test` | Exits `0` without `.env.test.local`; DB-dependent suites skip cleanly via `describe.skipIf(!process.env.POSTGRES_URL)`. |
| **Live DB Suite** | `POSTGRES_URL=... npm test` | All DB integration suites (`seed`, `crm`, `assessment-session`, `live-run-lease`, `eve-agent`, `run-assessment`, `writeback`, `e2e-workflow`) pass against Neon `test` branch. |
| **Eve Surface Guard** | `npx vitest run tests/eve-only-surface.test.ts` | Exits `0`; zero `/api/assessment/*` routes exist. |
| **Production Build** | `npm run build` | Next.js 15.5.28 + `withEve` production build succeeds cleanly. |
| **Dependency Audit** | `pnpm audit` | All Critical CVEs (`next`, `tinypool`) and patchable High/Moderate/Low CVEs resolved; any residual Zod v3 peer constraint documented. |
| **Runtime QA Probes** | Local HTTP server probes | `GET /login` SSR-renders Desk OS form (no CSR bailout, no `#09090b`, no `NODE_ENV` leak); `POST /api/auth/login` malformed JSON -> `400`; expired cookie `POST /api/auth/logout` -> `200` + clears cookie; `GET /` serves monochrome `SIMULATION` pill, `Permissions-Policy`, `X-Frame-Options: DENY`, and no `X-Powered-By`. |
