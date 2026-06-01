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
