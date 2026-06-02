# Testing Guide

This document explains how to run the Swarm test suite, what each test file covers, and how to write new tests.

---

## Running the test suite

Swarm uses Node.js's built-in `node:test` runner. No install step is needed.

Run all tests:

```bash
node --test runtime/runner.test.js runtime/contract.test.js runtime/audit.test.js
```

Run a single file:

```bash
node --test runtime/audit.test.js
```

A passing run prints one `ok` line per test. Failures print a diff and the failing assertion.

---

## What each test file covers

### `runtime/contract.test.js`

Tests the structured output contract parser (`runtime/contract.js`):

- Extracting a valid trailing `json` fenced block from agent output
- Handling missing blocks (returns `structured: false`)
- Handling malformed JSON (returns `structured: false`)
- Multiple blocks — the last one wins
- Invalid `status` values are rejected
- `fallbackContract` creates a minimal contract from free text

### `runtime/runner.test.js`

Tests the core runner logic (`runtime/runner.js`):

- `buildAgentPrompt` — assembles role, task, context, prior output, and the contract suffix
- `parseCliEnvelope` — parses the `claude --output-format json` response shape
- `shouldRetry` — returns true on timeout, non-zero exit, or missing contract (within retry budget)
- `budgetCheck` — flags cost then tokens when limits are exceeded
- `resolveLimits` — merges blueprint limits with CLI overrides, coercing strings to numbers
- `runAgent` happy path — returns a structured contract with correct token counts (uses stub)
- `runAgent` timeout path — retries then falls back to unstructured contract
- `run` linear/parallel blueprint — runs 3 agents, totals usage, emits `swarm_done`
- `run` Phase-2 conditional graph — routes to the true/false branch based on agent output
- `run` conditional convergence — both branches rejoin the downstream stage
- `run` chained conditionals — two back-to-back condition nodes route correctly
- `run` budget abort — stops at the first agent that pushes past `max_cost_usd`
- `run` archive — events and history records are written after completion

### `runtime/audit.test.js`

Tests the persistent audit log (`runtime/audit.js`):

- `appendAuditEntry` — writes a valid JSON line including the `user` field
- `readAuditLog` — returns entries in insertion order
- `readAuditLog({ limit: N })` — returns only the last N entries
- `readAuditLog({ blueprint: 'x' })` — filters by blueprint name
- `readAuditLog({ since: ts })` — filters by minimum timestamp
- Directory auto-creation — `appendAuditEntry` creates the parent directory if missing
- Empty-file guard — `readAuditLog` returns `[]` when the file does not exist

---

## The stub pattern (SWARM_CLAUDE_BIN)

The integration tests in `runner.test.js` spawn a real child process but replace the `claude` binary with a local fake script. The fake is at `test/fake-claude.js`.

The environment variable `SWARM_CLAUDE_BIN` overrides which binary `runner.js` calls:

```js
// runtime/runner.js
function claudeBin() { return process.env.SWARM_CLAUDE_BIN || 'claude'; }
```

Tests set the variable before calling `runAgent` or `run`:

```js
process.env.SWARM_CLAUDE_BIN = path.join(__dirname, '..', 'test', 'fake-claude.js');
```

The fake script reads the `-p <prompt>` argument and branches on marker strings embedded in the prompt:

| Prompt contains | Behaviour |
|-----------------|-----------|
| `SLEEP`         | Sleeps 5 s — triggers the timeout path |
| `NOJSON`        | Returns prose with no contract block |
| `HIGHCONF`      | Returns `confidence: 0.95` in the contract |
| `LOWCONF`       | Returns `confidence: 0.3` in the contract |
| *(anything else)* | Returns a normal success contract |

This lets integration tests exercise retry, timeout, branching, and budget logic without making real API calls.

---

## Writing a new test

Here is a minimal worked example — a test for a hypothetical `runtime/mymodule.js`:

```js
// runtime/mymodule.test.js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { myFunction } = require('./mymodule');

test('myFunction returns the expected value', () => {
  const result = myFunction('input');
  assert.equal(result, 'expected output');
});

test('myFunction throws on bad input', () => {
  assert.throws(() => myFunction(null), /invalid input/i);
});
```

Run it with:

```bash
node --test runtime/mymodule.test.js
```

For tests that write files, use a temp path so they do not pollute the repo:

```js
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

test('file is written correctly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-test-'));
  // ... write to dir ...
  // always clean up
  fs.rmSync(dir, { recursive: true });
});
```

---

## Testing blueprints manually

**Validate a blueprint (compiler only):**

```bash
node runtime/compiler.js swarms/research.yaml
```

This prints the compiled execution plan (stages or execution graph) and exits. It catches syntax errors, missing agents, and invalid flow strings without running anything.

**Run a blueprint against the stub (no real API calls):**

```bash
SWARM_CLAUDE_BIN=test/fake-claude.js node runtime/runner.js swarms/research.yaml "test task"
```

The stub returns a valid contract for every agent immediately, so the full run completes in under a second. Events are emitted to `.swarm/events.jsonl` and an archive record is written to `swarms/output/`.

**Check cost and token limits:**

```bash
SWARM_CLAUDE_BIN=test/fake-claude.js node runtime/runner.js swarms/research.yaml "test" --max-cost 0.001
```

The stub charges \$0.005 per agent, so a limit of \$0.001 triggers a `budget_exceeded` abort after the first agent.

---

## Running the dashboard locally

Start the dashboard server:

```bash
node runtime/dashboard.js 7700
```

The server auto-selects a free port starting at 7700 and prints:

```json
{ "type": "dashboard_started", "port": 7700, "url": "http://localhost:7700" }
```

Open `http://localhost:7700` in a browser. The dashboard shows:

- **Agents tab** — topology graph and live agent status
- **Log tab** — real-time event stream
- **History tab** — past runs with token/cost totals
- **Library tab** — available blueprints

While the dashboard is running, replay events from a past run by posting to `/event`:

```bash
curl -s -X POST http://localhost:7700/event \
  -H 'Content-Type: application/json' \
  -d '{"type":"agent_start","agent":"searcher","status":"running","message":"hello"}'
```
