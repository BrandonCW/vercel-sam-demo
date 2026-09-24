# 07: System 1 on Real Jev (`typesafe-ai/jev`) via AI Gateway Evaluation API

**What to build:**
Replace the current "Jev" (actually `openai/gpt-4o-mini` with a "You are Jev" system prompt) with TypeSafe AI's Jev evaluation model through Vercel AI Gateway. Jev answers typed questions (score / choice / boolean) about supplied state; composite score and stage gates are computed deterministically in code from its answers.

**Blocked by:** 06

**Status:** resolved

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

- [x] No `generateText` / LLM call remains in System 1; `JEV_SYSTEM_PROMPT` deleted.
- [x] `run_jev_scoring` calls `evaluate` from `eve/ai` with `ctx.abortSignal`.
- [x] Pure `computeComposite` / `evaluateStageGate` functions covered by fixture-based unit tests.
- [ ] Live test (10) confirms Acme baseline: composite 50–58, Identify Pain ≥ 8, Netlify `high`, Gate 2 blocked on Economic Buyer.
- [x] Spec §4 and user story 5 updated (citations → System 2).

## Answer

System 1 now runs on `typesafe-ai/jev` through `evaluate` from `eve/ai`. The `gpt-4o-mini` prompt, `JEV_SYSTEM_PROMPT` and all default-filling are gone.

- `lib/agents/jev-scorer.ts`:
  - `buildJevEvaluationRequest(input)` builds `state` `{ stageName, amount, aeNotes, saNotes }`, 8 `score` questions with 3 rungs, one per rubric band (Jev allows at most 10 levels; its fractional position on 0–2 is scaled linearly to 0–10), and 5 competitor `choice` questions (`absent | low | medium | high`). `zeroDataRetention` is currently off (see below).
  - `interpretJevEvaluation(input, evaluation)` is pure. It rounds and clamps scores, derives status, and reads confidence from `providerMetadata.typesafe.confidence` (a number, or a map keyed by question id). It keeps only non-`absent` competitors, computes the composite and gates in code, and validates with `JevScoringResultSchema`. It throws on any missing answer or confidence.
  - `scoreOpportunityWithJevAI(input, { abortSignal })` asserts the Gateway key, calls `evaluate` and interprets the result.
- The rubric wording lives in `RUBRIC_TEXT`, copied verbatim from `docs/meddpicc-rubric.md`. A test fails if the two drift.
- `jev-schema.ts` drops `evidence`/`gaps` from dimensions and `evidence`/`contextSummary` from competitive flags, because Jev returns no text.
- Callers updated:
  - the tool passes `ctx.abortSignal`;
  - the assess and feedback routes pass `request.signal`.
- Docs updated:
  - spec §4 and user story 5;
  - `agent/instructions.md` and the `qualification_assessor` instructions;
  - the rubric, which now lists Gate 2 Economic Buyer ≥ 4 (the rule the code already enforced) and a plain arrow in place of LaTeX in the Metrics row.
- The live Acme check (composite 50–58, Identify Pain ≥ 8, Netlify `high`, Gate 2 blocked on EB) is still open for ticket 10. A fixture test covers the mapping only. No `AI_GATEWAY_API_KEY` is available locally, so no billed call was made.

### Live Acme check (2026-09-25): blocked

- `tests/jev.live.test.ts` makes one real Jev call on the Acme fixture. It is opt-in: it runs only with `JEV_LIVE=1` and `AI_GATEWAY_API_KEY` set, so `pnpm test` never bills.
- The single attempt was refused by the Gateway with 403 `ZdrUnauthorizedError`, before any provider attempt (`providerAttemptCount: 0`). The error said Zero Data Retention needs an active Pro or Enterprise plan, and the team is on Pro Trial.
- No scores were returned, and the shape of `providerMetadata.typesafe.confidence` is still unconfirmed.
- Next step, for the user to decide: either complete the Vercel plan upgrade, or approve dropping `zeroDataRetention` (the ticket requires it). Then run `JEV_LIVE=1 pnpm vitest run tests/jev.live.test.ts`.

### Deviations after the first live attempts

- **Zero Data Retention is off (user decision).** The Gateway refuses ZDR on the Pro Trial plan. `providerOptions.gateway.zeroDataRetention` is removed, with a TODO in `jev-scorer.ts` and `tests/jev.test.ts` to restore it once the team is on a paid Pro plan.
- **Score questions now have 3 levels instead of 11.** The second live attempt failed with 400 `TypeSafe Score questions support at most 10 levels`. Each dimension now has one rung per rubric band, and Jev's position is scaled linearly to 0–10. The fix was made test-first. Because of this failure, the live Acme criteria are **still unverified**. A further live run (`JEV_LIVE=1 pnpm vitest run tests/jev.live.test.ts`) needs approval.
