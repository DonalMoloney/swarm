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
