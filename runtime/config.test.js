// runtime/config.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULTS, loadConfig, saveConfig } = require('./config');

let counter = 0;
function tmpFile() {
  return path.join(os.tmpdir(), `swarm-config-test-${process.pid}-${Date.now()}-${counter++}.json`);
}

function cleanup(file) {
  try { fs.unlinkSync(file); } catch {}
}

test('loadConfig with no file returns DEFAULTS', (t) => {
  const tmp = tmpFile();
  t.after(() => cleanup(tmp));
  assert.deepEqual(loadConfig(tmp), DEFAULTS);
});

test('saveConfig merges a known key and load reflects it', (t) => {
  const tmp = tmpFile();
  t.after(() => cleanup(tmp));

  const saved = saveConfig({ perRunCostCapUsd: 5 }, tmp);
  assert.equal(saved.perRunCostCapUsd, 5);
  assert.equal(saved.dashboardPort, DEFAULTS.dashboardPort);
  assert.equal(saved.defaultModel, DEFAULTS.defaultModel);

  const loaded = loadConfig(tmp);
  assert.equal(loaded.perRunCostCapUsd, 5);
  assert.equal(loaded.monthlyCostCapUsd, DEFAULTS.monthlyCostCapUsd);
});

test('saveConfig rejects an unknown key', (t) => {
  const tmp = tmpFile();
  t.after(() => cleanup(tmp));
  assert.throws(() => saveConfig({ unknownKey: 1 }, tmp), /unknown config key: unknownKey/);
});

test('saveConfig rejects a type mismatch', (t) => {
  const tmp = tmpFile();
  t.after(() => cleanup(tmp));
  assert.throws(() => saveConfig({ dashboardPort: 'nope' }, tmp), /invalid type for dashboardPort/);
});

test('saveConfig persists a false boolean', (t) => {
  const tmp = tmpFile();
  t.after(() => cleanup(tmp));

  const saved = saveConfig({ notifyOnError: false }, tmp);
  assert.equal(saved.notifyOnError, false);
  assert.equal(loadConfig(tmp).notifyOnError, false);
});
