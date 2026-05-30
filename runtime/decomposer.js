#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parsePlan(raw) {
  // Try direct parse first
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Extract first [...] block from surrounding prose
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error('No JSON array found in meta-agent output');
  return JSON.parse(match[0]);
}

function validatePlan(steps, availableBlueprints) {
  const errors = [];
  steps.forEach((step, i) => {
    const label = `Step ${step.step || i + 1}`;
    if (!step.blueprint) { errors.push(`${label}: missing required field "blueprint"`); }
    if (!step.task)      { errors.push(`${label}: missing required field "task"`); }
    if (!step.reason)    { errors.push(`${label}: missing required field "reason"`); }
    if (step.blueprint && !availableBlueprints.includes(step.blueprint)) {
      errors.push(`${label}: unknown blueprint "${step.blueprint}" (available: ${availableBlueprints.join(', ')})`);
    }
  });
  return errors;
}

function listBlueprints(swarmsDir) {
  const blueprints = [];
  const base = swarmsDir || path.join(process.cwd(), 'swarms');

  function scan(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory() && f !== 'output') {
        scan(full, prefix ? `${prefix}/${f}` : f);
      } else if (f.endsWith('.yaml')) {
        blueprints.push(prefix ? `${prefix}/${f.slice(0, -5)}` : f.slice(0, -5));
      }
    });
  }
  scan(base, '');
  return blueprints;
}

module.exports = { parsePlan, validatePlan, listBlueprints };
