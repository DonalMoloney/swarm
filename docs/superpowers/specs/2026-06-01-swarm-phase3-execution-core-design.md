# Swarm Phase 3: Reliable Execution Core

**Date:** 2026-06-01
**Branch:** `phase-3-execution-core`
**Focus:** A structured agent-output contract plus a thin, zero-dependency runner that enforces timeouts, retries, and budgets for the common execution path.
**Goal:** Make swarm execution predictable and produce machine-readable agent results — the foundation Phase 2 conditions and the Phase 5 headless runner both depend on.

---

## Overview

Today the swarm is executed by **Claude itself** following the step-by-step
instructions in `skills/swarm.md`: Claude reads the blueprint, spawns agents
with the Agent tool, and shells out to Node helpers (`events.js`,
`checkpoint.js`, `history.js`) for logging and state. There is no programmatic
executor, agents return **free text**, and "timeouts / retries / cost caps"
can only be best-effort instructions.

Phase 3 adds, in a **hybrid** shape:

1. **Structured output contract** — agents return a trailing JSON block;
   `runtime/contract.js` extracts and validates it (lenient fallback).
2. **Thin runner** — `runtime/runner.js` drives agents via the `claude` CLI as a
   subprocess (`child_process`, zero-dep), enforcing per-agent **timeouts**
   (hard kill), **retries**, and per-run **budgets** (tokens / cost).
3. **Accounting + richer events** — token and cost totals flow into the event
   stream and `swarm_done`.

The runner handles the **common path**: linear and parallel flows, no Phase 2
branching/conditions, no checkpoint-resume. Advanced cases remain on the
existing LLM-driven `swarm.md` flow. The runner is **opt-in / standalone** this
phase (invoked explicitly), not wired in as `swarm.md`'s default.

### Non-Goals (deferred)

- Branching / conditional execution through the runner (Phase 2 + later).
- Checkpoint-resume through the runner (Phase 4 builds durable history; runner
  resume is later).
- Streaming partial output, CI triggers, Slack/GitHub notifications (Phase 5).
- Pre-capping an agent's token usage (see "Honest limitations").

---

## Architecture

### Zero-dependency constraint

Per `CLAUDE.md`, the project uses Node built-ins only — no `package.json`, no
npm. The runner therefore invokes the **`claude` CLI** via `child_process`
rather than importing the Agent SDK. Requirement: the `claude` CLI must be on
`PATH` and authenticated in the environment where the runner runs.

### Components

| Unit | File | Responsibility | Depends on |
|------|------|----------------|------------|
| Output contract | `runtime/contract.js` (new) | Extract/validate/fallback the agent JSON block | — (pure) |
| Runner | `runtime/runner.js` (new) | Spawn agents, enforce timeout/retry/budget, run stages, emit events, save output/history | `contract`, `compiler`, `events`, `history`, `simple-yaml`, `child_process` |
| Events | `runtime/events.js` (modified) | Append richer `agent_done` + new event types | — |
| Skill instructions | `skills/swarm.md` (modified) | Append contract suffix to agent prompts; document runner path + retry semantics | — |
| Example blueprint | `swarms/research.yaml` (modified) | Demonstrate optional `limits:` | — |
| Tests | `runtime/*.test.js` (new) | `node:test` unit + one integration test | `node:test` |

Each unit is independently testable; `contract.js` is pure and the runner's
decision logic is factored into pure helpers (below).

---

## The Output Contract — `runtime/contract.js`

### Convention

Every agent prompt is suffixed with an instruction to **end its response with a
fenced JSON block**:

````
```json
{ "status": "success", "summary": "<one-line result>", "confidence": 0.0 }
```
````

- `status` (required): `success` | `partial` | `error`
- `summary` (required): one-line string
- Any additional fields are allowed (e.g. `confidence`, `count`, custom keys).
  These are what Phase 2 `agent_output` conditions evaluate.

### API

```js
// extractContract(text) -> { contract, structured, raw }
//   - finds the LAST ```json fenced block in text, parses it
//   - validates status ∈ {success, partial, error} and summary is a string
//   - structured: true if a valid block was found and validated
//   - on failure, contract is null (caller decides retry vs fallback)
function extractContract(text) { /* ... */ }

