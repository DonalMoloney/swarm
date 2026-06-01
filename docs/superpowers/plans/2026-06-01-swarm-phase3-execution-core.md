# Phase 3 — Reliable Execution Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured agent-output contract and a thin zero-dependency runner (driving the `claude` CLI) that enforces timeouts, retries, and per-run budgets for linear/parallel swarm flows.

**Architecture:** `runtime/contract.js` extracts/validates a trailing JSON block from agent output (lenient fallback). `runtime/runner.js` compiles a blueprint, and for non-Phase-2 plans (`plan.stages`) runs each stage's agents via `claude -p … --output-format json` (`child_process`), enforcing per-agent timeout (hard kill) + retries and per-run token/cost budgets (abort on exceed), emitting events and saving output/history. Phase-2 plans (`plan.execution_graph`) are refused with a pointer to the LLM flow. A small `simple-yaml.js` extension parses a top-level `limits:` block.

**Tech Stack:** Node.js built-ins only (`child_process`, `fs`, `path`), `node:test` for tests. No npm. Reuses `runtime/compiler.js`, `events.js`, `history.js`, `context.js`, `simple-yaml.js`.

---

## File Structure

- **Create** `runtime/contract.js` — `extractContract`, `fallbackContract` (pure).
- **Create** `runtime/runner.js` — pure helpers (`buildAgentPrompt`, `parseCliEnvelope`, `shouldRetry`, `budgetCheck`, `resolveLimits`) + `runAgent`, `runStage`, `run`, CLI entry.
- **Create** `runtime/contract.test.js`, `runtime/runner.test.js` — `node:test` suites.
- **Create** `test/fake-claude.js` — stub CLI for the integration test (no real API calls).
- **Modify** `runtime/simple-yaml.js` — parse top-level `limits:` scalar block.
- **Modify** `skills/swarm.md` — document the runner path, contract suffix, retry/budget semantics.
- **Modify** `swarms/research.yaml` — add an example `limits:` block.

Testability seam: the runner resolves the CLI binary from `process.env.SWARM_CLAUDE_BIN || 'claude'`, so tests point it at `test/fake-claude.js`.

---

## Task 1: Output contract — `runtime/contract.js`

**Files:**
- Create: `runtime/contract.js`
- Test: `runtime/contract.test.js`

- [ ] **Step 1: Write the failing test**

```js
// runtime/contract.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { extractContract, fallbackContract } = require('./contract');

test('extracts a valid trailing json block', () => {
  const text = 'Here is my work.\n```json\n{"status":"success","summary":"did it","confidence":0.9}\n```';
  const r = extractContract(text);
  assert.equal(r.structured, true);
  assert.equal(r.contract.status, 'success');
  assert.equal(r.contract.confidence, 0.9);
});

test('missing block -> not structured', () => {
  assert.equal(extractContract('no json here').structured, false);
});

test('malformed json -> not structured', () => {
  assert.equal(extractContract('```json\n{nope}\n```').structured, false);
});

test('multiple blocks -> last wins', () => {
  const text = '```json\n{"status":"error","summary":"a"}\n```\n```json\n{"status":"success","summary":"b"}\n```';
  assert.equal(extractContract(text).contract.summary, 'b');
});

test('invalid status -> not structured', () => {
  assert.equal(extractContract('```json\n{"status":"weird","summary":"x"}\n```').structured, false);
});

test('fallbackContract uses first non-empty line', () => {
  const fb = fallbackContract('\n  first line  \nsecond');
  assert.equal(fb.status, 'success');
  assert.equal(fb.summary, 'first line');
  assert.equal(fb._unstructured, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test runtime/contract.test.js`
Expected: FAIL — `Cannot find module './contract'`.

- [ ] **Step 3: Write minimal implementation**

