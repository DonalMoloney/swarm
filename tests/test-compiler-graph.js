#!/usr/bin/env node
const assert = require('assert');
const { compile, buildExecutionGraph } = require('../runtime/compiler');

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

// --- Comma-parallel syntax is rejected in phase-2 flows ---
assert.throws(
  () => compile({
    name: 'bad', flow: 'a, b → if cond: c else: d',
    groups: { g: { agents: ['a'] } },
    conditions: { cond: { type: 'validation', criteria: 'no-errors' } },
    agents: { a: { prompt: 'x' }, b: { prompt: 'y' }, c: { prompt: 'z' }, d: { prompt: 'w' } },
  }),
  /comma-parallel/,
  'compile rejects comma-parallel in a phase-2 flow'
);
assert.throws(
  () => buildExecutionGraph({ flow: 'a, b → c', groups: {} }),
  /comma-parallel/,
  'buildExecutionGraph rejects a comma token directly'
);

// --- Multiple if-segments: ids ordered and linked correctly ---
const multi = compile({
  name: 'm',
  flow: 'g1 → if c1: g2 else: g3 → if c2: g4 else: g5',
  groups: { g1:{agents:['a']}, g2:{agents:['b']}, g3:{agents:['d']}, g4:{agents:['e']}, g5:{agents:['f']} },
  conditions: { c1:{type:'validation',criteria:'no-errors'}, c2:{type:'validation',criteria:'no-errors'} },
  agents: { a:{prompt:'x'}, b:{prompt:'x'}, d:{prompt:'x'}, e:{prompt:'x'}, f:{prompt:'x'} },
});
assert.deepStrictEqual(
  multi.execution_graph.stages.map(n => n.id),
  ['s1','c1','s2','s3','c2','s4','s5'],
  'multi-if node ordering'
);

// --- Bare agent names (no groups) act as single-agent stages ---
const bare = compile({
  name: 'bare',
  flow: 'searcher → if cond: writer else: fixer',
  conditions: { cond: { type: 'validation', criteria: 'no-errors' } },
  agents: { searcher:{prompt:'x'}, writer:{prompt:'y'}, fixer:{prompt:'z'} },
});
assert.deepStrictEqual(
  bare.execution_graph.stages[0],
  { id:'s1', type:'group', group_id:'searcher', agents:['searcher'] },
  'bare agent name becomes a single-agent group stage'
);

// --- Malformed if-segment throws a clear error ---
assert.throws(
  () => buildExecutionGraph({ flow: 'g1 → if cond g2 else g3', groups: {} }),
  /Malformed/,
  'malformed if-segment throws'
);

console.log('✓ compiler execution graph + backward compat — all tests pass');
