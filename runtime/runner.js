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

const { compile } = require('./compiler');
const { evaluateCondition } = require('./evaluator');

async function runStage(stage, ctx) {
  const results = await Promise.all(stage.agents.map((name) => {
    const a = ctx.blueprint.agents[name] || {};
    const role = a.prompt || a.role || '';
    const prompt = buildAgentPrompt(role, ctx.task, ctx.contextBlock, ctx.priorOutput);
    const timeoutMs = num(a.timeout, ctx.limits.agentTimeout) * 1000;
    const maxRetries = num(a.retries, ctx.limits.agentRetries);
    ctx.emit({ type: 'agent_start', agent: name, status: 'running', message: 'Starting…' });
    return runAgent({ name, prompt, timeoutMs, maxRetries, model: ctx.model, emit: ctx.emit })
      .then((r) => {
        ctx.emit({
          type: r.status === 'error' ? 'agent_error' : 'agent_done',
          agent: name, status: r.status, tokens: r.tokens, cost_usd: r.costUsd,
          structured: r.structured, message: r.summary,
        });
        return r;
      });
  }));
  return results;
}

// Walk a Phase-2 execution graph: run group stages, evaluate conditions against
// captured agent contracts, and route true/false branches. Branch decisions are
// emitted as `condition_evaluated` events.
async function runGraph(graph, blueprint, baseCtx) {
  const totals = { tokens: 0, costUsd: 0 };
  const resultsByName = {};
  let priorOutput = '';
  let status = 'done';

  const nodes = Object.fromEntries(graph.stages.map(n => [n.id, n]));
  const branchTargets = new Set();
  for (const n of graph.stages) {
    if (n.type === 'condition') { branchTargets.add(n.true_next); branchTargets.add(n.false_next); }
  }
  // Sequential successor map.
  // (1) Spine: a non-branch-target group flows to the next node in order.
  // (2) Convergence: a conditional's TWO branch groups both flow to the node that
  //     follows the conditional's branch span. The compiler emits a conditional as
  //     [condition, trueGroup, falseGroup, <join>], so both branches rejoin the
  //     post-conditional flow — without this the TRUE branch would dead-end.
  const idxOf = {};
  graph.stages.forEach((n, i) => { idxOf[n.id] = i; });
  const seqNext = {};
  for (let i = 0; i < graph.stages.length - 1; i++) {
    const cur = graph.stages[i], nx = graph.stages[i + 1];
    if (cur.type === 'group' && !branchTargets.has(cur.id) &&
        (nx.type === 'condition' || (nx.type === 'group' && !branchTargets.has(nx.id)))) {
      seqNext[cur.id] = nx.id;
    }
  }
  for (const n of graph.stages) {
    if (n.type === 'condition') {
      const last = Math.max(idxOf[n.true_next], idxOf[n.false_next]);
      const join = graph.stages[last + 1];
      if (join) { seqNext[n.true_next] = join.id; seqNext[n.false_next] = join.id; }
    }
  }

  let currentId = graph.stages.length ? graph.stages[0].id : null;
  const visited = new Set();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodes[currentId];
    if (!node) break;

    if (node.type === 'group') {
      const results = await runStage({ agents: node.agents }, { ...baseCtx, blueprint, priorOutput });
      for (const r of results) resultsByName[r.name] = r;
      priorOutput = results.map(r => `## ${r.name}\n${r.text}`).join('\n\n');
      totals.tokens += results.reduce((s, r) => s + r.tokens, 0);
      totals.costUsd += results.reduce((s, r) => s + r.costUsd, 0);
      const b = budgetCheck(totals, baseCtx.limits);
      if (b.exceeded) {
        baseCtx.emit({ type: 'budget_exceeded', metric: b.metric, value: b.value, limit: b.limit });
        status = 'aborted';
        break;
      }
      currentId = seqNext[node.id] || null;
    } else { // condition node
      const cond = (blueprint.conditions || {})[node.condition_id];
      const pass = evaluateCondition(cond, resultsByName);
      const nextId = pass ? node.true_next : node.false_next;
      baseCtx.emit({ type: 'condition_evaluated', condition: node.condition_id, result: pass, branch: nextId });
      currentId = nextId;
    }
  }

  return { status, totals, priorOutput };
}