```js
// runtime/contract.js
'use strict';

const STATUSES = ['success', 'partial', 'error'];

function extractContract(text) {
  if (typeof text !== 'string') return { contract: null, structured: false, raw: text };
  const re = /```json\s*([\s\S]*?)```/gi;
  let m, last = null;
  while ((m = re.exec(text)) !== null) last = m[1];
  if (last === null) return { contract: null, structured: false, raw: text };
  let parsed;
  try { parsed = JSON.parse(last.trim()); }
  catch { return { contract: null, structured: false, raw: text }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { contract: null, structured: false, raw: text };
  }
  if (!STATUSES.includes(parsed.status) || typeof parsed.summary !== 'string') {
    return { contract: null, structured: false, raw: text };
  }
  return { contract: parsed, structured: true, raw: text };
}

function fallbackContract(text) {
  const firstLine = String(text || '').split('\n').map(l => l.trim()).find(Boolean) || '';
  return { status: 'success', summary: firstLine.slice(0, 200), _unstructured: true };
}

module.exports = { extractContract, fallbackContract, STATUSES };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test runtime/contract.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add runtime/contract.js runtime/contract.test.js
git commit -m "feat(phase3): agent-output contract extractor with lenient fallback"
```

---

## Task 2: Parse `limits:` block — `runtime/simple-yaml.js`

**Files:**
- Modify: `runtime/simple-yaml.js`
- Test: `runtime/simple-yaml.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// runtime/simple-yaml.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const yaml = require('./simple-yaml');

test('parses a top-level limits block as scalars', () => {
  const text = [
    'name: demo',
    'flow: "a → b"',
    'limits:',
    '  agent_timeout: 120',
    '  agent_retries: 2',
    '  max_cost_usd: 1.50',
    'agents:',
    '  a:',
    '    prompt: "x"',
    '  b:',
    '    prompt: "y"',
  ].join('\n');
  const bp = yaml.parse(text);
  assert.deepEqual(bp.limits, { agent_timeout: '120', agent_retries: '2', max_cost_usd: '1.50' });
  assert.equal(bp.name, 'demo');
  assert.ok(bp.agents.a && bp.agents.b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test runtime/simple-yaml.test.js`
Expected: FAIL — `bp.limits` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `runtime/simple-yaml.js`, change the indent-0 branch to recognize `limits` as a scalar-block opener, and add an indent-2 handler for it. Replace the existing indent-0 `if/else if` block:

```js
      if (SECTION_KEYS.includes(k) && !v) {
        result[k] = {};
        section = k;
      } else if (v) {
        result[k] = v.startsWith('[') ? parseInlineArray(v) : stripQuotes(v);
      }
```

with:

```js
      if (SECTION_KEYS.includes(k) && !v) {
        result[k] = {};
        section = k;
      } else if (k === 'limits' && !v) {
        result.limits = {};
        section = 'limits';
      } else if (v) {
        result[k] = v.startsWith('[') ? parseInlineArray(v) : stripQuotes(v);
      }
```

Then add this branch **before** the existing `else if (section && indent === 2)` branch:

```js
    } else if (section === 'limits' && indent === 2) {
      const colonIdx = content.indexOf(':');
      if (colonIdx !== -1) {
        const lk = content.slice(0, colonIdx).trim();
        const lv = content.slice(colonIdx + 1).trim();
        result.limits[lk] = stripQuotes(lv);
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test runtime/simple-yaml.test.js`
Expected: PASS.
Run: `node runtime/compiler.js swarms/research.yaml`
Expected: still prints a valid Execution Plan (no regression).

- [ ] **Step 5: Commit**

```bash
git add runtime/simple-yaml.js runtime/simple-yaml.test.js
git commit -m "feat(phase3): parse top-level limits block in simple-yaml"
```

---

## Task 3: Runner pure helpers — prompt + envelope

**Files:**
- Create: `runtime/runner.js` (helpers + exports only for now)
- Test: `runtime/runner.test.js`

- [ ] **Step 1: Write the failing test**

```js
// runtime/runner.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildAgentPrompt, parseCliEnvelope } = require('./runner');

test('buildAgentPrompt includes task, context, prior output, and contract suffix', () => {
  const p = buildAgentPrompt('You analyze.', 'do thing', 'CTX', 'PRIOR');
  assert.match(p, /You analyze\./);
  assert.match(p, /Task: do thing/);
  assert.match(p, /CTX/);
  assert.match(p, /Previous stage output:\nPRIOR/);
  assert.match(p, /```json/);
  assert.match(p, /"status"/);
});

