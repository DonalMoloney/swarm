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

const DEFAULTS = { agentTimeout: 300, agentRetries: 1, maxCostUsd: null, maxTokens: null };

function shouldRetry({ exitCode, timedOut, structured }, attempt, maxRetries) {
  if (attempt > maxRetries) return false;
  return timedOut || exitCode !== 0 || !structured;
}

function budgetCheck(totals, limits) {
  if (limits.maxCostUsd != null && totals.costUsd > limits.maxCostUsd) {
    return { exceeded: true, metric: 'cost_usd', value: totals.costUsd, limit: limits.maxCostUsd };
  }
  if (limits.maxTokens != null && totals.tokens > limits.maxTokens) {
    return { exceeded: true, metric: 'tokens', value: totals.tokens, limit: limits.maxTokens };
  }
  return { exceeded: false };
}

function num(v, fallback) { return v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : fallback; }

function resolveLimits(blueprint, opts = {}) {
  const L = (blueprint && blueprint.limits) || {};
  return {
    agentTimeout: num(opts.timeout, num(L.agent_timeout, DEFAULTS.agentTimeout)),
    agentRetries: num(L.agent_retries, DEFAULTS.agentRetries),
    maxCostUsd: num(opts.maxCost, num(L.max_cost_usd, DEFAULTS.maxCostUsd)),
    maxTokens: num(L.max_tokens, DEFAULTS.maxTokens),
  };
}

module.exports = {
  buildAgentPrompt, parseCliEnvelope, CONTRACT_SUFFIX,
  shouldRetry, budgetCheck, resolveLimits, DEFAULTS,
};
