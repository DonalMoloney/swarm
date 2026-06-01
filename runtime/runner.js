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

const { spawn } = require('child_process');

function claudeBin() { return process.env.SWARM_CLAUDE_BIN || 'claude'; }

function runAgentOnce(prompt, { timeoutMs, model }) {
  return new Promise((resolve) => {
    const args = ['-p', prompt, '--output-format', 'json'];
    if (model) args.push('--model', model);
    const child = spawn(claudeBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 2000);
    }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); resolve({ exitCode: -1, stdout, stderr: String(err), timedOut }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ exitCode: timedOut ? -1 : code, stdout, stderr, timedOut }); });
  });
}

async function runAgent({ name, prompt, timeoutMs, maxRetries, model, emit }) {
  const noop = () => {};
  const log = emit || noop;
  let attempt = 0, text = '', tokens = 0, costUsd = 0, structured = false, contract = null, timedOut = false, exitCode = 0;
  while (true) {
    attempt++;
    const res = await runAgentOnce(prompt, { timeoutMs, model });
    timedOut = res.timedOut; exitCode = res.exitCode;
    const env = parseCliEnvelope(res.stdout);
    if (env) { text = env.text; tokens += env.tokens; costUsd += env.costUsd; }
    const ex = extractContract(text);
    structured = ex.structured; contract = ex.contract;
    if (!shouldRetry({ exitCode, timedOut, structured }, attempt, maxRetries)) break;
    log({ type: 'agent_retry', agent: name, attempt, reason: timedOut ? 'timeout' : (exitCode !== 0 ? `exit_${exitCode}` : 'no_contract') });
  }
  if (!structured) contract = fallbackContract(text);
  const failed = (timedOut || exitCode !== 0) && !structured;
  const status = failed ? 'error' : contract.status;
  return { name, status, summary: contract.summary, contract, text, tokens, costUsd, attempts: attempt, structured };
}

module.exports = {
  buildAgentPrompt, parseCliEnvelope, CONTRACT_SUFFIX,
  shouldRetry, budgetCheck, resolveLimits, DEFAULTS,
  runAgent,
};
