# Phase 4 — Persistence & Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archive each swarm run's full event stream durably, enrich the run index, and let the dashboard replay any past run in the Live view.

**Architecture:** `runtime/archive.js` writes a run's events to `swarms/output/<id>.events.jsonl` (atomic) and appends an enriched record via `history.js`. The Phase 3 runner collects the events it emits, enriches `swarm_start` with `stages`+`agents`, and calls `archiveRun` on completion. The dashboard gains `GET /run/<id>/events`; the History tab replays a clicked run through the existing `processEvent` render path.

**Tech Stack:** Node.js built-ins only (`fs`, `path`, `http`), `node:test`. No npm. Reuses `runtime/history.js`, `runner.js`, `dashboard.js`, `ui/index.html`.

---

## File Structure

- **Create** `runtime/archive.js` — `archiveRun`, `loadRunEvents`, `eventsPath`.
- **Create** `runtime/archive.test.js` — unit tests.
- **Modify** `runtime/runner.js` — collect events, enrich `swarm_start`, call `archiveRun`.
- **Modify** `runtime/runner.test.js` — assert archive + enriched record.
- **Modify** `runtime/dashboard.js` — add `GET /run/<id>/events`.
- **Modify** `ui/index.html` — `replayRun`, `resetView`, module-level `es`, history row → replay.
- **Modify** `.gitignore` — ignore `swarms/output/*.jsonl`.
- **Modify** `skills/swarm.md` — note runs are archived + replayable.

