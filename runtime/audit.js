// runtime/audit.js
// Persistent append-only audit log. Writes to swarms/audit.jsonl (survives across runs).
// API:
//   appendAuditEntry(entry)  -> void
//   readAuditLog(opts?)      -> entry[]   opts: { limit?, blueprint?, since? }
'use strict';

const fs = require('fs');
const path = require('path');

function auditPath() {
  return process.env.SWARM_AUDIT_FILE || path.join(process.cwd(), 'swarms', 'audit.jsonl');
}

/**
 * Append a single entry to the audit log.
 * entry: { id, blueprint, task, status, agentCount, totalTokens, totalCostUsd, ts, user? }
 */
function appendAuditEntry(entry) {
  const file = auditPath();
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const user = entry.user || process.env.USER || process.env.USERNAME || 'unknown';
  const line = JSON.stringify({ ...entry, user }) + '\n';
  fs.appendFileSync(file, line, 'utf8');
}

/**
 * Read and optionally filter the audit log.
 * opts.limit     — return only the last N entries
 * opts.blueprint — filter by blueprint name
 * opts.since     — filter to entries with ts >= since (ms epoch)
 */
function readAuditLog(opts = {}) {
  const file = auditPath();
  if (!fs.existsSync(file)) return [];

  const raw = fs.readFileSync(file, 'utf8');
  let entries = raw
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

  if (opts.blueprint) {
    entries = entries.filter(e => e.blueprint === opts.blueprint);
  }
  if (opts.since != null) {
    entries = entries.filter(e => e.ts >= opts.since);
  }
  if (opts.limit != null) {
    entries = entries.slice(-opts.limit);
  }

  return entries;
}

module.exports = { appendAuditEntry, readAuditLog };
