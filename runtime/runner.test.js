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

function conditionalBlueprint(searcherMarker) {
  return {
    name: 'cond',
    flow: 'research → if high_confidence: synth else: fb',
    groups: { research: { agents: ['s'] }, synth: { agents: ['y'] }, fb: { agents: ['z'] } },
    conditions: { high_confidence: { type: 'agent_output', source: 's', check: 'confidence', threshold: '> 0.8' } },
    agents: {
      s: { prompt: `search ${searcherMarker}` },
      y: { prompt: 'synthesize' },
      z: { prompt: 'fallback' },
    },
  };
}

async function runConditional(marker) {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-graph-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try {
    const events = [];
    const summary = await run(conditionalBlueprint(marker), 't', { emit: e => events.push(e) });
    return { events, summary };
  } finally {
    process.chdir(cwd);
  }
}

test('run routes a Phase-2 graph to the TRUE branch when the condition holds', async () => {
  const { events } = await runConditional('HIGHCONF');           // searcher confidence 0.95 > 0.8
  const decision = events.find(e => e.type === 'condition_evaluated');
  assert.ok(decision, 'emits a condition_evaluated event');
  assert.equal(decision.condition, 'high_confidence');
  assert.equal(decision.result, true);
  const started = events.filter(e => e.type === 'agent_start').map(e => e.agent);
  assert.deepEqual(started, ['s', 'y'], 'ran searcher then the synth (true) branch');
  assert.ok(!started.includes('z'), 'did not run the fallback (false) branch');
});

test('run routes a Phase-2 graph to the FALSE branch when the condition fails', async () => {
  const { events } = await runConditional('LOWCONF');            // searcher confidence 0.3 < 0.8
  const decision = events.find(e => e.type === 'condition_evaluated');
  assert.equal(decision.result, false);
  const started = events.filter(e => e.type === 'agent_start').map(e => e.agent);
  assert.deepEqual(started, ['s', 'z'], 'ran searcher then the fallback (false) branch');
  assert.ok(!started.includes('y'), 'did not run the synth (true) branch');
});

async function runBlueprint(bp) {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-graph-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try {
    const events = [];
    await run(bp, 't', { emit: e => events.push(e) });
    return events.filter(e => e.type === 'agent_start').map(e => e.agent);
  } finally {
    process.chdir(cwd);
  }
}

test('a non-terminal conditional CONVERGES: both branches continue to the join stage', async () => {
  const mk = (marker) => ({
    name: 'conv',
    flow: 'research → if hc: synth else: fb → finalize',
    groups: { research: { agents: ['s'] }, synth: { agents: ['y'] }, fb: { agents: ['z'] }, finalize: { agents: ['f'] } },
    conditions: { hc: { type: 'agent_output', source: 's', check: 'confidence', threshold: '> 0.8' } },
    agents: { s: { prompt: `search ${marker}` }, y: { prompt: 'syn' }, z: { prompt: 'fb' }, f: { prompt: 'final' } },
  });
  // TRUE branch must still reach finalize (this is the regression the seqNext fix addresses)
  assert.deepEqual(await runBlueprint(mk('HIGHCONF')), ['s', 'y', 'f'], 'true branch converges to finalize');
  // FALSE branch likewise
  assert.deepEqual(await runBlueprint(mk('LOWCONF')), ['s', 'z', 'f'], 'false branch converges to finalize');
});

test('run routes through chained conditionals', async () => {
  const bp = {
    name: 'chain',
    flow: 'g1 → if c1: g2 else: g3 → if c2: g4 else: g5',
    groups: { g1: { agents: ['a1'] }, g2: { agents: ['a2'] }, g3: { agents: ['a3'] }, g4: { agents: ['a4'] }, g5: { agents: ['a5'] } },
    conditions: {
      c1: { type: 'agent_output', source: 'a1', check: 'confidence', threshold: '> 0.8' },
      c2: { type: 'agent_output', source: 'a1', check: 'confidence', threshold: '> 0.9' },
    },
    agents: { a1: { prompt: 'lead HIGHCONF' }, a2: { prompt: 'x' }, a3: { prompt: 'x' }, a4: { prompt: 'x' }, a5: { prompt: 'x' } },
  };
  // a1 confidence 0.95 → c1 true → g2 → c2 (0.95 > 0.9) true → g4
  assert.deepEqual(await runBlueprint(bp), ['a1', 'a2', 'a4'], 'chains c1-true then c2-true');
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

test('run archives events and enriches the history record', async () => {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-archive-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try {
    const blueprint = { name: 'demo', flow: 'a → b', agents: { a: { prompt: 'A' }, b: { prompt: 'B' } } };
    await run(blueprint, 'task', {});
    const history = require('./history');
    const rec = history.list()[0];
    assert.equal(rec.blueprint, 'demo');
    assert.equal(rec.status, 'done');
    assert.equal(rec.agentCount, 2);
    assert.ok(rec.events_file, 'record has events_file');
    const ev = fs.readFileSync(path.join('swarms/output', rec.events_file), 'utf8')
      .split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(ev.some(e => e.type === 'swarm_start' && Array.isArray(e.agents)), 'swarm_start carries agents');
    assert.ok(ev.some(e => e.type === 'swarm_done'), 'archive includes swarm_done');
  } finally {
    process.chdir(cwd);
  }
});