test('buildAgentPrompt omits optional sections when empty', () => {
  const p = buildAgentPrompt('role', 'task', '', '');
  assert.doesNotMatch(p, /Previous stage output/);
});

test('parseCliEnvelope reads result, tokens, cost', () => {
  const stdout = JSON.stringify({
    result: 'the answer',
    usage: { input_tokens: 100, output_tokens: 50 },
    total_cost_usd: 0.01,
    is_error: false,
  });
  const env = parseCliEnvelope(stdout);
  assert.equal(env.text, 'the answer');
  assert.equal(env.tokens, 150);
  assert.equal(env.costUsd, 0.01);
  assert.equal(env.isError, false);
});

test('parseCliEnvelope returns null on non-JSON', () => {
  assert.equal(parseCliEnvelope('garbage'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test runtime/runner.test.js`
Expected: FAIL — `Cannot find module './runner'`.

- [ ] **Step 3: Write minimal implementation**

```js
// runtime/runner.js
'use strict';

const { extractContract, fallbackContract } = require('./contract');

const CONTRACT_SUFFIX = [
  '',
  '---',
  'When finished, end your reply with a fenced json block describing the result:',
  '```json',
  '{ "status": "success | partial | error", "summary": "<one line>" }',
  '```',
  'Add any extra fields downstream steps may need (e.g. "confidence": 0.0-1.0).',
].join('\n');

function buildAgentPrompt(role, task, contextBlock, priorOutput) {
  let p = `${role}\n\nTask: ${task}`;
  if (contextBlock) p += `\n\n${contextBlock}`;
  if (priorOutput) p += `\n\nPrevious stage output:\n${priorOutput}`;
  return p + '\n' + CONTRACT_SUFFIX;
}

function parseCliEnvelope(stdout) {
  let obj;
  try { obj = JSON.parse(stdout); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const usage = obj.usage || {};
  return {
    text: obj.result != null ? String(obj.result) : '',
    tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
    costUsd: typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : 0,
    isError: !!obj.is_error,
  };
}

module.exports = { buildAgentPrompt, parseCliEnvelope, CONTRACT_SUFFIX };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test runtime/runner.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add runtime/runner.js runtime/runner.test.js
git commit -m "feat(phase3): runner prompt builder + CLI envelope parser"
```

---

## Task 4: Runner pure helpers — retry + budget + limits

**Files:**
- Modify: `runtime/runner.js`
- Modify: `runtime/runner.test.js`

- [ ] **Step 1: Add failing tests**

Append to `runtime/runner.test.js`:

```js
const { shouldRetry, budgetCheck, resolveLimits } = require('./runner');

test('shouldRetry: retries on timeout/nonzero/no-contract within budget', () => {
  assert.equal(shouldRetry({ exitCode: 0, timedOut: true, structured: true }, 1, 1), true);
  assert.equal(shouldRetry({ exitCode: 2, timedOut: false, structured: true }, 1, 1), true);
  assert.equal(shouldRetry({ exitCode: 0, timedOut: false, structured: false }, 1, 1), true);
});

test('shouldRetry: stops on success or when attempts exhausted', () => {
  assert.equal(shouldRetry({ exitCode: 0, timedOut: false, structured: true }, 1, 1), false);
  assert.equal(shouldRetry({ exitCode: 0, timedOut: false, structured: false }, 2, 1), false);
});

test('budgetCheck flags cost then tokens', () => {
  assert.equal(budgetCheck({ tokens: 10, costUsd: 2 }, { maxCostUsd: 1, maxTokens: null }).metric, 'cost_usd');
  assert.equal(budgetCheck({ tokens: 99, costUsd: 0 }, { maxCostUsd: null, maxTokens: 50 }).metric, 'tokens');
  assert.equal(budgetCheck({ tokens: 1, costUsd: 0 }, { maxCostUsd: 1, maxTokens: 50 }).exceeded, false);
});

test('resolveLimits merges defaults, blueprint, and CLI opts (strings coerced)', () => {
  const L = resolveLimits({ limits: { agent_timeout: '120', max_cost_usd: '1.5' } }, { maxCost: '2' });
  assert.equal(L.agentTimeout, 120);
  assert.equal(L.agentRetries, 1);       // default
  assert.equal(L.maxCostUsd, 2);          // CLI overrides blueprint
  assert.equal(L.maxTokens, null);        // default (no cap)
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test runtime/runner.test.js`
Expected: FAIL — `shouldRetry is not a function`.

- [ ] **Step 3: Implement**

Add to `runtime/runner.js` before `module.exports`:

```js
const DEFAULTS = { agentTimeout: 300, agentRetries: 1, maxCostUsd: null, maxTokens: null };

function shouldRetry({ exitCode, timedOut, structured }, attempt, maxRetries) {
  if (attempt > maxRetries) return false;
  return timedOut || exitCode !== 0 || !structured;
}

function budgetCheck(totals, limits) {
  if (limits.maxCostUsd != null && totals.costUsd > limits.maxCostUsd) {
    return { exceeded: true, metric: 'cost_usd', value: totals.costUsd, limit: limits.maxCostUsd };
  }
  if (limits.maxTokens != null && totals.tokens > limits.maxTokens) {
    return { exceeded: true, metric: 'tokens', value: totals.tokens, limit: limits.maxTokens };
  }
  return { exceeded: false };
}

function num(v, fallback) { return v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : fallback; }

function resolveLimits(blueprint, opts = {}) {
  const L = (blueprint && blueprint.limits) || {};
  return {
    agentTimeout: num(opts.timeout, num(L.agent_timeout, DEFAULTS.agentTimeout)),
    agentRetries: num(L.agent_retries, DEFAULTS.agentRetries),
    maxCostUsd: num(opts.maxCost, num(L.max_cost_usd, DEFAULTS.maxCostUsd)),
    maxTokens: num(L.max_tokens, DEFAULTS.maxTokens),
  };
}
```

Update `module.exports` to:

```js
module.exports = {
  buildAgentPrompt, parseCliEnvelope, CONTRACT_SUFFIX,
  shouldRetry, budgetCheck, resolveLimits, DEFAULTS,
};
```

> Note: `shouldRetry` uses `attempt > maxRetries` — `attempt` is the number of attempts already made; with `maxRetries:1` the first failure (attempt 1) retries, the second (attempt 2) stops → max 2 attempts.

- [ ] **Step 4: Run to verify pass**

Run: `node --test runtime/runner.test.js`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add runtime/runner.js runtime/runner.test.js
git commit -m "feat(phase3): runner retry, budget, and limit-resolution helpers"
```

---

## Task 5: `runAgent` — spawn, timeout, retry (integration)

**Files:**
- Modify: `runtime/runner.js`
- Create: `test/fake-claude.js`
- Modify: `runtime/runner.test.js`

- [ ] **Step 1: Create the fake CLI stub**

```js
// test/fake-claude.js
#!/usr/bin/env node
// Stub of `claude -p <prompt> --output-format json` for tests. No network.
// Behavior is driven by markers in the prompt:
//   contains "SLEEP"   -> sleep 5s (to trigger the runner timeout)
//   contains "NOJSON"  -> return text with no contract block
//   otherwise          -> return a valid contract envelope
const args = process.argv.slice(2);
const pIdx = args.indexOf('-p');
const prompt = pIdx !== -1 ? (args[pIdx + 1] || '') : '';

function emit(result) {
  process.stdout.write(JSON.stringify({
    result,
    usage: { input_tokens: 100, output_tokens: 20 },
    total_cost_usd: 0.005,
    is_error: false,
  }));
}

if (prompt.includes('SLEEP')) {
  setTimeout(() => emit('late'), 5000);
} else if (prompt.includes('NOJSON')) {
  emit('just prose, no contract');
} else {
  emit('Done.\n```json\n{"status":"success","summary":"ok"}\n```');
}
```

Make it executable:

```bash
chmod +x test/fake-claude.js
```

- [ ] **Step 2: Write the failing integration test**

Append to `runtime/runner.test.js`:

```js
const path = require('node:path');
const { runAgent } = require('./runner');

const FAKE = path.join(__dirname, '..', 'test', 'fake-claude.js');

test('runAgent happy path returns a structured contract', async () => {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const events = [];
  const r = await runAgent({ name: 'a', prompt: 'hello', timeoutMs: 4000, maxRetries: 1, emit: e => events.push(e) });
  assert.equal(r.status, 'success');
  assert.equal(r.structured, true);
  assert.equal(r.tokens, 120);
  assert.ok(r.costUsd > 0);
});

test('runAgent times out, retries, then falls back', async () => {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const events = [];
  const r = await runAgent({ name: 'slow', prompt: 'SLEEP please', timeoutMs: 500, maxRetries: 1, emit: e => events.push(e) });
  assert.equal(r.attempts, 2);                         // initial + 1 retry
  assert.ok(events.some(e => e.type === 'agent_retry' && e.reason === 'timeout'));
  assert.equal(r.structured, false);                   // never got a contract
  assert.equal(r.status, 'error');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `node --test runtime/runner.test.js`
Expected: FAIL — `runAgent is not a function`.

- [ ] **Step 4: Implement `runAgent`**

Add to `runtime/runner.js` (after the helpers, before `module.exports`):

```js
const { spawn } = require('child_process');

function claudeBin() { return process.env.SWARM_CLAUDE_BIN || 'claude'; }

function runAgentOnce(prompt, { timeoutMs, model }) {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--output-format', 'json'];
    if (model) args.push('--model', model);
    const child = spawn(claudeBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 2000);
    }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); resolve({ exitCode: -1, stdout, stderr: String(err), timedOut }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ exitCode: timedOut ? -1 : code, stdout, stderr, timedOut }); });
  });
}

