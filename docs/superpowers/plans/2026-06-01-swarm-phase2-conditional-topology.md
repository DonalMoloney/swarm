# Swarm Phase 2 — Conditional Topology (Compiler Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Swarm runtime so blueprints can declare agent **groups** and **conditions**, and so the compiler turns a conditional `flow` (`group → if cond: a else: b`) into a branch-aware `execution_graph` — while every existing Phase-1 blueprint keeps compiling unchanged.

**Architecture:** Two runtime files change. `runtime/simple-yaml.js` gains the ability to parse two new nested section blocks (`groups`, `conditions`) and inline arrays, reusing the existing `agents`-block machinery. `runtime/compiler.js` gains group/condition validation, a `buildExecutionGraph()` function that emits the graph format defined in the design spec, and a mode switch in `compile()` that selects "Phase-2 graph output" vs. the existing "Phase-1 linear stages" output. The UI layer (preview + wizard visualization) is **out of scope** for this plan — see "Scope & Boundaries."

**Tech Stack:** Pure Node.js, zero dependencies (project constraint). Hand-rolled YAML parser. Tests are standalone `node` scripts using `assert`, auto-discovered by `tests/run-all.js`.

**Source spec:** `docs/superpowers/specs/2026-05-31-swarm-phase2-extend-capabilities-design.md`

---

## Scope & Boundaries

This plan covers the **testable runtime foundation** — the part everything else depends on:

**In scope (Phase 2.1 MVP — runtime):**
- `groups` and `conditions` blueprint sections (YAML parsing + validation)
- Conditional flow syntax `group → if condition: trueTarget else: falseTarget`
- `execution_graph` output (group nodes + condition nodes with `true_next`/`false_next`)
- `validation` and `agent_output` condition *definitions* (structural validation only)
- Backward compatibility: Phase-1 blueprints emit the existing top-level `stages`

