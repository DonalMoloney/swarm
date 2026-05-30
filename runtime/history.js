#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// SECURITY NOTE: SWARM_INDEX_PATH is only set by test code pointing to a temp
// directory and must be treated as trusted input. Do not use this env var in
// untrusted/production contexts without adding a strict path-base guard.
function indexPath() {
  return process.env.SWARM_INDEX_PATH ||
    path.join(process.cwd(), 'swarms', 'output', 'index.json');
}

function ensureIndex() {
  const p = indexPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]', 'utf8');
}

function readIndex() {
  ensureIndex();
  try {
    return JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
  } catch {
    fs.writeFileSync(indexPath(), '[]', 'utf8');
    return [];
  }
}

function append(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('history.append: record must be a plain object');
  }
  const p = indexPath();
  const records = readIndex();
  records.unshift(record);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function list(blueprint) {
  const records = readIndex();
  return blueprint ? records.filter(r => r.blueprint === blueprint) : records;
}

function get(id) {
  const records = readIndex();
  return records.find(r => r.id === id) || null;
}

module.exports = { append, list, get };
