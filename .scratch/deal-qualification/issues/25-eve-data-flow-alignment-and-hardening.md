# 25: Eve Workflow Data Flow Alignment & Operational Hardening

**Status:** resolved  
**Type:** task  
**Blocked by:** 24  
**Parent Epic:** [GitHub Issue #6](https://github.com/BrandonCW/vercel-sam-demo/issues/6)

## Context
During the Eve Data Flow & Architecture Review documented in `public/eve-swimlane-review.html` (and mirrored in `architecture-evolution.html` and `.scratch/deal-qualification/eve-swimlane-review.html`), seven architectural findings were identified across the 3-swimlane runtime (`Client / Workbench UI`, `Eve Agent Core`, and `Durable Execution / Vercel Workflow`).

These findings range from P0 edge-case handling (cancellation events trapping the UI, unpropagated abort signals wasting AI Gateway compute) to P1 agent configuration hygiene (omitted `defaultTools: false`, redundant `disableTool()` stub files, auth gate evaluation order) and P2 operational hardening (resilient discovery parsing, mid-submit reload continuity, audit metadata precision, and removal of prototype score fallbacks).

Addressing these 7 items brings the Eve Deal Qualification codebase into strict alignment with `eve@0.64.1` conventions and Vercel Workflow durable execution principles.

## Current State

1. **Missing `turn.cancelled` & `session.completed` in `assessmentReducer` (P0)**:
   - `lib/assessment-results.ts:168-230`: `reduce(view, event)` contains no branches for `turn.cancelled` or `session.completed`.
   - When a turn is aborted via `agent.abort()`, the reducer ignores the event, leaving `runningTool: 'run_assessment'`, `system2Running: true`, or `phase: 'assessing'` / `'submitting_feedback'`.
   - In `components/workbench/LiveQualificationWorkbench.tsx:310-330`, this leaves `turnInFlight: true` or locks the UI from safely returning to `'READY_TO_ASSESS'` or `'PENDING_FEEDBACK'`.
   - If an SA was in Turn 2 (answering discovery findings) and cancelled, failing the view or leaving it unhandled discards or traps Turn 1's 35-second baseline Jev + System 2 synthesis.

2. **Unpropagated `ctx.abortSignal` into Gateway & Scoring Steps (P0)**:
   - `agent/tools/run_assessment.ts:54-72`: `ctx.abortSignal` is received from Eve's workflow context, but is never passed into `scoreWithJev(...)` or `analyzeWithSystem2(...)`.
   - `agent/lib/assessment-steps.ts:30-45`: `scoreWithJev` invokes `evaluate(...)` without an abort signal.
   - `agent/lib/assessment-steps.ts:80-115`: `analyzeWithSystem2` uses `AbortSignal.timeout(180_000)` only, ignoring workflow cancellation. If the user cancels an assessment, background AI Gateway requests continue running to timeout, incurring unnecessary latency and token costs.

3. **Missing `defaultTools: false` & `tool: false` in `agent/agent.ts` (P1)**:
   - `agent/agent.ts:4-15`: Configures `defineAgent` without `defaultTools: false` or `tool: false`.
   - Consequently, Eve compiles 7 default framework tools (`read_file`, `todo`, `load_skill`, `connection_search`, `ask_question`, `task_cancel`, `tools/agent.ts`) into `.eve/compile/compiled-agent-manifest.json`, none of which are used by this deal qualification agent.
   - Four legacy stubs (`agent/tools/{bash,web_fetch,web_search,write_file}.ts`) export `disableTool()`, which is redundant when `defaultTools: false` is configured.

4. **Static Agent Model Resolution vs `defineDynamic` (P1)**:
   - `agent/agent.ts:7`: Calls `model: resolveAgentModel()` at compile/module evaluation time.
   - Eve 0.64 supports dynamic runtime model resolution via `model: defineDynamic({ events: { 'session.started': () => resolveAgentModel() } })`, allowing per-session model configuration and clean environment-variable overriding without bundle re-evaluation.

5. **`EVE_CHANNEL_AUTH` Ordering & Unprotected `reset_crm_data` (P1)**:
   - `lib/eve-auth.ts:24`: Exports `EVE_CHANNEL_AUTH = [dealQualSessionAuth, localDev()]`.
   - `lib/eve-auth.ts:13-21` calls `verifySessionToken(token)`, which invokes `getAuthEnv().appPassword`. In local development (`NODE_ENV === 'development'`) where `APP_PASSWORD` is intentionally unset, holding a stale browser cookie throws an unhandled error instead of bypassing auth or allowing loopback development requests.
   - `agent/tools/reset_crm_data.ts:24-32`: Tool allows destructive database reset (`full: true` wipes all opportunities) without `approval: always()`, meaning an autonomous LLM could trigger database wipes without human operator confirmation.

6. **Brittle `ctx.ask` Parsing & Reload Mid-Submit Race (P2)**:
   - `agent/tools/run_assessment.ts:63-68`: Calls `parseSaAnswer(reply.text)`. If JSON parsing or Zod validation fails, `run_assessment` throws immediately, failing the entire assessment session without retry.
   - `lib/ui/saved-assessment-session.ts:20-60` & `components/workbench/LiveQualificationWorkbench.tsx:420-435`: When an SA clicks "Submit Findings", `agent.respond` sends the payload and the local reducer switches to `'submitting_feedback'`. However, `client.input.responded` is a client-only event; if the browser reloads before `feedback_recorded` streams back, stream replay starts at server events where `phase` is `'awaiting_feedback'`, momentarily flashing the discovery form.

7. **Error Taxonomy, Audit Precision & Score Fallback Slop (P2)**:
   - `agent/lib/assessment-steps.ts`: Steps set `maxRetries = 0` uniformly without distinguishing fatal errors (missing opportunity, schema violation) from transient network failures.
   - `lib/db/assessments.ts:66`: `recordSystem2Analysis` hardcodes `sessionState: 'pending_feedback'`, even when invoked with `writebackWithoutFeedback: true` where no feedback is ever awaited.
   - `lib/db/assessments.ts:175`: Final writeback interaction sets `audit.actor = 'system1_jev'` instead of representing the overall assessment session synthesis.
   - `components/workbench/LiveQualificationWorkbench.tsx:437`: Contains `const liveScore = currentOpportunity.meddpicc_score ?? view.jevResult?.overallScore ?? (isComplete ? 76 : 0);`, a hardcoded `76` score fallback lingering from early UI prototypes.

## Desired Behavior & Goals

1. **Graceful Cancellation & Resumption**:
   - `turn.cancelled` resets in-flight tool indicators (`runningTool: null`, `system2Running: false`, `error: null`).
   - If `view.pendingInput` or `view.system2Result` is present (from Turn 1 before feedback submission), `phase` safely reverts to `'awaiting_feedback'` so the SA can continue editing and submitting discovery answers.
   - If cancelled before discovery, `phase` returns cleanly to `'ready'`.
   - `session.completed` transitions `phase` to `'closed'`.

2. **Abort Signal Propagation**:
   - `run_assessment.ts` passes `ctx.abortSignal` to `scoreWithJev` and `analyzeWithSystem2`.
   - `scoreWithJev` passes `signal` to `evaluate(...)`.
   - `analyzeWithSystem2` combines `ctx.abortSignal` with `AbortSignal.timeout(180_000)` via `AbortSignal.any([timeoutSignal, ctx.abortSignal])`, cleanly cancelling in-flight Gateway calls if the user cancels.

3. **Clean Agent Manifest & Tool Surface**:
   - `agent/agent.ts` sets `defaultTools: false` and `tool: false`.
   - Redundant `agent/tools/{bash,web_fetch,web_search,write_file}.ts` stubs are removed.
   - `npx eve info` and `npx eve build` verify that only intentional tools (`crm_read_deal`, `reset_crm_data`, `run_assessment`) remain.

4. **Dynamic Agent Model Resolution**:
   - `agent/agent.ts` uses `model: defineDynamic({ events: { 'session.started': () => resolveAgentModel() } })`.

5. **Hardened Auth Flow & Destructive Tool Approval**:
   - `dealQualSessionAuth` checks `shouldBypassAuth()` before verifying tokens and gracefully catches token verification exceptions.
   - `EVE_CHANNEL_AUTH` checks `localDev()` alongside `dealQualSessionAuth`.
   - `agent/tools/reset_crm_data.ts` specifies `approval: always()`, preventing autonomous LLM wiping of the CRM database.

6. **Resilient Discovery Input & Mid-Submit Reload Continuity**:
   - `run_assessment.ts` wraps `ctx.ask` in a retry loop (up to 3 attempts) that re-prompts with validation errors if the SA's submission is malformed.
   - `lib/ui/saved-assessment-session.ts` and `LiveQualificationWorkbench.tsx` track `submittingRequestId`, ensuring a browser refresh while evaluating does not flash the editable discovery form.

7. **Accurate Metadata, Error Handling & Clean State Fallbacks**:
   - `recordSystem2Analysis` accurately sets `sessionState: writebackWithoutFeedback ? 'skipped_feedback' : 'pending_feedback'`.
   - `LiveQualificationWorkbench.tsx:437` removes the hardcoded `(isComplete ? 76 : 0)` fallback in favor of `view.result?.finalScore ?? 0`.

## Scope

- **In Scope**:
  - `lib/assessment-results.ts`: Handle `turn.cancelled` and `session.completed` in `assessmentReducer`.
  - `agent/tools/run_assessment.ts`: Propagate `ctx.abortSignal`, retry `ctx.ask` on malformed answer.
  - `agent/lib/assessment-steps.ts`: Pass abort signal to `evaluate` and `generateText`.
  - `agent/agent.ts`: Add `defaultTools: false`, `tool: false`, dynamic model resolution.
  - Remove redundant `agent/tools/{bash,web_fetch,web_search,write_file}.ts`.
  - `lib/eve-auth.ts`: Reorder and harden auth fallbacks.
  - `agent/tools/reset_crm_data.ts`: Add `approval: always()`.
  - `lib/ui/saved-assessment-session.ts`: Persist and restore `submittingRequestId`.
  - `components/workbench/LiveQualificationWorkbench.tsx`: Clean up score fallback and integrate `submittingRequestId`.
  - `lib/db/assessments.ts`: Accurate `sessionState` when `writebackWithoutFeedback: true`.
  - Unit and integration tests covering all 7 fixes.

- **Out of Scope**:
  - Modifying the underlying MEDDPICC 8-dimension scoring weights or prompt rubric.
  - Changing CRM schema tables or adding new database columns.
  - Modifying external Eve package internals.

## Technical Approach

### 1. `lib/assessment-results.ts` (`assessmentReducer`)
Handle `turn.cancelled`:
```ts
case 'turn.cancelled': {
  if (view.phase === 'failed') return view;
  const hasAwaitingDiscovery = Boolean(view.pendingInput || (view.system2Result && !view.feedback));
  return {
    ...view,
    phase: hasAwaitingDiscovery ? 'awaiting_feedback' : 'ready',
    runningTool: null,
    system2Running: false,
    error: null,
  };
}
case 'session.completed':
  return {
    ...view,
    phase: 'closed',
    runningTool: null,
    system2Running: false,
    pendingInput: null,
  };
```

### 2. `agent/tools/run_assessment.ts` & `agent/lib/assessment-steps.ts`
Thread `ctx.abortSignal`:
```ts
// run_assessment.ts
const baseline = await scoreWithJev(opportunityId, ctx.abortSignal);
...
const analysis = await analyzeWithSystem2(scored, baseline.jevResult, system2Model, scope, ctx.abortSignal);
```
Combine signals in `analyzeWithSystem2`:
```ts
const abortSignal = signal
  ? AbortSignal.any([AbortSignal.timeout(SYSTEM2_TIMEOUT_MS), signal])
  : AbortSignal.timeout(SYSTEM2_TIMEOUT_MS);
```

### 3. `agent/agent.ts`
```ts
import { defineAgent, defineDynamic } from "eve";
import { resolveAgentModel } from "@/lib/models";

export default defineAgent({
  description:
    "Enterprise Deal Qualification Agent orchestrating MEDDPICC scoring (Jev), System 2 deep reasoning, and CRM writeback.",
  defaultTools: false,
  tool: false,
  model: defineDynamic({
    events: {
      "session.started": () => resolveAgentModel(),
    },
  }),
  limits: {
    sessionTimeoutMs: 30 * 24 * 60 * 60 * 1_000,
  },
});
```

### 4. `lib/eve-auth.ts`
```ts
export const dealQualSessionAuth: AuthFn<Request> = async (request) => {
  if (shouldBypassAuth()) {
    return {
      attributes: {},
      authenticator: 'deal_qual_session',
      principalId: 'deal-qual-demo-user',
      principalType: 'user',
    };
  }
  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);
  if (!token) return null;
  try {
    if (!(await verifySessionToken(token))) return null;
  } catch {
    return null;
  }
  return {
    attributes: {},
    authenticator: 'deal_qual_session',
    principalId: 'deal-qual-demo-user',
    principalType: 'user',
  };
};

export const EVE_CHANNEL_AUTH: AuthFn<Request>[] = [localDev(), dealQualSessionAuth];
```

### 5. `agent/tools/reset_crm_data.ts`
```ts
import { always } from "eve/tools/approval";
...
export default defineTool({
  description: "...",
  approval: always(),
  inputSchema: ...
```

### 6. `agent/tools/run_assessment.ts` (`ctx.ask` retry loop)
```ts
let answer: SaAnswer | null = null;
let promptText = DISCOVERY_PROMPT;
for (let attempt = 1; attempt <= 3; attempt++) {
  const reply = await ctx.ask({ prompt: promptText, display: "text", allowFreeform: true });
  try {
    answer = parseSaAnswer(reply.text);
    break;
  } catch (err) {
    if (attempt === 3) throw err;
    promptText = `${DISCOVERY_PROMPT} (Previous response invalid: ${err instanceof Error ? err.message : String(err)}. Please re-submit valid JSON.)`;
  }
}
```

### 7. Mid-Submit Reload Continuity & Score Fallback
- In `lib/ui/saved-assessment-session.ts`, add `saveSubmittingRequestId`, `loadSubmittingRequestId`, `clearSubmittingRequestId`.
- In `LiveQualificationWorkbench.tsx`:
  - When `handleSubmitFeedback` triggers, save `submittingRequestId`.
  - When `feedback_recorded` arrives or phase settles to `'closed'` / `'ready'`, clear `submittingRequestId`.
  - If `submittingRequestId` matches `view.pendingInput?.requestId`, maintain the evaluating/submitting state.
  - In `liveScore`, replace `(isComplete ? 76 : 0)` with `view.result?.finalScore ?? 0`.

## Verification & Test Plan

1. **Unit Tests**:
   - `tests/assessment-results.test.ts`: Test `turn.cancelled` returning to `'ready'` (Turn 1) and `'awaiting_feedback'` (Turn 2 with System 2 result). Test `session.completed` returning `'closed'`.
   - `tests/run-assessment.test.ts`: Test `ctx.ask` retry logic with invalid JSON followed by valid JSON.
   - `tests/eve-channel-auth.test.ts`: Test `dealQualSessionAuth` bypass in development mode and missing `APP_PASSWORD` resilience.
   - `tests/saved-assessment-session.test.ts`: Test `saveSubmittingRequestId` / `loadSubmittingRequestId` / `clearSubmittingRequestId`.
   - `tests/system2-output.test.ts`: Test abort signal handling in `analyzeWithSystem2`.

2. **Regression & Full Suite Execution**:
   - Run `node --env-file=.env.local node_modules/vitest/vitest.mjs run` across all 31 test suites (230+ tests).
   - Run `npx tsc --noEmit` to verify type cleanliness.
   - Run `npx eve info` and `npx eve build` to confirm compiled manifest cleanliness (no orphan default tools or disabled stubs).
