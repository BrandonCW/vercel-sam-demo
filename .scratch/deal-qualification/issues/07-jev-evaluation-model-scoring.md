# 07: System 1 on Real Jev (`typesafe-ai/jev`) via AI Gateway Evaluation API

**What to build:**
Replace the current "Jev" (actually `openai/gpt-4o-mini` with a "You are Jev" system prompt) with TypeSafe AI's Jev evaluation model through Vercel AI Gateway. Jev answers typed questions (score / choice / boolean) about supplied state; composite score and stage gates are computed deterministically in code from its answers.

**Blocked by:** 06

**Status:** ready-for-agent

## Research (2026-09-25)

- Model: `typesafe-ai/jev`. Evaluation modality, not a language model. Requires AI SDK ≥ 7.0.105 (repo has 7.0.112).
- Inside eve tools use `evaluate` from `eve/ai` (defaults to Jev, shares Gateway auth incl. `eve dev` `/login`, accepts `abortSignal: ctx.abortSignal`). Outside eve: `experimental_evaluate` from `ai`.
- Input: `state` (string | object | array) + `questions` map. All questions answered in one request.
- Output per question: `score` → `{ score, probabilities }` (interpolated across ordered `criteria` array, lowest→highest); `choice` → `{ choice, probabilities }`; `boolean` → `{ probability }`. Confidence in `result.providerMetadata.typesafe.confidence`.
- Jev does **not** return text: no citations, no gap prose.
- Supports `providerOptions: { gateway: { zeroDataRetention: true } }`.
- Billed per token; the free tier ended 2026-09-25.
- Docs: https://vercel.com/docs/ai-gateway/modalities/evaluation, https://vercel.com/changelog/typesafe-ai-jev-now-available-on-ai-gateway, `node_modules/eve/docs/guides/evaluate.md`.

## Design

- `state`: `{ stageName, amount, aeNotes, saNotes }` for the opportunity.
- 8 `score` questions, one per MEDDPICC dimension. Criteria rungs derived from `docs/meddpicc-rubric.md` (single source of truth), mapped to the 0–10 scale.
- Status (`unaddressed` 0–3 / `partial` 4–7 / `verified` 8–10) derived in code from score.
- One `choice` question per taxonomy competitor (Netlify, AWS Amplify, Cloudflare Pages, Akamai/Fastly, DIY Kubernetes/ECS) with options `absent | low | medium | high`.
- Confidence per dimension from `providerMetadata.typesafe.confidence`.
- Weighted composite + Gate 2 / Gate 3 rules computed in code (pure functions, unit-testable with fixtures).
- Enable `zeroDataRetention`.
- Output still validated with `JevScoringResultSchema`; drop `citations` / `gap` text fields from the Jev contract (moved to System 2, see 08/spec amendment).
- Any Jev error throws (per 06).

## Acceptance criteria

- [ ] No `generateText` / LLM call remains in System 1; `JEV_SYSTEM_PROMPT` deleted.
- [ ] `run_jev_scoring` calls `evaluate` from `eve/ai` with `ctx.abortSignal`.
- [ ] Pure `computeComposite` / `evaluateStageGate` functions covered by fixture-based unit tests.
- [ ] Live test (10) confirms Acme baseline: composite 50–58, Identify Pain ≥ 8, Netlify `high`, Gate 2 blocked on Economic Buyer.
- [ ] Spec §4 and user story 5 updated (citations → System 2).
