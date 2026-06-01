# Swarm Phase 2 — Preview Visualization & Wizard Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dry-run **preview** understand Phase-2 blueprints — fix the data layer that currently rejects/drops them, render the `execution_graph` as group containers + condition diamonds + labeled branch edges, and let the wizard builder author `groups`/`conditions`.

**Architecture:** The geometry of the topology is extracted into a **pure, node-testable** `ui/graph-layout.js` (`layoutExecutionGraph()`), leaving `ui/graph.js` a thin SVG drawer. `runtime/preview.js` is fixed to pass Phase-2 plans through (it currently has a stale validator that rejects them). `runtime/wizard.js` gains `groups`/`conditions` builder methods + YAML emission. `ui/preview.html` wires the renderer + legend. The live dashboard (`index.html`) Phase-2 rendering is **out of scope** (it needs runtime condition evaluation — a later phase).

**Tech Stack:** Pure Node.js / browser JS, zero dependencies. Node `assert` test scripts auto-discovered by `tests/run-all.js`. Browser-only modules (`graph.js`, `graph-layout.js`) use a `typeof module` dual-export so they load both in the browser (`window.X`) and in node tests.

**Source spec:** `docs/superpowers/specs/2026-05-31-swarm-phase2-extend-capabilities-design.md` (UI sections). **Builds on:** the merged compiler foundation (`execution_graph` format).

---

## Scope & Boundaries

**In scope:**
- `runtime/preview.js`: Phase-2 passthrough (validate via compiler, return `execution_graph`/`groups`/`conditions`)
- `ui/graph-layout.js` (new): pure layout of an execution graph into positioned boxes/diamonds/edges
- `ui/graph.js`: `renderExecutionGraph()` drawing groups (rects), conditions (diamonds), true/false edges
- `ui/preview.html`: render the Phase-2 graph + updated legend in the dry-run preview
- `runtime/wizard.js`: builder methods for `groups`/`conditions` + YAML emission
- Docs

**Out of scope (separate/later):**
- Live dashboard (`index.html`) Phase-2 rendering — depends on runtime condition evaluation (deferred)
- `ui/wizard.html` DOM editor for groups/conditions — additive UI follow-up (the *builder* is delivered here so the UI can be wired later)
- User-choice modal, compound conditions (spec Phase 2.2)

**Verification approach:** Pure logic (Tasks 1, 2, 3, 5) is TDD'd with node `assert`. The browser wiring (Task 4) is verified by launching the dashboard and confirming it serves the assets and renders without console errors (a screenshot smoke check), since the zero-dependency constraint rules out a DOM test lib.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `runtime/preview.js` | Dry-run plan generation | **Modify** — Phase-2 passthrough in `generateExecutionPlan` |
| `ui/graph-layout.js` | Pure layout of an execution graph | **Create** |
| `ui/graph.js` | SVG drawing | **Modify** — add `renderExecutionGraph`; dual-export |
| `ui/preview.html` | Dry-run preview page | **Modify** — render graph + legend for Phase-2 |
| `runtime/wizard.js` | Blueprint builder | **Modify** — `addGroup`/`addCondition` + YAML |
| `tests/test-preview-phase2.js` | preview passthrough | **Create** |
| `tests/test-graph-layout.js` | layout geometry | **Create** |
| `tests/test-graph-render.js` | SVG drawing via DOM stub | **Create** |
| `tests/test-wizard-phase2.js` | wizard groups/conditions | **Create** |

Layout contract (consumed by `graph.js` and tests):

```js
layoutExecutionGraph({ stages: [...] })
// →
{
  width, height,
  nodes: [ { id, type:'group'|'condition', shape:'rect'|'diamond',
             label, agents, col, row, cx, cy, w, h } ],
  edges: [ { from, to, kind:'seq'|'true'|'false', x1, y1, x2, y2 } ],
}
```

---

## Task 1: `preview.js` — Phase-2 passthrough

**Files:**
- Modify: `runtime/preview.js` (only `generateExecutionPlan`; keep the exported `validateBlueprint`/`extractAgentsFromFlow` intact — they are tested elsewhere)
- Test: `tests/test-preview-phase2.js`

