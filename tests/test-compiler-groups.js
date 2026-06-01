#!/usr/bin/env node
const assert = require('assert');
const { validateBlueprint } = require('../runtime/compiler');

// Valid groups → no errors
const ok = {
  name: 'g',
  flow: 'research → synthesis',
  groups: {
    research: { agents: ['a'] },
    synthesis: { agents: ['b'] },
  },
  agents: { a: { prompt: 'x' }, b: { prompt: 'y' } },
};
assert.deepStrictEqual(validateBlueprint(ok), [], 'valid grouped blueprint has no errors');

// Group references an agent that is not defined → error naming the agent
const ghost = {
  name: 'g',
  flow: 'research',
  groups: { research: { agents: ['a', 'ghost'] } },
  agents: { a: { prompt: 'x' } },
};
const e1 = validateBlueprint(ghost);
assert.ok(e1.some(e => e.includes('ghost')), 'flags undefined agent referenced by a group');

// Group with empty/missing agents list → error
const empty = {
  name: 'g',
  flow: 'research',
  groups: { research: { agents: [] } },
  agents: { a: { prompt: 'x' } },
};
const e2 = validateBlueprint(empty);
assert.ok(e2.some(e => e.includes('research')), 'flags group with no agents');

// Flat group flow referencing an undefined token → error
const badFlow = {
  name: 'g', flow: 'research → ghostflow',
  groups: { research: { agents: ['a'] } },
  agents: { a: { prompt: 'x' } },
};
assert.ok(
  validateBlueprint(badFlow).some(e => e.includes('ghostflow')),
  'flags flat flow token that is neither group nor agent'
);

// Group-name tokens in a flat flow do NOT produce false "undefined" errors
assert.ok(
  !validateBlueprint(ok).some(e => e.includes('undefined')),
  'group names in flow are not falsely flagged'
);

// Conditional (if) flow with valid group targets is NOT flagged by the flat check
const ifFlow = {
  name: 'g', flow: 'research → if cond: synthesis else: research',
  groups: { research: { agents: ['a'] }, synthesis: { agents: ['b'] } },
  agents: { a: { prompt: 'x' }, b: { prompt: 'y' } },
};
assert.ok(
  !validateBlueprint(ifFlow).some(e => e.includes('undefined groups or agents')),
  'if-flow is not validated by the flat-flow check'
);

console.log('✓ compiler group validation — all 6 tests pass');
