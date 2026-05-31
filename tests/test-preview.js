#!/usr/bin/env node
const assert = require('assert');
const {
  generateExecutionPlan,
  validateBlueprint,
  extractAgentsFromFlow,
} = require('../runtime/preview');

// Test 1: extractAgentsFromFlow handles → syntax
const agents1 = extractAgentsFromFlow('a, b → c');
assert.strictEqual(agents1.size, 3, 'extracts 3 agents from "a, b → c"');
assert.ok(agents1.has('a'), 'contains agent a');
assert.ok(agents1.has('b'), 'contains agent b');
assert.ok(agents1.has('c'), 'contains agent c');

// Test 2: extractAgentsFromFlow handles -> syntax
const agents2 = extractAgentsFromFlow('a -> b -> c');
assert.strictEqual(agents2.size, 3, 'extracts 3 agents from "a -> b -> c"');
assert.ok(agents2.has('a'), 'contains agent a');
assert.ok(agents2.has('b'), 'contains agent b');
assert.ok(agents2.has('c'), 'contains agent c');

// Test 3: extractAgentsFromFlow handles parallel agents
const agents3 = extractAgentsFromFlow('a, b, c');
assert.strictEqual(agents3.size, 3, 'extracts 3 agents from "a, b, c"');
assert.ok(agents3.has('a'), 'contains agent a');
assert.ok(agents3.has('b'), 'contains agent b');
assert.ok(agents3.has('c'), 'contains agent c');

// Test 4: extractAgentsFromFlow handles mixed syntax
const agents4 = extractAgentsFromFlow('a → b, c → d');
assert.strictEqual(agents4.size, 4, 'extracts 4 agents from "a → b, c → d"');
assert.ok(agents4.has('a'), 'contains agent a');
assert.ok(agents4.has('b'), 'contains agent b');
assert.ok(agents4.has('c'), 'contains agent c');
assert.ok(agents4.has('d'), 'contains agent d');

// Test 5: extractAgentsFromFlow handles whitespace
const agents5 = extractAgentsFromFlow('  a  ,  b  →  c  ');
assert.strictEqual(agents5.size, 3, 'handles whitespace correctly');

// Test 6: validateBlueprint accepts valid blueprint
const validBlueprint = {
  name: 'test',
  flow: 'a → b',
  agents: {
    a: { role: 'Agent A' },
    b: { role: 'Agent B' },
  },
};
const errors1 = validateBlueprint(validBlueprint);
assert.strictEqual(errors1.length, 0, 'valid blueprint has no errors');

// Test 7: validateBlueprint catches missing name
const noName = {
  flow: 'a',
  agents: { a: { role: 'A' } },
};
const errors2 = validateBlueprint(noName);
assert.ok(errors2.length > 0, 'missing name produces errors');
assert.ok(errors2[0].includes('name'), 'error mentions name');

// Test 8: validateBlueprint catches missing flow
const noFlow = {
  name: 'test',
  agents: { a: { role: 'A' } },
};
const errors3 = validateBlueprint(noFlow);
assert.ok(errors3.length > 0, 'missing flow produces errors');
assert.ok(errors3[0].includes('flow'), 'error mentions flow');

// Test 9: validateBlueprint catches missing agents
const noAgents = {
  name: 'test',
  flow: 'a',
};
const errors4 = validateBlueprint(noAgents);
assert.ok(errors4.length > 0, 'missing agents produces errors');
assert.ok(errors4[0].includes('agents'), 'error mentions agents');

// Test 10: validateBlueprint catches undefined agents in flow
const undefinedAgent = {
  name: 'test',
  flow: 'a → b → c',
  agents: {
    a: { role: 'Agent A' },
    b: { role: 'Agent B' },
    // c is missing
  },
};
const errors5 = validateBlueprint(undefinedAgent);
assert.ok(errors5.length > 0, 'undefined agent produces errors');
assert.ok(errors5.some(e => e.includes('c')), 'error mentions missing agent c');

// Test 11: validateBlueprint catches multiple undefined agents
const multiUndefined = {
  name: 'test',
  flow: 'a, x → b, y → c',
  agents: {
    a: { role: 'Agent A' },
    b: { role: 'Agent B' },
    c: { role: 'Agent C' },
  },
};
const errors6 = validateBlueprint(multiUndefined);
assert.ok(errors6.length > 0, 'multiple undefined agents produce errors');
assert.ok(errors6.some(e => e.includes('x')), 'error mentions missing agent x');
assert.ok(errors6.some(e => e.includes('y')), 'error mentions missing agent y');

// Test 12: generateExecutionPlan with valid blueprint
const simpleBlueprintYaml = `name: simple
flow: "a → b"
agents:
  a:
    role: Agent A
  b:
    role: Agent B`;

const plan1 = generateExecutionPlan(simpleBlueprintYaml);
assert.strictEqual(plan1.name, 'simple', 'plan has correct name');
assert.ok(Array.isArray(plan1.stages), 'plan has stages array');
assert.strictEqual(plan1.stages.length, 2, 'plan has 2 stages');
assert.ok(plan1.agents, 'plan has agents object');
assert.ok(!plan1.error, 'valid plan has no error');

// Test 13: generateExecutionPlan with parallel flow
const parallelBlueprintYaml = `name: parallel
flow: "a, b → c"
agents:
  a:
    role: Agent A
  b:
    role: Agent B
  c:
    role: Agent C`;

const plan2 = generateExecutionPlan(parallelBlueprintYaml);
assert.strictEqual(plan2.stages.length, 2, 'parallel plan has 2 stages');
assert.strictEqual(plan2.stages[0].type, 'parallel', 'first stage is parallel');
assert.strictEqual(plan2.stages[0].agents.length, 2, 'first stage has 2 agents');

// Test 14: generateExecutionPlan with invalid blueprint includes error
const invalidBlueprintYaml = `name: bad
flow: "a → b → c"
agents:
  a:
    role: Agent A
  b:
    role: Agent B`;
  // c is missing — this should error

const plan3 = generateExecutionPlan(invalidBlueprintYaml);
assert.ok(plan3.error, 'invalid plan has error');
assert.ok(typeof plan3.error === 'string', 'error is a string');
assert.ok(plan3.error.includes('c'), 'error message mentions missing agent c');

// Test 15: generateExecutionPlan returns execution structure
const structuredBlueprintYaml = `name: structured
description: A structured blueprint
flow: "searcher, analyst → synthesiser"
agents:
  searcher:
    role: Search the web
  analyst:
    role: Analyze from knowledge
  synthesiser:
    role: Synthesize results`;

const plan4 = generateExecutionPlan(structuredBlueprintYaml);
assert.strictEqual(plan4.name, 'structured', 'has name');
assert.ok(plan4.stages, 'has stages');
assert.ok(plan4.agents, 'has agents object');
assert.strictEqual(Object.keys(plan4.agents).length, 3, 'agents object has 3 entries');

// Test 16: validateBlueprint rejects non-object agents
const badAgentsType = {
  name: 'test',
  flow: 'a',
  agents: ['a'],
};
const errors7 = validateBlueprint(badAgentsType);
assert.ok(errors7.length > 0, 'non-object agents produces errors');
assert.ok(errors7[0].includes('object'), 'error mentions object type');

console.log('✓ preview module — all 16 tests pass');
