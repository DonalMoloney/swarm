# Swarm Phase 2 — Intelligence Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-inject repo context (git diff, file tree, stack, recent commits) into agent prompts via a `context:` blueprint field and a `--context` flag on `/swarm`, with zero new dependencies.

**Architecture:** A new `runtime/context.js` module provides a `gather(providers[])` function that shells out to git/find commands and returns a formatted string block. `compiler.js` gains validation for the `context` field. `skills/swarm.md` calls `context.js` before spawning agents and prepends the block to every agent prompt. Phase 1 must be complete before starting Phase 2.

**Tech Stack:** Node.js built-ins only (`child_process.execSync`, `fs`, `path`, `assert`, `os`). No npm. No package.json.

---

### Task 1: `runtime/context.js` — providers and gather function

**Files:**
- Create: `runtime/context.js`
- Create: `tests/test-context.js`

- [ ] **Step 1: Write failing test**

Create `tests/test-context.js`:

```javascript
#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

// Point context.js at a known safe directory (this repo itself)
// All providers are tested against the current working directory.
const context = require('../runtime/context');

// Test 1: gather returns a non-empty string for valid providers
const result = context.gather(['stack-detect']);
assert.strictEqual(typeof result, 'string', 'gather returns a string');
assert.ok(result.length > 0, 'non-empty output');

// Test 2: gather wraps output in ## Context block
assert.ok(result.includes('## Context'), 'output has ## Context header');

// Test 3: unknown provider is skipped gracefully (no throw)
const safe = context.gather(['unknown-provider-xyz']);
assert.strictEqual(typeof safe, 'string', 'unknown provider does not throw');

// Test 4: gather with empty array returns empty string
const empty = context.gather([]);
assert.strictEqual(empty, '', 'empty providers = empty string');

// Test 5: stack-detect finds Node.js for this repo (has runtime/compiler.js)
// The repo has no package.json but has .js files — detect falls back to extension scan
assert.ok(result.toLowerCase().includes('node') || result.toLowerCase().includes('javascript'),
  'stack-detect identifies Node.js project: ' + result);

// Test 6: file-tree provider returns output containing known files
const treeResult = context.gather(['file-tree']);
assert.ok(treeResult.includes('runtime'), 'file-tree shows runtime/ directory');

console.log('✓ runtime/context.js — all 6 tests pass');
```

- [ ] **Step 2: Run test — verify it fails**

```bash
node tests/test-context.js
```

Expected: `Error: Cannot find module '../runtime/context'`

- [ ] **Step 3: Create `runtime/context.js`**

