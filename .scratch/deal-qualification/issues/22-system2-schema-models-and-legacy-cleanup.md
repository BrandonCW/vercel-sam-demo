# 22: Prune System 2 Schema, Simplify Models, Seed Soylent Competitor & Delete Orphaned Legacy Components

**Status:** ready-for-agent  
**Type:** task  
**Blocked by:** none  
**Parent Epic:** [GitHub Issue #6](https://github.com/BrandonCW/vercel-sam-demo/issues/6)

## Context

The System 2 LLM assessment step in `lib/agents/system2.ts` forces generation of three unused top-level properties (`phase1Gaps`, `phase2Competitive`, `summary`) that consume ~65% of the output token budget and have zero UI or backend consumers. On smaller models like Claude Haiku, this triggers mid-JSON truncation. Additionally, `toRenderField()` throws a fatal error if choice fields return empty `options`, and four pre-redesign dark-theme components (~1,200 LOC) remain orphaned in `components/workbench/`.

## Goals

1. **Prune System 2 Schema (`CEO-3`):** Remove `phase1Gaps`, `phase2Competitive`, and `summary` from `System2ModelOutputSchema` and `System2AnalysisResultSchema` in `lib/agents/system2.ts`. Remove dead sub-schemas `QualificationGapSchema` and `CompetitiveCounterPointSchema`.
2. **Resilient Choice Field Coercion (`ENG-4`):** Update `toRenderField()` in `lib/agents/system2.ts:136-141` to trim string options, filter non-empty values, and coerce choice fields (`select`, `radio`, `checkbox_group`) with zero valid options to `'text'` with `options: undefined` instead of throwing an error. Update `tests/system2-output.test.ts:66-73` to assert this graceful degradation.
3. **Update System 2 Prompt:** Clean `agent/lib/assessment-steps.ts:58-74` (`SYSTEM2_PROMPT`) to stop requesting `phase1Gaps`, `phase2Competitive`, or root `summary`.
4. **Simplify Model Registry (`CEO-1`, `CEO-4`, `DX-1`, `ENG-10`):** Update `SYSTEM2_MODELS` in `lib/models.ts` to exactly two models: `google/gemini-3.8-flash` (Default) and `anthropic/claude-haiku-5.5` (Fast) per user confirmation of live Gateway ID. Keep default agent and system2 models as `google/gemini-3.8-flash`. Preserve `${name}` in `lib/models.ts:18-20` error messages (`"Unknown System 2 model: ${name}"`) and enumerate supported models.
5. **Seed Competitive Flag for Soylent (`CEO-4`, `ENG-3`):** In `lib/db/scenarios.ts:145-169`, standardize `scenario_soylent_headless` competitor to canonical `'Akamai/Fastly'` and seed SA notes with low/medium Akamai/Fastly CDN rule mentions so System 1 (`scoreWithJev`) preserves competitive intelligence.
6. **Update Simulation Fixtures, Tests & Evals (`ENG-2`, `DX-2`, `DX-3`):** Remove pruned fields from `lib/fixtures/simulation/acme_migration.json` and `lib/simulation/fixture-schema.ts`. Clean removed model references (`anthropic/claude-sonnet-5`, `openai/gpt-5.5`) across all 6 test files (`tests/fixtures/qualification.ts`, `tests/run-assessment.test.ts`, `tests/assessment-results.test.ts`, `tests/eve-agent.test.ts`, `tests/assessment-turns.test.ts`, `tests/models.test.ts`).
7. **Test Suite Migration & Component Deletion Order (`ENG-1`, `CEO-8`):** Retarget `tests/workbench-shell.test.tsx` (18 tests) to `LiveQualificationWorkbench` and `tests/dynamic-form-renderer.test.tsx` (11 tests) to `DynamicDiscoveryForm` before deleting the 4 dark components (`components/workbench/WorkbenchShell.tsx`, `ActionStage.tsx`, `ContextColumn.tsx`, `DynamicFormRenderer.tsx`).

## Acceptance Criteria

1. `System2ModelOutputSchema` and `System2AnalysisResultSchema` contain only `dimensionFindings`, `phase3Form`, `fatalBlocker`, `valueFocus`, `primaryRisk`, and `nextMilestone` (plus `modelUsed` on `System2AnalysisResultSchema`).
2. Calling `toSystem2AnalysisResult` on a choice field with `options: []` coerces `type` to `'text'` with `options: undefined` without throwing.
3. `SYSTEM2_MODELS` contains only `google/gemini-3.8-flash` (Default) and `anthropic/claude-haiku-5.5` (Fast).
4. `scenario_soylent_headless` has `competitive_flags: ['Akamai/Fastly']` and seeded SA notes.
5. The 4 orphaned dark-theme component files are completely removed after test suites are retargeted.
6. All 6 test files cleaned of removed model references.
7. `npm test` and `npm run build` exit 0.

## Testing Plan

| Layer | What | Count | Test Card |
|---|---|---|---|
| **Unit** | `tests/system2-output.test.ts` — Slimmed `System2ModelOutputSchema` validation & empty-option choice coercion to `'text'` | +3 | `protects=System 2 schema validation and resilient choice-to-text field coercion; fails_when=schema requires phase1Gaps/phase2Competitive/summary or throws on select/radio with empty options; no_claim=live LLM gateway latency or model adherence` |
| **Unit** | `tests/models.test.ts` — `SYSTEM2_MODELS` 2-model contract (`gemini-3.8-flash`, `claude-haiku-5.5`) & error message formatting | +2 | `protects=2-model registry and error message format; fails_when=extra models remain in SYSTEM2_MODELS or error message omits model name; no_claim=live Vercel AI Gateway model availability` |
| **Regression** | `tests/run-assessment.test.ts`, `tests/assessment-results.test.ts`, `tests/eve-agent.test.ts` — Sanitized test fixtures | +4 | `protects=test suite execution without references to removed models; fails_when=tests expect sonnet or gpt-5.5; no_claim=live API tokens` |

## Rollback Plan

`git revert <commit-sha>` restores prior schemas, models, fixture, and component files cleanly without database migrations.
