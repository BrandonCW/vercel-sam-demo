# 08: eve Agent Structure, Typed Tools, Subagents & Channel Auth

**What to build:**
Bring `agent/` in line with eve's documented conventions and spec §3 so the agent is correct and safe to drive in isolation (no Next.js UI dependency).

**Blocked by:** 06, 07

**Status:** resolved

## Scope

- **Tool contracts**: replace all `z.any()` (`jevResult`, `meddpiccBreakdown`) with real Zod schemas. Tools take `opportunityId` and load records themselves; the model never re-types opportunity data.
- **Decisions in code, not model**: stage gate result, qualification status (incl. fatal-blocker detection), and the standardized Suggested Next Steps string are computed inside tools, not by the LLM and not in API routes.
- **Writeback invariant**: `crm_update_next_steps` rejects any write if `ae_notes` would change.
- **Subagents** (`agent/subagents/<id>/tools/`), since subagents do not inherit root tools:
  - `qualification_assessor`: `crm_read_deal`, `run_jev_scoring`.
  - `playbook_generator`: `run_system2_analysis` (System 2 now also returns per-dimension **citations** and gap callouts — user story 5).
  - Root instructions explicitly delegate to them.
- **Built-in tools**: disable `bash`, `web_fetch`, `web_search`, `write_file` on the root agent.
- **Channel auth**: replace `none()` in `agent/channels/eve.ts` with `localDev()` + a custom `AuthFn` verifying the `deal_qual_session` cookie via `lib/auth.ts`.
- **Models**: replace retired `anthropic/claude-3-5-sonnet` defaults with current Gateway model IDs from one shared config; update System 2 model enum and spec §1 / user story 20 dropdown options.
- **Skills**: add `description` frontmatter to `meddpicc_evaluator.md` and `scenario_seeder.md`.
- **Instructions**: remove duplicated rubric weights (point to `docs/meddpicc-rubric.md`); correct System 1 description to "Jev evaluation model".

## Acceptance criteria

- [x] `npx eve info` → 0 errors, 0 warnings; subagents list their tools; built-ins above absent.
- [x] No `z.any()` in `agent/tools/`.
- [x] Anonymous `POST /eve/v1/session` in a non-dev environment → 401.
- [x] No retired model IDs anywhere in `agent/`, `lib/`, `.env.example`, or the spec.

## Answer

All agent behaviour now lives in the eve agent under `agent/`; `lib/` keeps only pure helpers and data access, and a test fails if `lib/`, `app/` or `components/` call a model.

- **Root** (`agent/agent.ts`, `instructions.md`): tools `crm_read_deal`, `crm_update_next_steps` (status incl. fatal blocker + Suggested Next Steps decided in code, rejects `ae_notes` changes), `reset_crm_data`; built-ins `bash`, `web_fetch`, `web_search`, `write_file` disabled. Instructions delegate to both subagents and describe the assess, post-feedback and structured-outcome contracts.
- **`qualification_assessor`**: `crm_read_deal`, `run_jev_scoring` (calls `evaluate` from `eve/ai` directly; request building and interpretation stay pure in `lib/agents/jev-scorer.ts`).
- **`playbook_generator`**: `run_system2_analysis` (the System 2 `generateText` call moved here from `lib/agents/system2-runner.ts`, now deleted). It returns per-dimension citations and gap callouts, which are merged into `meddpicc_breakdown` so `ContextColumn` fills `dim.evidence`/`dim.gaps` unchanged.
- **Routes → eve**: `/api/qualification/assess` and `/feedback` call `runAgentTurn` (`lib/eve-session.ts`), which opens an eve session with `eve/client` against the same-origin `/eve/v1/*` mount, forwards the `deal_qual_session` cookie for channel auth, and requires a structured `{ outcome, error }` result. Routes then check that the expected tool rows were freshly persisted (`requireFreshInteractions`) and that System 2 used the selected model, and rebuild the unchanged response shapes from Postgres.
- **Channel auth**: `localDev()` + `deal_qual_session` `AuthFn`; anonymous non-dev → 401.
- **Models**: single source `lib/models.ts` (`anthropic/claude-sonnet-5` default).

Deviations / follow-ups:
- `WorkbenchShell.tsx` default model changed from the retired `'claude-3-5-sonnet'` literal to `DEFAULT_SYSTEM2_MODEL` (one line, no visible change; the old ID is no longer valid).
- The feedback route appends SA notes before the eve turn; a failed turn leaves them appended (ticket 09 moves this into the session).
- Freshness checks are per-opportunity, so concurrent runs on the same opportunity could cross (ticket 09 session ownership).
- Live System 2 on Acme failed twice with schema-invalid structured output (an option missing `value`); Jev itself succeeded. Tracked for ticket 10.
- UI migration to `useEveAgent` is issue 11.
