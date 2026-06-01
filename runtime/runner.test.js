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
