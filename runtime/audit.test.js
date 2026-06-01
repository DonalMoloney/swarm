// runtime/audit.test.js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Use a temp file for each test run to avoid polluting the real audit log
function tmpAuditFile() {
  return `/tmp/swarm-audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`;
}

function loadModule(auditFile) {
  // Override env var so audit.js uses our temp file
  process.env.SWARM_AUDIT_FILE = auditFile;
  // Clear require cache so fresh module picks up the env var
  delete require.cache[require.resolve('./audit')];
  return require('./audit');
}

test('appendAuditEntry writes a valid JSON line to the audit file', () => {
  const file = tmpAuditFile();
  const { appendAuditEntry } = loadModule(file);

  appendAuditEntry({
    id: 'research-20260601120000',
    blueprint: 'research',
    task: 'compare AI frameworks',
    status: 'done',
    agentCount: 3,
    totalTokens: 360,
    totalCostUsd: 0.015,
    ts: 1748736000000,
  });

  assert.ok(fs.existsSync(file), 'audit file was created');
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'one line written');

  const entry = JSON.parse(lines[0]);
  assert.equal(entry.id, 'research-20260601120000');
  assert.equal(entry.blueprint, 'research');
  assert.equal(entry.status, 'done');
  assert.equal(entry.agentCount, 3);
  assert.equal(entry.totalTokens, 360);
  assert.ok(typeof entry.user === 'string', 'user field is present');

  fs.unlinkSync(file);
});

test('readAuditLog returns entries in order', () => {
  const file = tmpAuditFile();
  const { appendAuditEntry, readAuditLog } = loadModule(file);

  appendAuditEntry({ id: 'run-1', blueprint: 'research', task: 't1', status: 'done', agentCount: 1, totalTokens: 100, totalCostUsd: 0.001, ts: 1000 });
  appendAuditEntry({ id: 'run-2', blueprint: 'code-review', task: 't2', status: 'done', agentCount: 2, totalTokens: 200, totalCostUsd: 0.002, ts: 2000 });
  appendAuditEntry({ id: 'run-3', blueprint: 'research', task: 't3', status: 'error', agentCount: 1, totalTokens: 50, totalCostUsd: 0.0005, ts: 3000 });

  const entries = readAuditLog();
  assert.equal(entries.length, 3);
  assert.equal(entries[0].id, 'run-1');
  assert.equal(entries[1].id, 'run-2');
  assert.equal(entries[2].id, 'run-3');

  fs.unlinkSync(file);
});

test('readAuditLog({ limit: 2 }) returns only the last 2', () => {
  const file = tmpAuditFile();
  const { appendAuditEntry, readAuditLog } = loadModule(file);

  for (let i = 1; i <= 5; i++) {
    appendAuditEntry({ id: `run-${i}`, blueprint: 'x', task: 't', status: 'done', agentCount: 1, totalTokens: i * 10, totalCostUsd: 0, ts: i * 1000 });
  }

  const entries = readAuditLog({ limit: 2 });
  assert.equal(entries.length, 2, 'only 2 returned');
  assert.equal(entries[0].id, 'run-4', 'second-to-last entry');
  assert.equal(entries[1].id, 'run-5', 'last entry');

  fs.unlinkSync(file);
});

test('readAuditLog({ blueprint: "research" }) filters correctly', () => {
  const file = tmpAuditFile();
  const { appendAuditEntry, readAuditLog } = loadModule(file);

  appendAuditEntry({ id: 'r1', blueprint: 'research', task: 't', status: 'done', agentCount: 1, totalTokens: 100, totalCostUsd: 0, ts: 1000 });
  appendAuditEntry({ id: 'r2', blueprint: 'code-review', task: 't', status: 'done', agentCount: 2, totalTokens: 200, totalCostUsd: 0, ts: 2000 });
  appendAuditEntry({ id: 'r3', blueprint: 'research', task: 't', status: 'done', agentCount: 1, totalTokens: 150, totalCostUsd: 0, ts: 3000 });

  const entries = readAuditLog({ blueprint: 'research' });
  assert.equal(entries.length, 2, 'only research entries');
  assert.ok(entries.every(e => e.blueprint === 'research'), 'all entries are research');
  assert.equal(entries[0].id, 'r1');
  assert.equal(entries[1].id, 'r3');

  fs.unlinkSync(file);
});

test('non-fatal: directory is created if it does not exist', () => {
  // Use a nested path under /tmp that does not yet exist
  const dir = `/tmp/swarm-audit-test-newdir-${Date.now()}`;
  const file = path.join(dir, 'audit.jsonl');
  const { appendAuditEntry, readAuditLog } = loadModule(file);

  assert.ok(!fs.existsSync(dir), 'dir does not exist yet');
  appendAuditEntry({ id: 'x', blueprint: 'b', task: 't', status: 'done', agentCount: 1, totalTokens: 1, totalCostUsd: 0, ts: 1 });
  assert.ok(fs.existsSync(file), 'file was created inside new directory');

  const entries = readAuditLog();
  assert.equal(entries.length, 1);

  fs.rmSync(dir, { recursive: true });
});

test('readAuditLog returns [] when file does not exist', () => {
  const file = `/tmp/swarm-audit-nonexistent-${Date.now()}.jsonl`;
  const { readAuditLog } = loadModule(file);
  const entries = readAuditLog();
  assert.deepEqual(entries, []);
});

test('readAuditLog({ since }) filters by timestamp', () => {
  const file = tmpAuditFile();
  const { appendAuditEntry, readAuditLog } = loadModule(file);

  appendAuditEntry({ id: 'old', blueprint: 'b', task: 't', status: 'done', agentCount: 1, totalTokens: 10, totalCostUsd: 0, ts: 1000 });
  appendAuditEntry({ id: 'new', blueprint: 'b', task: 't', status: 'done', agentCount: 1, totalTokens: 20, totalCostUsd: 0, ts: 5000 });

  const entries = readAuditLog({ since: 2000 });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'new');

  fs.unlinkSync(file);
});
