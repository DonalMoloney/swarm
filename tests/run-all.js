#!/usr/bin/env node
// Runs all test-*.js files in tests/ and reports results
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.startsWith('test-') && f.endsWith('.js'));

let passed = 0;
let failed = 0;

for (const file of files) {
  try {
    execFileSync('node', [path.join(testDir, file)], { stdio: 'inherit' });
    passed++;
  } catch {
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
