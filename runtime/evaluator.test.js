// runtime/evaluator.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateCondition, parseThreshold, compare } = require('./evaluator');

test('parseThreshold handles operators, quotes, contains, and bare values', () => {
  assert.deepEqual(parseThreshold('> 0.8'), { op: '>', value: 0.8 });
  assert.deepEqual(parseThreshold('>=3'), { op: '>=', value: 3 });
  assert.deepEqual(parseThreshold('== "success"'), { op: '==', value: 'success' });
  assert.deepEqual(parseThreshold('!= partial'), { op: '!=', value: 'partial' });
  assert.deepEqual(parseThreshold('contains error'), { op: 'contains', value: 'error' });
  assert.deepEqual(parseThreshold('success'), { op: '==', value: 'success' });
});

test('compare does numeric and string comparisons', () => {
  assert.equal(compare(0.95, '>', 0.8), true);
  assert.equal(compare(0.3, '>', 0.8), false);
  assert.equal(compare('success', '==', 'success'), true);
  assert.equal(compare('partial', '!=', 'success'), true);
  assert.equal(compare('an error occurred', 'contains', 'error'), true);
});

test('agent_output: routes on a numeric threshold', () => {
  const results = { searcher: { status: 'success', structured: true, contract: { status: 'success', confidence: 0.95 } } };
  assert.equal(evaluateCondition({ type: 'agent_output', source: 'searcher', check: 'confidence', threshold: '> 0.8' }, results), true);
  results.searcher.contract.confidence = 0.3;
  assert.equal(evaluateCondition({ type: 'agent_output', source: 'searcher', check: 'confidence', threshold: '> 0.8' }, results), false);
});

test('agent_output: string equality on a status field', () => {
  const results = { s: { status: 'success', structured: true, contract: { status: 'success' } } };
  assert.equal(evaluateCondition({ type: 'agent_output', source: 's', check: 'status', threshold: '== success' }, results), true);
});

test('agent_output: false when source missing or field absent', () => {
  assert.equal(evaluateCondition({ type: 'agent_output', source: 'nobody', check: 'x', threshold: '> 1' }, {}), false);
  const results = { s: { status: 'success', structured: true, contract: { status: 'success' } } };
  assert.equal(evaluateCondition({ type: 'agent_output', source: 's', check: 'confidence', threshold: '> 0.5' }, results), false);
});

test('validation: no-errors / all-pass semantics', () => {
  const ok = { a: { status: 'success', structured: true, contract: {} }, b: { status: 'partial', structured: true, contract: {} } };
  assert.equal(evaluateCondition({ type: 'validation', criteria: 'no-errors' }, ok), true);
  assert.equal(evaluateCondition({ type: 'validation', criteria: 'all-pass' }, ok), false); // b is partial
  const withErr = { a: { status: 'error', structured: false, contract: {} } };
  assert.equal(evaluateCondition({ type: 'validation', criteria: 'no-errors' }, withErr), false);
  const allGood = { a: { status: 'success', structured: true, contract: {} } };
  assert.equal(evaluateCondition({ type: 'validation', criteria: 'all-pass' }, allGood), true);
});

test('unknown condition shape returns false (no throw)', () => {
  assert.equal(evaluateCondition(null, {}), false);
  assert.equal(evaluateCondition({ type: 'mystery' }, {}), false);
});
