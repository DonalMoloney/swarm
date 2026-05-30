#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-history-test-'));
process.env.SWARM_INDEX_PATH = path.join(tmpDir, 'index.json');

delete require.cache[require.resolve('../runtime/history')];
const history = require('../runtime/history');

assert.deepStrictEqual(history.list(), [], 'empty list');

history.append({ id: '001', blueprint: 'research', task: 'task A', file: 'research-001.md', ts: 1 });
history.append({ id: '002', blueprint: 'debug',    task: 'task B', file: 'debug-002.md',    ts: 2 });
const all = history.list();
assert.strictEqual(all.length, 2);
assert.strictEqual(all[0].id, '002', 'newest first');
assert.strictEqual(all[1].id, '001');

const research = history.list('research');
assert.strictEqual(research.length, 1);
assert.strictEqual(research[0].blueprint, 'research');

const rec = history.get('001');
assert.strictEqual(rec.task, 'task A');

assert.strictEqual(history.get('999'), null);

fs.rmSync(tmpDir, { recursive: true });
console.log('✓ runtime/history.js — all 5 tests pass');