async function runAgent({ name, prompt, timeoutMs, maxRetries, model, emit }) {
  const noop = () => {};
  const log = emit || noop;
  let attempt = 0, text = '', tokens = 0, costUsd = 0, structured = false, contract = null, timedOut = false, exitCode = 0;
  while (true) {
    attempt++;
    const res = await runAgentOnce(prompt, { timeoutMs, model });
    timedOut = res.timedOut; exitCode = res.exitCode;
    const env = parseCliEnvelope(res.stdout);
    if (env) { text = env.text; tokens += env.tokens; costUsd += env.costUsd; }
    const ex = extractContract(text);
    structured = ex.structured; contract = ex.contract;
    if (!shouldRetry({ exitCode, timedOut, structured }, attempt, maxRetries)) break;
    log({ type: 'agent_retry', agent: name, attempt, reason: timedOut ? 'timeout' : (exitCode !== 0 ? `exit_${exitCode}` : 'no_contract') });
  }
  if (!structured) contract = fallbackContract(text);
  const failed = (timedOut || exitCode !== 0) && !structured;
  const status = failed ? 'error' : contract.status;
  return { name, status, summary: contract.summary, contract, text, tokens, costUsd, attempts: attempt, structured };
}
```

Add `runAgent` to `module.exports`.

- [ ] **Step 5: Run to verify pass**

Run: `node --test runtime/runner.test.js`
Expected: PASS (10 tests). The timeout test takes ~1–2s.

- [ ] **Step 6: Commit**

```bash
git add runtime/runner.js runtime/runner.test.js test/fake-claude.js
git commit -m "feat(phase3): runAgent with hard timeout, retry, and fallback"
```

---

## Task 6: `runStage` + `run` orchestration (integration)

**Files:**
- Modify: `runtime/runner.js`
- Modify: `runtime/runner.test.js`

- [ ] **Step 1: Write the failing test**

Append to `runtime/runner.test.js`:

```js
const fs = require('node:fs');
const os = require('node:os');
const { run } = require('./runner');

