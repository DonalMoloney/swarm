#!/usr/bin/env node
const assert = require('assert');
const WizardSession = require('../runtime/wizard');

// Test 1: Create a new wizard session
const session1 = new WizardSession('session-001');
assert.strictEqual(session1.sessionId, 'session-001', 'sessionId stored');
assert.strictEqual(session1.state.name, null, 'name initialized to null');
assert.strictEqual(session1.state.description, null, 'description initialized to null');
assert.deepStrictEqual(session1.state.agents, {}, 'agents initialized to empty object');
assert.strictEqual(session1.state.flow, null, 'flow initialized to null');
assert.strictEqual(session1.state.context, null, 'context initialized to null');
console.log('✓ Test 1: WizardSession initializes with empty state');

// Test 2: setName() is chainable and stores name
const session2 = new WizardSession('session-002');
const result = session2.setName('My Research Blueprint');
assert.strictEqual(result, session2, 'setName() returns this for chaining');
assert.strictEqual(session2.state.name, 'My Research Blueprint', 'name stored correctly');
console.log('✓ Test 2: setName() is chainable and stores name');

// Test 3: setDescription() is chainable and stores description
const session3 = new WizardSession('session-003');
const result3 = session3.setDescription('A blueprint for researching AI topics');
assert.strictEqual(result3, session3, 'setDescription() returns this for chaining');
assert.strictEqual(session3.state.description, 'A blueprint for researching AI topics', 'description stored correctly');
console.log('✓ Test 3: setDescription() is chainable and stores description');

// Test 4: addAgent() with explicit prompt
const session4 = new WizardSession('session-004');
const result4 = session4.addAgent('searcher', 'Web Search Specialist', 'Find the most relevant sources on the web');
assert.strictEqual(result4, session4, 'addAgent() returns this for chaining');
assert(session4.state.agents.searcher, 'agent added to agents object');
assert.strictEqual(session4.state.agents.searcher.role, 'Web Search Specialist', 'role stored correctly');
assert.strictEqual(session4.state.agents.searcher.prompt, 'Find the most relevant sources on the web', 'explicit prompt stored');
console.log('✓ Test 4: addAgent() with explicit prompt stores agent correctly');

// Test 5: addAgent() with auto-generated prompt from role
const session5 = new WizardSession('session-005');
session5.addAgent('analyst', 'Data Analysis Expert');
assert(session5.state.agents.analyst, 'agent added');
assert.strictEqual(session5.state.agents.analyst.role, 'Data Analysis Expert', 'role stored');
assert(session5.state.agents.analyst.prompt, 'prompt auto-generated');
assert(session5.state.agents.analyst.prompt.length > 0, 'auto-generated prompt is non-empty');
console.log('✓ Test 5: addAgent() auto-generates prompt from role when not provided');

// Test 6: setFlow() is chainable and stores flow
const session6 = new WizardSession('session-006');
const result6 = session6.setFlow('searcher, analyst → synthesiser');
assert.strictEqual(result6, session6, 'setFlow() returns this for chaining');
assert.strictEqual(session6.state.flow, 'searcher, analyst → synthesiser', 'flow stored correctly');
console.log('✓ Test 6: setFlow() is chainable and stores flow');

// Test 7: Chaining multiple method calls
const session7 = new WizardSession('session-007');
session7
  .setName('Research Pipeline')
  .setDescription('Multi-stage research and synthesis')
  .addAgent('searcher', 'Web Research Specialist', 'Find relevant sources')
  .addAgent('analyst', 'Analyst', 'Analyze findings')
  .setFlow('searcher, analyst → synthesiser');

assert.strictEqual(session7.state.name, 'Research Pipeline', 'name set via chain');
assert.strictEqual(session7.state.description, 'Multi-stage research and synthesis', 'description set via chain');
assert(session7.state.agents.searcher, 'searcher agent added via chain');
assert(session7.state.agents.analyst, 'analyst agent added via chain');
assert.strictEqual(session7.state.flow, 'searcher, analyst → synthesiser', 'flow set via chain');
console.log('✓ Test 7: Method chaining works across multiple calls');

// Test 8: toYAML() generates valid YAML for simple blueprint
const session8 = new WizardSession('session-008');
session8
  .setName('simple-test')
  .setDescription('A simple test blueprint')
  .addAgent('worker', 'Simple Worker', 'Do the work')
  .setFlow('worker');

const yaml8 = session8.toYAML();
assert(yaml8.includes('name: simple-test'), 'YAML contains name field');
assert(yaml8.includes('description: A simple test blueprint'), 'YAML contains description');
assert(yaml8.includes('flow: "worker"'), 'YAML contains flow');
assert(yaml8.includes('agents:'), 'YAML contains agents section');
assert(yaml8.includes('  worker:'), 'YAML contains worker agent');
assert(yaml8.includes('    role: Simple Worker'), 'YAML contains worker role');
console.log('✓ Test 8: toYAML() generates valid YAML for simple blueprint');

