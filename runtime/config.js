#!/usr/bin/env node
/**
 * Loads and saves user settings from swarm.config.json (in cwd).
 * Unknown keys are dropped on load and rejected on save; values are
 * type-checked against DEFAULTS so the dashboard never persists garbage.
 *
 * Config lives in the working dir, NOT .swarm/ (which is cleared each run).
 */

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  dashboardPort: 7700,
  defaultModel: 'claude-opus-4-8',
  perRunCostCapUsd: 2.0,
  monthlyCostCapUsd: 50.0,
  notifyOnComplete: true,
  notifyOnError: true,
};

function configPath(file) {
  return file || path.join(process.cwd(), 'swarm.config.json');
}

function loadConfig(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(file), 'utf8'));
    const merged = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (Object.prototype.hasOwnProperty.call(parsed, k)) merged[k] = parsed[k];
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(partial, file) {
  for (const k of Object.keys(partial)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
      throw new Error('unknown config key: ' + k);
    }
    if (typeof partial[k] !== typeof DEFAULTS[k]) {
      throw new Error('invalid type for ' + k);
    }
  }
  const merged = { ...loadConfig(file), ...partial };
  fs.writeFileSync(configPath(file), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

module.exports = { DEFAULTS, configPath, loadConfig, saveConfig };
