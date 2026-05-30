# Swarm Phase 3 — Power Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add task decomposition (a meta-agent that breaks a goal into a chained sequence of swarm runs) and action-capable agents (blueprints that declare `edit-files`, `run-tests`, or `open-pr` permissions with an explicit user confirmation gate).

**Architecture:** `runtime/decomposer.js` calls a meta-agent, parses its JSON plan, validates blueprint names, then executes steps in sequence via normal swarm runs. `skills/swarm-decompose.md` drives the user-facing flow. `compiler.js` gains `actions` validation. `skills/swarm.md` gains a permission gate that blocks execution when `actions` is declared until the user confirms. Phases 1 and 2 must be complete before starting Phase 3.

**Tech Stack:** Node.js built-ins only. No npm. No package.json.

---

### Task 1: Validate `actions` field in compiler

**Files:**
- Modify: `runtime/compiler.js` (validate `actions` array)
- Modify: `tests/test-compiler-extends.js` (add actions validation tests)

- [ ] **Step 1: Add actions validation tests to `tests/test-compiler-extends.js`**

Append before the final `console.log` line:

```javascript
// Test 7: blueprint with valid actions field compiles without error
const withActions = {
  name: 'action-test',
  flow: 'a',
  agents: { a: { role: 'Agent A' } },
  actions: ['edit-files', 'run-tests'],
};
const plan3 = compile(withActions);
assert.ok(plan3, 'blueprint with actions compiles');

// Test 8: blueprint with invalid action throws
let threwActions = false;
try {
  compile({ name: 'bad-action', flow: 'a', agents: { a: { role: 'x' } }, actions: ['delete-everything'] });
} catch (e) {
  threwActions = true;
  assert.ok(e.message.includes('delete-everything'), 'error names the invalid action');
}
assert.ok(threwActions, 'invalid action throws');
```

Update the final `console.log` to:
```javascript
console.log('✓ compiler extends + context + actions — all 8 tests pass');
```

- [ ] **Step 2: Run test — verify tests 7 and 8 fail**

```bash
node tests/test-compiler-extends.js
```

Expected: tests 7–8 fail because compiler doesn't validate `actions` yet.

- [ ] **Step 3: Add `actions` validation to `validateBlueprint` in `runtime/compiler.js`**

In `validateBlueprint`, add after the `context` validation block:

```javascript
  if (blueprint.actions !== undefined) {
    const VALID_ACTIONS = ['edit-files', 'run-tests', 'open-pr'];
    if (!Array.isArray(blueprint.actions)) {
      errors.push('actions must be an array');
    } else {
      const invalid = blueprint.actions.filter(a => !VALID_ACTIONS.includes(a));
      if (invalid.length) {
        errors.push(`Unknown actions: ${invalid.join(', ')} (valid: ${VALID_ACTIONS.join(', ')})`);
      }
    }
  }
```

- [ ] **Step 4: Run test — verify all 8 pass**

```bash
node tests/test-compiler-extends.js
```

Expected: `✓ compiler extends + context + actions — all 8 tests pass`

- [ ] **Step 5: Smoke test existing blueprints still compile**

```bash
node runtime/compiler.js swarms/research.yaml
node runtime/compiler.js swarms/debug.yaml
```

Expected: both print execution plans with no errors.

- [ ] **Step 6: Commit**

```bash
git add runtime/compiler.js tests/test-compiler-extends.js
git commit -m "feat: validate actions field in compiler"
```

---

### Task 2: Permission gate in `skills/swarm.md`

**Files:**
- Modify: `skills/swarm.md` (add permission gate before step 6)

- [ ] **Step 1: Add permission gate as step 5c in `skills/swarm.md`**

After step **5b (Gather context)** and before **Step 6 (Execute the swarm)**, add:

```markdown
### 5c. Actions permission gate

Check whether the blueprint declares an `actions` field with one or more values.

If `actions` is present and non-empty, **stop and show this prompt to the user before proceeding**:

```
⚠ This swarm has action permissions: <actions joined by ", ">
  Agents will <description based on actions present>:
    - edit-files  → modify files in your working tree
    - run-tests   → execute shell commands (tests, builds)
    - open-pr     → run `gh pr create` to open a pull request

  Type "yes" to proceed, or anything else to cancel.
