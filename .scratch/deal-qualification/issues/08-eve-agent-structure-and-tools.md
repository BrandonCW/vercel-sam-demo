# 08: eve Agent Structure, Typed Tools, Subagents & Channel Auth

**What to build:**
Bring `agent/` in line with eve's documented conventions and spec §3 so the agent is correct and safe to drive in isolation (no Next.js UI dependency).

**Blocked by:** 06, 07

**Status:** ready-for-agent

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

- [ ] `npx eve info` → 0 errors, 0 warnings; subagents list their tools; built-ins above absent.
- [ ] No `z.any()` in `agent/tools/`.
- [ ] Anonymous `POST /eve/v1/session` in a non-dev environment → 401.
- [ ] No retired model IDs anywhere in `agent/`, `lib/`, `.env.example`, or the spec.
