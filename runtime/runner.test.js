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
