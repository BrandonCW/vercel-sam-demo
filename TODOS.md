# TODOS

## Active Milestone — Issue #26: E2E Audit Hardening, Progressive Eve Latency & Deal Desk UX Polish

Spec & Review Artifact: `.scratch/deal-qualification/issues/26-e2e-audit-hardening-and-ux-polish.md`

- [x] **WP-1 (`deps-infra`): GStack Spec/Docs, Node & Dependency CVE Remediation, Security Headers, ESLint & Offline DB Test Guards**
  - Author Issue #26 GStack spec + engineering/design review plan, `DESIGN.md` monochrome `SIMULATION` / `LIVE` pill carve-out, and `agent/skills/scenario_seeder.md` scenario alignment.
  - Pin Node runtime (`.nvmrc` `24`, `engines.node >=22.0.0`), upgrade `next` to `^15.5.28`, and apply safe `pnpm.overrides` / version bumps to remediate Critical & High CVEs without breaking `eve@0.64.1` or `ai@7.0.112`.
  - Configure non-interactive ESLint (`CI=true npm run lint`), disable `X-Powered-By` in `next.config.ts`, add `Permissions-Policy` header in `vercel.json`, and guard DB-dependent test suites with `describe.skipIf(!process.env.POSTGRES_URL)`.
- [ ] **WP-2 (`eve-backend`): Progressive Eve `Option A` Latency Cuts, MEDDPICC/Jev Scoring & Writeback Guards**
  - Yield baseline `jev_scored` immediately, parallelize `saveJevScoring` with `analyzeWithSystem2`, bound Gemini `thinkingBudget: 1024`, close Turn-2 phase immediately on `action.result`, document `SCORE_LEVELS = 10` Gateway cap + continuous `[0, 9]` scaling, enforce `last_reset_at` write guards and Eve channel `Origin` CSRF checks, and scrub backend display jargon.
- [ ] **WP-3 (`auth-sim`): Auth/Route Security Hardening, `/login` Warm Stone Desk OS Redesign & Simulation Math**
  - Restyle `/login` per `DESIGN.md` with `<Suspense>` SSR prerendering and `CWE-601` open-redirect validation; harden `/api/auth/login` (`400` malformed JSON, `timingSafeEqual`, IP rate limit), `/api/auth/logout` (`PUBLIC_PATHS` expired-cookie cleanup), `/api/crm/reset` (`{ full: true }` prod guard), `VERCEL_OIDC_TOKEN` env support, and simulation fixture weighted-sum + negative-answer math.
- [ ] **WP-4 (`workbench-ui`): Progressive Stage 1 Hydration, Monochrome `SIMULATION`/`LIVE` Pill & `DESIGN.md` Compliance**
  - Add interactive monochrome `SIMULATION` / `LIVE` pill in `TopNavBar`, unblock Stage 1 immediately on `jevResult` with persistent `Abort` and calm bone shimmers, scrub all `"System 1"` / `"System 2"` UI jargon, drive Stage Gate strictly from `stageGate` + `qualificationStatus`, sync scenarios cleanly across modes, and load fonts via `next/font/google`.

## Deferred / Backlog

- [ ] **Focus-Guarded Stage Hotkeys (`1` / `2` / `3`)** (Deferred from Issue #24 CEO Review — Proposal #5)
  - **Context:** Power users navigating the Deal Desk OS 3-stage stepper (`1. Initial Deal Audit`, `2. Field Discovery Checklist`, `3. Updated Assessment & Next Steps`) could jump between unlocked stages using single-key `1`/`2`/`3` shortcuts when focus is outside form controls (`INPUT`, `TEXTAREA`, `SELECT`, `[role="combobox"]`, or open `[role="dialog"]`).
  - **Why deferred:** Deferred from Issue #24 under Principle 3 (Pragmatic) and Principle 5 (Explicit over clever) to avoid key-capture edge cases with custom select comboboxes and screen-reader navigation during the core layout refactor. Standard `<button>` keyboard navigation (`Tab` / `Enter` / `Space`) on `StepperBar` ships in Issue #24.
  - **Files:** `components/workbench/StepperBar.tsx`, `components/workbench/QualificationWorkbench.tsx`, `components/workbench/LiveQualificationWorkbench.tsx`