// Test 9: toYAML() with multiple agents and complex flow
const session9 = new WizardSession('session-009');
session9
  .setName('research')
  .setDescription('Fan-out parallel research then synthesise')
  .addAgent('searcher', 'Search Specialist', 'Search for sources')
  .addAgent('analyst', 'Analyst', 'Analyze from first principles')
  .addAgent('synthesiser', 'Synthesiser', 'Combine findings into report')
  .setFlow('searcher, analyst → synthesiser');

const yaml9 = session9.toYAML();
assert(yaml9.includes('name: research'), 'name field present');
assert(yaml9.includes('flow: "searcher, analyst → synthesiser"'), 'flow field with arrow');
assert(yaml9.includes('  searcher:'), 'searcher agent present');
assert(yaml9.includes('  analyst:'), 'analyst agent present');
assert(yaml9.includes('  synthesiser:'), 'synthesiser agent present');
assert(yaml9.includes('    role: Search Specialist'), 'searcher role present');
assert(yaml9.includes('    role: Analyst'), 'analyst role present');
assert(yaml9.includes('    prompt:'), 'prompt field present');
console.log('✓ Test 9: toYAML() generates YAML with multiple agents and complex flow');

// Test 10: YAML output is valid (parseable by simple-yaml parser)
const simpleYaml = require('../runtime/simple-yaml');
const session10 = new WizardSession('session-010');
session10
  .setName('test-parsing')
  .setDescription('Testing YAML parsing')
  .addAgent('agent1', 'First Agent', 'Do first task')
  .addAgent('agent2', 'Second Agent', 'Do second task')
  .setFlow('agent1 → agent2');

const yaml10 = session10.toYAML();
const parsed = simpleYaml.parse(yaml10);
assert.strictEqual(parsed.name, 'test-parsing', 'parsed name matches');
assert.strictEqual(parsed.description, 'Testing YAML parsing', 'parsed description matches');
assert.strictEqual(parsed.flow, 'agent1 → agent2', 'parsed flow matches');
assert(parsed.agents.agent1, 'parsed agent1 exists');
assert(parsed.agents.agent2, 'parsed agent2 exists');
assert.strictEqual(parsed.agents.agent1.role, 'First Agent', 'parsed agent1 role matches');
console.log('✓ Test 10: YAML output is valid and parseable by simple-yaml');

// Test 11: Multiple agents can be added progressively
const session11 = new WizardSession('session-011');
session11.addAgent('a', 'Role A', 'Prompt A');
session11.addAgent('b', 'Role B', 'Prompt B');
session11.addAgent('c', 'Role C');
assert.strictEqual(Object.keys(session11.state.agents).length, 3, 'three agents added');
assert.strictEqual(session11.state.agents.a.prompt, 'Prompt A', 'agent a prompt');
assert.strictEqual(session11.state.agents.b.prompt, 'Prompt B', 'agent b prompt');
assert(session11.state.agents.c.prompt, 'agent c has auto-generated prompt');
console.log('✓ Test 11: Multiple agents can be added progressively');

// Test 12: setContext() stores context array (if implemented)
const session12 = new WizardSession('session-012');
session12.setContext('agent1', ['github', 'slack']);
assert.deepStrictEqual(session12.state.context, { agent1: ['github', 'slack'] }, 'context stored for agent');
console.log('✓ Test 12: setContext() stores provider context for agents');

// Test 13: toYAML() escapes special characters in prompts
const session13 = new WizardSession('session-013');
session13
  .setName('escaping-test')
  .setDescription('Test escaping of quotes and special chars')
  .addAgent('worker', 'Worker', 'Use "quotes" in the prompt and handle them correctly')
  .setFlow('worker');

const yaml13 = session13.toYAML();
assert(yaml13.includes('prompt:'), 'prompt field present');
// Just verify it's valid YAML that can be parsed
const parsed13 = simpleYaml.parse(yaml13);
assert(parsed13.agents.worker.prompt, 'prompt parsed successfully');
console.log('✓ Test 13: toYAML() handles special characters in prompts');

// Test 14: Empty wizard produces minimal valid YAML
const session14 = new WizardSession('session-014');
const yaml14 = session14.toYAML();
assert(yaml14.includes('name:'), 'even empty wizard has name field');
assert(yaml14.includes('agents:'), 'even empty wizard has agents section');
console.log('✓ Test 14: Empty wizard produces minimal valid YAML structure');

// Test 15: YAML format follows spec (name, description, flow, agents with role+prompt)
const session15 = new WizardSession('session-015');
session15
  .setName('format-test')
  .setDescription('Test format compliance')
  .addAgent('x', 'Role X', 'Prompt X')
  .setFlow('x');

const yaml15 = session15.toYAML();
const lines = yaml15.split('\n');
// Check order: name should come before agents
const nameIdx = lines.findIndex(l => l.includes('name:'));
const agentsIdx = lines.findIndex(l => l.includes('agents:'));
assert(nameIdx >= 0 && agentsIdx >= 0, 'both name and agents present');
assert(nameIdx < agentsIdx, 'name comes before agents in YAML output');
console.log('✓ Test 15: YAML output follows expected field order');

// Cleanup (no temp files created)
console.log('\n✓ runtime/wizard.js — all 15 tests pass');