```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VALID_PROVIDERS = ['git-diff', 'file-tree', 'stack-detect', 'recent-commits'];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function gitDiff() {
  let diff = run('git diff HEAD');
  if (!diff) diff = run('git diff --cached');
  if (!diff) return 'No uncommitted changes.';
  // Summarise: show changed files + line counts, not full diff (keeps context short)
  const lines = diff.split('\n');
  const files = [];
  let current = null;
  let added = 0; let removed = 0;
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (current) files.push(`  ${current}  (+${added}, -${removed})`);
      current = line.split(' b/')[1] || line;
      added = 0; removed = 0;
    } else if (line.startsWith('+') && !line.startsWith('+++')) { added++; }
    else if (line.startsWith('-') && !line.startsWith('---')) { removed++; }
  }
  if (current) files.push(`  ${current}  (+${added}, -${removed})`);
  return files.length ? files.join('\n') : 'No file changes detected.';
}

function fileTree() {
  const raw = run(
    "find . -not -path './.git/*' -not -path './node_modules/*' " +
    "-not -path './swarms/output/*' -not -path './.swarm/*' " +
    "-maxdepth 4 -type f"
  );
  if (!raw) return 'Could not read file tree.';
  // Group by top-level directory
  const lines = raw.split('\n').filter(Boolean).sort();
  return lines.slice(0, 80).join('\n') + (lines.length > 80 ? `\n  … (${lines.length - 80} more)` : '');
}

function stackDetect() {
  const cwd = process.cwd();

  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      const fw = deps.find(d => ['express','fastify','next','nuxt','react','vue','angular'].includes(d));
      const ver = pkg.engines && pkg.engines.node ? ` ${pkg.engines.node}` : '';
      return `Node.js${ver}${fw ? ', ' + fw : ''}`;
    } catch { return 'Node.js'; }
  }
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    const line = fs.readFileSync(path.join(cwd, 'go.mod'), 'utf8').split('\n')[0];
    return `Go (${line.replace('module ', '')})`;
  }
  if (fs.existsSync(path.join(cwd, 'requirements.txt')) ||
      fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
    return 'Python';
  }
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) return 'Rust';
  if (fs.existsSync(path.join(cwd, 'pom.xml'))) return 'Java (Maven)';

  // Fallback: sample file extensions
  const sample = run("find . -maxdepth 3 -type f -name '*.js' -o -name '*.ts' -o -name '*.py' -o -name '*.go' -o -name '*.rs'");
  if (!sample) return 'Unknown';
  const exts = sample.split('\n').map(f => path.extname(f)).filter(Boolean);
  const counts = {};
  exts.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const map = { '.js': 'JavaScript/Node.js', '.ts': 'TypeScript', '.py': 'Python', '.go': 'Go', '.rs': 'Rust' };
  return top ? (map[top[0]] || top[0]) : 'Unknown';
}

function recentCommits() {
  const log = run('git log --oneline --format="%h %s (%an, %ar)" -10');
  return log || 'No git history found.';
}

const PROVIDERS = {
  'git-diff':       { label: 'Git diff',          fn: gitDiff },
  'file-tree':      { label: 'Project structure',  fn: fileTree },
  'stack-detect':   { label: 'Stack',              fn: stackDetect },
  'recent-commits': { label: 'Recent commits',     fn: recentCommits },
};

function gather(providers) {
  if (!providers || providers.length === 0) return '';

  const sections = [];
  for (const name of providers) {
    if (!PROVIDERS[name]) continue;
    const { label, fn } = PROVIDERS[name];
    const output = fn();
    if (output) sections.push(`**${label}:**\n${output}`);
  }

  if (!sections.length) return '';
  return `## Context\n\n${sections.join('\n\n')}`;
}

module.exports = { gather, VALID_PROVIDERS };
```

- [ ] **Step 4: Run test — verify it passes**

```bash
node tests/test-context.js
```

Expected: `✓ runtime/context.js — all 6 tests pass`

- [ ] **Step 5: Commit**

```bash
git add runtime/context.js tests/test-context.js
git commit -m "feat: add runtime/context.js with git-diff, file-tree, stack-detect, recent-commits providers"
```

---

### Task 2: Validate `context` field in compiler

**Files:**
- Modify: `runtime/compiler.js` (validate `context` array in `validateBlueprint`)
- Modify: `tests/test-compiler-extends.js` (add context validation tests)

- [ ] **Step 1: Add context validation tests to `tests/test-compiler-extends.js`**

Append to the end of `tests/test-compiler-extends.js`, before the final `console.log`:

```javascript
// Test 5: blueprint with valid context field compiles without error
const { VALID_PROVIDERS } = require('../runtime/context');
const withContext = {
  name: 'ctx-test',
  flow: 'a',
  agents: { a: { role: 'Agent A' } },
  context: ['git-diff', 'stack-detect'],
};
const plan2 = compile(withContext);
assert.ok(plan2, 'blueprint with context compiles');

// Test 6: blueprint with invalid context provider throws
let threw = false;
try {
  compile({ name: 'bad', flow: 'a', agents: { a: { role: 'x' } }, context: ['not-a-provider'] });
} catch (e) {
  threw = true;
  assert.ok(e.message.includes('not-a-provider'), 'error names the invalid provider');
}
assert.ok(threw, 'invalid context provider throws');
```

Update the final `console.log` to read:
```javascript
console.log('✓ compiler extends + context — all 6 tests pass');
```

- [ ] **Step 2: Run test — verify tests 5 and 6 fail**

```bash
node tests/test-compiler-extends.js
```

Expected: tests 5–6 fail because compiler doesn't validate `context` yet.

- [ ] **Step 3: Add context validation to `validateBlueprint` in `runtime/compiler.js`**

In `runtime/compiler.js`, update the `validateBlueprint` function. Add after the existing agent-in-flow check:

```javascript
  if (blueprint.context !== undefined) {
    const { VALID_PROVIDERS } = require('./context');
    if (!Array.isArray(blueprint.context)) {
      errors.push('context must be an array of provider names');
    } else {
      const invalid = blueprint.context.filter(p => !VALID_PROVIDERS.includes(p));
      if (invalid.length) {
        errors.push(`Unknown context providers: ${invalid.join(', ')} (valid: ${VALID_PROVIDERS.join(', ')})`);
      }
    }
  }