```

Wait for the user's response.
- If the user types exactly `yes` (case-insensitive), continue to step 6.
- If the user types anything else, or does not respond, emit:
  ```bash
  node runtime/events.js swarm_done swarm cancelled "Cancelled by user at permission gate"
  ```
  Then stop and print:
  ```
  Swarm cancelled.
  ```

If `--dry-run` is active, skip this gate entirely (dry runs never execute agents).
```

- [ ] **Step 2: Commit**

```bash
git add skills/swarm.md
git commit -m "feat: add actions permission gate to swarm.md"
```

---

### Task 3: `runtime/decomposer.js` — plan parsing and step execution

**Files:**
- Create: `runtime/decomposer.js`
- Create: `tests/test-decomposer.js`

- [ ] **Step 1: Write failing test**

Create `tests/test-decomposer.js`:

```javascript
#!/usr/bin/env node
const assert = require('assert');
const { parsePlan, validatePlan } = require('../runtime/decomposer');

const AVAILABLE_BLUEPRINTS = ['research', 'code-review', 'debug', 'team/security-audit'];

// Test 1: parsePlan parses valid JSON array
const raw = JSON.stringify([
  { step: 1, blueprint: 'research',     task: 'research the problem', reason: 'gather info' },
  { step: 2, blueprint: 'code-review',  task: 'review changes',       reason: 'check quality' },
]);
const steps = parsePlan(raw);
assert.strictEqual(steps.length, 2);
assert.strictEqual(steps[0].blueprint, 'research');
assert.strictEqual(steps[1].step, 2);

// Test 2: parsePlan extracts JSON from a string with surrounding prose
const withProse = `Here is the plan:\n${JSON.stringify([{ step: 1, blueprint: 'debug', task: 'find bug', reason: 'x' }])}\nEnd.`;
const steps2 = parsePlan(withProse);
assert.strictEqual(steps2.length, 1);
assert.strictEqual(steps2[0].blueprint, 'debug');

// Test 3: parsePlan throws on unparseable input
let threw = false;
try { parsePlan('not json at all, no brackets'); } catch { threw = true; }
assert.ok(threw, 'unparseable input throws');

// Test 4: validatePlan passes for known blueprints
const errors = validatePlan(steps, AVAILABLE_BLUEPRINTS);
assert.deepStrictEqual(errors, [], 'no errors for valid plan');

// Test 5: validatePlan returns errors for unknown blueprints
const bad = [{ step: 1, blueprint: 'nonexistent', task: 'x', reason: 'y' }];
const errs = validatePlan(bad, AVAILABLE_BLUEPRINTS);
assert.ok(errs.length > 0, 'unknown blueprint produces error');
assert.ok(errs[0].includes('nonexistent'), 'error names the unknown blueprint');

// Test 6: validatePlan catches missing required fields
const incomplete = [{ step: 1, blueprint: 'research' }]; // missing task
const errs2 = validatePlan(incomplete, AVAILABLE_BLUEPRINTS);
assert.ok(errs2.some(e => e.includes('task')), 'missing task field caught');

console.log('✓ runtime/decomposer.js — all 6 tests pass');
```

- [ ] **Step 2: Run test — verify it fails**

```bash
node tests/test-decomposer.js
```

Expected: `Error: Cannot find module '../runtime/decomposer'`

- [ ] **Step 3: Create `runtime/decomposer.js`**

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * parsePlan(raw) — extract a JSON array of steps from a string.
 * The meta-agent may wrap the JSON in prose; we extract the first [...] block.
 */
