#!/usr/bin/env node
// Runs the project's test suites and reports results.
// Two conventions are discovered and run:
//   - tests/test-*.js    (plain node + assert scripts)
//   - runtime/*.test.js  (node:test built-in runner — Phase 3 reliability core)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const testDir = __dirname;
const runtimeDir = path.join(__dirname, '..', 'runtime');

const suites = [];
for (const f of fs.readdirSync(testDir)) {
  if (f.startsWith('test-') && f.endsWith('.js')) suites.push(path.join(testDir, f));
}
for (const f of fs.readdirSync(runtimeDir)) {
  if (f.endsWith('.test.js')) suites.push(path.join(runtimeDir, f));
}
suites.sort();

let passed = 0;
let failed = 0;

for (const file of suites) {
  try {
    execFileSync('node', [file], { stdio: 'inherit' });
    passed++;
  } catch {
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
