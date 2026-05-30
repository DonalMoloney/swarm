#!/usr/bin/env node
const assert = require('assert');
const { parsePlan, validatePlan } = require('../runtime/decomposer');

const AVAILABLE = ['research', 'code-review', 'debug', 'team/security-audit'];

// Test 1: parsePlan parses valid JSON array
const raw = JSON.stringify([
  { step: 1, blueprint: 'research',    task: 'research the problem', reason: 'gather info' },
  { step: 2, blueprint: 'code-review', task: 'review changes',       reason: 'check quality' },
]);
const steps = parsePlan(raw);
assert.strictEqual(steps.length, 2);
assert.strictEqual(steps[0].blueprint, 'research');
assert.strictEqual(steps[1].step, 2);

// Test 2: parsePlan extracts JSON from string with surrounding prose
const withProse = `Here is the plan:\n${JSON.stringify([{ step: 1, blueprint: 'debug', task: 'find bug', reason: 'x' }])}\nEnd.`;
const steps2 = parsePlan(withProse);
assert.strictEqual(steps2.length, 1);
assert.strictEqual(steps2[0].blueprint, 'debug');

// Test 3: parsePlan throws on unparseable input
let threw = false;
try { parsePlan('not json at all, no brackets'); } catch { threw = true; }
assert.ok(threw, 'unparseable input throws');

// Test 4: validatePlan passes for known blueprints
const errors = validatePlan(steps, AVAILABLE);
assert.deepStrictEqual(errors, [], 'no errors for valid plan');

// Test 5: validatePlan returns errors for unknown blueprints
const bad = [{ step: 1, blueprint: 'nonexistent', task: 'x', reason: 'y' }];
const errs = validatePlan(bad, AVAILABLE);
assert.ok(errs.length > 0, 'unknown blueprint produces error');
assert.ok(errs[0].includes('nonexistent'), 'error names the unknown blueprint');

// Test 6: validatePlan catches missing required fields
const incomplete = [{ step: 1, blueprint: 'research' }];
const errs2 = validatePlan(incomplete, AVAILABLE);
assert.ok(errs2.some(e => e.includes('task')), 'missing task field caught');

// Test 6b: parsePlan handles nested arrays in prose correctly
const nested = 'Plan:\n' + JSON.stringify([{step:1, blueprint:'debug', task:'x', reason:'y', meta:{tags:['a','b']}}]) + '\nEnd.';
const steps3 = parsePlan(nested);
assert.strictEqual(steps3.length, 1, 'nested array in prose parsed correctly');
assert.strictEqual(steps3[0].blueprint, 'debug');

console.log('✓ runtime/decomposer.js — all 6 tests pass');