- [ ] **Step 1: Write the failing test.** Create `tests/test-preview-phase2.js`:

```js
#!/usr/bin/env node
const assert = require('assert');
const { generateExecutionPlan } = require('../runtime/preview');

const phase2Yaml = `
name: rc
description: "demo"
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
    type: agent_output
    source: searcher
    check: confidence
    threshold: "> 0.8"
agents:
  searcher:
    prompt: "s"
  analyst:
    prompt: "a"
  synthesizer:
    prompt: "syn"
  error_handler:
    prompt: "e"
`;

const plan = generateExecutionPlan(phase2Yaml);
assert.ok(!plan.error, `phase-2 blueprint should not error, got: ${plan.error}`);
assert.ok(plan.execution_graph, 'plan exposes execution_graph');
assert.strictEqual(plan.execution_graph.stages[0].group_id, 'research');
assert.ok(plan.groups && plan.groups.research, 'plan exposes groups');
assert.ok(plan.conditions && plan.conditions.high_confidence, 'plan exposes conditions');
assert.strictEqual(plan.stages, undefined, 'phase-2 plan has no linear stages');

// Phase-1 still works (regression)
const p1 = generateExecutionPlan('name: x\nflow: "a → b"\nagents:\n  a:\n    prompt: "x"\n  b:\n    prompt: "y"\n');
assert.ok(!p1.error, 'phase-1 still compiles');
assert.ok(Array.isArray(p1.stages), 'phase-1 keeps linear stages');
assert.strictEqual(p1.execution_graph, undefined, 'phase-1 has no execution_graph');

console.log('✓ preview phase-2 passthrough — all tests pass');
```

- [ ] **Step 2: Run `node tests/test-preview-phase2.js`** — confirm FAIL (the stale local `validateBlueprint` rejects the `if`-flow as an undefined agent, so `plan.error` is set).

- [ ] **Step 3: Implement.** In `runtime/preview.js`, replace the body of `generateExecutionPlan` with:

```js
function generateExecutionPlan(blueprintYaml) {
  try {
    const blueprint = yaml.parse(blueprintYaml);
    const isPhase2 = !!blueprint.groups || /\bif\s/.test(blueprint.flow || '');

    // Phase-1 keeps the existing local validation (and its error messages).
    // Phase-2 validation is performed by compile() below (it throws on errors).
    if (!isPhase2) {
      const errors = validateBlueprint(blueprint);
      if (errors.length > 0) {
        return { error: errors.join('\n') };
      }
    }

    const compiled = compile(blueprint);

    if (compiled.execution_graph) {
      return {
        name: compiled.name,
        description: compiled.description || '',
        output: compiled.output || 'markdown',
        groups: compiled.groups,
        conditions: compiled.conditions,
        execution_graph: compiled.execution_graph,
        agents: compiled.agents,
        contexts: blueprint.context || [],
        actions: blueprint.actions || [],
      };
    }

    return {
      name: compiled.name,
      description: compiled.description || '',
      output: compiled.output || 'markdown',
      stages: compiled.stages,
      agents: compiled.agents,
      contexts: blueprint.context || [],
      actions: blueprint.actions || [],
    };
  } catch (err) {
    return { error: err.message };
  }
}
```

Do NOT remove `validateBlueprint` or `extractAgentsFromFlow` — they remain exported and used for the Phase-1 path.

- [ ] **Step 4: Run `node tests/test-preview-phase2.js`** — confirm PASS.
- [ ] **Step 5: Run `node tests/run-all.js`** — confirm 0 failed (existing `test-preview.js` still green).
- [ ] **Step 6: Commit:**
```bash
git add runtime/preview.js tests/test-preview-phase2.js
git commit -m "feat(preview): pass phase-2 execution graphs through the dry-run plan"
```

---

## Task 2: `ui/graph-layout.js` — pure layout

**Files:**
- Create: `ui/graph-layout.js`
- Test: `tests/test-graph-layout.js`

- [ ] **Step 1: Write the failing test.** Create `tests/test-graph-layout.js`:

