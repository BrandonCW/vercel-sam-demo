# 22: Prune System 2 Schema, Simplify Models, Seed Soylent Competitor & Delete Orphaned Legacy Components

**Status:** ready-for-agent  
**Type:** task  
**Blocked by:** none  
**Parent Epic:** [GitHub Issue #6](https://github.com/BrandonCW/vercel-sam-demo/issues/6)

## Context

The System 2 LLM assessment step in `lib/agents/system2.ts` forces generation of three unused top-level properties (`phase1Gaps`, `phase2Competitive`, `summary`) that consume ~65% of the output token budget and have zero UI or backend consumers. On smaller models like Claude Haiku, this triggers mid-JSON truncation. Additionally, `toRenderField()` throws a fatal error if choice fields return empty `options`, and four pre-redesign dark-theme components (~1,200 LOC) remain orphaned in `components/workbench/`.

## Goals

1. **Prune System 2 Schema:** Remove `phase1Gaps`, `phase2Competitive`, and `summary` from `System2ModelOutputSchema` and `System2AnalysisResultSchema` in `lib/agents/system2.ts`. Remove dead sub-schemas `QualificationGapSchema` and `CompetitiveCounterPointSchema`.
2. **Resilient Choice Field Coercion:** Update `toRenderField()` in `lib/agents/system2.ts` to filter empty options and coerce choice fields (`select`, `radio`, `checkbox_group`) with zero options to `'text'` instead of throwing an error.
3. **Update System 2 Prompt:** Clean `agent/lib/assessment-steps.ts:58-74` (`SYSTEM2_PROMPT`) to stop requesting `phase1Gaps`, `phase2Competitive`, or root `summary`.
4. **Simplify Model Registry:** Update `SYSTEM2_MODELS` in `lib/models.ts` to exactly two models: `google/gemini-3.8-flash` (Default) and `anthropic/claude-haiku-5.5` (Fast). Keep default agent and system2 models as `google/gemini-3.8-flash`.
5. **Seed Competitive Flag for Soylent:** In `lib/db/scenarios.ts:145`, change `scenario_soylent_headless` from `competitive_flags: []` to `competitive_flags: ['Akamai / Fastly']`.
6. **Update Simulation Fixtures & Evals:** Remove pruned fields from `lib/fixtures/simulation/acme_migration.json`, `lib/simulation/fixture-schema.ts`, and test files (`tests/system2-output.test.ts`, evals).
7. **Delete Orphaned Dark-Theme Components:** Delete `components/workbench/WorkbenchShell.tsx`, `components/workbench/ActionStage.tsx`, `components/workbench/ContextColumn.tsx`, and `components/workbench/DynamicFormRenderer.tsx`.

## Acceptance Criteria

1. `System2ModelOutputSchema` and `System2AnalysisResultSchema` contain only `dimensionFindings`, `phase3Form`, `fatalBlocker`, `valueFocus`, `primaryRisk`, and `nextMilestone` (plus `modelUsed` on `System2AnalysisResultSchema`).
2. Calling `toSystem2AnalysisResult` on a choice field with `options: []` coerces `type` to `'text'` without throwing.
3. `SYSTEM2_MODELS` contains only `google/gemini-3.8-flash` (Default) and `anthropic/claude-haiku-5.5` (Fast).
4. `scenario_soylent_headless` has `competitive_flags: ['Akamai / Fastly']`.
5. The 4 orphaned dark-theme component files are completely removed.
6. `npm test` and `npm run build` exit 0.

## Testing Plan

| Layer | What | Count | Test Card |
|---|---|---|---|
| **Unit** | `tests/system2-output.test.ts` — Slimmed `System2ModelOutputSchema` validation & empty-option choice coercion to `'text'` | +3 | `protects=System 2 schema validation and resilient choice-to-text field coercion; fails_when=schema requires phase1Gaps/phase2Competitive/summary or throws on select/radio with empty options; no_claim=live LLM gateway latency or model adherence` |
| **Unit** | `tests/models-and-scenarios.test.ts` — `SYSTEM2_MODELS` 2-model contract (`gemini-3.8-flash`, `claude-haiku-5.5`) & non-empty `competitive_flags` across all 3 scenarios | +2 | `protects=2-model registry and competitive flag seeding on all 3 scenarios; fails_when=extra models remain in SYSTEM2_MODELS or any scenario has empty competitive_flags; no_claim=live Vercel AI Gateway model availability` |

## Rollback Plan

`git revert <commit-sha>` restores prior schemas, models, fixture, and component files cleanly without database migrations.
