# 17: Live UI verification and final eval

**Status:** ready-for-agent

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
