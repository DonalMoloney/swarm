// runtime/contract.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { extractContract, fallbackContract } = require('./contract');

test('extracts a valid trailing json block', () => {
  const text = 'Here is my work.\n```json\n{"status":"success","summary":"did it","confidence":0.9}\n```';
  const r = extractContract(text);
  assert.equal(r.structured, true);
  assert.equal(r.contract.status, 'success');
  assert.equal(r.contract.confidence, 0.9);
});

test('missing block -> not structured', () => {
  assert.equal(extractContract('no json here').structured, false);
});

test('malformed json -> not structured', () => {
  assert.equal(extractContract('```json\n{nope}\n```').structured, false);
});

test('multiple blocks -> last wins', () => {
  const text = '```json\n{"status":"error","summary":"a"}\n```\n```json\n{"status":"success","summary":"b"}\n```';
  assert.equal(extractContract(text).contract.summary, 'b');
});

test('invalid status -> not structured', () => {
  assert.equal(extractContract('```json\n{"status":"weird","summary":"x"}\n```').structured, false);
});

test('fallbackContract uses first non-empty line', () => {
  const fb = fallbackContract('\n  first line  \nsecond');
  assert.equal(fb.status, 'success');
  assert.equal(fb.summary, 'first line');
  assert.equal(fb._unstructured, true);
});
