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
  - `buildJevEvaluationRequest(input)` builds `state` `{ stageName, amount, aeNotes, saNotes }`, 8 `score` questions with 10 levels, Jev's maximum. Level p stands for round(p × 10 / 9) on the 0–10 scale and is worded with that value's rubric band. Jev's fractional position is scaled the same way, and 5 competitor `choice` questions (`absent | low | medium | high`). `zeroDataRetention` is currently off (see below).
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

- **Zero Data Retention is not used (user decision, permanent).** The Gateway refused ZDR on the Pro Trial plan, and the user then decided it is not required. The request sends no `providerOptions`.
- **Score questions now have 10 levels instead of 11.** The second live attempt failed with 400 `TypeSafe Score questions support at most 10 levels`. A brief 3-band version was replaced by 10 levels to keep 0–10 granularity. The fix was made test-first.

### Live Acme result (third attempt, 10 levels, no ZDR)

- **Confidence shape:** `providerMetadata.typesafe.confidence` is a map keyed by question id, covering every dimension and every `competitor_*` question, with values from 0 to 1. The existing per-question handling fits it, so no fix was needed.
- **Usage and cost:** 4,346 input tokens and 380 output tokens; Gateway `marketCost` about $0.00018.
- **Mapped scores (0–10):**

| Dimension | Score | Confidence |
|---|---|---|
| Identify Pain | 6 | 0.77 |
| Champion | 2 | 0.34 |
| Economic Buyer | 6 | 0.70 |
| Decision Criteria | 6 | 0.78 |
| Decision Process | 3 | 0.49 |
| Metrics | 5 | 0.69 |
| Competition | 6 | 0.70 |
| Paper Process | 1 | 0.53 |

- **Against the acceptance criteria** (the mapping was not tuned toward them):

| Criterion | Actual | Result |
|---|---|---|
| Composite 50–58 | 48 | **FAIL** |
| Identify Pain ≥ 8 | 6 (position 5.31/9) | **FAIL** |
| Netlify `high` | `high` (p = 0.94); no other competitor flagged | PASS |
| Gate 2 blocked on Economic Buyer | blocked, but on Champion 2/10 and Overall 48/100. Economic Buyer is 6, above the ≥ 4 gate. | **FAIL** |

- **Why it differs:** the Acme fixture notes say "Met with VP of E-Commerce… Budget allocated ($180k ACV)", which Jev reads as partial Economic Buyer evidence. The notes also name no champion; they say only "Technical decision rests with Head of Platform". The baseline figures (Identify Pain 8, Champion 7, Economic Buyer 3) seem to reflect the spec author's expectations rather than these notes.
- **Open decision:** either revise the criteria or the Acme fixture notes (ticket 10 seeds the data), or accept Jev's reading.
- `tests/jev.live.test.ts` still asserts the original criteria, so it fails on the real output. It is opt-in.

### Acme notes rewritten; live Acme check passes

The user decided to rewrite the Acme scenario notes in `lib/db/fixtures.ts` so they tell the demo story. The mapping and scoring were not changed. Two billed runs were made.

**What the notes now say:**
- **Pain, quantified and verified:** 45-minute builds, a deploy queue that backs up on launch days, and a Black Friday preview outage that cost about $400k according to the customer's own post-mortem.
- **Named, active champion:** Priya Raman, Head of Platform, who is building the business case herself.
- **Economic Buyer named but unengaged:** Priya assumes the CFO, Mark Ellis, would sign. We have no contact with him and no budget is approved; the ~$180k ACV is our own estimate.
- **Netlify as incumbent:** three years in, with a 30% renewal discount on the table and 90 days left on the contract.
- **SA notes:** no written requirements, no POC or timeline, no build-time target, and no legal or procurement process yet.
- The strings `tests/crm.test.ts` asserts are kept.

**Run 1** (the first version also had a written requirements list, a POC ask and a target metric): composite 69, Economic Buyer 5, Gate 2 passed. It missed the criteria.

**Run 2** (revised notes):

| Dimension | Score | Confidence |
|---|---|---|
| Identify Pain | 9 | 0.80 |
| Champion | 7 | 0.75 |
| Economic Buyer | 3 | 0.29 |
| Decision Criteria | 4 | 0.54 |
| Decision Process | 3 | 0.50 |
| Metrics | 7 | 0.63 |
| Competition | 7 | 0.40 |
| Paper Process | 3 | 0.33 |

| Criterion | Actual | Result |
|---|---|---|
| Composite 50–58 | 58 | PASS, at the upper edge |
| Identify Pain ≥ 8 | 9 | PASS |
| Netlify `high` | `high` | PASS |
| Gate 2 blocked on Economic Buyer | Blocked, with a single blocker: Economic Buyer 3/10 | PASS |

Data seeding and reset for all environments stays with ticket 10.