function parsePlan(raw) {
  // Try direct parse first
  try {
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Extract first [...] block from surrounding prose
  const match = raw.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error('No JSON array found in meta-agent output');
  return JSON.parse(match[0]);
}

/**
 * validatePlan(steps, availableBlueprints) — check each step has required fields
 * and references a known blueprint. Returns array of error strings (empty = valid).
 */
function validatePlan(steps, availableBlueprints) {
  const errors = [];
  steps.forEach((step, i) => {
    const label = `Step ${step.step || i + 1}`;
    if (!step.blueprint) { errors.push(`${label}: missing required field "blueprint"`); }
    if (!step.task)      { errors.push(`${label}: missing required field "task"`); }
    if (!step.reason)    { errors.push(`${label}: missing required field "reason"`); }
    if (step.blueprint && !availableBlueprints.includes(step.blueprint)) {
      errors.push(`${label}: unknown blueprint "${step.blueprint}" (available: ${availableBlueprints.join(', ')})`);
    }
  });
  return errors;
}

/**
 * listBlueprints(dir) — return available blueprint names from swarms/ directory.
 */
function listBlueprints(swarmsDir) {
  const blueprints = [];
  const base = swarmsDir || path.join(process.cwd(), 'swarms');

  function scan(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory() && f !== 'output') {
        scan(full, prefix ? `${prefix}/${f}` : f);
      } else if (f.endsWith('.yaml')) {
        blueprints.push(prefix ? `${prefix}/${f.slice(0, -5)}` : f.slice(0, -5));
      }
    });
  }
  scan(base, '');
  return blueprints;
}

module.exports = { parsePlan, validatePlan, listBlueprints };
```

- [ ] **Step 4: Run test — verify all 6 pass**

```bash
node tests/test-decomposer.js
```

Expected: `✓ runtime/decomposer.js — all 6 tests pass`

- [ ] **Step 5: Commit**

```bash
git add runtime/decomposer.js tests/test-decomposer.js
git commit -m "feat: add runtime/decomposer.js with parsePlan, validatePlan, listBlueprints"
```

---

### Task 4: `/swarm decompose` skill

**Files:**
- Create: `skills/swarm-decompose.md`

- [ ] **Step 1: Create `skills/swarm-decompose.md`**

```markdown
---
name: swarm-decompose
description: Break a large goal into an ordered sequence of swarm runs using a meta-agent decomposer.
---

# /swarm decompose — Task Decomposition

```
/swarm decompose "<goal>"
/swarm decompose "<goal>" --dry-run
```

## Instructions

### 1. Parse arguments

Extract:
- `GOAL` — the quoted goal string
- `DRY_RUN` — true if `--dry-run` is present

### 2. List available blueprints

```bash
node -e "
const { listBlueprints } = require('./runtime/decomposer');
const list = listBlueprints();
console.log(list.join('\n'));
"
```

Save the output as `AVAILABLE_BLUEPRINTS` (newline-separated list).

### 3. Call the meta-agent

Spawn an agent with this prompt (fill in `GOAL` and `AVAILABLE_BLUEPRINTS`):

```
You are a task planner for a multi-agent system called Swarm.

Your job is to decompose the following goal into an ordered sequence of swarm runs.

Goal: <GOAL>

Available blueprints:
<AVAILABLE_BLUEPRINTS>

Rules:
- Use only blueprints from the available list above.
- Each step must have: step (number), blueprint (exact name), task (specific instruction for that run), reason (why this step is needed).
- Order steps so each one can use the output of the previous.
- Use 2–5 steps. Fewer is better — do not add steps unless they are clearly needed.
- Return ONLY a valid JSON array. No prose, no markdown fences. Example:
  [{"step":1,"blueprint":"research","task":"research X","reason":"need context before reviewing"},{"step":2,"blueprint":"code-review","task":"review based on research findings","reason":"apply research to find issues"}]
```

Save the agent's response as `META_AGENT_OUTPUT`.

### 4. Parse and validate the plan

```bash
node -e "
const { parsePlan, validatePlan, listBlueprints } = require('./runtime/decomposer');
const raw = $(cat .swarm/meta-plan-raw.txt);
const steps = parsePlan(raw);
const available = listBlueprints();
const errors = validatePlan(steps, available);
if (errors.length) {
  console.error('Plan validation failed:');
  errors.forEach(e => console.error('  • ' + e));
  process.exit(1);
}
console.log(JSON.stringify(steps, null, 2));
"
```