```

- [ ] **Step 4: Run test — verify all 6 pass**

```bash
node tests/test-compiler-extends.js
```

Expected: `✓ compiler extends + context — all 6 tests pass`

- [ ] **Step 5: Smoke test existing blueprints still compile**

```bash
node runtime/compiler.js swarms/research.yaml
node runtime/compiler.js swarms/code-review.yaml
```

Expected: both print execution plans with no errors.

- [ ] **Step 6: Commit**

```bash
git add runtime/compiler.js tests/test-compiler-extends.js
git commit -m "feat: validate context providers in compiler"
```

---

### Task 3: Inject context into agent prompts in `skills/swarm.md`

**Files:**
- Modify: `skills/swarm.md` (add context gathering before step 6 and `--context` flag to step 0)

- [ ] **Step 1: Update step 0 (Parse arguments) in `skills/swarm.md`**

Find the Parse arguments section and add `CONTEXT_PROVIDERS` to the extracted values:

```markdown
Extract from the invocation:
- `BLUEPRINT_NAME` — first argument (e.g. `research`, `code-review`, `debug`)
- `TASK` — the quoted task description
- `DRY_RUN` — true if `--dry-run` flag present
- `CONTEXT_PROVIDERS` — value of `--context` flag if present (comma-separated, e.g. `git-diff,stack-detect`), else empty string
```

- [ ] **Step 2: Add step 5b (Gather context) in `skills/swarm.md`**

After the existing **Step 5 (Emit swarm_start event)** and before **Step 6 (Execute the swarm)**, add a new step:

```markdown
### 5b. Gather context

Determine the context providers to use:
1. If the blueprint has a `context:` field, use those providers.
2. If `--context` was passed on the command line, use those providers (comma-separated).
3. If both are present, merge them (deduplicate).
4. If neither, skip this step (CONTEXT_BLOCK = empty string).

If providers were determined, run:

```bash
node -e "
const { gather } = require('./runtime/context');
const providers = '<PROVIDERS>'.split(',').map(p => p.trim()).filter(Boolean);
console.log(gather(providers));
" > .swarm/context.txt
```

Set `CONTEXT_BLOCK` = contents of `.swarm/context.txt`.

If `CONTEXT_BLOCK` is non-empty, print:
```
Context gathered: <PROVIDERS>
```
```

- [ ] **Step 3: Update step 6 (Execute the swarm) to prepend context**

Find the agent prompt construction in Step 6:

```
Each agent prompt = the agent's `role` from the blueprint + "\n\nTask: " + TASK + (if stage > 0: "\n\nPrevious stage output:\n" + prior_output)
```

Replace with:

```
Each agent prompt = the agent's `role` from the blueprint + "\n\nTask: " + TASK + (if CONTEXT_BLOCK is non-empty: "\n\n" + CONTEXT_BLOCK) + (if stage > 0: "\n\nPrevious stage output:\n" + prior_output)
```

- [ ] **Step 4: Dry-run test with --context flag**

```
/swarm research "test context injection" --dry-run --context stack-detect
```

Expected: prints execution plan, then stops. No agents run. Verify the dry-run output mentions the context flag was recognised.

- [ ] **Step 5: Commit**

```bash
git add skills/swarm.md
git commit -m "feat: inject context block into agent prompts via context field and --context flag"
```

---

### Task 4: Run all tests

- [ ] **Step 1: Run full test suite**

```bash
node tests/run-all.js
```

Expected:
```
✓ runtime/history.js — all 5 tests pass
✓ compiler extends + context — all 6 tests pass
✓ runtime/context.js — all 6 tests pass

3 passed, 0 failed
```

- [ ] **Step 2: Manual integration test**

```
/swarm code-review "review the runtime/ directory" --context git-diff,stack-detect --dry-run
```

Expected: dry-run prints plan and stops. No errors about context gathering.

- [ ] **Step 3: Commit if any outstanding changes**

```bash
git status
```

If clean, done. Otherwise:
```bash
git add -p
git commit -m "fix: address issues from phase 2 integration test"
```