test('run executes a linear+parallel blueprint and totals usage', async () => {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-run-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try {
    const blueprint = {
      name: 'demo',
      flow: 'a, b → c',
      agents: { a: { prompt: 'A' }, b: { prompt: 'B' }, c: { prompt: 'C' } },
    };
    const events = [];
    const summary = await run(blueprint, 'the task', { emit: e => events.push(e) });
    assert.equal(summary.status, 'done');
    assert.equal(summary.totalTokens, 360);            // 3 agents * 120
    assert.ok(events.some(e => e.type === 'swarm_done' && e.status === 'done'));
    assert.equal(events.filter(e => e.type === 'agent_done').length, 3);
  } finally {
    process.chdir(cwd);
  }
});

test('run rejects Phase-2 (execution_graph) blueprints', async () => {
  const blueprint = {
    name: 'cond', flow: 'research → if c1: synth else: fb',
    groups: { research: { agents: ['s'] }, synth: { agents: ['y'] }, fb: { agents: ['z'] } },
    conditions: { c1: { type: 'validation', criteria: 'no-errors' } },
    agents: { s: { prompt: '' }, y: { prompt: '' }, z: { prompt: '' } },
  };
  await assert.rejects(() => run(blueprint, 't', {}), /Phase-2|execution graph|groups\/conditions/i);
});

