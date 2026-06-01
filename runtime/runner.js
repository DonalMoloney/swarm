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

  // Collect every emitted event so the run can be archived for replay
  const collected = [];
  const record = (e) => { collected.push(e); emit(e); };

  const baseCtx = { task, contextBlock: opts.contextBlock || '', limits, model: opts.model, emit: record };

  record({
    type: 'swarm_start', agent: blueprint.name, status: 'running', message: task,
    stages: plan.stages, agents: Object.keys(blueprint.agents),
  });

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
        record({ type: 'budget_exceeded', metric: b.metric, value: b.value, limit: b.limit });
        status = 'aborted';
        break;
      }
    }
  }

  record({ type: 'swarm_done', status, total_tokens: totals.tokens, total_cost_usd: totals.costUsd });

  // Persist the run durably: events archive + enriched index record
  try {
    const fs = require('fs');
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const id = `${blueprint.name}-${stamp}`;
    fs.mkdirSync('swarms/output', { recursive: true });
    fs.writeFileSync(`swarms/output/${id}.md`, priorOutput, 'utf8');
    require('./archive').archiveRun({
      id, blueprint: blueprint.name, task,
      events: collected, status,
      totalTokens: totals.tokens, totalCostUsd: totals.costUsd,
      agentCount: Object.keys(blueprint.agents).length,
      outputFile: `${id}.md`, ts: Date.now(),
    });
  } catch (e) { /* non-fatal */ }

  return { status, totalTokens: totals.tokens, totalCostUsd: totals.costUsd };
}

// CI-mode log formatters (GitHub Actions annotation syntax).
// Exported for testing; also used by the CLI entry point when --ci is passed.
function formatCiEvent(e) {
  const type = e.type;
  if (type === 'agent_error') {
    const msg = e.message || e.status || 'agent failed';
    return `::error title=Agent ${e.agent}::${msg}`;
  }
  if (type === 'budget_exceeded') {
    return `::warning title=Budget exceeded::${e.metric} ${e.value} > ${e.limit}`;
  }
  if (type === 'swarm_done') {
    if (e.status === 'done') {
      const tokens = e.total_tokens != null ? e.total_tokens : '?';
      const cost = typeof e.total_cost_usd === 'number' ? `$${e.total_cost_usd.toFixed(4)}` : '$?';
      return `::notice title=Swarm complete::${tokens} tokens, ${cost}`;
    }
    return `::warning title=Swarm ended::status=${e.status}`;
  }
  if (type === 'agent_start') {
    return `::group::Agent ${e.agent}`;
  }
  if (type === 'agent_done') {
    return `::endgroup::`;
  }
  // Default: plain log line
  const tag = e.agent || e.type;
  return `[${tag}] ${e.message || e.status || e.type}`;
}

module.exports = {
  buildAgentPrompt, parseCliEnvelope, CONTRACT_SUFFIX,
  shouldRetry, budgetCheck, resolveLimits, DEFAULTS,
  runAgent, runStage, runGraph, run,
  formatCiEvent,
};

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const yaml = require('./simple-yaml');
  const { resolveExtends } = require('./compiler');

  const [, , bpPath, task, ...rest] = process.argv;
  if (!bpPath || !task) {
    console.error('Usage: node runtime/runner.js <blueprint.yaml> "<task>" [--max-cost N] [--timeout S] [--model NAME] [--ci] [--notify-slack <url>] [--notify-pr <repo> <pr-number>]');
    process.exit(1);
  }

  const opts = {};
  let ciMode = false;
  let notifySlack = null;
  let notifyPrRepo = null;
  let notifyPrNumber = null;

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--max-cost') opts.maxCost = rest[++i];
    else if (rest[i] === '--timeout') opts.timeout = rest[++i];
    else if (rest[i] === '--model') opts.model = rest[++i];
    else if (rest[i] === '--ci') ciMode = true;
    else if (rest[i] === '--notify-slack') notifySlack = rest[++i];
    else if (rest[i] === '--notify-pr') { notifyPrRepo = rest[++i]; notifyPrNumber = rest[++i]; }
  }

  // Also pick up notify targets from environment variables (set by GitHub Actions).
  if (!notifySlack && process.env.SLACK_WEBHOOK_URL) notifySlack = process.env.SLACK_WEBHOOK_URL;
  if (!notifyPrRepo && process.env.SWARM_NOTIFY_REPO) notifyPrRepo = process.env.SWARM_NOTIFY_REPO;
  if (!notifyPrNumber && process.env.SWARM_NOTIFY_PR) notifyPrNumber = process.env.SWARM_NOTIFY_PR;

  const { appendEvent } = require('./events');
  opts.emit = (e) => {
    appendEvent(e);
    if (ciMode) {
      const line = formatCiEvent(e);
      if (line) process.stdout.write(line + '\n');
    } else {
      const tag = e.agent || e.type;
      console.log(`[${tag}] ${e.message || e.status || e.type}`);
    }
  };

  let bp = yaml.parse(fs.readFileSync(path.resolve(bpPath), 'utf8'));
  bp = resolveExtends(bp, (name) => yaml.parse(fs.readFileSync(path.resolve(path.dirname(bpPath), '..', `${name}.yaml`), 'utf8')));

  const blueprintName = bp.name || path.basename(bpPath, '.yaml');

  run(bp, task, opts)
    .then(async (s) => {
      if (ciMode) {
        const cost = `$${s.totalCostUsd.toFixed(4)}`;
        console.log(`::notice title=Run summary::${s.status} — ${s.totalTokens} tokens, ${cost}`);
        // Write to GitHub Actions step summary if available
        if (process.env.GITHUB_STEP_SUMMARY) {
          const { formatGithubComment } = require('./notify');
          const summary = formatGithubComment({
            blueprint: blueprintName,
            task,
            status: s.status,
            totalTokens: s.totalTokens,
            totalCostUsd: s.totalCostUsd,
            runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
              ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
              : undefined,
          });
          fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n', 'utf8');
        }
      } else {
        console.log(`\n✓ ${s.status} — ${s.totalTokens} tokens, $${s.totalCostUsd.toFixed(4)}`);
      }

      // Send notifications if configured
      const notifyOpts = {};
      if (process.env.GITHUB_TOKEN) notifyOpts.githubToken = process.env.GITHUB_TOKEN;
      if (notifyPrRepo) notifyOpts.githubRepo = notifyPrRepo;
      if (notifyPrNumber) notifyOpts.prNumber = notifyPrNumber;
      if (notifySlack) notifyOpts.slackWebhook = notifySlack;

      const hasAnyNotify = !!(notifySlack || (notifyPrRepo && notifyPrNumber));
      if (hasAnyNotify) {
        const { notify } = require('./notify');
        await notify({
          blueprint: blueprintName,
          task,
          status: s.status,
          totalTokens: s.totalTokens,
          totalCostUsd: s.totalCostUsd,
        }, notifyOpts);
      }

      process.exit(s.status === 'done' ? 0 : 1);
    })
    .catch((err) => { console.error(err.message); process.exit(1); });
}