// fallbackContract(text) -> { status:'success', summary:<first non-empty line>,
//                             _unstructured:true }
function fallbackContract(text) { /* ... */ }
```

### Lenient behavior (decided)

1. Agent returns → `extractContract`.
2. If `structured` → use it.
3. If not → **retry the agent once** (runner concern).
4. If still not structured → `fallbackContract(text)`, log a warning, set
   `agent_done.structured = false`.

This keeps Phase 1/legacy free-text agents working while giving Phase 2 real
fields whenever the agent cooperates.

---

## The Runner — `runtime/runner.js`

### Agent execution

```js
// runAgent({ name, prompt, timeoutMs, maxRetries, model }) -> result
//   result: { name, status, summary, contract, text, tokens, costUsd,
//             attempts, structured, error? }
```

Steps per attempt:
1. Spawn `claude -p "<prompt>" --output-format json` via `child_process.spawn`.
2. Collect stdout. On exit, `parseCliEnvelope(stdout)` extracts:
   - `result` (the agent's text),
   - `usage` → input/output tokens,
   - `total_cost_usd`.
3. `extractContract(result)` → contract or null.
4. Decide via `shouldRetry(...)`:
   - retry on: nonzero exit, timeout, or null contract — while
     `attempt <= maxRetries`.
   - emit `agent_retry { agent, attempt, reason }` before each retry.
5. On give-up with no contract → `fallbackContract`.

**Timeout (hard enforcement):** a `setTimeout(timeoutMs)` sends `SIGTERM`, then
`SIGKILL` after a short grace period, and the attempt is treated as a timeout
failure (eligible for retry).

### Stage execution

```js
// runStage(stage, ctx) -> [results]
//   parallel stage  -> Promise.all(agents.map(runAgent))
//   sequential stage -> single runAgent
// Prior-stage outputs are concatenated into the next stage's prompt context,
// matching skills/swarm.md's current behavior. Failed upstream agents inject a
// "[FAILED: <agent>]" marker downstream.
```

### Budgets (decided: abort on exceed)

After each agent completes, the runner adds its tokens/cost to running totals
and calls `budgetCheck(totals, limits)`:
- If `max_cost_usd` or `max_tokens` is exceeded → emit
  `budget_exceeded { metric, value, limit }`, **stop launching further agents**,
  and finish with `swarm_done { status: "aborted" }`.
- In-flight parallel agents in the current stage are allowed to finish (we only
  gate *launching* the next work) — simplest correct behavior.

### CLI entry

```bash
node runtime/runner.js swarms/<blueprint>.yaml "<task>" \
  [--max-cost <usd>] [--timeout <seconds>] [--model <name>]
```

Flow: read + `compile` the blueprint → reject if it uses Phase 2
conditions/branches (clear message: "use the LLM flow for branching blueprints")
→ run stages → write final output to `swarms/output/<bp>-<ts>.md` → record
history via `history.append(...)` → emit `swarm_done` with totals.

---

## Configuration

New optional `limits` block in a blueprint (all fields optional → defaults):

```yaml
limits:
  agent_timeout: 300       # seconds per agent attempt   (default 300)
  agent_retries: 1         # extra attempts on failure    (default 1)
  max_cost_usd: 1.00       # per-run budget               (default: none)
  max_tokens: 200000       # per-run budget               (default: none)
```

Per-agent overrides:

```yaml
agents:
  searcher:
    timeout: 120           # overrides limits.agent_timeout
    retries: 2             # overrides limits.agent_retries
    prompt: "..."
```

CLI flags (`--max-cost`, `--timeout`, `--model`) override blueprint values.
**Backward compatible:** blueprints without `limits` use defaults; no budget
caps unless specified.

---

## Event Schema Extensions

Existing types unchanged; the following are added/extended (still
newline-delimited JSON in `.swarm/events.jsonl`):

```json
{ "type": "agent_done", "agent": "searcher", "status": "success",
  "tokens": 4820, "cost_usd": 0.0123, "structured": true,
  "message": "<summary>", "ts": 0 }