```js
#!/usr/bin/env node
const assert = require('assert');
const { layoutExecutionGraph } = require('../ui/graph-layout');

const graph = {
  stages: [
    { id: 's1', type: 'group', group_id: 'research', agents: ['searcher', 'analyst'] },
    { id: 'c1', type: 'condition', condition_id: 'high_confidence', true_next: 's2', false_next: 's3' },
    { id: 's2', type: 'group', group_id: 'synthesis', agents: ['synthesizer'] },
    { id: 's3', type: 'group', group_id: 'fallback', agents: ['error_handler'] },
  ],
};

const L = layoutExecutionGraph(graph);
const byId = Object.fromEntries(L.nodes.map(n => [n.id, n]));

// shapes
assert.strictEqual(byId.s1.shape, 'rect');
assert.strictEqual(byId.c1.shape, 'diamond');
assert.strictEqual(byId.s2.shape, 'rect');

// labels & agents
assert.strictEqual(byId.s1.label, 'research');
assert.deepStrictEqual(byId.s1.agents, ['searcher', 'analyst']);
assert.strictEqual(byId.c1.label, 'high_confidence');

// columns: entry=0, condition=1, branches=2
assert.strictEqual(byId.s1.col, 0);
assert.strictEqual(byId.c1.col, 1);
assert.strictEqual(byId.s2.col, 2);
assert.strictEqual(byId.s3.col, 2);

// branch siblings get distinct rows
assert.notStrictEqual(byId.s2.row, byId.s3.row);

// edges: s1→c1 (seq), c1→s2 (true), c1→s3 (false)
const ek = L.edges.map(e => `${e.from}->${e.to}:${e.kind}`).sort();
assert.deepStrictEqual(ek, ['c1->s2:true', 'c1->s3:false', 's1->c1:seq'].sort());

// edge endpoints are numbers within canvas
for (const e of L.edges) {
  for (const v of [e.x1, e.y1, e.x2, e.y2]) assert.ok(typeof v === 'number' && v >= 0);
}
assert.ok(L.width > 0 && L.height > 0);

// multi-condition graph: columns advance, ids unique
const multi = layoutExecutionGraph({ stages: [
  { id: 's1', type: 'group', group_id: 'g1', agents: ['a'] },
  { id: 'c1', type: 'condition', condition_id: 'c1', true_next: 's2', false_next: 's3' },
  { id: 's2', type: 'group', group_id: 'g2', agents: ['b'] },
  { id: 's3', type: 'group', group_id: 'g3', agents: ['d'] },
  { id: 'c2', type: 'condition', condition_id: 'c2', true_next: 's4', false_next: 's5' },
  { id: 's4', type: 'group', group_id: 'g4', agents: ['e'] },
  { id: 's5', type: 'group', group_id: 'g5', agents: ['f'] },
]});
assert.strictEqual(multi.nodes.length, 7);
assert.ok(multi.nodes.every(n => typeof n.cx === 'number'));

console.log('✓ graph layout — all tests pass');
```

- [ ] **Step 2: Run `node tests/test-graph-layout.js`** — confirm FAIL (module missing).

- [ ] **Step 3: Implement.** Create `ui/graph-layout.js`:

