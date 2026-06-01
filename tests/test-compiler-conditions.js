#!/usr/bin/env node
const assert = require('assert');
const { validateBlueprint } = require('../runtime/compiler');

const base = {
  name: 'c',
  flow: 'research → if cond: synthesis else: fallback',
  groups: {
    research: { agents: ['a'] },
    synthesis: { agents: ['b'] },
    fallback: { agents: ['d'] },
  },
  agents: { a: { prompt: 'x' }, b: { prompt: 'y' }, d: { prompt: 'z' } },
};

// Invalid condition type
let bp = { ...base, conditions: { cond: { type: 'magic' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('magic')), 'flags invalid condition type');

// agent_output missing source
bp = { ...base, conditions: { cond: { type: 'agent_output', check: 'confidence', threshold: '> 0.8' } } };
assert.ok(validateBlueprint(bp).some(e => /source/.test(e)), 'flags agent_output missing source');

// agent_output source references undefined agent
bp = { ...base, conditions: { cond: { type: 'agent_output', source: 'nobody', check: 'c', threshold: '> 1' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('nobody')), 'flags undefined source agent');

// validation condition with bad criteria
bp = { ...base, conditions: { cond: { type: 'validation', criteria: 'sometimes' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('sometimes')), 'flags invalid validation criteria');

// flow references an undefined condition name
bp = { ...base, flow: 'research → if ghost: synthesis else: fallback',
       conditions: { cond: { type: 'validation', criteria: 'no-errors' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('ghost')), 'flags undefined condition in flow');

// flow branch target is neither group nor agent
bp = { ...base, flow: 'research → if cond: nowhere else: fallback',
       conditions: { cond: { type: 'validation', criteria: 'no-errors' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('nowhere')), 'flags undefined branch target');

// fully valid phase-2 blueprint → no errors
bp = { ...base, conditions: { cond: { type: 'validation', criteria: 'no-errors' } } };
assert.deepStrictEqual(validateBlueprint(bp), [], 'valid phase-2 blueprint passes');

// null / non-object condition value → clean error, no throw
bp = { ...base, conditions: { cond: null } };
assert.ok(
  validateBlueprint(bp).some(e => e.includes('must be an object')),
  'flags null condition value without throwing'
);

console.log('✓ compiler condition validation — all 8 tests pass');