test('run aborts when the cost budget is exceeded', async () => {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-budget-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try {
    const blueprint = {
      name: 'demo', flow: 'a → b → c',
      limits: { max_cost_usd: '0.007' },               // one agent (0.005) ok, two exceeds
      agents: { a: { prompt: 'A' }, b: { prompt: 'B' }, c: { prompt: 'C' } },
    };
    const events = [];
    const summary = await run(blueprint, 't', { emit: e => events.push(e) });
    assert.equal(summary.status, 'aborted');
    assert.ok(events.some(e => e.type === 'budget_exceeded' && e.metric === 'cost_usd'));
  } finally {
    process.chdir(cwd);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test runtime/runner.test.js`
Expected: FAIL — `run is not a function`.

- [ ] **Step 3: Implement `runStage` + `run`**

Add to `runtime/runner.js`:

```js
const { compile } = require('./compiler');

async function runStage(stage, ctx) {
  const results = await Promise.all(stage.agents.map((name) => {
    const a = ctx.blueprint.agents[name] || {};
    const role = a.prompt || a.role || '';
    const prompt = buildAgentPrompt(role, ctx.task, ctx.contextBlock, ctx.priorOutput);
    const timeoutMs = num(a.timeout, ctx.limits.agentTimeout) * 1000;
    const maxRetries = num(a.retries, ctx.limits.agentRetries);
    ctx.emit({ type: 'agent_start', agent: name, status: 'running', message: 'Starting…' });
    return runAgent({ name, prompt, timeoutMs, maxRetries, model: ctx.model, emit: ctx.emit })
      .then((r) => {
        ctx.emit({
          type: r.status === 'error' ? 'agent_error' : 'agent_done',
          agent: name, status: r.status, tokens: r.tokens, cost_usd: r.costUsd,
          structured: r.structured, message: r.summary,
        });
        return r;
      });
  }));
  return results;
}

async function run(blueprint, task, opts = {}) {
  const emit = opts.emit || (() => {});
  const plan = compile(blueprint);
  if (plan.execution_graph) {
    throw new Error('Runner handles linear/parallel flows only; this blueprint uses Phase-2 groups/conditions — run it via the /swarm LLM flow.');
  }
  const limits = resolveLimits(blueprint, opts);
  const totals = { tokens: 0, costUsd: 0 };
  let priorOutput = '';
  let status = 'done';

  emit({ type: 'swarm_start', agent: blueprint.name, status: 'running', message: task });

  for (const stage of plan.stages) {
    const results = await runStage(stage, {
      blueprint, task, contextBlock: opts.contextBlock || '',
      priorOutput, limits, model: opts.model, emit,
    });
    priorOutput = results.map(r => `## ${r.name}\n${r.text}`).join('\n\n');
    totals.tokens += results.reduce((s, r) => s + r.tokens, 0);
    totals.costUsd += results.reduce((s, r) => s + r.costUsd, 0);
    const b = budgetCheck(totals, limits);
    if (b.exceeded) {
      emit({ type: 'budget_exceeded', metric: b.metric, value: b.value, limit: b.limit });
      status = 'aborted';
      break;
    }
  }

  // Save final output + history (best-effort; mirrors skills/swarm.md)
  try {
    const fs = require('fs');
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const id = `${blueprint.name}-${stamp}`;
    fs.mkdirSync('swarms/output', { recursive: true });
    fs.writeFileSync(`swarms/output/${id}.md`, priorOutput, 'utf8');
    require('./history').append({ id, blueprint: blueprint.name, task, file: `${id}.md`, ts: Date.now() });
  } catch (e) { /* non-fatal */ }

  emit({ type: 'swarm_done', status, total_tokens: totals.tokens, total_cost_usd: totals.costUsd });
  return { status, totalTokens: totals.tokens, totalCostUsd: totals.costUsd };
}
```

Add `runStage` and `run` to `module.exports`.

> Note: `new Date()` is fine in runtime code (the no-`Date.now()` rule is a workflow-script constraint, not a project constraint). Tests don't assert on the timestamp.

- [ ] **Step 4: Run to verify pass**

Run: `node --test runtime/runner.test.js`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add runtime/runner.js runtime/runner.test.js
git commit -m "feat(phase3): stage + run orchestration with budget abort and history"
```

---

## Task 7: CLI entry + run-all-tests check

**Files:**
- Modify: `runtime/runner.js`

- [ ] **Step 1: Add the CLI block**

Add at the end of `runtime/runner.js`, before `module.exports` is fine, or after — place this `require.main` block at the very end of the file:

```js
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const yaml = require('./simple-yaml');
  const { resolveExtends } = require('./compiler');

  const [, , bpPath, task, ...rest] = process.argv;
  if (!bpPath || !task) {
    console.error('Usage: node runtime/runner.js <blueprint.yaml> "<task>" [--max-cost N] [--timeout S] [--model NAME]');
    process.exit(1);
  }
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--max-cost') opts.maxCost = rest[++i];
    else if (rest[i] === '--timeout') opts.timeout = rest[++i];
    else if (rest[i] === '--model') opts.model = rest[++i];
  }

  const { appendEvent } = require('./events');
  opts.emit = (e) => { appendEvent(e); const tag = e.agent || e.type; console.log(`[${tag}] ${e.message || e.status || e.type}`); };

  let bp = yaml.parse(fs.readFileSync(path.resolve(bpPath), 'utf8'));
  bp = resolveExtends(bp, (name) => yaml.parse(fs.readFileSync(path.resolve(path.dirname(bpPath), '..', `${name}.yaml`), 'utf8')));

  run(bp, task, opts)
    .then((s) => { console.log(`\n✓ ${s.status} — ${s.totalTokens} tokens, $${s.totalCostUsd.toFixed(4)}`); process.exit(s.status === 'done' ? 0 : 1); })
    .catch((err) => { console.error(err.message); process.exit(1); });
}
```

- [ ] **Step 2: Verify the CLI errors cleanly with no args**

Run: `node runtime/runner.js`
Expected: prints the Usage line, exits 1.

- [ ] **Step 3: Verify the CLI runs a blueprint via the fake stub**

Run:
```bash
SWARM_CLAUDE_BIN="$(pwd)/test/fake-claude.js" node runtime/runner.js swarms/research.yaml "demo task"
```
Expected: prints `[research] …`, per-agent lines, and a final `✓ done — 360 tokens, $0.0150` (3 agents). Exits 0.

- [ ] **Step 4: Run the whole suite**

Run: `node --test`
Expected: PASS — all of `contract.test.js`, `simple-yaml.test.js`, `runner.test.js`.

- [ ] **Step 5: Commit**

```bash
git add runtime/runner.js
git commit -m "feat(phase3): runner CLI entry (events + output, exit codes)"
```

---

## Task 8: Wire the contract into `skills/swarm.md` + example `limits:`

**Files:**
- Modify: `skills/swarm.md`
- Modify: `swarms/research.yaml`

- [ ] **Step 1: Add the contract suffix to agent prompts in `skills/swarm.md`**

In step 6 ("Execute the swarm"), change the agent-prompt construction bullet so each agent prompt ends with the contract instruction. Replace the parallel-stage prompt bullet:

```
- Each agent prompt = the agent's `role` from the blueprint + "\n\nTask: " + TASK + (if CONTEXT_BLOCK is non-empty: "\n\n" + CONTEXT_BLOCK) + (if stage > 0: "\n\nPrevious stage output:\n" + prior_output)
```

with:

```
- Each agent prompt = the agent's `prompt` from the blueprint + "\n\nTask: " + TASK + (if CONTEXT_BLOCK is non-empty: "\n\n" + CONTEXT_BLOCK) + (if stage > 0: "\n\nPrevious stage output:\n" + prior_output) + the **contract suffix**: a fenced ```json block instructing the agent to end with `{ "status": "success|partial|error", "summary": "<one line>", ...extra fields }`. Parse that block from each agent's output; if absent, treat the raw text as `{status:"success", summary:<first line>}`.
```

- [ ] **Step 2: Add a "Runner (Phase 3)" subsection to `skills/swarm.md`**

After the "Error handling" section, append:

```markdown
## Programmatic runner (Phase 3)

For linear/parallel blueprints (no groups/conditions), you may execute the swarm
with enforced timeouts, retries, and budgets instead of spawning agents by hand:

\`\`\`bash
node runtime/runner.js swarms/<blueprint>.yaml "<task>" [--max-cost <usd>] [--timeout <seconds>] [--model <name>]
\`\`\`

The runner drives the \`claude\` CLI per agent, appends the same events to
\`.swarm/events.jsonl\` (now including \`tokens\`, \`cost_usd\`, \`status\`, plus
\`agent_retry\` and \`budget_exceeded\`), saves output, and records history.
Blueprints that use Phase-2 groups/conditions are **not** handled by the runner —
run those with the steps above. Per-run limits come from the blueprint's
\`limits:\` block (or the CLI flags):

\`\`\`yaml
limits:
  agent_timeout: 300   # seconds per agent attempt
  agent_retries: 1
  max_cost_usd: 1.00   # per-run budget; run aborts if exceeded
  max_tokens: 200000
\`\`\`
```

- [ ] **Step 3: Add an example `limits:` block to `swarms/research.yaml`**

Add this top-level block to `swarms/research.yaml` (e.g. just under `description:`):

```yaml
limits:
  agent_timeout: 300
  agent_retries: 1
  max_cost_usd: 1.00
```

- [ ] **Step 4: Verify no regression**

Run: `node runtime/compiler.js swarms/research.yaml`
Expected: prints the Execution Plan unchanged (the `limits` block is ignored by the compiler).
Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/swarm.md swarms/research.yaml
git commit -m "docs(phase3): document runner + contract in swarm skill; example limits"
```

---

## Self-Review

**Spec coverage:**
- Contract (extract/validate/fallback) → Task 1. ✓
- `limits` config parsing → Task 2; resolution → Task 4. ✓
- Prompt contract suffix → Task 3 (runner) + Task 8 (swarm.md). ✓
- CLI envelope parsing (tokens/cost) → Task 3. ✓
- Retry/timeout (hard kill) → Task 4 (decision) + Task 5 (spawn). ✓
- Budget abort + `budget_exceeded` → Task 4 + Task 6. ✓
- Event extensions (`agent_done` tokens/cost/status/structured, `agent_retry`, `swarm_done` totals) → Tasks 5–6. ✓
- `execution_graph` rejection → Task 6. ✓
- CLI entry → Task 7. ✓
- `node:test` unit + stubbed integration (no API) → all tasks; `SWARM_CLAUDE_BIN` seam → Task 5. ✓
- Backward compatibility (compiler unaffected, LLM flow intact) → Tasks 2/8 verification steps. ✓

**Placeholder scan:** none — every code/test step is complete.

**Type consistency:** `extractContract → {contract, structured, raw}`, `parseCliEnvelope → {text, tokens, costUsd, isError}`, `resolveLimits → {agentTimeout, agentRetries, maxCostUsd, maxTokens}`, `runAgent → {name,status,summary,contract,text,tokens,costUsd,attempts,structured}`, `run → {status, totalTokens, totalCostUsd}`. Event field names (`cost_usd`, `total_tokens`) match the spec's schema. Consistent across tasks.
