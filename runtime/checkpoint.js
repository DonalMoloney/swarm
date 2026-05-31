#!/usr/bin/env node
/**
 * Checkpoint save/load/resume logic for swarm stage persistence.
 * Allows resuming swarm execution from a specific stage.
 *
 * Checkpoint ID format: swarm-name-YYYY-MM-DD-NNN (e.g., research-2026-05-31-001)
 *
 * State structure:
 * {
 *   checkpointId,
 *   swarmName,
 *   stageNumber,
 *   stageOutputs: { agent1: result1, agent2: result2 },
 *   timestamp,
 *   duration,
 *   events: [event1, event2, ...],
 *   blueprintSha,
 *   gitSha
 * }
 *
 * Save location: .swarm/checkpoints/ (gitignored)
 * Files created:
 * - checkpointId.json — full state
 * - checkpointId-stage-N-done — marker file for quick stage checks
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate a checkpoint ID based on swarm name and current date.
 * Format: swarm-name-YYYY-MM-DD-NNN
 *
 * @param {string} swarmName - Name of the swarm
 * @param {string} [checkpointDir] - Checkpoint directory to scan for existing IDs (defaults to .swarm/checkpoints)
 * @returns {string} Generated checkpoint ID
 */
function generateCheckpointId(swarmName, checkpointDir) {
  const dir = checkpointDir || path.join(process.cwd(), '.swarm', 'checkpoints');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Find the highest sequence number for this date
  let maxSeq = 0;
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    const pattern = new RegExp(`^${swarmName}-${dateStr}-(\\d{3})\\.json$`);
    files.forEach(file => {
      const match = file.match(pattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        maxSeq = Math.max(maxSeq, seq);
      }
    });
  }

  const seqStr = String(maxSeq + 1).padStart(3, '0');
  return `${swarmName}-${dateStr}-${seqStr}`;
}

/**
 * Save checkpoint state after a stage completes.
 *
 * @param {string} swarmName - Name of the swarm (used to find latest checkpoint)
 * @param {object} state - State object with structure documented above
 * @param {string} [checkpointDir] - Directory to save checkpoints (defaults to .swarm/checkpoints)
 */
function saveCheckpoint(swarmName, state, checkpointDir) {
  const dir = checkpointDir || path.join(process.cwd(), '.swarm', 'checkpoints');
  const checkpointId = state.checkpointId;
  const stageNumber = state.stageNumber;

  // Ensure directory exists
  fs.mkdirSync(dir, { recursive: true });

  // Save full state JSON
  const stateFile = path.join(dir, `${checkpointId}.json`);
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

  // Create marker file for this stage
  const markerFile = path.join(dir, `${checkpointId}-stage-${stageNumber}-done`);
  fs.writeFileSync(markerFile, '', 'utf8');
}

/**
 * Load a saved checkpoint by ID.
 *
 * @param {string} checkpointId - The checkpoint ID (e.g., research-2026-05-31-001)
 * @param {string} [checkpointDir] - Directory containing checkpoints (defaults to .swarm/checkpoints)
 * @returns {object|null} Loaded state object or null if not found
 */
function loadCheckpoint(checkpointId, checkpointDir) {
  const dir = checkpointDir || path.join(process.cwd(), '.swarm', 'checkpoints');
  const stateFile = path.join(dir, `${checkpointId}.json`);

  if (!fs.existsSync(stateFile)) {
    return null;
  }

  const content = fs.readFileSync(stateFile, 'utf8');
  return JSON.parse(content);
}

/**
 * Check if a resumable checkpoint exists for a given swarm.
 * Returns true if the most recent checkpoint for the swarm exists.
 *
 * @param {string} swarmName - Name of the swarm
 * @param {string} [checkpointDir] - Directory containing checkpoints (defaults to .swarm/checkpoints)
 * @returns {boolean} True if a checkpoint exists for this swarm
 */
function isCheckpointAvailable(swarmName, checkpointDir) {
  const dir = checkpointDir || path.join(process.cwd(), '.swarm', 'checkpoints');

  if (!fs.existsSync(dir)) {
    return false;
  }

  const files = fs.readdirSync(dir);
  // Look for any .json file matching the swarm name
  return files.some(file => file.startsWith(swarmName + '-') && file.endsWith('.json'));
}

/**
 * Get the latest checkpoint ID for a swarm.
 *
 * @param {string} swarmName - Name of the swarm
 * @param {string} [checkpointDir] - Directory containing checkpoints (defaults to .swarm/checkpoints)
 * @returns {string|null} Latest checkpoint ID or null if none exist
 */
function getLatestCheckpointId(swarmName, checkpointDir) {
  const dir = checkpointDir || path.join(process.cwd(), '.swarm', 'checkpoints');

  if (!fs.existsSync(dir)) {
    return null;
  }

  const files = fs.readdirSync(dir);
  const checkpoints = files
    .filter(file => file.startsWith(swarmName + '-') && file.endsWith('.json'))
    .map(file => file.replace('.json', ''))
    .sort()
    .reverse();

  return checkpoints.length > 0 ? checkpoints[0] : null;
}

/**
 * Get all completed stages for a checkpoint.
 * Scans for marker files of the format checkpointId-stage-N-done
 *
 * @param {string} checkpointId - The checkpoint ID
 * @param {string} [checkpointDir] - Directory containing checkpoints (defaults to .swarm/checkpoints)
 * @returns {number[]} Array of completed stage numbers in ascending order
 */
function getCompletedStages(checkpointId, checkpointDir) {
  const dir = checkpointDir || path.join(process.cwd(), '.swarm', 'checkpoints');

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  const pattern = new RegExp(`^${checkpointId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-stage-(\\d+)-done$`);
  const stages = [];

  files.forEach(file => {
    const match = file.match(pattern);
    if (match) {
      stages.push(parseInt(match[1], 10));
    }
  });

  return stages.sort((a, b) => a - b);
}

module.exports = {
  generateCheckpointId,
  saveCheckpoint,
  loadCheckpoint,
  isCheckpointAvailable,
  getLatestCheckpointId,
  getCompletedStages
};
