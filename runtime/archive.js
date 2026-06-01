// runtime/archive.js
'use strict';

const fs = require('fs');
const path = require('path');
const history = require('./history');

function outputDir() {
  return process.env.SWARM_OUTPUT_DIR || path.join(process.cwd(), 'swarms', 'output');
}

function eventsPath(id) {
  return path.join(outputDir(), `${path.basename(String(id))}.events.jsonl`);
}

function archiveRun(run) {
  if (!run || !run.id) throw new TypeError('archiveRun: run.id is required');
  const dir = outputDir();
  fs.mkdirSync(dir, { recursive: true });

  const events = Array.isArray(run.events) ? run.events : [];
  const ep = eventsPath(run.id);
  const body = events.map(e => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '');
  const tmp = ep + '.tmp';
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, ep);

  history.append({
    id: run.id,
    blueprint: run.blueprint,
    task: run.task,
    file: run.outputFile || `${run.id}.md`,
    events_file: `${path.basename(String(run.id))}.events.jsonl`,
    status: run.status || 'done',
    tokens: run.totalTokens || 0,
    cost_usd: run.totalCostUsd || 0,
    agentCount: run.agentCount || 0,
    ts: run.ts || Date.now(),
  });

  return ep;
}

function loadRunEvents(id) {
  const ep = eventsPath(id);
  if (!fs.existsSync(ep)) return [];
  return fs.readFileSync(ep, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

module.exports = { archiveRun, loadRunEvents, eventsPath };
