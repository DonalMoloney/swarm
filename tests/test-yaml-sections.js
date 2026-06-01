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
