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

// linear multi-group graph (no conditions): sequential edges + advancing columns
const lin = layoutExecutionGraph({ stages: [
  { id: 's1', type: 'group', group_id: 'a', agents: ['x'] },
  { id: 's2', type: 'group', group_id: 'b', agents: ['y'] },
  { id: 's3', type: 'group', group_id: 'c', agents: ['z'] },
]});
const linById = Object.fromEntries(lin.nodes.map(n => [n.id, n]));
assert.strictEqual(linById.s1.col, 0, 'linear: first group in col 0');
assert.strictEqual(linById.s2.col, 1, 'linear: second group in col 1');
assert.strictEqual(linById.s3.col, 2, 'linear: third group in col 2');
assert.deepStrictEqual(
  lin.edges.map(e => `${e.from}->${e.to}:${e.kind}`).sort(),
  ['s1->s2:seq', 's2->s3:seq'],
  'linear groups are connected by sequential edges'
);

// branch-target siblings are NOT chained by a sequential edge
const br = layoutExecutionGraph({ stages: [
  { id: 's1', type: 'group', group_id: 'g', agents: ['x'] },
  { id: 'c1', type: 'condition', condition_id: 'c', true_next: 's2', false_next: 's3' },
  { id: 's2', type: 'group', group_id: 'g2', agents: ['y'] },
  { id: 's3', type: 'group', group_id: 'g3', agents: ['z'] },
]});
assert.ok(!br.edges.some(e => e.from === 's2' && e.to === 's3'), 'branch siblings are not seq-linked');

console.log('✓ graph layout — all tests pass');