async function run(blueprint, task, opts = {}) {
  const emit = opts.emit || (() => {});
  const plan = compile(blueprint);
  const limits = resolveLimits(blueprint, opts);
  const baseCtx = { task, contextBlock: opts.contextBlock || '', limits, model: opts.model, emit };

  emit({ type: 'swarm_start', agent: blueprint.name, status: 'running', message: task });

  let status, totals, priorOutput;
  if (plan.execution_graph) {
    ({ status, totals, priorOutput } = await runGraph(plan.execution_graph, blueprint, baseCtx));
  } else {
    totals = { tokens: 0, costUsd: 0 };
    priorOutput = '';
    status = 'done';
    for (const stage of plan.stages) {
      const results = await runStage(stage, { ...baseCtx, blueprint, priorOutput });
      priorOutput = results.map(r => `## ${r.name}\n${r.text}`).join('\n\n');
      totals.tokens += results.reduce((s, r) => s + r.tokens, 0);
      totals.costUsd += results.reduce((s, r) => s + r.costUsd, 0);
      const b = budgetCheck(totals, limits);
      if (b.exceeded) {
        emit({ type: 'budget_exceeded', metric: b.metric, value: b.value, limit: b.limit });
        status = 'aborted';
        break;
      }
    }
  }

  // Save final output + history (best-effort; mirrors skills/swarm.md)
  try {
    const fs = require('fs');
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const id = `${blueprint.name}-${stamp}`;
    fs.mkdirSync('swarms/output', { recursive: true });
    fs.writeFileSync(`swarms/output/${id}.md`, priorOutput, 'utf8');
    require('./history').append({ id, blueprint: blueprint.name, task, file: `${id}.md`, ts: Date.now() });
  } catch (e) { /* non-fatal */ }

  emit({ type: 'swarm_done', status, total_tokens: totals.tokens, total_cost_usd: totals.costUsd });
  return { status, totalTokens: totals.tokens, totalCostUsd: totals.costUsd };
}

module.exports = {
  buildAgentPrompt, parseCliEnvelope, CONTRACT_SUFFIX,
  shouldRetry, budgetCheck, resolveLimits, DEFAULTS,
  runAgent, runStage, runGraph, run,
};

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const yaml = require('./simple-yaml');
  const { resolveExtends } = require('./compiler');

  const [, , bpPath, task, ...rest] = process.argv;
  if (!bpPath || !task) {
    console.error('Usage: node runtime/runner.js <blueprint.yaml> "<task>" [--max-cost N] [--timeout S] [--model NAME]');
    process.exit(1);
  }
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--max-cost') opts.maxCost = rest[++i];
    else if (rest[i] === '--timeout') opts.timeout = rest[++i];
    else if (rest[i] === '--model') opts.model = rest[++i];
  }

  const { appendEvent } = require('./events');
  opts.emit = (e) => { appendEvent(e); const tag = e.agent || e.type; console.log(`[${tag}] ${e.message || e.status || e.type}`); };

  let bp = yaml.parse(fs.readFileSync(path.resolve(bpPath), 'utf8'));
  bp = resolveExtends(bp, (name) => yaml.parse(fs.readFileSync(path.resolve(path.dirname(bpPath), '..', `${name}.yaml`), 'utf8')));

  run(bp, task, opts)
    .then((s) => { console.log(`\n✓ ${s.status} — ${s.totalTokens} tokens, $${s.totalCostUsd.toFixed(4)}`); process.exit(s.status === 'done' ? 0 : 1); })
    .catch((err) => { console.error(err.message); process.exit(1); });
}