**Out of scope (separate sibling plans):**
- Preview/wizard UI visualization of groups/conditions (consumes this plan's `execution_graph` — write *after* this format is locked)
- Runtime *evaluation* of conditions during a live swarm run (belongs in `skills/swarm.md` orchestration; needs agent JSON output contracts that don't exist yet)
- User-choice conditions, compound AND/OR/NOT, fallback retry (spec Phase 2.2 — explicitly deferred)

Rationale: the spec spans compiler + execution + two UI surfaces. Per the writing-plans scope check, each plan should produce working, testable software on its own. The compiler/graph is pure Node and fully unit-testable; the UI is not, and depends on the graph format this plan finalizes.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `runtime/simple-yaml.js` | Parse blueprint YAML into JS object | **Modify** — generalize section handling to `agents`/`groups`/`conditions`; add inline-array parsing |
| `runtime/compiler.js` | Validate blueprint + compile flow into execution plan | **Modify** — add group/condition validation, `buildExecutionGraph()`, Phase-2 mode switch in `compile()`, CLI rendering for graphs |
| `tests/test-yaml-sections.js` | YAML parser covers new sections + inline arrays | **Create** |
| `tests/test-compiler-groups.js` | Group validation | **Create** |
| `tests/test-compiler-conditions.js` | Condition + conditional-flow validation | **Create** |
| `tests/test-compiler-graph.js` | `execution_graph` shape + backward-compat | **Create** |
| `swarms/research-conditional.yaml` | Worked example blueprint exercising the whole feature | **Create** |

Data contract locked by this plan (consumed by the future UI plan):

```json
{
  "name": "...",
  "description": "...",
  "output": "markdown",
  "groups": { "<id>": { "agents": ["..."], "description": "..." } },
  "conditions": { "<id>": { "type": "agent_output|validation", "...": "..." } },
  "execution_graph": {
    "stages": [
      { "id": "s1", "type": "group", "group_id": "research", "agents": ["searcher","analyst"] },
      { "id": "c1", "type": "condition", "condition_id": "high_confidence", "true_next": "s2", "false_next": "s3" },
      { "id": "s2", "type": "group", "group_id": "synthesis", "agents": ["synthesizer"] },
      { "id": "s3", "type": "group", "group_id": "fallback", "agents": ["error_handler"] }
    ]
  },
  "agents": { "...": { "prompt": "..." } }
}
```

Phase-1 blueprints continue to emit `{ name, description, output, stages, agents }` with **no** `groups`/`conditions`/`execution_graph` keys.

---

## Task 1: Extend the YAML parser for `groups`, `conditions`, and inline arrays

**Files:**
- Modify: `runtime/simple-yaml.js` (full rewrite of the `parse` function, ~50 lines)
- Test: `tests/test-yaml-sections.js`

- [ ] **Step 1: Write the failing test**

Create `tests/test-yaml-sections.js`:

```js
#!/usr/bin/env node
const assert = require('assert');
const yaml = require('../runtime/simple-yaml');

const src = `
name: demo
flow: "research → if high_confidence: synthesis else: fallback"
groups:
  research:
    description: "Parallel research"
    agents: [searcher, analyst]
  synthesis:
    agents: [synthesizer]
conditions:
  high_confidence:
    type: agent_output
    source: searcher
    check: confidence
    threshold: "> 0.8"
agents:
  searcher:
    prompt: "Search the web"
    tools: [WebSearch, Read]
  analyst:
    prompt: "Analyze findings"
  synthesizer:
    prompt: "Synthesize"
`;

const bp = yaml.parse(src);

// top-level scalars still work
assert.strictEqual(bp.name, 'demo');
assert.strictEqual(bp.flow, 'research → if high_confidence: synthesis else: fallback');

// groups block: nested objects with inline-array agents + optional description
assert.deepStrictEqual(bp.groups.research.agents, ['searcher', 'analyst']);
assert.strictEqual(bp.groups.research.description, 'Parallel research');
assert.deepStrictEqual(bp.groups.synthesis.agents, ['synthesizer']);

// conditions block: nested objects; quoted threshold keeps its operator
assert.strictEqual(bp.conditions.high_confidence.type, 'agent_output');
assert.strictEqual(bp.conditions.high_confidence.source, 'searcher');
assert.strictEqual(bp.conditions.high_confidence.check, 'confidence');
assert.strictEqual(bp.conditions.high_confidence.threshold, '> 0.8');

// agents block unchanged: prompt scalar + tools inline array
assert.strictEqual(bp.agents.searcher.prompt, 'Search the web');
assert.deepStrictEqual(bp.agents.searcher.tools, ['WebSearch', 'Read']);
assert.strictEqual(bp.agents.analyst.prompt, 'Analyze findings');

console.log('✓ yaml sections (groups/conditions/inline-arrays) — all tests pass');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test-yaml-sections.js`
Expected: FAIL — `bp.groups` is `undefined` (current parser ignores the `groups` block), throwing on `bp.groups.research`.

- [ ] **Step 3: Rewrite `runtime/simple-yaml.js`**

Replace the entire file contents with:

```js
/**
 * Minimal YAML parser for the fixed swarm blueprint schema.
 * Avoids any npm dependency.
 *
 * Understands three nested "section" blocks — agents, groups, conditions —
 * each shaped as:
 *   <section>:
 *     <key>:
 *       <field>: <value>
 * plus inline arrays:  agents: [a, b, c]
 */

function parseInlineArray(v) {
  return v.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
}

function stripQuotes(v) {
  return v.replace(/^["']|["']$/g, '');
}

const SECTION_KEYS = ['agents', 'groups', 'conditions'];

function parse(text) {
  const result = {};
  const lines = text.split('\n');
  let section = null;     // one of SECTION_KEYS, or null
  let currentKey = null;  // current agent / group / condition name

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    const content = line.trim();

    if (indent === 0) {
      section = null;
      currentKey = null;
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) continue;
      const k = content.slice(0, colonIdx).trim();
      const v = content.slice(colonIdx + 1).trim();

      if (SECTION_KEYS.includes(k) && !v) {
        result[k] = {};
        section = k;
      } else if (v) {
        result[k] = v.startsWith('[') ? parseInlineArray(v) : stripQuotes(v);
      }
    } else if (section && indent === 2) {
      currentKey = content.replace(/:$/, '').trim();
      result[section][currentKey] = {};
    } else if (section && indent === 4 && currentKey) {
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) continue;
      const k = content.slice(0, colonIdx).trim();
      const v = content.slice(colonIdx + 1).trim();
      if (k === 'tools' || k === 'agents' || v.startsWith('[')) {
        result[section][currentKey][k] = parseInlineArray(v);
      } else {
        result[section][currentKey][k] = stripQuotes(v);
      }
    }
  }

  return result;
}

module.exports = { parse };
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node tests/test-yaml-sections.js`
Expected: PASS — `✓ yaml sections (groups/conditions/inline-arrays) — all tests pass`

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `node tests/run-all.js`
Expected: all suites pass, 0 failed. (The generalized parser preserves the `agents` block behavior exactly and only *adds* top-level inline-array support, so existing parser-dependent tests stay green.)

- [ ] **Step 6: Commit**

```bash
git add runtime/simple-yaml.js tests/test-yaml-sections.js
git commit -m "feat(yaml): parse groups/conditions sections and inline arrays"
```

---

## Task 2: Validate `groups`

**Files:**
- Modify: `runtime/compiler.js` (add a `groups` validation block inside `validateBlueprint`, after the existing `actions` block, before `return errors;`)
- Test: `tests/test-compiler-groups.js`

- [ ] **Step 1: Write the failing test**

Create `tests/test-compiler-groups.js`:

```js
#!/usr/bin/env node
const assert = require('assert');
const { validateBlueprint } = require('../runtime/compiler');

// Valid groups → no errors
const ok = {
  name: 'g',
  flow: 'research → synthesis',
  groups: {
    research: { agents: ['a'] },
    synthesis: { agents: ['b'] },
  },
  agents: { a: { prompt: 'x' }, b: { prompt: 'y' } },
};
assert.deepStrictEqual(validateBlueprint(ok), [], 'valid grouped blueprint has no errors');

// Group references an agent that is not defined → error naming the agent
const ghost = {
  name: 'g',
  flow: 'research',
  groups: { research: { agents: ['a', 'ghost'] } },
  agents: { a: { prompt: 'x' } },
};
const e1 = validateBlueprint(ghost);
assert.ok(e1.some(e => e.includes('ghost')), 'flags undefined agent referenced by a group');

// Group with empty/missing agents list → error
const empty = {
  name: 'g',
  flow: 'research',
  groups: { research: { agents: [] } },
  agents: { a: { prompt: 'x' } },
};
const e2 = validateBlueprint(empty);
assert.ok(e2.some(e => e.includes('research')), 'flags group with no agents');

console.log('✓ compiler group validation — all 3 tests pass');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test-compiler-groups.js`
Expected: FAIL — the `ok` case fails first: the *current* `validateBlueprint` runs its linear-flow agent check against `"research → synthesis"`, finds `research`/`synthesis` are not defined agents, and returns errors instead of `[]`.

- [ ] **Step 3: Guard the existing linear-flow check, then add group validation**

In `runtime/compiler.js`, find the existing block:

```js
  if (blueprint.flow && blueprint.agents) {
    const stages = parseFlow(blueprint.flow);
    const allAgentNames = stages.flatMap(s => s.agents);
    const defined = Object.keys(blueprint.agents);
    const unknown = allAgentNames.filter(a => !defined.includes(a));
    if (unknown.length) {
      errors.push(`Flow references undefined agents: ${unknown.join(', ')}`);
    }
  }
```

Change the condition so this Phase-1 check is skipped whenever Phase-2 features are in play (groups present or conditional flow):

```js
  const usesPhase2 = !!blueprint.groups || /\bif\s/.test(blueprint.flow || '');

  if (blueprint.flow && blueprint.agents && !usesPhase2) {
    const stages = parseFlow(blueprint.flow);
    const allAgentNames = stages.flatMap(s => s.agents);
    const defined = Object.keys(blueprint.agents);
    const unknown = allAgentNames.filter(a => !defined.includes(a));
    if (unknown.length) {
      errors.push(`Flow references undefined agents: ${unknown.join(', ')}`);
    }
  }
```

Then, immediately before `return errors;` at the end of `validateBlueprint`, add the group validation block:

```js
  if (blueprint.groups !== undefined) {
    if (typeof blueprint.groups !== 'object' || Array.isArray(blueprint.groups)) {
      errors.push('groups must be an object');
    } else {
      const definedAgents = blueprint.agents ? Object.keys(blueprint.agents) : [];
      for (const [gname, g] of Object.entries(blueprint.groups)) {
        if (!Array.isArray(g.agents) || g.agents.length === 0) {
          errors.push(`Group "${gname}" must list at least one agent`);
          continue;
        }
        const missing = g.agents.filter(a => !definedAgents.includes(a));
        if (missing.length) {
          errors.push(`Group "${gname}" references undefined agents: ${missing.join(', ')}`);
        }
      }
    }
  }
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node tests/test-compiler-groups.js`
Expected: PASS — `✓ compiler group validation — all 3 tests pass`

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `node tests/run-all.js`
Expected: all suites pass, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add runtime/compiler.js tests/test-compiler-groups.js
git commit -m "feat(compiler): validate groups and guard phase-1 flow check"
```

---

## Task 3: Validate `conditions` and conditional flow references

**Files:**
- Modify: `runtime/compiler.js` (add condition validation + conditional-flow reference validation inside `validateBlueprint`, before `return errors;`)
- Test: `tests/test-compiler-conditions.js`

- [ ] **Step 1: Write the failing test**

Create `tests/test-compiler-conditions.js`:

```js
#!/usr/bin/env node
const assert = require('assert');
const { validateBlueprint } = require('../runtime/compiler');

const base = {
  name: 'c',
  flow: 'research → if cond: synthesis else: fallback',
  groups: {
    research: { agents: ['a'] },
    synthesis: { agents: ['b'] },
    fallback: { agents: ['d'] },
  },
  agents: { a: { prompt: 'x' }, b: { prompt: 'y' }, d: { prompt: 'z' } },
};

// Invalid condition type
let bp = { ...base, conditions: { cond: { type: 'magic' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('magic')), 'flags invalid condition type');

// agent_output missing source
bp = { ...base, conditions: { cond: { type: 'agent_output', check: 'confidence', threshold: '> 0.8' } } };
assert.ok(validateBlueprint(bp).some(e => /source/.test(e)), 'flags agent_output missing source');

// agent_output source references undefined agent
bp = { ...base, conditions: { cond: { type: 'agent_output', source: 'nobody', check: 'c', threshold: '> 1' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('nobody')), 'flags undefined source agent');

// validation condition with bad criteria
bp = { ...base, conditions: { cond: { type: 'validation', criteria: 'sometimes' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('sometimes')), 'flags invalid validation criteria');

// flow references an undefined condition name
bp = { ...base, flow: 'research → if ghost: synthesis else: fallback',
       conditions: { cond: { type: 'validation', criteria: 'no-errors' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('ghost')), 'flags undefined condition in flow');

// flow branch target is neither group nor agent
bp = { ...base, flow: 'research → if cond: nowhere else: fallback',
       conditions: { cond: { type: 'validation', criteria: 'no-errors' } } };
assert.ok(validateBlueprint(bp).some(e => e.includes('nowhere')), 'flags undefined branch target');

// fully valid phase-2 blueprint → no errors
bp = { ...base, conditions: { cond: { type: 'validation', criteria: 'no-errors' } } };
assert.deepStrictEqual(validateBlueprint(bp), [], 'valid phase-2 blueprint passes');

console.log('✓ compiler condition validation — all 7 tests pass');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test-compiler-conditions.js`
Expected: FAIL — first assertion fails: invalid type `magic` is currently not checked, so no matching error is produced.

- [ ] **Step 3: Add condition + conditional-flow validation**

In `runtime/compiler.js`, immediately before `return errors;` (after the group block from Task 2), add:

```js
  const VALID_CONDITION_TYPES = ['validation', 'agent_output'];
  const VALID_CRITERIA = ['no-errors', 'no-warnings', 'all-pass'];

  if (blueprint.conditions !== undefined) {
    if (typeof blueprint.conditions !== 'object' || Array.isArray(blueprint.conditions)) {
      errors.push('conditions must be an object');
    } else {
      const definedAgents = blueprint.agents ? Object.keys(blueprint.agents) : [];
      for (const [cname, c] of Object.entries(blueprint.conditions)) {
        if (!VALID_CONDITION_TYPES.includes(c.type)) {
          errors.push(`Condition "${cname}" has invalid type "${c.type}" (valid: ${VALID_CONDITION_TYPES.join(', ')})`);
          continue;
        }
        if (c.type === 'validation' && !VALID_CRITERIA.includes(c.criteria)) {
          errors.push(`Condition "${cname}" has invalid criteria "${c.criteria}" (valid: ${VALID_CRITERIA.join(', ')})`);
        }
        if (c.type === 'agent_output') {
          if (!c.source) errors.push(`Condition "${cname}" (agent_output) is missing "source"`);
          else if (!definedAgents.includes(c.source)) errors.push(`Condition "${cname}" references undefined source agent "${c.source}"`);
          if (!c.check) errors.push(`Condition "${cname}" (agent_output) is missing "check"`);
          if (!c.threshold) errors.push(`Condition "${cname}" (agent_output) is missing "threshold"`);
        }
      }
    }
  }

  if (blueprint.flow && /\bif\s/.test(blueprint.flow)) {
    const definedConditions = blueprint.conditions ? Object.keys(blueprint.conditions) : [];
    const definedGroups = blueprint.groups ? Object.keys(blueprint.groups) : [];
    const definedAgents = blueprint.agents ? Object.keys(blueprint.agents) : [];
    const isKnownTarget = (name) => definedGroups.includes(name) || definedAgents.includes(name);
    const segments = blueprint.flow.split(/→|->/).map(s => s.trim()).filter(Boolean);

    for (const seg of segments) {
      if (/^if\s/.test(seg)) {
        const m = seg.match(/^if\s+(.+?):\s*(.+?)\s+else:\s*(.+)$/);
        if (!m) { errors.push(`Malformed conditional flow segment: "${seg}"`); continue; }
        const cond = m[1].trim();
        const trueTarget = m[2].trim();
        const falseTarget = m[3].trim();
        if (!definedConditions.includes(cond)) {
          errors.push(`Flow references undefined condition "${cond}"`);
        }
        for (const target of [trueTarget, falseTarget]) {
          if (!isKnownTarget(target)) {
            errors.push(`Flow branch target "${target}" is not a defined group or agent`);
          }
        }
      } else {
        for (const name of seg.split(',').map(s => s.trim()).filter(Boolean)) {
          if (!isKnownTarget(name)) {
            errors.push(`Flow references "${name}" which is not a defined group or agent`);
          }
        }
      }
    }
  }
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node tests/test-compiler-conditions.js`
Expected: PASS — `✓ compiler condition validation — all 7 tests pass`

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `node tests/run-all.js`
Expected: all suites pass, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add runtime/compiler.js tests/test-compiler-conditions.js
git commit -m "feat(compiler): validate conditions and conditional flow references"
```

---

## Task 4: Build the `execution_graph` and switch `compile()` to Phase-2 output

**Files:**
- Modify: `runtime/compiler.js` (add `buildExecutionGraph()`; branch inside `compile()`; export `buildExecutionGraph`)
- Test: `tests/test-compiler-graph.js`

- [ ] **Step 1: Write the failing test**

Create `tests/test-compiler-graph.js`:

```js
#!/usr/bin/env node
const assert = require('assert');
const { compile } = require('../runtime/compiler');

// --- Phase-2: conditional flow with groups produces an execution graph ---
const bp = {
  name: 'rs',
  flow: 'research → if high_confidence: synthesis else: fallback',
  groups: {
    research: { agents: ['searcher', 'analyst'] },
    synthesis: { agents: ['synthesizer'] },
    fallback: { agents: ['error_handler'] },
  },
  conditions: {
    high_confidence: { type: 'agent_output', source: 'searcher', check: 'confidence', threshold: '> 0.8' },
  },
  agents: {
    searcher: { prompt: 's' }, analyst: { prompt: 'a' },
    synthesizer: { prompt: 'syn' }, error_handler: { prompt: 'e' },
  },
};

const plan = compile(bp);
assert.ok(plan.execution_graph, 'phase-2 plan emits execution_graph');
const st = plan.execution_graph.stages;
assert.deepStrictEqual(st[0], { id: 's1', type: 'group', group_id: 'research', agents: ['searcher', 'analyst'] });
assert.deepStrictEqual(st[1], { id: 'c1', type: 'condition', condition_id: 'high_confidence', true_next: 's2', false_next: 's3' });
assert.deepStrictEqual(st[2], { id: 's2', type: 'group', group_id: 'synthesis', agents: ['synthesizer'] });
assert.deepStrictEqual(st[3], { id: 's3', type: 'group', group_id: 'fallback', agents: ['error_handler'] });
assert.strictEqual(st.length, 4, 'exactly four nodes');
assert.strictEqual(plan.stages, undefined, 'phase-2 plan has no top-level linear stages');
assert.deepStrictEqual(plan.groups, bp.groups, 'groups passed through');
assert.deepStrictEqual(plan.conditions, bp.conditions, 'conditions passed through');

// --- Backward compat: a Phase-1 linear blueprint is unchanged ---
const linear = {
  name: 'lin',
  flow: 'a, b → c',
  agents: { a: { prompt: 'x' }, b: { prompt: 'y' }, c: { prompt: 'z' } },
};
const lp = compile(linear);
assert.strictEqual(lp.execution_graph, undefined, 'phase-1 plan has no execution_graph');
assert.strictEqual(lp.groups, undefined, 'phase-1 plan has no groups key');
assert.strictEqual(lp.stages.length, 2, 'phase-1 linear stages preserved');
assert.deepStrictEqual(lp.stages[0], { type: 'parallel', agents: ['a', 'b'] });
assert.deepStrictEqual(lp.stages[1], { type: 'sequential', agents: ['c'] });

console.log('✓ compiler execution graph + backward compat — all tests pass');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test-compiler-graph.js`
Expected: FAIL — `plan.execution_graph` is `undefined` (current `compile()` always emits linear `stages`).

- [ ] **Step 3: Add `buildExecutionGraph()` and the Phase-2 branch in `compile()`**

In `runtime/compiler.js`, add this function above `compile()`:

```js
function buildExecutionGraph(blueprint) {
  const tokens = blueprint.flow.split(/→|->/).map(t => t.trim()).filter(Boolean);
  const stages = [];
  let sCount = 0;
  let cCount = 0;
  const stageIdFor = {};
  const pushed = new Set();

  function groupAgents(name) {
    if (blueprint.groups && blueprint.groups[name]) return blueprint.groups[name].agents;
    return [name]; // a bare agent name acts as its own single-agent stage
  }
  function allocId(name) {
    if (!stageIdFor[name]) stageIdFor[name] = `s${++sCount}`;
    return stageIdFor[name];
  }
  function pushStage(name) {
    const id = allocId(name);
    if (!pushed.has(id)) {
      pushed.add(id);
      stages.push({ id, type: 'group', group_id: name, agents: groupAgents(name) });
    }
    return id;
  }

  for (const token of tokens) {
    if (/^if\s/.test(token)) {
      const m = token.match(/^if\s+(.+?):\s*(.+?)\s+else:\s*(.+)$/);
      if (!m) throw new Error(`Malformed conditional flow segment: "${token}"`);
      const condName = m[1].trim();
      const trueName = m[2].trim();
      const falseName = m[3].trim();
      const cid = `c${++cCount}`;
      const trueId = allocId(trueName);
      const falseId = allocId(falseName);
      stages.push({ id: cid, type: 'condition', condition_id: condName, true_next: trueId, false_next: falseId });
      pushStage(trueName);
      pushStage(falseName);
    } else {
      pushStage(token);
    }
  }

  return { stages };
}
```

Then replace the body of `compile()`. The current body is:

```js
  const stages = parseFlow(blueprint.flow);

  return {
    name: blueprint.name,
    description: blueprint.description || '',
    output: blueprint.output || 'markdown',
    stages,
    agents: blueprint.agents,
  };
```

Replace it with:

```js
  const usesPhase2 = !!blueprint.groups || /\bif\s/.test(blueprint.flow || '');

  if (usesPhase2) {
    return {
      name: blueprint.name,
      description: blueprint.description || '',
      output: blueprint.output || 'markdown',
      groups: blueprint.groups || {},
      conditions: blueprint.conditions || {},
      execution_graph: buildExecutionGraph(blueprint),
      agents: blueprint.agents,
    };
  }

  const stages = parseFlow(blueprint.flow);

  return {
    name: blueprint.name,
    description: blueprint.description || '',
    output: blueprint.output || 'markdown',
    stages,
    agents: blueprint.agents,
  };
```

Finally, update the module exports at the bottom of the file from:

```js
module.exports = { parseFlow, compile, validateBlueprint, resolveExtends };
```

to:

```js
module.exports = { parseFlow, compile, validateBlueprint, resolveExtends, buildExecutionGraph };
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node tests/test-compiler-graph.js`
Expected: PASS — `✓ compiler execution graph + backward compat — all tests pass`

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `node tests/run-all.js`
Expected: all suites pass, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add runtime/compiler.js tests/test-compiler-graph.js
git commit -m "feat(compiler): emit execution_graph for conditional flows"
```

---

## Task 5: Worked example blueprint + CLI rendering for graphs

**Files:**
- Create: `swarms/research-conditional.yaml`
- Modify: `runtime/compiler.js` (the `require.main === module` CLI block — render `execution_graph` when present)
- Test: `tests/test-compiler-graph.js` (extend with an end-to-end parse→compile assertion)

- [ ] **Step 1: Write the failing test (end-to-end through the YAML parser)**

Append to `tests/test-compiler-graph.js`, just before the final `console.log(...)` line:

```js
// --- End-to-end: parse the shipped example YAML and compile it ---
const fs = require('fs');
const path = require('path');
const yaml = require('../runtime/simple-yaml');
const exampleSrc = fs.readFileSync(path.join(__dirname, '..', 'swarms', 'research-conditional.yaml'), 'utf8');
const example = yaml.parse(exampleSrc);
const ep = compile(example);
assert.ok(ep.execution_graph, 'example compiles to an execution graph');
assert.ok(ep.execution_graph.stages.some(n => n.type === 'condition'), 'example graph contains a condition node');
assert.ok(ep.execution_graph.stages[0].type === 'group', 'example graph starts with a group stage');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test-compiler-graph.js`
Expected: FAIL — `ENOENT` reading `swarms/research-conditional.yaml` (file does not exist yet).

- [ ] **Step 3: Create the example blueprint**

Create `swarms/research-conditional.yaml`:

```yaml
name: research-conditional
description: "Research, then branch to synthesis or fallback based on searcher confidence"
flow: "research → if high_confidence: synthesis else: fallback"

groups:
  research:
    description: "Parallel research agents"
    agents: [searcher, analyst]
  synthesis:
    description: "Aggregate findings"
    agents: [synthesizer]
  fallback:
    description: "Recover from low-confidence research"
    agents: [error_handler]

conditions:
  high_confidence:
    type: agent_output
    source: searcher
    check: confidence
    threshold: "> 0.8"

agents:
  searcher:
    prompt: "Search the web for sources. Return JSON including a numeric confidence field."
  analyst:
    prompt: "Analyze the gathered sources for relevance and quality."
  synthesizer:
    prompt: "Synthesize the high-confidence findings into a final report."
  error_handler:
    prompt: "Research confidence was low. Report what is missing and suggest next steps."
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/test-compiler-graph.js`
Expected: PASS — `✓ compiler execution graph + backward compat — all tests pass`

- [ ] **Step 5: Update the CLI renderer to handle graphs**

In `runtime/compiler.js`, find the CLI rendering block inside `if (require.main === module) { ... }`:

```js
  try {
    const plan = compile(blueprint);
    console.log('\nExecution Plan:');
    console.log('─'.repeat(40));
    plan.stages.forEach((stage, i) => {
      const label = stage.type === 'parallel'
        ? `[${stage.agents.join(' + ')}]  (parallel)`
        : `${stage.agents[0]}  (sequential)`;
      console.log(`  Stage ${i + 1}: ${label}`);
    });
    console.log('─'.repeat(40));
    console.log(`Output format: ${plan.output}\n`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
```

Replace it with a version that branches on `execution_graph`:

```js
  try {
    const plan = compile(blueprint);
    console.log('\nExecution Plan:');
    console.log('─'.repeat(40));
    if (plan.execution_graph) {
      plan.execution_graph.stages.forEach((node) => {
        if (node.type === 'condition') {
          console.log(`  ${node.id} ◇ if ${node.condition_id} → ${node.true_next} else ${node.false_next}`);
        } else {
          console.log(`  ${node.id} [${node.agents.join(' + ')}]  (group: ${node.group_id})`);
        }
      });
    } else {
      plan.stages.forEach((stage, i) => {
        const label = stage.type === 'parallel'
          ? `[${stage.agents.join(' + ')}]  (parallel)`
          : `${stage.agents[0]}  (sequential)`;
        console.log(`  Stage ${i + 1}: ${label}`);
      });
    }
    console.log('─'.repeat(40));
    console.log(`Output format: ${plan.output}\n`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
```

- [ ] **Step 6: Manually verify the CLI on the example**

Run: `node runtime/compiler.js swarms/research-conditional.yaml`
Expected output (exact):

```
Execution Plan:
────────────────────────────────────────
  s1 [searcher + analyst]  (group: research)
  c1 ◇ if high_confidence → s2 else s3
  s2 [synthesizer]  (group: synthesis)
  s3 [error_handler]  (group: fallback)
────────────────────────────────────────
Output format: markdown
```

Also confirm a Phase-1 blueprint still renders the old way:

Run: `node runtime/compiler.js swarms/research.yaml`
Expected: linear `Stage 1 / Stage 2 …` output, unchanged from before this plan.

- [ ] **Step 7: Run the full suite**

Run: `node tests/run-all.js`
Expected: all suites pass, 0 failed.

- [ ] **Step 8: Commit**

```bash
git add runtime/compiler.js swarms/research-conditional.yaml tests/test-compiler-graph.js
git commit -m "feat(compiler): render execution graphs in CLI + ship conditional example"
```

---

## Task 6: Documentation + spec checkbox reconciliation

**Files:**
- Modify: `CLAUDE.md` (Flow Syntax table + Blueprint Structure section)
- Modify: `docs/swarm-authoring.md` (document groups/conditions) — if the section structure differs, add a new "## Conditional Topology (Phase 2)" section
- Modify: `docs/superpowers/specs/2026-05-31-swarm-phase2-extend-capabilities-design.md` (tick the MVP runtime checkboxes that this plan delivers)

- [ ] **Step 1: Document the conditional flow syntax in `CLAUDE.md`**

In `CLAUDE.md`, under the `### Flow Syntax` table, add a row after the existing `"A → B, C → D"` row:

```
| `"G → if cond: X else: Y"` | Run group/agent G, then branch to X or Y based on condition `cond` (Phase 2) |
```

And under `### Blueprint Structure`, after the existing example, add:

````markdown
**Phase 2 — groups & conditions:**

```yaml
flow: "research → if high_confidence: synthesis else: fallback"
groups:
  research:
    agents: [searcher, analyst]
  synthesis:
    agents: [synthesizer]
  fallback:
    agents: [error_handler]
conditions:
  high_confidence:
    type: agent_output      # or: validation
    source: searcher
    check: confidence
    threshold: "> 0.8"
```

When `groups` are present or the flow contains `if`, `compile()` emits an
`execution_graph` (group + condition nodes) instead of linear `stages`.
Phase-1 blueprints are unaffected.
````

- [ ] **Step 2: Document in `docs/swarm-authoring.md`**

Read `docs/swarm-authoring.md` first to match its existing heading style, then append a section:

```markdown
## Conditional Topology (Phase 2)

Blueprints can group agents and branch on conditions.

- **`groups`** — named sets of agents that execute as a unit. Each group needs an `agents` list; `description` is optional.
- **`conditions`** — named decision gates. Two types are supported:
  - `type: validation` with `criteria: no-errors | no-warnings | all-pass`
  - `type: agent_output` with `source` (an agent name), `check` (a field in that agent's JSON output), and `threshold` (e.g. `"> 0.8"`, `"== success"`).
- **Conditional flow** — `"G → if cond: trueTarget else: falseTarget"`. Targets are group or agent names.

Note: condition *definitions* are validated and compiled into the execution
graph now. Live *evaluation* of conditions during a run is a later phase.
```

- [ ] **Step 3: Reconcile the spec checkboxes**

In `docs/superpowers/specs/2026-05-31-swarm-phase2-extend-capabilities-design.md`, under `### MVP (Phase 2.1) — Implement Now`, tick the boxes this plan delivers:

- `[x] Blueprints support groups, conditions sections`
- `[x] Flow syntax: "group → if condition: branch1 else: branch2"`
- `[x] Compiler builds execution graph with branches`
- `[x] Validation conditions: type: validation, criteria: ...` (definition + structural validation)
- `[x] Agent-output conditions: type: agent_output, source, check, threshold` (definition + structural validation)
- `[x] Events logged with branch decisions` → leave **unchecked**; that is runtime evaluation (out of scope)
- Leave Preview UI / Wizard boxes **unchecked** (separate UI plan)

Add a one-line note under the MVP heading:

```markdown
> Runtime/compiler foundation delivered by plan `2026-06-01-swarm-phase2-conditional-topology.md`. UI visualization and live condition evaluation tracked separately.
```

- [ ] **Step 4: Run the full suite (docs changes shouldn't break anything, but confirm)**

Run: `node tests/run-all.js`
Expected: all suites pass, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/swarm-authoring.md docs/superpowers/specs/2026-05-31-swarm-phase2-extend-capabilities-design.md
git commit -m "docs: document phase-2 conditional topology and reconcile spec"
```

---

## Final Verification

- [ ] Run `node tests/run-all.js` — confirm **all** suites pass (the 8 pre-existing plus the 4 new: yaml-sections, compiler-groups, compiler-conditions, compiler-graph).
- [ ] Run `node runtime/compiler.js swarms/research-conditional.yaml` — confirm the graph renders.
- [ ] Run `node runtime/compiler.js swarms/research.yaml` — confirm Phase-1 output is unchanged (regression sentinel).
- [ ] `git log --oneline` — confirm one focused commit per task.

---

## Spec Coverage Self-Review

| Spec requirement (MVP runtime) | Task |
|--------------------------------|------|
| Blueprints support `groups`, `conditions` sections | Task 1 (parse), Tasks 2–3 (validate) |
| Flow syntax `"group → if cond: a else: b"` | Task 3 (validate), Task 4 (compile) |
| Compiler builds execution graph with branches | Task 4 |
| Validation conditions (`type: validation`, criteria) | Task 3 |
| Agent-output conditions (`source`, `check`, `threshold`) | Task 3 |
| Backward compatible: Phase-1 blueprints work unchanged | Tasks 2 & 4 (guards + mode switch), regression-tested in Tasks 4–6 |
| Example blueprint exercising the feature | Task 5 |
| Docs updated | Task 6 |

**Deliberately not covered (out of scope, separate plans):** Preview/wizard UI visualization; live condition *evaluation* + branch-decision event logging; user-choice conditions; compound AND/OR/NOT; fallback retry; nested workflows (all spec Phase 2.2 or UI).