Test seam: `runtime/archive.js` resolves the output dir from `process.env.SWARM_OUTPUT_DIR || <cwd>/swarms/output`; tests `chdir` to a temp dir (so `history.js`'s default index path aligns).

---

## Task 1: `runtime/archive.js`

**Files:**
- Create: `runtime/archive.js`
- Test: `runtime/archive.test.js`

- [ ] **Step 1: Write the failing test**

```js
// runtime/archive.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { archiveRun, loadRunEvents } = require('./archive');
const history = require('./history');

function inTemp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-arch-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try { return fn(dir); } finally { process.chdir(cwd); }
}

test('archiveRun writes events file and enriched index record', () => {
  inTemp(() => {
    const events = [
      { type: 'swarm_start', agent: 'demo', ts: 1 },
      { type: 'agent_done', agent: 'a', tokens: 100, ts: 2 },
      { type: 'swarm_done', status: 'done', ts: 3 },
    ];
    archiveRun({ id: 'demo-001', blueprint: 'demo', task: 't', events,
      status: 'done', totalTokens: 100, totalCostUsd: 0.01, agentCount: 1, ts: 9 });
    const lines = fs.readFileSync('swarms/output/demo-001.events.jsonl', 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 3);
    const rec = history.list().find(r => r.id === 'demo-001');
    assert.equal(rec.status, 'done');
    assert.equal(rec.tokens, 100);
    assert.equal(rec.agentCount, 1);
    assert.equal(rec.events_file, 'demo-001.events.jsonl');
  });
});

test('loadRunEvents round-trips and returns [] for missing', () => {
  inTemp(() => {
    archiveRun({ id: 'r1', blueprint: 'b', task: 't',
      events: [{ type: 'swarm_done', status: 'done' }], status: 'done' });
    assert.equal(loadRunEvents('r1').length, 1);
    assert.deepEqual(loadRunEvents('nope'), []);
  });
});

test('loadRunEvents id is path-safe (basename only)', () => {
  inTemp(() => {
    archiveRun({ id: 'safe', blueprint: 'b', task: 't', events: [{ x: 1 }], status: 'done' });
    assert.deepEqual(loadRunEvents('../../etc/passwd'), []);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test runtime/archive.test.js`
Expected: FAIL — `Cannot find module './archive'`.

- [ ] **Step 3: Implement**

```js
// runtime/archive.js
'use strict';

const fs = require('fs');
const path = require('path');
const history = require('./history');

function outputDir() {
  return process.env.SWARM_OUTPUT_DIR || path.join(process.cwd(), 'swarms', 'output');
}

function eventsPath(id) {
  return path.join(outputDir(), `${path.basename(String(id))}.events.jsonl`);
}

function archiveRun(run) {
  if (!run || !run.id) throw new TypeError('archiveRun: run.id is required');
  const dir = outputDir();
  fs.mkdirSync(dir, { recursive: true });

  const events = Array.isArray(run.events) ? run.events : [];
  const ep = eventsPath(run.id);
  const body = events.map(e => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '');
  const tmp = ep + '.tmp';
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, ep);

  history.append({
    id: run.id,
    blueprint: run.blueprint,
    task: run.task,
    file: run.outputFile || `${run.id}.md`,
    events_file: `${path.basename(String(run.id))}.events.jsonl`,
    status: run.status || 'done',
    tokens: run.totalTokens || 0,
    cost_usd: run.totalCostUsd || 0,
    agentCount: run.agentCount || 0,
    ts: run.ts || Date.now(),
  });

  return ep;
}

function loadRunEvents(id) {
  const ep = eventsPath(id);
  if (!fs.existsSync(ep)) return [];
  return fs.readFileSync(ep, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

module.exports = { archiveRun, loadRunEvents, eventsPath };
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test runtime/archive.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add runtime/archive.js runtime/archive.test.js
git commit -m "feat(phase4): durable run archive (events + enriched index)"
```

---

## Task 2: Ignore archived event files

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add the ignore rule**

Edit `.gitignore` — add `swarms/output/*.jsonl` right after the `swarms/output/*.json` line:

```
.swarm/
swarms/output/*.md
swarms/output/*.json
swarms/output/*.jsonl
.superpowers/
node_modules/
mock-dashboard.html
```

- [ ] **Step 2: Verify**

Run: `git check-ignore swarms/output/anything.events.jsonl`
Expected: prints `swarms/output/anything.events.jsonl` (ignored).

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(phase4): gitignore archived swarms/output/*.jsonl"
```

---

## Task 3: Runner archives each run

**Files:**
- Modify: `runtime/runner.js`
- Modify: `runtime/runner.test.js`

- [ ] **Step 1: Add the failing test**

Append to `runtime/runner.test.js`:

```js
test('run archives events and enriches the history record', async () => {
  process.env.SWARM_CLAUDE_BIN = FAKE;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-archive-'));
  const cwd = process.cwd();
  process.chdir(dir);
  fs.mkdirSync('swarms/output', { recursive: true });
  try {
    const blueprint = { name: 'demo', flow: 'a → b', agents: { a: { prompt: 'A' }, b: { prompt: 'B' } } };
    await run(blueprint, 'task', {});
    const history = require('./history');
    const rec = history.list()[0];
    assert.equal(rec.blueprint, 'demo');
    assert.equal(rec.status, 'done');
    assert.equal(rec.agentCount, 2);
    assert.ok(rec.events_file, 'record has events_file');
    const ev = fs.readFileSync(path.join('swarms/output', rec.events_file), 'utf8')
      .split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(ev.some(e => e.type === 'swarm_start' && Array.isArray(e.agents)), 'swarm_start carries agents');
    assert.ok(ev.some(e => e.type === 'swarm_done'), 'archive includes swarm_done');
  } finally {
    process.chdir(cwd);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test runtime/runner.test.js`
Expected: FAIL — `rec.events_file` is undefined / `swarm_start` lacks `agents`.

- [ ] **Step 3: Implement — modify `run()` in `runtime/runner.js`**

(a) Replace the emit setup and `swarm_start` emit (lines beginning `const emit = opts.emit ...` through the `swarm_start` emit):

```js
  const emit = opts.emit || (() => {});
  const plan = compile(blueprint);
  if (plan.execution_graph) {
    throw new Error('Runner handles linear/parallel flows only; this blueprint uses Phase-2 groups/conditions — run it via the /swarm LLM flow.');
  }
  const limits = resolveLimits(blueprint, opts);
  const totals = { tokens: 0, costUsd: 0 };
  let priorOutput = '';
  let status = 'done';

  // Collect every emitted event so the run can be archived for replay
  const collected = [];
  const record = (e) => { collected.push(e); emit(e); };

  record({
    type: 'swarm_start', agent: blueprint.name, status: 'running', message: task,
    stages: plan.stages, agents: Object.keys(blueprint.agents),
  });
```

(b) In the stage loop, change `emit` → `record` for `runStage`'s `emit:` and the `budget_exceeded` emit:

```js
    const results = await runStage(stage, {
      blueprint, task, contextBlock: opts.contextBlock || '',
      priorOutput, limits, model: opts.model, emit: record,
    });
    priorOutput = results.map(r => `## ${r.name}\n${r.text}`).join('\n\n');
    totals.tokens += results.reduce((s, r) => s + r.tokens, 0);
    totals.costUsd += results.reduce((s, r) => s + r.costUsd, 0);
    const b = budgetCheck(totals, limits);
    if (b.exceeded) {
      record({ type: 'budget_exceeded', metric: b.metric, value: b.value, limit: b.limit });
      status = 'aborted';
      break;
    }
```

(c) Replace the tail (the `swarm_done` emit + save block) so `swarm_done` is recorded **before** archiving, and archiving replaces the bare `history.append`:

```js
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
```

> Note: the old code emitted `swarm_done` *after* the save block; this reorders it before archiving so the archived stream includes `swarm_done` (replay needs it). The live `.swarm/events.jsonl` ordering is unchanged in practice (still the last event emitted).

- [ ] **Step 4: Run to verify pass**

Run: `node --test runtime/runner.test.js`
Expected: PASS (existing 13 + this new test = 14).

- [ ] **Step 5: Commit**

```bash
git add runtime/runner.js runtime/runner.test.js
git commit -m "feat(phase4): runner archives each run and enriches swarm_start"
```

---

## Task 4: Dashboard `/run/<id>/events` route

**Files:**
- Modify: `runtime/dashboard.js`

- [ ] **Step 1: Add the route**

In `runtime/dashboard.js`, add this branch immediately **before** the `} else if (url.pathname.startsWith('/output/')) {` branch:

```js
    } else if (url.pathname.startsWith('/run/') && url.pathname.endsWith('/events')) {
      const id = decodeURIComponent(url.pathname.slice('/run/'.length, -'/events'.length));
      let events = [];
      try { events = require('./archive').loadRunEvents(id); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(events));

```

(`loadRunEvents` already applies `path.basename`, so traversal is contained.)

- [ ] **Step 2: Manual verification (no server test harness in repo)**

Run, in the worktree root:
```bash
# 1. produce an archived run with the fake CLI
SWARM_CLAUDE_BIN="$(pwd)/test/fake-claude.js" node runtime/runner.js swarms/research.yaml "replay demo"
# 2. find the run id
ls swarms/output/*.events.jsonl
# 3. start the dashboard and curl the route (replace <id>)
node runtime/dashboard.js 7700 &
sleep 1
curl -s http://localhost:7700/run/<id>/events | head -c 200
kill %1
```
Expected: the curl prints a JSON array beginning with a `swarm_start` event. Then clean up: `rm -f swarms/output/*.md swarms/output/*.jsonl swarms/output/index.json` (these are gitignored; just keeps the tree tidy).

- [ ] **Step 3: Commit**

```bash
git add runtime/dashboard.js
git commit -m "feat(phase4): dashboard serves archived run events at /run/<id>/events"
```

---

## Task 5: UI — replay a past run in the Live view

**Files:**
- Modify: `ui/index.html`

- [ ] **Step 1: Make the EventSource reference module-level**

In the `<script>`, change `connect()` so `es` is assignable at module scope. Replace:

```js
  function connect() {
    const es = new EventSource('/events');
```

with:

```js
  let es = null;
  function connect() {
    es = new EventSource('/events');
```

(Leave the rest of `connect()` unchanged — it already references `es`.)

- [ ] **Step 2: Add `resetView()` and `replayRun()`**

Add these functions inside the `<script>` (e.g. just above `function showTab`):

```js
  function resetView() {
    state.swarmName = ''; state.task = ''; state.stages = []; state.agents = {}; state.status = 'idle';
    for (const k in agentColorMap) delete agentColorMap[k];
    colorIdx = 0;
    document.getElementById('log-stream').textContent = '';
    document.getElementById('task-list').innerHTML = '<div id="empty-state">No agents yet</div>';
    updateHeader();
    renderTaskList();
  }

  let replayTimers = [];
  function replayRun(id) {
    showTab('live');
    replayTimers.forEach(clearTimeout);
    replayTimers = [];
    if (es) { es.close(); es = null; }   // replay mode: stop the live feed
    resetView();
    fetch('/run/' + encodeURIComponent(id) + '/events')
      .then(r => r.json())
      .then(events => {
        events.forEach((e, i) => {
          replayTimers.push(setTimeout(() => processEvent(e), i * 250));
        });
      })
      .catch(() => {});
  }
```

- [ ] **Step 3: Make History rows replay**

In `loadHistory()`, change the row click handler. Replace:

```js
          tr.addEventListener('click', () => openRun(r.file, r.id));
```

with:

```js
          tr.addEventListener('click', () => replayRun(r.id));
```

(Leave `openRun` defined — it's harmless and still referenced nowhere else.)

- [ ] **Step 4: Manual verification**

```bash
# produce two archived runs
SWARM_CLAUDE_BIN="$(pwd)/test/fake-claude.js" node runtime/runner.js swarms/research.yaml "run one"
SWARM_CLAUDE_BIN="$(pwd)/test/fake-claude.js" node runtime/runner.js swarms/research.yaml "run two"
node runtime/dashboard.js 7700 &
sleep 1
echo "Open http://localhost:7700 → History tab → click a row → it should switch to Live and animate the topology + log."
# after checking: kill %1 ; rm -f swarms/output/*.md swarms/output/*.jsonl swarms/output/index.json
```
Expected: clicking a History row switches to the Live tab and replays that run (nodes light up, log streams, status badge ends `done`).

- [ ] **Step 5: Commit**

```bash
git add ui/index.html
git commit -m "feat(phase4): replay a past run in the Live view from History"
```

---

## Task 6: Document persistence & replay in `skills/swarm.md`

**Files:**
- Modify: `skills/swarm.md`

- [ ] **Step 1: Add a note to the runner section**

In the "Programmatic runner (Phase 3)" section of `skills/swarm.md`, append this paragraph:

```markdown
Every runner execution is **archived** for replay: the full event stream is
written to `swarms/output/<id>.events.jsonl` and an enriched record (status,
tokens, cost, agent count) is appended to `swarms/output/index.json`. In the
dashboard's **History** tab, clicking a past run replays it in the Live view
(served from `GET /run/<id>/events`).
```

- [ ] **Step 2: Verify no regression**

Run: `node runtime/compiler.js swarms/research.yaml`
Expected: prints the Execution Plan unchanged.
Run: `node --test`
Expected: PASS (all suites).

- [ ] **Step 3: Commit**

```bash
git add skills/swarm.md
git commit -m "docs(phase4): document run archive + replay in swarm skill"
```

---

## Self-Review

**Spec coverage:**
- `archive.js` (archiveRun + loadRunEvents) → Task 1. ✓
- Ignore `*.jsonl` → Task 2. ✓
- Runner archives + enriches `swarm_start` → Task 3. ✓
- `GET /run/<id>/events` (path-safe) → Task 4. ✓
- History-row replay in Live view → Task 5. ✓
- Enriched index record (status/tokens/cost/agentCount/events_file) → Task 1 + Task 3. ✓
- Backward compatibility (`/history`, `/output`, old records) → unchanged routes; additive fields. ✓
- Tests (archive unit + runner integration) → Tasks 1, 3; UI/route manual verify (no DOM/server harness) → Tasks 4, 5. ✓

**Placeholder scan:** none — every code step is complete; `<id>` in manual steps is a runtime value the operator substitutes.

**Type consistency:** `archiveRun(run)` consumes `{id, blueprint, task, events, status, totalTokens, totalCostUsd, agentCount, outputFile, ts}` and the runner passes exactly those keys. Index record fields (`events_file`, `status`, `tokens`, `cost_usd`, `agentCount`) match between `archive.js`, the runner test, and the spec. `loadRunEvents(id) -> [event]`, consumed by both the dashboard route and (via fetch) `replayRun`.
