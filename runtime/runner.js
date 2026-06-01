// runtime/runner.js
'use strict';

const { extractContract, fallbackContract } = require('./contract');

const CONTRACT_SUFFIX = [
  '',
  '---',
  'When finished, end your reply with a fenced json block describing the result:',
  '```json',
  '{ "status": "success | partial | error", "summary": "<one line>" }',
  '```',
  'Add any extra fields downstream steps may need (e.g. "confidence": 0.0-1.0).',
].join('\n');

function buildAgentPrompt(role, task, contextBlock, priorOutput) {
  let p = `${role}\n\nTask: ${task}`;
  if (contextBlock) p += `\n\n${contextBlock}`;
  if (priorOutput) p += `\n\nPrevious stage output:\n${priorOutput}`;
  return p + '\n' + CONTRACT_SUFFIX;
}

function parseCliEnvelope(stdout) {
  let obj;
  try { obj = JSON.parse(stdout); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const usage = obj.usage || {};
  return {
    text: obj.result != null ? String(obj.result) : '',
    tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
    costUsd: typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : 0,
    isError: !!obj.is_error,
  };
}

module.exports = { buildAgentPrompt, parseCliEnvelope, CONTRACT_SUFFIX };
