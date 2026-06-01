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
