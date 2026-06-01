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
