#!/usr/bin/env node
/**
 * Aggregates token/cost metrics from a swarm events array.
 * Used by the dashboard's /metrics route and the Cost tab.
 *
 * Events without a `tokens` field are treated as 0 (backward compatible).
 */

// Sonnet 4.6 rates (USD per 1M tokens), with a 60/40 input/output split.
const RATES = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
};
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const INPUT_SPLIT = 0.6;
const OUTPUT_SPLIT = 0.4;

function tokensOf(event) {
  const n = Number(event && event.tokens);
  return Number.isFinite(n) ? n : 0;
}

function totalTokens(events) {
  return (events || [])
    .filter(e => e && e.type === 'agent_done')
    .reduce((sum, e) => sum + tokensOf(e), 0);
}

function perAgent(events) {
  const out = {};
  (events || [])
    .filter(e => e && e.type === 'agent_done' && e.agent)
    .forEach(e => { out[e.agent] = (out[e.agent] || 0) + tokensOf(e); });
  return out;
}

function estimateCost(tokens, model = DEFAULT_MODEL) {
  const rate = RATES[model] || RATES[DEFAULT_MODEL];
  const t = Number.isFinite(Number(tokens)) ? Number(tokens) : 0;
  const inputCost = (t * INPUT_SPLIT / 1e6) * rate.input;
  const outputCost = (t * OUTPUT_SPLIT / 1e6) * rate.output;
  return inputCost + outputCost;
}

/**
 * Returns { used, limit, pct } when the swarm_start event carries a token
 * budget (via `limits.max_tokens`), otherwise null.
 */
function budgetUsage(events) {
  const start = (events || []).find(e => e && e.type === 'swarm_start');
  const limits = start && start.limits;
  const limit = limits ? Number(limits.max_tokens) : NaN;
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const used = totalTokens(events);
  return { used, limit, pct: limit ? (used / limit) * 100 : 0 };
}

module.exports = { totalTokens, perAgent, estimateCost, budgetUsage, DEFAULT_MODEL };
