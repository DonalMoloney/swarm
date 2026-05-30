#!/usr/bin/env node
/**
 * Appends structured events to .swarm/events.jsonl
 * Called by the swarm skill after each agent action.
 *
 * Usage: node events.js <type> <agent> [status] [message]
 *
 * Event types: swarm_start | agent_start | agent_log | agent_done | agent_error | swarm_done
 */

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(process.cwd(), '.swarm', 'events.jsonl');

function appendEvent(event) {
  const line = JSON.stringify({ ...event, ts: Date.now() }) + '\n';
  fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
  fs.appendFileSync(EVENTS_FILE, line, 'utf8');
}

function clearEvents() {
  fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
  fs.writeFileSync(EVENTS_FILE, '', 'utf8');
}

if (require.main === module) {
  const [,, type, agent, status, ...msgParts] = process.argv;
  const message = msgParts.join(' ');

  if (!type) {
    console.error('Usage: node events.js <type> [agent] [status] [message]');
    process.exit(1);
  }

  if (type === 'clear') {
    clearEvents();
    process.exit(0);
  }

  appendEvent({ type, agent, status, message });
}

module.exports = { appendEvent, clearEvents, EVENTS_FILE };
