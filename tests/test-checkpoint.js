#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Create a temporary directory for checkpoint tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-checkpoint-test-'));
const checkpointDir = path.join(tmpDir, 'checkpoints');

// Mock the checkpoint module
const checkpoint = require('../runtime/checkpoint');

// Test 1: saveCheckpoint() stores state correctly
const testState1 = {
  checkpointId: 'research-2026-05-31-001',
  swarmName: 'research',
  stageNumber: 1,
  stageOutputs: {
    searcher: 'Found 5 research papers on AI frameworks',
    analyst: 'Analyzed frameworks: PyTorch, TensorFlow, JAX'
  },
  timestamp: Date.now(),
  duration: 12500,
  events: [
    { type: 'swarm_start', agent: 'research', ts: 1000 },
    { type: 'agent_done', agent: 'searcher', status: 'done', tokens: 500, ts: 2000 }
  ],
  blueprintSha: 'abc123def456',
  gitSha: 'commit789'
};

checkpoint.saveCheckpoint('research', testState1, checkpointDir);
assert(fs.existsSync(path.join(checkpointDir, 'research-2026-05-31-001.json')), 'checkpoint JSON file created');
assert(fs.existsSync(path.join(checkpointDir, 'research-2026-05-31-001-stage-1-done')), 'stage marker file created');
console.log('✓ Test 1: saveCheckpoint() stores state and marker files');

// Test 2: loadCheckpoint() retrieves saved state
const loaded1 = checkpoint.loadCheckpoint('research-2026-05-31-001', checkpointDir);
assert.strictEqual(loaded1.checkpointId, 'research-2026-05-31-001', 'checkpointId matches');
assert.strictEqual(loaded1.swarmName, 'research', 'swarmName matches');
assert.strictEqual(loaded1.stageNumber, 1, 'stageNumber matches');
assert.strictEqual(loaded1.stageOutputs.searcher, 'Found 5 research papers on AI frameworks', 'stage output preserved');
assert.strictEqual(loaded1.blueprintSha, 'abc123def456', 'blueprintSha preserved');
console.log('✓ Test 2: loadCheckpoint() retrieves saved state correctly');

// Test 3: isCheckpointAvailable() detects existing checkpoint
assert.strictEqual(checkpoint.isCheckpointAvailable('research', checkpointDir), true, 'checkpoint available for research');
assert.strictEqual(checkpoint.isCheckpointAvailable('nonexistent', checkpointDir), false, 'no checkpoint for nonexistent swarm');
console.log('✓ Test 3: isCheckpointAvailable() detects existing checkpoints');

// Test 4: Save multiple stages of the same swarm
const testState2 = {
  checkpointId: 'research-2026-05-31-001',
  swarmName: 'research',
  stageNumber: 2,
  stageOutputs: {
    ...testState1.stageOutputs,
    synthesizer: 'Comprehensive comparison document generated'
  },
  timestamp: Date.now(),
  duration: 25000,
  events: testState1.events.concat([
    { type: 'agent_done', agent: 'synthesizer', status: 'done', tokens: 800, ts: 3000 }
  ]),
  blueprintSha: 'abc123def456',
  gitSha: 'commit789'
};

checkpoint.saveCheckpoint('research', testState2, checkpointDir);
assert(fs.existsSync(path.join(checkpointDir, 'research-2026-05-31-001-stage-2-done')), 'stage 2 marker created');

const loaded2 = checkpoint.loadCheckpoint('research-2026-05-31-001', checkpointDir);
assert.strictEqual(loaded2.stageNumber, 2, 'latest stage number is 2');
assert.strictEqual(loaded2.stageOutputs.synthesizer, 'Comprehensive comparison document generated', 'stage 2 output present');
console.log('✓ Test 4: Multiple stages of same swarm persisted and loaded correctly');

// Test 5: getCompletedStages() returns correct stages
const completedStages = checkpoint.getCompletedStages('research-2026-05-31-001', checkpointDir);
assert(Array.isArray(completedStages), 'returns an array');
assert.strictEqual(completedStages.length, 2, 'returns both completed stages');
assert(completedStages.includes(1), 'includes stage 1');
assert(completedStages.includes(2), 'includes stage 2');
console.log('✓ Test 5: getCompletedStages() lists all completed stages');

// Test 6: loadCheckpoint() returns null for non-existent checkpoint
const notFound = checkpoint.loadCheckpoint('nonexistent-2026-05-31-999', checkpointDir);
assert.strictEqual(notFound, null, 'returns null for non-existent checkpoint');
console.log('✓ Test 6: loadCheckpoint() returns null for missing checkpoints');

// Test 7: Multiple swarms can have separate checkpoints
const testState3 = {
  checkpointId: 'debug-2026-05-31-001',
  swarmName: 'debug',
  stageNumber: 1,
  stageOutputs: {
    reproducer: 'Error reproduced in test suite'
  },
  timestamp: Date.now(),
  duration: 5000,
  events: [],
  blueprintSha: 'different123',
  gitSha: 'commit456'
};

checkpoint.saveCheckpoint('debug', testState3, checkpointDir);
assert(fs.existsSync(path.join(checkpointDir, 'debug-2026-05-31-001.json')), 'debug checkpoint created');
assert.strictEqual(checkpoint.isCheckpointAvailable('debug', checkpointDir), true, 'debug checkpoint available');
assert.strictEqual(checkpoint.isCheckpointAvailable('research', checkpointDir), true, 'research checkpoint still available');
console.log('✓ Test 7: Multiple swarms maintain separate checkpoints');

// Test 8: Checkpoint ID generation validation
const checkpointId = checkpoint.generateCheckpointId('my-swarm');
const idMatch = checkpointId.match(/^my-swarm-\d{4}-\d{2}-\d{2}-\d{3}$/);
assert(idMatch, `checkpoint ID matches format: ${checkpointId}`);
console.log('✓ Test 8: generateCheckpointId() produces correct format');

// Test 9: getCompletedStages() for non-existent checkpoint returns empty array
const noStages = checkpoint.getCompletedStages('nonexistent-2026-05-31-999', checkpointDir);
assert(Array.isArray(noStages), 'returns an array');
assert.strictEqual(noStages.length, 0, 'returns empty array for non-existent checkpoint');
console.log('✓ Test 9: getCompletedStages() returns empty array for missing checkpoint');

// Cleanup
fs.rmSync(tmpDir, { recursive: true });

console.log('\n✓ runtime/checkpoint.js — all 9 tests pass');
