#!/usr/bin/env node
const assert = require('assert');
const { resolveExtends, compile } = require('../runtime/compiler');

const parent = {
  name: 'parent',
  flow: 'a, b → c',
  agents: {
    a: { role: 'Agent A from parent' },
    b: { role: 'Agent B from parent' },
    c: { role: 'Agent C from parent' },
  },
};

const child = {
  name: 'child',
  extends: 'parent',
  agents: {
    c: { role: 'Agent C overridden by child' },
  },
};

function loader(name) {
  if (name === 'parent') return parent;
  throw new Error(`Unknown blueprint: ${name}`);
}

// Test 1: resolveExtends merges agents, uses parent flow
const resolved = resolveExtends(child, loader);
assert.strictEqual(resolved.flow, 'a, b → c', 'inherits parent flow');
assert.strictEqual(resolved.agents.a.role, 'Agent A from parent', 'inherits agent A');
assert.strictEqual(resolved.agents.c.role, 'Agent C overridden by child', 'overrides agent C');
assert.strictEqual(resolved.extends, undefined, 'extends field removed after resolution');

// Test 2: child flow overrides parent flow
const childWithFlow = { ...child, flow: 'a → b → c' };
const resolved2 = resolveExtends(childWithFlow, loader);
assert.strictEqual(resolved2.flow, 'a → b → c', 'child flow wins');

// Test 3: no extends field — blueprint returned unchanged
const plain = { name: 'plain', flow: 'x', agents: { x: { role: 'X' } } };
assert.strictEqual(resolveExtends(plain, loader), plain, 'no extends = no change');

// Test 4: resolved blueprint compiles without error
const plan = compile(resolved);
assert.strictEqual(plan.name, 'child');
assert.strictEqual(plan.stages.length, 2);

// Test 5: blueprint with valid context field compiles without error
const { VALID_PROVIDERS } = require('../runtime/context');
const withContext = {
  name: 'ctx-test',
  flow: 'a',
  agents: { a: { role: 'Agent A' } },
  context: ['git-diff', 'stack-detect'],
};
const plan2 = compile(withContext);
assert.ok(plan2, 'blueprint with context compiles');

// Test 6: blueprint with invalid context provider throws
let threw = false;
try {
  compile({ name: 'bad', flow: 'a', agents: { a: { role: 'x' } }, context: ['not-a-provider'] });
} catch (e) {
  threw = true;
  assert.ok(e.message.includes('not-a-provider'), 'error names the invalid provider');
}
assert.ok(threw, 'invalid context provider throws');

console.log('✓ compiler extends + context — all 6 tests pass');