```js
/**
 * Pure layout for a Phase-2 execution graph.
 * No DOM, no dependencies — usable in the browser and in node tests.
 *
 * Input:  { stages: [ {id,type:'group',group_id,agents} | {id,type:'condition',condition_id,true_next,false_next} ] }
 * Output: { width, height, nodes:[...positioned...], edges:[...with endpoints...] }
 */

const COL_W = 170;   // horizontal spacing between columns
const ROW_H = 90;    // vertical spacing between rows
const MARGIN = 24;   // canvas padding
const RECT_W = 130;  // group box width
const RECT_H = 54;   // group box height
const DIAMOND = 64;  // condition diamond bounding size

function buildEdges(stages) {
  const edges = [];
  const byId = Object.fromEntries(stages.map(s => [s.id, s]));
  const branchTargets = new Set();
  for (const n of stages) {
    if (n.type === 'condition') {
      branchTargets.add(n.true_next);
      branchTargets.add(n.false_next);
    }
  }
  // condition → branch targets
  for (const n of stages) {
    if (n.type === 'condition') {
      if (byId[n.true_next]) edges.push({ from: n.id, to: n.true_next, kind: 'true' });
      if (byId[n.false_next]) edges.push({ from: n.id, to: n.false_next, kind: 'false' });
    }
  }
  // sequential: a group that is immediately followed by a condition flows into it
  for (let i = 0; i < stages.length - 1; i++) {
    const cur = stages[i];
    const next = stages[i + 1];
    if (cur.type === 'group' && next.type === 'condition') {
      edges.push({ from: cur.id, to: next.id, kind: 'seq' });
    }
  }
  return edges;
}

function assignColumns(stages, edges) {
  const col = {};
  for (const n of stages) col[n.id] = 0;
  // relax (DAG longest-path); iterate stages.length times for safety
  for (let it = 0; it < stages.length; it++) {
    for (const e of edges) {
      if (col[e.to] < col[e.from] + 1) col[e.to] = col[e.from] + 1;
    }
  }
  return col;
}

function layoutExecutionGraph(graph) {
  const stages = (graph && graph.stages) || [];
  const edges = buildEdges(stages);
  const col = assignColumns(stages, edges);

  // rows: stack nodes within each column in stage order
  const rowCounter = {};
  const node = {};
  let maxRow = 0;
  let maxCol = 0;

  for (const s of stages) {
    const c = col[s.id];
    const r = rowCounter[c] || 0;
    rowCounter[c] = r + 1;
    maxCol = Math.max(maxCol, c);
    maxRow = Math.max(maxRow, r);

    const isCond = s.type === 'condition';
    const w = isCond ? DIAMOND : RECT_W;
    const h = isCond ? DIAMOND : RECT_H;
    const cx = MARGIN + c * COL_W + RECT_W / 2;
    const cy = MARGIN + r * ROW_H + RECT_H / 2;

    node[s.id] = {
      id: s.id,
      type: s.type,
      shape: isCond ? 'diamond' : 'rect',
      label: isCond ? s.condition_id : s.group_id,
      agents: isCond ? [] : (s.agents || []),
      col: c,
      row: r,
      cx,
      cy,
      w,
      h,
    };
  }

  const positionedEdges = edges.map(e => ({
    from: e.from,
    to: e.to,
    kind: e.kind,
    x1: node[e.from].cx,
    y1: node[e.from].cy,
    x2: node[e.to].cx,
    y2: node[e.to].cy,
  }));

  return {
    width: MARGIN * 2 + (maxCol + 1) * COL_W,
    height: MARGIN * 2 + (maxRow + 1) * ROW_H,
    nodes: Object.values(node),
    edges: positionedEdges,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutExecutionGraph };
}
if (typeof window !== 'undefined') {
  window.layoutExecutionGraph = layoutExecutionGraph;
}
```

- [ ] **Step 4: Run `node tests/test-graph-layout.js`** — confirm PASS.
- [ ] **Step 5: Run `node tests/run-all.js`** — 0 failed.
- [ ] **Step 6: Commit:**
```bash
git add ui/graph-layout.js tests/test-graph-layout.js
git commit -m "feat(ui): add pure execution-graph layout module"
```

---

## Task 3: `ui/graph.js` — render the execution graph

**Files:**
- Modify: `ui/graph.js` (add `renderExecutionGraph`; add a `typeof module` dual-export at the end; keep the existing `renderGraph` untouched)
- Test: `tests/test-graph-render.js` (uses a tiny in-test DOM stub — zero dependencies)

- [ ] **Step 1: Write the failing test.** Create `tests/test-graph-render.js`:

