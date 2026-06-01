// runtime/archive.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { archiveRun, loadRunEvents } = require('./archive');
const history = require('./history');

function inTemp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-arch-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try { return fn(dir); } finally { process.chdir(cwd); }
}

test('archiveRun writes events file and enriched index record', () => {
  inTemp(() => {
    const events = [
      { type: 'swarm_start', agent: 'demo', ts: 1 },
      { type: 'agent_done', agent: 'a', tokens: 100, ts: 2 },
      { type: 'swarm_done', status: 'done', ts: 3 },
    ];
    archiveRun({ id: 'demo-001', blueprint: 'demo', task: 't', events,
      status: 'done', totalTokens: 100, totalCostUsd: 0.01, agentCount: 1, ts: 9 });
    const lines = fs.readFileSync('swarms/output/demo-001.events.jsonl', 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 3);
    const rec = history.list().find(r => r.id === 'demo-001');
    assert.equal(rec.status, 'done');
    assert.equal(rec.tokens, 100);
    assert.equal(rec.agentCount, 1);
    assert.equal(rec.events_file, 'demo-001.events.jsonl');
  });
});

test('loadRunEvents round-trips and returns [] for missing', () => {
  inTemp(() => {
    archiveRun({ id: 'r1', blueprint: 'b', task: 't',
      events: [{ type: 'swarm_done', status: 'done' }], status: 'done' });
    assert.equal(loadRunEvents('r1').length, 1);
    assert.deepEqual(loadRunEvents('nope'), []);
  });
});

test('loadRunEvents id is path-safe (basename only)', () => {
  inTemp(() => {
    archiveRun({ id: 'safe', blueprint: 'b', task: 't', events: [{ x: 1 }], status: 'done' });
    assert.deepEqual(loadRunEvents('../../etc/passwd'), []);
  });
});
