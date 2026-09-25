# 17: Live UI verification and final eval

**Status:** resolved

**Type:** task

**Blocked by:** 12, 15, 16

## Context

Everything in 12–16 is unit-tested with stubs. This slice proves the direct `useEveAgent` path against the real AI Gateway and the Neon `test` branch. The budget is billed runs: at most 3 purposeful ones here.

## Acceptance criteria

- [ ] **Setup:** `pnpm dev` runs with a temporary `.env.local` copied from `.env.test.local`, deleted afterwards.
- [ ] **One live Assessment Session through the workbench**, driven in the in-app browser:
  - assess Acme with the default model;
  - see the paused form, scores and evidence;
  - reload and see the same session resumed;
  - submit discovery answers;
  - see the completed writeback;
  - confirm in Postgres that there is one session with one `sa_feedback` and one `writeback`.
- [ ] **Network:** no `/api/qualification/*` request appears in the network log.
- [ ] **`pnpm eval`** is run once at the end, and its results are recorded.

## Answer

**Live workbench.** Ran `pnpm dev` with a temporary `.env.local` copied from `.env.test.local` (without the retired `EVE_AGENT_ORIGIN`), drove it in the in-app browser, then stopped the server and deleted `.env.local`. Acme was reset to baseline through `/api/crm/reset` first.

1. **Start Assessment** with Claude Sonnet 5. The header showed ANALYZING and Reset was locked. The session ID was saved to `localStorage` as soon as eve created it.
2. **Reload.** The workbench resumed session `wrun_01M3B8E9VHVK0RWPWRH6GAGD9X` in PENDING_FEEDBACK: "System 2 Reasoning Complete (54/100)", the Economic Buyer blocker, the generated discovery form (radio, textarea and text fields), and System 2 citations under Identify Pain in the rubric.
3. **Submitted the discovery form.** EVALUATING appeared. Reloading mid-turn resumed EVALUATING with Reset still locked, and the turn then completed: "Qualification Finalized (85/100)", `[QUALIFIED] … | Owner: SA (Lead) + AE | … | Watch: Netlify (high threat)`.
4. **Reload of the closed session** showed COMPLETED with the same result. The console had no errors.
5. **Network:** one `POST /eve/v1/session`, then one `POST /eve/v1/session/wrun_01M3B8E9…` (turn 2 on the same session), plus stream GETs. No `/api/qualification` request, and no `/api/*` calls at all during the session.
6. **Postgres (test branch), that session:** `initial_scoring` and `questions_generated` (model `anthropic/claude-sonnet-5`) in turn_0; `sa_feedback`, `initial_scoring` and `writeback` in turn_1. That is exactly one `sa_feedback` and one `writeback`. `ae_notes` is unchanged, the SA notes carry the appended discovery update, and the status is `qualified` at 85.

**`pnpm eval`**, the final run: all green, exit 0. The live-run lease was released afterwards.

| Eval | Gates | Judges |
|---|---|---|
| acme/assess-then-qualify | 26/26 | citationsGrounded 88%, playbookQuality 99% |
| globex/amplify-in-review | 9/9 | – |
| soylent/q4-freeze-headless | 9/9 | Q4-freeze judge 90% |
| failure/gateway-failure-no-writeback | 7/7 | `noFailedActions` 0%, as designed |

Artifacts are in `.eve/evals/2026-09-25T03-12-37` and `2026-09-25T03-13-19`.

**Billed runs this effort: 3.** The two UI turns are one Assessment Session (turn 1 and turn 2), plus one `pnpm eval`.