```js
#!/usr/bin/env node
const assert = require('assert');

// Minimal SVG DOM stub — records created elements and their attributes.
function makeStubDoc() {
  const created = [];
  function el(tag) {
    const node = {
      tag, attrs: {}, children: [], style: {}, textContent: '',
      setAttribute(k, v) { this.attrs[k] = String(v); },
      appendChild(c) { this.children.push(c); return c; },
    };
    created.push(node);
    return node;
  }
  return {
    created,
    document: { createElementNS: (_ns, tag) => el(tag) },
  };
}

const stub = makeStubDoc();
global.document = stub.document;
const { renderExecutionGraph } = require('../ui/graph.js');

const svg = {
  clientWidth: 600, clientHeight: 200, firstChild: null,
  _kids: [],
  setAttribute() {},
  appendChild(c) { this._kids.push(c); return c; },
  removeChild() {},
};

const graph = {
  stages: [
    { id: 's1', type: 'group', group_id: 'research', agents: ['searcher', 'analyst'] },
    { id: 'c1', type: 'condition', condition_id: 'high_confidence', true_next: 's2', false_next: 's3' },
    { id: 's2', type: 'group', group_id: 'synthesis', agents: ['synthesizer'] },
    { id: 's3', type: 'group', group_id: 'fallback', agents: ['error_handler'] },
  ],
};

renderExecutionGraph(graph, svg);

const tags = stub.created.map(n => n.tag);
assert.ok(tags.includes('rect'), 'draws a rect for group nodes');
assert.ok(tags.includes('polygon'), 'draws a polygon (diamond) for condition nodes');
assert.ok(tags.includes('line') || tags.includes('path'), 'draws edges');
assert.ok(stub.created.some(n => n.tag === 'text' && n.textContent.includes('research')), 'labels the research group');
assert.ok(stub.created.some(n => n.tag === 'text' && n.textContent.includes('high_confidence')), 'labels the condition');
assert.ok(svg._kids.length > 0, 'appended content to the svg');

console.log('✓ graph render (execution graph) — all tests pass');
```

- [ ] **Step 2: Run `node tests/test-graph-render.js`** — confirm FAIL (`renderExecutionGraph` is undefined / not exported).

- [ ] **Step 3: Implement.** In `ui/graph.js`, ADD this function after `renderGraph` (do not modify `renderGraph`):

