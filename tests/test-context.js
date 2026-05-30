#!/usr/bin/env node
const assert = require('assert');

const context = require('../runtime/context');

// Test 1: gather returns a string for valid providers
const result = context.gather(['stack-detect']);
assert.strictEqual(typeof result, 'string', 'gather returns a string');
assert.ok(result.length > 0, 'non-empty output');

// Test 2: output has ## Context header
assert.ok(result.includes('## Context'), 'output has ## Context header');

// Test 3: unknown provider is skipped gracefully (no throw)
const safe = context.gather(['unknown-provider-xyz']);
assert.strictEqual(typeof safe, 'string', 'unknown provider does not throw');

// Test 4: empty providers returns empty string
const empty = context.gather([]);
assert.strictEqual(empty, '', 'empty providers = empty string');

// Test 5: stack-detect identifies this repo as Node.js/JavaScript
assert.ok(
  result.toLowerCase().includes('node') || result.toLowerCase().includes('javascript'),
  'stack-detect identifies Node.js project: ' + result
);

// Test 6: file-tree shows runtime/ directory
const treeResult = context.gather(['file-tree']);
assert.ok(treeResult.includes('runtime'), 'file-tree shows runtime/ directory');

console.log('✓ runtime/context.js — all 6 tests pass');
