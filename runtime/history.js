#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

function append(record) {
  ensureIndex();
  const p = indexPath();
  const records = JSON.parse(fs.readFileSync(p, 'utf8'));
  records.unshift(record);
  fs.writeFileSync(p, JSON.stringify(records, null, 2), 'utf8');
}

function list(blueprint) {
  ensureIndex();
  const records = JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
  return blueprint ? records.filter(r => r.blueprint === blueprint) : records;
}

function get(id) {
  ensureIndex();
  const records = JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
  return records.find(r => r.id === id) || null;
}

module.exports = { append, list, get };
