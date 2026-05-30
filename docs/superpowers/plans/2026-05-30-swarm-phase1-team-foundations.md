# Swarm Phase 1 — Team Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add blueprint sharing (`swarms/team/`), run history (`swarms/output/index.json`), and authoring UX (`/swarm scaffold`, `/swarm validate`, `/swarm history`) to Swarm with zero new dependencies.

**Architecture:** A new `runtime/history.js` module owns the run index. `runtime/compiler.js` gains `extends` resolution before validation. `dashboard.js` gains a `/history` route. `ui/index.html` adds a History tab. Two new skill files add the scaffold/validate and history commands.

**Tech Stack:** Node.js built-ins only (`fs`, `path`, `assert`, `os`, `http`). No npm. No package.json.

---

### Task 1: Test runner + history module scaffold

**Files:**
- Create: `tests/run-all.js`
- Create: `tests/test-history.js`
- Create: `runtime/history.js`

- [ ] **Step 1: Create `tests/run-all.js`**

```javascript
#!/usr/bin/env node
// Runs all test-*.js files in tests/ and reports results
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.startsWith('test-') && f.endsWith('.js'));

let passed = 0;
let failed = 0;

for (const file of files) {
  try {
    execSync(`node ${path.join(testDir, file)}`, { stdio: 'inherit' });
    passed++;
  } catch {
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Create `tests/test-history.js` (failing — module doesn't exist yet)**

```javascript
#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-history-test-'));
process.env.SWARM_INDEX_PATH = path.join(tmpDir, 'index.json');

// Clear require cache so env var is picked up
delete require.cache[require.resolve('../runtime/history')];
const history = require('../runtime/history');

// Test 1: list on empty index returns []
assert.deepStrictEqual(history.list(), [], 'empty list');

// Test 2: append stores record and list returns it newest-first
history.append({ id: '001', blueprint: 'research', task: 'task A', file: 'research-001.md', ts: 1 });
history.append({ id: '002', blueprint: 'debug',    task: 'task B', file: 'debug-002.md',    ts: 2 });
const all = history.list();
assert.strictEqual(all.length, 2);
assert.strictEqual(all[0].id, '002', 'newest first');
assert.strictEqual(all[1].id, '001');

// Test 3: list filters by blueprint
const research = history.list('research');
assert.strictEqual(research.length, 1);
assert.strictEqual(research[0].blueprint, 'research');

// Test 4: get returns record by id
const rec = history.get('001');
assert.strictEqual(rec.task, 'task A');

// Test 5: get returns null for unknown id
assert.strictEqual(history.get('999'), null);

// Cleanup
fs.rmSync(tmpDir, { recursive: true });
console.log('✓ runtime/history.js — all 5 tests pass');
```

- [ ] **Step 3: Run test — verify it fails**

```bash
node tests/test-history.js
```

Expected: `Error: Cannot find module '../runtime/history'`

- [ ] **Step 4: Create `runtime/history.js`**

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function indexPath() {
  return process.env.SWARM_INDEX_PATH ||
    path.join(process.cwd(), 'swarms', 'output', 'index.json');
}

function ensureIndex() {
  const p = indexPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]', 'utf8');
}

function append(record) {
  ensureIndex();
  const p = indexPath();
  const records = JSON.parse(fs.readFileSync(p, 'utf8'));
  records.unshift(record);
  fs.writeFileSync(p, JSON.stringify(records, null, 2), 'utf8');
}

function list(blueprint) {
  ensureIndex();
  const records = JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
  return blueprint ? records.filter(r => r.blueprint === blueprint) : records;
}

function get(id) {
  ensureIndex();
  const records = JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
  return records.find(r => r.id === id) || null;
}

module.exports = { append, list, get };
```

- [ ] **Step 5: Run test — verify it passes**

```bash
node tests/test-history.js
```

Expected: `✓ runtime/history.js — all 5 tests pass`

- [ ] **Step 6: Commit**