{ "type": "agent_retry", "agent": "searcher", "attempt": 2,
  "reason": "timeout", "ts": 0 }

{ "type": "budget_exceeded", "metric": "cost_usd",
  "value": 1.07, "limit": 1.00, "ts": 0 }

{ "type": "swarm_done", "status": "done",
  "total_tokens": 14980, "total_cost_usd": 0.041, "ts": 0 }
```

- `swarm_done.status`: `done` | `aborted` | `error`.
- The dashboard already renders per-agent `tokens`; `cost_usd` surfacing in the
  UI is **deferred to Phase 7** (the events carry it now so no migration later).

---

## Error Handling

Extends the current `swarm.md` policy:
- An agent that fails all attempts → `agent_error`, and a `[FAILED: <agent>]`
  marker is injected into downstream context (unchanged).
- Retries now happen **before** declaring failure.
- A failure that pushes the run over budget trips the abort path (above).
- The runner never throws to the top level for a single agent failure; it
  records and continues, ending with an accurate `swarm_done.status`.

---

## Honest Limitations

- **No pre-cap on agent tokens.** The `claude` CLI does not expose a hard
  per-call token ceiling we can rely on, so `max_tokens` / `max_cost_usd` are
  enforced as **post-agent budget gates** (stop launching more work once
  exceeded), not mid-generation cutoffs. **Timeouts** are the only hard
  mid-agent stop (process kill).
- **Requires the `claude` CLI** on PATH and authenticated. The LLM-driven
  `swarm.md` flow remains available where that is not the case.
- Parallel-stage budget accounting is checked at stage boundaries; agents
  already in flight are allowed to finish.

---

## Testing (zero-dep `node:test`)

First automated tests in the repo. Run with `node --test`.

**Pure unit tests:**
- `contract.test.js` — `extractContract`: valid block; missing block; malformed
  JSON; multiple blocks (last wins); invalid `status`; `fallbackContract` shape.
- `runner.test.js` (pure helpers) — `buildAgentPrompt` appends the contract
  suffix and prior context; `parseCliEnvelope` reads tokens/cost/result;
  `shouldRetry` truth table; `budgetCheck` over/under/at-limit.

**Integration test:**
- A **fake `claude` stub script** (a tiny Node script that prints a canned
  `--output-format json` envelope, or sleeps to trigger timeout) is put on PATH
  for the test. Verifies: happy path returns a parsed contract; a slow stub is
  killed by the timeout and retried; budget abort fires. **No real API calls.**

---

## Success Criteria

Phase 3 is complete when:

- [ ] `runtime/contract.js` extracts/validates the JSON block with lenient fallback.
- [ ] Agent prompts include the contract suffix (in `swarm.md` and runner).
- [ ] `runtime/runner.js` runs a linear and a parallel blueprint end-to-end via
      the `claude` CLI subprocess.
- [ ] Per-agent timeout hard-kills and retries; retries respect `agent_retries`.
- [ ] Per-run `max_cost_usd` / `max_tokens` abort the run with
      `swarm_done.status = "aborted"` and a `budget_exceeded` event.
- [ ] `agent_done` carries `tokens`, `cost_usd`, `status`, `structured`;
      `swarm_done` carries totals.
- [ ] Blueprints with Phase 2 conditions are rejected by the runner with a clear
      message (handled by the LLM flow).
- [ ] `node --test` passes (unit + the stubbed integration test).
- [ ] Backward compatible: existing blueprints and the LLM-driven `swarm.md`
      flow still work unchanged.

---

## Design Philosophy

- **Contract before enforcement.** Define the data shape agents must emit first;
  conditions and accounting become trivial once outputs are structured.
- **Zero-dep, CLI-as-engine.** Shelling the `claude` CLI keeps the no-npm rule
  and doubles as the Phase 5 headless seed.
- **Honest enforcement.** Hard timeouts where we can kill; budget gates where we
  can only measure — stated plainly, not papered over.
- **Additive & backward compatible.** The runner is opt-in; nothing existing
  breaks.