Before running, write `META_AGENT_OUTPUT` to `.swarm/meta-plan-raw.txt`:
```bash
mkdir -p .swarm
```
Then write the meta-agent output to `.swarm/meta-plan-raw.txt`.

If validation fails, show the errors and stop.

### 5. Show plan and confirm

Print the plan to the user:

```
Decomposition plan for: <GOAL>
─────────────────────────────────────────────────────
  Step 1: [blueprint: research]
          Task: research X
          Why:  need context before reviewing

  Step 2: [blueprint: code-review]
          Task: review based on research findings
          Why:  apply research to find issues
─────────────────────────────────────────────────────
  2 steps. Each step's output feeds into the next.
```

If `--dry-run`, stop here.

Otherwise ask:
```
Proceed with this plan? [y/N]
```

If the user does not confirm with `y` (case-insensitive), print `Decomposition cancelled.` and stop.

### 6. Execute steps in sequence

For each step in order:

1. Print:
   ```
   ── Step N/TOTAL: <blueprint> — <task> ──
   ```

2. Run the swarm for this step:
   - If step N > 1, create a context file with the prior step's output and use `--context` or inject it as additional task context.
   - Invoke the swarm skill internally: treat it as `/swarm <blueprint> "<task>\n\nContext from previous step:\n<prior_output>"`

3. Save this step's output as `STEP_N_OUTPUT`.

4. Print on completion:
   ```
   ✓ Step N complete
   ```

### 7. Save combined output

Write a combined output file to:
```
swarms/output/decompose-<YYYYMMDD-HHmmss>.md
```

Format:
```markdown
# Decomposition: <GOAL>

## Step 1 — <blueprint>: <task>
<step 1 output>

## Step 2 — <blueprint>: <task>
<step 2 output>
```

Record in history:
```bash
node -e "
const history = require('./runtime/history');
history.append({
  id: 'decompose-<YYYYMMDD-HHmmss>',
  blueprint: 'decompose',
  task: '<GOAL>',
  file: 'decompose-<YYYYMMDD-HHmmss>.md',
  ts: Date.now()
});
"
```

### 8. Report to user

```
✓ Decomposition complete: <N> steps
  Goal: <GOAL>
  Output: swarms/output/decompose-<YYYYMMDD-HHmmss>.md
  Dashboard: http://localhost:7700
```
```

- [ ] **Step 2: Install the skill**

```bash
cp skills/swarm-decompose.md ~/.claude/skills/
```

- [ ] **Step 3: Dry-run smoke test**

```
/swarm decompose "audit and summarise the runtime directory" --dry-run
```

Expected: meta-agent produces a 2–4 step plan, prints it, then stops (does not execute). No errors from `parsePlan` or `validatePlan`.

- [ ] **Step 4: Commit**

```bash
git add skills/swarm-decompose.md
git commit -m "feat: add swarm-decompose skill"
```

---

### Task 5: Dashboard decomposition view

**Files:**
- Modify: `ui/index.html` (add Decompose tab showing chained sub-swarm results)

- [ ] **Step 1: Add Decompose tab button to header nav in `ui/index.html`**

Find the nav added in Phase 1:
```html
    <nav id="tabs" style="display:flex;gap:4px;">
      <button id="tab-live"    class="tab active" onclick="showTab('live')">Live</button>
      <button id="tab-history" class="tab"        onclick="showTab('history')">History</button>
    </nav>
```

Replace with:
```html
    <nav id="tabs" style="display:flex;gap:4px;">
      <button id="tab-live"      class="tab active" onclick="showTab('live')">Live</button>
      <button id="tab-history"   class="tab"        onclick="showTab('history')">History</button>
      <button id="tab-decompose" class="tab"        onclick="showTab('decompose')">Decompose</button>
    </nav>
```

- [ ] **Step 2: Add decompose panel HTML to `ui/index.html`**

After the `<div id="history-panel">...</div>` block, add:

```html
<div id="decompose-panel" style="display:none;flex:1;overflow:auto;padding:12px 16px;">
  <h2 style="font-size:10px;color:#484f58;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Decomposition Runs</h2>
  <div id="decompose-list"></div>