```bash
git add runtime/history.js tests/test-history.js tests/run-all.js
git commit -m "feat: add runtime/history.js with append/list/get and tests"
```

---

### Task 2: `swarms/team/` directory and empty output index

**Files:**
- Create: `swarms/team/.gitkeep`
- Create: `swarms/output/index.json`
- Modify: `.gitignore` (remove `swarms/output/` if present, add `swarms/output/*.md`)

- [ ] **Step 1: Create the team directory placeholder**

```bash
mkdir -p swarms/team
touch swarms/team/.gitkeep
```

- [ ] **Step 2: Create empty history index**

```bash
mkdir -p swarms/output
echo '[]' > swarms/output/index.json
```

- [ ] **Step 3: Check and update `.gitignore`**

Run `cat .gitignore` (or `ls .gitignore` if it doesn't exist). If `swarms/output` or `swarms/output/` is present, replace it so only the markdown output files are ignored but `index.json` is tracked:

If `.gitignore` exists, replace any `swarms/output` line with:
```
swarms/output/*.md
```

If `.gitignore` doesn't exist, create it:
```
.swarm/
swarms/output/*.md
```

- [ ] **Step 4: Commit**

```bash
git add swarms/team/.gitkeep swarms/output/index.json .gitignore
git commit -m "feat: add swarms/team/ directory and tracked output index"
```

---

### Task 3: `extends` resolution in compiler

**Files:**
- Modify: `runtime/compiler.js` (add `resolveExtends`)
- Create: `tests/test-compiler-extends.js`

- [ ] **Step 1: Write failing test**

Create `tests/test-compiler-extends.js`:

```javascript
#!/usr/bin/env node
const assert = require('assert');
const { resolveExtends, compile } = require('../runtime/compiler');

// Parent blueprint
const parent = {
  name: 'parent',
  flow: 'a, b → c',
  agents: {
    a: { role: 'Agent A from parent' },
    b: { role: 'Agent B from parent' },
    c: { role: 'Agent C from parent' },
  },
};

// Child overrides one agent, keeps parent flow
const child = {
  name: 'child',
  extends: 'parent',
  agents: {
    c: { role: 'Agent C overridden by child' },
  },
};

function loader(name) {
  if (name === 'parent') return parent;
  throw new Error(`Unknown blueprint: ${name}`);
}

// Test 1: resolveExtends merges agents, uses parent flow
const resolved = resolveExtends(child, loader);
assert.strictEqual(resolved.flow, 'a, b → c', 'inherits parent flow');
assert.strictEqual(resolved.agents.a.role, 'Agent A from parent', 'inherits agent A');
assert.strictEqual(resolved.agents.c.role, 'Agent C overridden by child', 'overrides agent C');
assert.strictEqual(resolved.extends, undefined, 'extends field removed after resolution');

// Test 2: child flow overrides parent flow
const childWithFlow = { ...child, flow: 'a → b → c' };
const resolved2 = resolveExtends(childWithFlow, loader);
assert.strictEqual(resolved2.flow, 'a → b → c', 'child flow wins');

// Test 3: no extends field — blueprint returned unchanged
const plain = { name: 'plain', flow: 'x', agents: { x: { role: 'X' } } };
assert.strictEqual(resolveExtends(plain, loader), plain, 'no extends = no change');

// Test 4: resolved blueprint compiles without error
const plan = compile(resolved);
assert.strictEqual(plan.name, 'child');
assert.strictEqual(plan.stages.length, 2);

console.log('✓ compiler extends — all 4 tests pass');
```

- [ ] **Step 2: Run test — verify it fails**

```bash
node tests/test-compiler-extends.js
```

Expected: `TypeError: resolveExtends is not a function`

- [ ] **Step 3: Add `resolveExtends` to `runtime/compiler.js`**

Add this function before the `compile` function (after `validateBlueprint`):

```javascript
function resolveExtends(blueprint, loadBlueprint) {
  if (!blueprint.extends) return blueprint;
  const parent = loadBlueprint(blueprint.extends);
  const resolved = {
    ...parent,
    ...blueprint,
    agents: { ...parent.agents, ...blueprint.agents },
    flow: blueprint.flow || parent.flow,
  };
  delete resolved.extends;
  return resolved;
}
```

- [ ] **Step 4: Export `resolveExtends` from `runtime/compiler.js`**

Replace the last line:
```javascript
module.exports = { parseFlow, compile, validateBlueprint };
```
With:
```javascript
module.exports = { parseFlow, compile, validateBlueprint, resolveExtends };
```

- [ ] **Step 5: Update the CLI block in `runtime/compiler.js` to resolve extends before compiling**

In the `if (require.main === module)` block, replace:
```javascript
  const raw = fs.readFileSync(path.resolve(blueprintPath), 'utf8');
  const blueprint = parseSimpleYaml(raw);

  try {
    const plan = compile(blueprint);
```
With:
```javascript
  const yaml = require('./simple-yaml.js');
  const raw = fs.readFileSync(path.resolve(blueprintPath), 'utf8');
  let blueprint = yaml.parse ? yaml.parse(raw) : parseSimpleYaml(raw);

  function loadBlueprint(name) {
    const p = path.resolve(path.dirname(blueprintPath), '..', `${name}.yaml`);
    const src = fs.readFileSync(p, 'utf8');
    return yaml.parse ? yaml.parse(src) : parseSimpleYaml(src);
  }

  blueprint = resolveExtends(blueprint, loadBlueprint);

  try {
    const plan = compile(blueprint);
```

- [ ] **Step 6: Run test — verify it passes**

```bash
node tests/test-compiler-extends.js
```

Expected: `✓ compiler extends — all 4 tests pass`

- [ ] **Step 7: Smoke test existing blueprints still compile**

```bash
node runtime/compiler.js swarms/research.yaml
node runtime/compiler.js swarms/code-review.yaml
node runtime/compiler.js swarms/debug.yaml
```

Expected: all three print an execution plan with no errors.

- [ ] **Step 8: Commit**

```bash
git add runtime/compiler.js tests/test-compiler-extends.js
git commit -m "feat: add extends resolution to compiler"
```

---

### Task 4: `/history` route in dashboard and History tab in UI

**Files:**
- Modify: `runtime/dashboard.js` (add `/history` route)
- Modify: `ui/index.html` (add History tab)

- [ ] **Step 1: Add `/history` route to `runtime/dashboard.js`**

In the `http.createServer` handler, add this block before the final `else`:

```javascript
    } else if (url.pathname === '/history') {
      const indexFile = path.join(process.cwd(), 'swarms', 'output', 'index.json');
      let data = '[]';
      try { data = fs.readFileSync(indexFile, 'utf8'); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
```

- [ ] **Step 2: Add History tab button to `ui/index.html` header**

In `ui/index.html`, find the `<header>` element and add tab buttons. Locate:
```html
  <header>
```
And add after `<header h1>` and before `<div id="status-badge">`:
```html
    <nav id="tabs" style="display:flex;gap:4px;">
      <button id="tab-live"    class="tab active" onclick="showTab('live')">Live</button>
      <button id="tab-history" class="tab"        onclick="showTab('history')">History</button>
    </nav>
```

Add to the `<style>` block:
```css
  .tab { background:#21262d; border:1px solid #30363d; color:#8b949e; padding:3px 10px; border-radius:4px; cursor:pointer; font-family:inherit; font-size:11px; }
  .tab.active { background:#1f6feb33; color:#58a6ff; border-color:#58a6ff44; }
  #history-panel { display:none; flex:1; overflow:auto; padding:12px 16px; }
  #history-panel.visible { display:block; }
  #history-table { width:100%; border-collapse:collapse; }
  #history-table th { color:#484f58; font-size:10px; text-transform:uppercase; letter-spacing:1px; padding:4px 8px; border-bottom:1px solid #21262d; text-align:left; }
  #history-table td { padding:5px 8px; border-bottom:1px solid #161b22; color:#8b949e; font-size:11px; }
  #history-table td:first-child { color:#e6edf3; }
  #history-output { margin-top:12px; background:#161b22; border:1px solid #21262d; border-radius:4px; padding:12px; white-space:pre-wrap; color:#8b949e; font-size:11px; display:none; }
```

- [ ] **Step 3: Add history panel HTML to `ui/index.html`**

Find the closing `</body>` tag and add the panel before it (after the existing `#bottom` div):

```html
<div id="history-panel">
  <h2 style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Run History</h2>
  <table id="history-table">
    <thead><tr><th>ID</th><th>Blueprint</th><th>Task</th><th>Date</th></tr></thead>
    <tbody id="history-body"></tbody>
  </table>
  <pre id="history-output"></pre>
</div>
```

- [ ] **Step 4: Add tab-switching JS to `ui/index.html`**

In the `<script>` block (or before `</body>`), add:

```javascript
function showTab(tab) {
  document.getElementById('tab-live').classList.toggle('active', tab === 'live');
  document.getElementById('tab-history').classList.toggle('active', tab === 'history');
  document.getElementById('bottom').style.display = tab === 'live' ? 'grid' : 'none';
  const hp = document.getElementById('history-panel');
  hp.classList.toggle('visible', tab === 'history');
  if (tab === 'history') loadHistory();
}

function loadHistory() {
  fetch('/history')
    .then(r => r.json())
    .then(records => {
      const tbody = document.getElementById('history-body');
      tbody.innerHTML = '';
      if (!records.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = 'No runs yet';
        td.style.cssText = 'color:#484f58;text-align:center;padding:20px';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      records.forEach(r => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => openRun(r.file, r.id));
        [
          r.id,
          r.blueprint,
          r.task.length > 60 ? r.task.slice(0, 60) + '…' : r.task,
          new Date(r.ts).toLocaleString(),
        ].forEach(text => {
          const td = document.createElement('td');
          td.textContent = text;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    });
}

function openRun(file, id) {
  fetch('/output/' + encodeURIComponent(file))
    .then(r => r.ok ? r.text() : Promise.reject())
    .then(text => {
      const el = document.getElementById('history-output');
      el.textContent = text;
      el.style.display = 'block';
    })
    .catch(() => {
      document.getElementById('history-output').textContent = 'Output file not found: ' + file;
      document.getElementById('history-output').style.display = 'block';
    });
}
```

- [ ] **Step 5: Add `/output/` route to `runtime/dashboard.js`**

Add before the final `else`:

```javascript
    } else if (url.pathname.startsWith('/output/')) {
      const filename = decodeURIComponent(url.pathname.slice('/output/'.length));
      const filePath = path.join(process.cwd(), 'swarms', 'output', path.basename(filename));
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
```

- [ ] **Step 6: Manual smoke test**

```bash
node runtime/dashboard.js 7700 &
open http://localhost:7700
```

Expected: Dashboard loads. Click "History" tab — shows "No runs yet" table. Click "Live" tab — returns to normal topology view.

```bash
kill %1
```

- [ ] **Step 7: Commit**

```bash
git add runtime/dashboard.js ui/index.html
git commit -m "feat: add /history route and History tab to dashboard"
```

---

### Task 5: Record run history in `skills/swarm.md`

**Files:**
- Modify: `skills/swarm.md` (step 7: save output → also append to index)

- [ ] **Step 1: Find step 7 in `skills/swarm.md`**

Open `skills/swarm.md`. Locate step **7. Save output** which currently reads:

```
Write the final agent's output to:
\```
swarms/output/<BLUEPRINT_NAME>-<timestamp>.md
\```
Create the output directory if needed: `mkdir -p swarms/output`
```

- [ ] **Step 2: Replace step 7 with history-recording version**

Replace that step's content with:

```markdown
### 7. Save output and record history

```bash
mkdir -p swarms/output
```

Write the final agent's output to `swarms/output/<BLUEPRINT_NAME>-<YYYYMMDD-HHmmss>.md`.

Then append to the run history index:

```bash
node -e "
const history = require('./runtime/history');
const id = '<BLUEPRINT_NAME>-<YYYYMMDD-HHmmss>';
history.append({
  id: id,
  blueprint: '<BLUEPRINT_NAME>',
  task: '<TASK>',
  file: id + '.md',
  ts: Date.now()
});
"
```

Replace `<BLUEPRINT_NAME>`, `<YYYYMMDD-HHmmss>`, and `<TASK>` with the actual values from this run.
```

- [ ] **Step 3: Verify swarm.md is still valid by dry-running**

```bash
node runtime/compiler.js swarms/research.yaml --dry-run
```

Expected: execution plan prints, no error. (The skill file change doesn't affect the compiler — this is just a sanity check that nothing in the repo broke.)

- [ ] **Step 4: Commit**

```bash
git add skills/swarm.md
git commit -m "feat: record run history in swarm.md step 7"
```

---

### Task 6: `/swarm scaffold` and `/swarm validate` skill

**Files:**
- Create: `skills/swarm-scaffold.md`

- [ ] **Step 1: Create `skills/swarm-scaffold.md`**

```markdown
---
name: swarm-scaffold
description: Scaffold a new swarm blueprint or validate an existing one.
---

# /swarm scaffold — Blueprint Authoring Tools

Two sub-commands:

```
/swarm scaffold <name>    — generate a new blueprint at swarms/<name>.yaml
/swarm validate <name>    — lint and validate an existing blueprint
```

## Instructions

### scaffold

When invoked as `/swarm scaffold <name>`:

1. Ask: "How many agents? (2–6)"
2. Ask: "What topology? (a) all parallel  (b) sequential pipeline  (c) parallel then one summariser"
3. Generate `swarms/<name>.yaml` based on the answers:

**2 agents, topology (a) — parallel:**
```yaml
name: <name>
description: "<name> swarm"
flow: "agent-1, agent-2"
output: markdown

agents:
  agent-1:
    role: Describe what agent-1 should do and return.

  agent-2:
    role: Describe what agent-2 should do and return.
```

**3 agents, topology (c) — parallel then summariser:**
```yaml
name: <name>
description: "<name> swarm"
flow: "agent-1, agent-2 → summariser"
output: markdown

agents:
  agent-1:
    role: Describe what agent-1 should do and return.

  agent-2:
    role: Describe what agent-2 should do and return.

  summariser:
    role: You receive inputs from agent-1 and agent-2. Combine them into a final report.
```

**N agents, topology (b) — sequential pipeline:**
Generate `flow: "agent-1 → agent-2 → ... → agent-N"` with each agent referencing the previous.

4. Write the file. Print:
```
✓ Created swarms/<name>.yaml
  Next: edit the agent roles, then run /swarm validate <name>
```

### validate

When invoked as `/swarm validate <name>`:

1. Run:
```bash
node runtime/compiler.js swarms/<name>.yaml
```

2. If it succeeds, print:
```
✓ Blueprint valid — N agents, N stages
```

3. If it fails, translate compiler errors into human-readable messages:

| Compiler error | Human message |
|---------------|---------------|
| `Flow references undefined agents: X` | `✗ Agent "X" appears in flow but is not defined under agents:` |
| `Missing required field: flow` | `✗ Blueprint is missing a flow: field` |
| `Missing required field: agents` | `✗ Blueprint is missing an agents: section` |
| Any other error | Print the raw error prefixed with `✗` |

Print all errors, then:
```
  Fix the above, then re-run /swarm validate <name>
```
```

- [ ] **Step 2: Install the skill**

```bash
cp skills/swarm-scaffold.md ~/.claude/skills/
```

- [ ] **Step 3: Smoke test scaffold**

In Claude Code:
```
/swarm scaffold test-demo
```

Expected: Claude asks about agent count and topology, then creates `swarms/test-demo.yaml`. Run:
```bash
cat swarms/test-demo.yaml
```
Verify it has valid structure.

- [ ] **Step 4: Smoke test validate**

```
/swarm validate test-demo
```

Expected: `✓ Blueprint valid — N agents, N stages`

```bash
rm swarms/test-demo.yaml
```

- [ ] **Step 5: Commit**

```bash
git add skills/swarm-scaffold.md
git commit -m "feat: add swarm-scaffold skill with scaffold and validate commands"
```

---

### Task 7: `/swarm history` skill

**Files:**
- Create: `skills/swarm-history.md`

- [ ] **Step 1: Create `skills/swarm-history.md`**

```markdown
---
name: swarm-history
description: Browse past swarm runs and open their outputs.
---

# /swarm history — Run History Browser

```
/swarm history                  — list all past runs, newest first
/swarm history <blueprint>      — filter by blueprint name
/swarm history open <id>        — print the output of a specific run
```

## Instructions

### list (no arguments or blueprint filter)

1. Run:
```bash
node -e "
const history = require('./runtime/history');
const filter = process.argv[2] || undefined;
const records = history.list(filter);
if (!records.length) {
  console.log('No runs yet. Use /swarm <blueprint> \"<task>\" to run a swarm.');
  process.exit(0);
}
const rows = records.map(r => {
  const d = new Date(r.ts).toISOString().slice(0,16).replace('T',' ');
  const task = r.task.length > 50 ? r.task.slice(0,50) + '...' : r.task;
  return \`  \${r.id.padEnd(24)} \${r.blueprint.padEnd(16)} \${task.padEnd(53)} \${d}\`;
});
console.log('  ' + 'ID'.padEnd(24) + ' ' + 'BLUEPRINT'.padEnd(16) + ' ' + 'TASK'.padEnd(53) + ' DATE');
console.log('  ' + '-'.repeat(100));
rows.forEach(r => console.log(r));
" -- <FILTER_ARG>
```

Replace `<FILTER_ARG>` with the blueprint name if provided, or omit the `-- <FILTER_ARG>` part for unfiltered.

### open

When invoked as `/swarm history open <id>`:

1. Run:
```bash
node -e "
const history = require('./runtime/history');
const record = history.get('<ID>');
if (!record) { console.log('Run not found: <ID>'); process.exit(1); }
const fs = require('fs');
const path = require('path');
const file = path.join('swarms', 'output', record.file);
if (!fs.existsSync(file)) { console.log('Output file not found: ' + file); process.exit(1); }
console.log(fs.readFileSync(file, 'utf8'));
"
```

Replace `<ID>` with the requested id.
```

- [ ] **Step 2: Install the skill**

```bash
cp skills/swarm-history.md ~/.claude/skills/
```

- [ ] **Step 3: Smoke test**

Run a real swarm first to generate a history entry:
```
/swarm research "test run for history smoke test" --dry-run
```

(Dry run won't generate output but gives a smoke test of the new skill install.)

Then:
```
/swarm history
```

Expected: either "No runs yet" (if no real runs have completed) or a table of past runs.

- [ ] **Step 4: Commit**

```bash
git add skills/swarm-history.md
git commit -m "feat: add swarm-history skill"
```

---

### Task 8: Run all tests

- [ ] **Step 1: Run the full test suite**

```bash
node tests/run-all.js
```

Expected output:
```
✓ runtime/history.js — all 5 tests pass
✓ compiler extends — all 4 tests pass

2 passed, 0 failed
```

- [ ] **Step 2: Commit if any outstanding changes**

```bash
git status
```

If clean, nothing to do. If there are uncommitted changes from debugging, stage and commit:

```bash
git add -p
git commit -m "fix: address test failures from phase 1"
```
