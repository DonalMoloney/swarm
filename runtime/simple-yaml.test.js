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