</div>
```

- [ ] **Step 3: Update `showTab` function in `ui/index.html`**

Replace the existing `showTab` function:

```javascript
function showTab(tab) {
  ['live', 'history', 'decompose'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  document.getElementById('bottom').style.display = tab === 'live' ? 'grid' : 'none';
  document.getElementById('history-panel').style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('decompose-panel').style.display = tab === 'decompose' ? 'block' : 'none';
  if (tab === 'history') loadHistory();
  if (tab === 'decompose') loadDecompose();
}
```

- [ ] **Step 4: Add `loadDecompose` function to `ui/index.html`**

After the `loadHistory` function, add:

```javascript
function loadDecompose() {
  fetch('/history')
    .then(r => r.json())
    .then(records => {
      const runs = records.filter(r => r.blueprint === 'decompose');
      const container = document.getElementById('decompose-list');
      while (container.firstChild) container.removeChild(container.firstChild);

      if (!runs.length) {
        const msg = document.createElement('p');
        msg.textContent = 'No decomposition runs yet. Use /swarm decompose "<goal>" to start one.';
        msg.style.color = '#484f58';
        container.appendChild(msg);
        return;
      }

      runs.forEach(r => {
        const section = document.createElement('div');
        section.style.cssText = 'border:1px solid #21262d;border-radius:4px;margin-bottom:12px;overflow:hidden;';

        const header = document.createElement('div');
        header.style.cssText = 'background:#161b22;padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;';

        const title = document.createElement('span');
        title.style.color = '#e6edf3';
        title.textContent = r.task;

        const meta = document.createElement('span');
        meta.style.color = '#484f58';
        meta.style.fontSize = '10px';
        meta.textContent = new Date(r.ts).toLocaleString();

        header.appendChild(title);
        header.appendChild(meta);

        const body = document.createElement('pre');
        body.style.cssText = 'display:none;padding:12px;font-size:11px;color:#8b949e;white-space:pre-wrap;margin:0;';

        header.addEventListener('click', () => {
          if (body.style.display === 'none') {
            fetch('/output/' + encodeURIComponent(r.file))
              .then(res => res.ok ? res.text() : Promise.reject())
              .then(text => { body.textContent = text; body.style.display = 'block'; })
              .catch(() => { body.textContent = 'Output file not found.'; body.style.display = 'block'; });
          } else {
            body.style.display = 'none';
          }
        });

        section.appendChild(header);
        section.appendChild(body);
        container.appendChild(section);
      });
    });
}
```

- [ ] **Step 5: Manual smoke test**

```bash
node runtime/dashboard.js 7700 &
open http://localhost:7700
```

Click the **Decompose** tab. Expected: "No decomposition runs yet" message.
Click **History** tab. Expected: history table renders (or "No runs yet").
Click **Live** tab. Expected: topology graph renders.

```bash
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add ui/index.html
git commit -m "feat: add Decompose tab to dashboard"
```

---

### Task 6: Run all tests and final smoke test

- [ ] **Step 1: Run full test suite**

```bash
node tests/run-all.js
```

Expected:
```
✓ runtime/history.js — all 5 tests pass
✓ compiler extends + context + actions — all 8 tests pass
✓ runtime/context.js — all 6 tests pass
✓ runtime/decomposer.js — all 6 tests pass

4 passed, 0 failed
```

- [ ] **Step 2: Validate all included blueprints compile cleanly**

```bash
for f in swarms/*.yaml; do echo "--- $f ---"; node runtime/compiler.js "$f"; done
```

Expected: all three blueprints print execution plans with no errors.

- [ ] **Step 3: Final dry-run of all three new commands**

```
/swarm scaffold demo-blueprint
/swarm validate demo-blueprint
/swarm history
/swarm decompose "audit the runtime directory" --dry-run
```

Expected: each command runs without errors. `scaffold` creates `swarms/demo-blueprint.yaml`, `validate` passes it, `history` shows the table or "no runs", `decompose --dry-run` shows a 2–3 step plan and stops.

Clean up:
```bash
rm -f swarms/demo-blueprint.yaml
```

- [ ] **Step 4: Commit if any outstanding changes**

```bash
git status
```

If clean, all three phases are complete.