```js
/**
 * Render a Phase-2 execution graph (groups as rounded rects, conditions as
 * diamonds, true/false branch edges) into an SVG element.
 * Uses the pure layout from graph-layout.js.
 */
function renderExecutionGraph(executionGraph, svgEl) {
  const layout = (typeof layoutExecutionGraph !== 'undefined'
    ? layoutExecutionGraph
    : require('./graph-layout').layoutExecutionGraph)(executionGraph);

  const NS = 'http://www.w3.org/2000/svg';
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
  svgEl.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);

  const defs = document.createElementNS(NS, 'defs');
  function marker(id, color) {
    const m = document.createElementNS(NS, 'marker');
    m.setAttribute('id', id); m.setAttribute('markerWidth', '8'); m.setAttribute('markerHeight', '8');
    m.setAttribute('refX', '7'); m.setAttribute('refY', '3'); m.setAttribute('orient', 'auto');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M0,0 L0,6 L8,3 z'); p.setAttribute('fill', color);
    m.appendChild(p); return m;
  }
  defs.appendChild(marker('g-true', '#3fb950'));
  defs.appendChild(marker('g-false', '#f85149'));
  defs.appendChild(marker('g-seq', '#58a6ff'));
  svgEl.appendChild(defs);

  const edgeColor = { true: '#3fb950', false: '#f85149', seq: '#58a6ff' };

  // edges first (under nodes)
  layout.edges.forEach(e => {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', e.x1); line.setAttribute('y1', e.y1);
    line.setAttribute('x2', e.x2); line.setAttribute('y2', e.y2);
    line.setAttribute('stroke', edgeColor[e.kind] || '#484f58');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('marker-end', `url(#g-${e.kind})`);
    svgEl.appendChild(line);
    if (e.kind === 'true' || e.kind === 'false') {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (e.x1 + e.x2) / 2); t.setAttribute('y', (e.y1 + e.y2) / 2 - 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9');
      t.setAttribute('fill', edgeColor[e.kind]); t.setAttribute('font-family', 'monospace');
      t.textContent = e.kind;
      svgEl.appendChild(t);
    }
  });

  // nodes
  layout.nodes.forEach(n => {
    const g = document.createElementNS(NS, 'g');
    if (n.shape === 'diamond') {
      const r = n.w / 2;
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', `${n.cx},${n.cy - r} ${n.cx + r},${n.cy} ${n.cx},${n.cy + r} ${n.cx - r},${n.cy}`);
      poly.setAttribute('fill', '#1f6feb22'); poly.setAttribute('stroke', '#d29922'); poly.setAttribute('stroke-width', '1.5');
      g.appendChild(poly);
    } else {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', n.cx - n.w / 2); rect.setAttribute('y', n.cy - n.h / 2);
      rect.setAttribute('width', n.w); rect.setAttribute('height', n.h);
      rect.setAttribute('rx', '8'); rect.setAttribute('fill', '#161b22'); rect.setAttribute('stroke', '#30363d'); rect.setAttribute('stroke-width', '1.5');
      g.appendChild(rect);
    }
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', n.cx); label.setAttribute('y', n.shape === 'diamond' ? n.cy + 3 : n.cy - 4);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', '11');
    label.setAttribute('fill', '#e6edf3'); label.setAttribute('font-family', 'monospace');
    label.textContent = n.label;
    g.appendChild(label);
    if (n.shape === 'rect' && n.agents.length) {
      const sub = document.createElementNS(NS, 'text');
      sub.setAttribute('x', n.cx); sub.setAttribute('y', n.cy + 12);
      sub.setAttribute('text-anchor', 'middle'); sub.setAttribute('font-size', '8');
      sub.setAttribute('fill', '#8b949e'); sub.setAttribute('font-family', 'monospace');
      sub.textContent = n.agents.join(', ');
      g.appendChild(sub);
    }
    svgEl.appendChild(g);
  });
}
```

Then, at the very end of `ui/graph.js`, REPLACE the line `window.renderGraph = renderGraph;` with:

```js
if (typeof window !== 'undefined') {
  window.renderGraph = renderGraph;
  window.renderExecutionGraph = renderExecutionGraph;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderGraph, renderExecutionGraph };
}
```

- [ ] **Step 4: Run `node tests/test-graph-render.js`** — confirm PASS.
- [ ] **Step 5: Run `node tests/run-all.js`** — 0 failed.
- [ ] **Step 6: Commit:**
```bash
git add ui/graph.js tests/test-graph-render.js
git commit -m "feat(ui): render execution graphs (groups, conditions, branches) as SVG"
```

---

## Task 4: `ui/preview.html` — wire the Phase-2 graph + legend

**Files:**
- Modify: `ui/preview.html` (load `graph-layout.js`; render the graph in `renderPreview`; extend legend)
- Verification: launch the dashboard, load the preview, confirm no console errors + a screenshot

This is a browser-wiring task (no node unit test — zero-dependency constraint).

- [ ] **Step 1: Include the layout module.** In `ui/preview.html`, find where `graph.js` would be loaded (or the `<script>` section near the end). Ensure both scripts load before the inline script that calls `renderPreview`. Add in the `<head>` or before the inline `<script>`:

```html
<script src="graph-layout.js"></script>
<script src="graph.js"></script>
```

(If `graph.js` is not already referenced in preview.html, add both. The dashboard already serves `/graph.js`; add a `/graph-layout.js` route in Task — see Step 4.)

- [ ] **Step 2: Render the graph in `renderPreview`.** In the inline script's `renderPreview(blueprint)` function, AFTER the existing `if (blueprint.stages) { ... }` block, add:

```js
    if (blueprint.execution_graph) {
      const svg = document.getElementById('preview-graph-svg');
      if (svg && window.renderExecutionGraph) {
        window.renderExecutionGraph(blueprint.execution_graph, svg);
      }
      // List the graph nodes as a textual plan
      const nodes = blueprint.execution_graph.stages.map(n =>
        n.type === 'condition'
          ? { agents: [{ name: `◇ if ${n.condition_id} → ${n.true_next} / ${n.false_next}` }], parallel: false }
          : { agents: (n.agents || []).map(name => ({ name })), parallel: (n.agents || []).length > 1 }
      );
      renderExecutionPlan(nodes);
    }
```

- [ ] **Step 3: Extend the legend.** In `ui/preview.html`, find `#preview-graph-legend` (around line 40) and add legend entries for the Phase-2 shapes. Add these spans inside that legend div:

```html
      <span>▭ Group</span>
      <span>◇ Condition</span>
      <span style="color:#3fb950;">— true</span>
      <span style="color:#f85149;">— false</span>
```

- [ ] **Step 4: Serve `graph-layout.js` from the dashboard.** In `runtime/dashboard.js`, find the `/graph.js` route:

```js
    } else if (url.pathname === '/graph.js') {
      serveFile(res, path.join(UI_DIR, 'graph.js'), 'application/javascript');
```

Add immediately after it:

```js
    } else if (url.pathname === '/graph-layout.js') {
      serveFile(res, path.join(UI_DIR, 'graph-layout.js'), 'application/javascript');
```

- [ ] **Step 5: Verify in a real browser.** Run the suite first (`node tests/run-all.js`, 0 failed). Then start the dashboard and load the preview with the conditional example, and confirm: the SVG shows a `research` box → `high_confidence` diamond → `synthesis`/`fallback` boxes with green/red branch edges, and the browser console has no errors. Capture a screenshot for the record. (Use the project's preview entry point; if preview data must be injected, set `window.previewData = generateExecutionPlan(<research-conditional.yaml contents>)` equivalent, or use the existing preview command path.)

- [ ] **Step 6: Commit:**
```bash
git add ui/preview.html runtime/dashboard.js
git commit -m "feat(ui): visualize phase-2 execution graph in the dry-run preview"
```

---

## Task 5: `runtime/wizard.js` — author groups & conditions

**Files:**
- Modify: `runtime/wizard.js` (add `addGroup`, `addCondition`; emit them in `toYAML`; keep existing methods/behavior)
- Test: `tests/test-wizard-phase2.js`

- [ ] **Step 1: Write the failing test.** Create `tests/test-wizard-phase2.js`:

```js
#!/usr/bin/env node
const assert = require('assert');
const WizardSession = require('../runtime/wizard');
const yaml = require('../runtime/simple-yaml');
const { compile } = require('../runtime/compiler');

const w = new WizardSession('s1')
  .setName('rc')
  .setFlow('research → if high_confidence: synthesis else: fallback')
  .addAgent('searcher', 'searcher', 'Search')
  .addAgent('analyst', 'analyst', 'Analyze')
  .addAgent('synthesizer', 'synthesizer', 'Synthesize')
  .addAgent('error_handler', 'handler', 'Recover')
  .addGroup('research', ['searcher', 'analyst'])
  .addGroup('synthesis', ['synthesizer'])
  .addGroup('fallback', ['error_handler'])
  .addCondition('high_confidence', { type: 'agent_output', source: 'searcher', check: 'confidence', threshold: '> 0.8' });

// chainable
assert.ok(w instanceof WizardSession, 'builder methods are chainable');

const out = w.toYAML();
const parsed = yaml.parse(out);
assert.deepStrictEqual(parsed.groups.research.agents, ['searcher', 'analyst']);
assert.strictEqual(parsed.conditions.high_confidence.type, 'agent_output');
assert.strictEqual(parsed.conditions.high_confidence.threshold, '> 0.8');

// the emitted YAML compiles to a phase-2 plan
const plan = compile(parsed);
assert.ok(plan.execution_graph, 'wizard YAML compiles to an execution graph');

// Phase-1 wizard output unchanged (no empty groups/conditions sections)
const p1 = new WizardSession('s2').setName('x').setFlow('a → b')
  .addAgent('a', 'a', 'x').addAgent('b', 'b', 'y').toYAML();
assert.ok(!/groups:/.test(p1), 'phase-1 output has no groups section');
assert.ok(!/conditions:/.test(p1), 'phase-1 output has no conditions section');

console.log('✓ wizard phase-2 authoring — all tests pass');
```

- [ ] **Step 2: Run `node tests/test-wizard-phase2.js`** — confirm FAIL (`addGroup` is not a function).

- [ ] **Step 3: Implement.** In `runtime/wizard.js`:

(a) In the constructor, add `groups` and `conditions` to `this.state`:

```js
    this.state = {
      name: null,
      description: null,
      agents: {},
      context: null,
      flow: null,
      groups: {},
      conditions: {}
    };
```

(b) Add two methods (e.g. after `setFlow`):

```js
  /**
   * Add a group of agents.
   * @param {string} name - Group name
   * @param {string[]} agents - Agent names in the group
   * @returns {WizardSession} this for chaining
   */
  addGroup(name, agents) {
    this.state.groups[name] = { agents: Array.isArray(agents) ? agents : [agents] };
    return this;
  }

  /**
   * Add a condition.
   * @param {string} name - Condition name
   * @param {object} def - Condition definition (type + type-specific fields)
   * @returns {WizardSession} this for chaining
   */
  addCondition(name, def) {
    this.state.conditions[name] = { ...def };
    return this;
  }
```

(c) In `toYAML`, BEFORE the `agents:` section block, emit groups and conditions when present:

```js
    // groups section (Phase 2)
    const groupNames = Object.keys(this.state.groups);
    if (groupNames.length > 0) {
      lines.push('');
      lines.push('groups:');
      for (const g of groupNames) {
        lines.push(`  ${g}:`);
        lines.push(`    agents: [${this.state.groups[g].agents.join(', ')}]`);
      }
    }

    // conditions section (Phase 2)
    const condNames = Object.keys(this.state.conditions);
    if (condNames.length > 0) {
      lines.push('');
      lines.push('conditions:');
      for (const c of condNames) {
        const def = this.state.conditions[c];
        lines.push(`  ${c}:`);
        for (const [k, v] of Object.entries(def)) {
          const needsQuote = typeof v === 'string' && /[>:<=]/.test(v);
          lines.push(`    ${k}: ${needsQuote ? `"${v}"` : v}`);
        }
      }
    }
```

- [ ] **Step 4: Run `node tests/test-wizard-phase2.js`** — confirm PASS.
- [ ] **Step 5: Run `node tests/run-all.js`** — 0 failed (existing `test-wizard.js` still green).
- [ ] **Step 6: Commit:**
```bash
git add runtime/wizard.js tests/test-wizard-phase2.js
git commit -m "feat(wizard): author groups and conditions in the blueprint builder"
```

---

## Task 6: Documentation

**Files:**
- Modify: `CLAUDE.md` (Architecture diagram + Dashboard Routes)
- Modify: `docs/swarm-authoring.md` (note preview visualization)

- [ ] **Step 1: `CLAUDE.md` — note the new UI files + route.** Under `### Dashboard Routes`, add after the `/graph.js` line:

```
- `GET /graph-layout.js` → `ui/graph-layout.js` (pure execution-graph layout)
```

In the Architecture diagram's render line, update:

```
ui/index.html + ui/graph.js  ← topology SVG + live log dashboard
ui/preview.html + ui/graph-layout.js  ← dry-run preview incl. Phase-2 group/condition topology
```

- [ ] **Step 2: `docs/swarm-authoring.md` — note preview support.** Under the existing "Conditional Topology (Phase 2)" section, append:

```markdown
The dry-run preview visualizes Phase-2 blueprints: groups render as boxes,
conditions as diamonds, and branches as green (true) / red (false) edges.
The wizard builder can author `groups` and `conditions` programmatically.
```

- [ ] **Step 3: Run `node tests/run-all.js`** — 0 failed.
- [ ] **Step 4: Commit:**
```bash
git add CLAUDE.md docs/swarm-authoring.md
git commit -m "docs: note phase-2 preview visualization and wizard authoring"
```

---

## Final Verification

- [ ] `node tests/run-all.js` — all suites pass (existing + 4 new: preview-phase2, graph-layout, graph-render, wizard-phase2).
- [ ] Dashboard smoke: preview of `swarms/research-conditional.yaml` renders the group/condition/branch SVG with no console errors (screenshot captured).
- [ ] `git log --oneline` — one focused commit per task.

## Spec Coverage Self-Review

| Spec UI requirement | Task |
|---------------------|------|
| Groups as containers | Tasks 2, 3, 4 |
| Conditions as diamonds | Tasks 2, 3, 4 |
| Branches as labeled true/false edges | Tasks 2, 3, 4 |
| Preview shows execution plan with decision points | Tasks 1, 4 |
| Wizard defines groups & conditions | Task 5 (builder; HTML editor deferred) |
| Legend updated | Task 4 |

**Deliberately deferred:** live dashboard Phase-2 rendering (needs runtime evaluation); `wizard.html` DOM editor (builder shipped, UI is an additive follow-up); user-choice/compound conditions (Phase 2.2).
