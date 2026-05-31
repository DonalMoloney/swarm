#!/usr/bin/env node
const assert = require('assert');
const { parseIdea, generateBlueprint } = require('../runtime/suggestions');
const { compile } = require('../runtime/compiler');
const yaml = require('../runtime/simple-yaml.js');

// Test 1: parseIdea detects bug-hunting keywords
const idea1 = parseIdea('Find bugs in the auth module');
assert.ok(idea1.agents.includes('bug-hunter'), 'bug keyword detected');
assert.ok(idea1.idea.includes('auth module'), 'idea preserved');

// Test 2: parseIdea detects performance keywords
const idea2 = parseIdea('Review performance of database queries');
assert.ok(idea2.agents.includes('perf-reviewer'), 'performance keyword detected');

// Test 3: parseIdea detects security keywords
const idea3 = parseIdea('Security audit of login flow');
assert.ok(idea3.agents.includes('security-reviewer'), 'security keyword detected');

// Test 4: parseIdea detects search/research keywords
const idea4 = parseIdea('Research the latest AI frameworks');
assert.ok(idea4.agents.includes('searcher'), 'search/research keyword detected');

// Test 5: parseIdea detects analysis keywords
const idea5 = parseIdea('Analyze the requirements document');
assert.ok(idea5.agents.includes('analyst'), 'analysis keyword detected');

// Test 6: parseIdea with multiple keywords
const idea6 = parseIdea('Debug performance issues in the API');
assert.ok(idea6.agents.includes('bug-hunter'), 'first keyword matched');
assert.ok(idea6.agents.includes('perf-reviewer'), 'second keyword matched');
assert.ok(idea6.agents.length >= 2, 'multiple agents detected');

// Test 7: parseIdea with no matching keywords defaults to reviewer
const idea7 = parseIdea('Something random and unrelated');
assert.ok(idea7.agents.includes('reviewer'), 'default reviewer agent created');
assert.strictEqual(idea7.agents.length, 1, 'only one default agent');

// Test 8: parseIdea extracts roles
const idea8 = parseIdea('Find bugs and review performance');
assert.ok(idea8.roles, 'roles object exists');
if (idea8.agents.includes('bug-hunter')) {
  assert.ok(idea8.roles['bug-hunter'], 'bug-hunter role defined');
}

// Test 9: generateBlueprint returns valid YAML string
const blueprint9 = generateBlueprint('Find bugs in the code');
assert.strictEqual(typeof blueprint9, 'string', 'returns string');
assert.ok(blueprint9.includes('name:'), 'YAML includes name field');
assert.ok(blueprint9.includes('agents:'), 'YAML includes agents field');
assert.ok(blueprint9.includes('flow:'), 'YAML includes flow field');

// Test 10: generateBlueprint creates parseable YAML
const blueprint10 = generateBlueprint('Research AI frameworks');
const parsed10 = yaml.parse(blueprint10);
assert.ok(parsed10.name, 'parsed YAML has name');
assert.ok(parsed10.flow, 'parsed YAML has flow');
assert.ok(parsed10.agents, 'parsed YAML has agents');

// Test 11: generateBlueprint creates compilable blueprint
const blueprint11 = generateBlueprint('Security audit required');
const parsed11 = yaml.parse(blueprint11);
const compiled11 = compile(parsed11);
assert.strictEqual(compiled11.name, parsed11.name, 'compiled blueprint matches name');
assert.ok(compiled11.stages, 'compiled blueprint has stages');

// Test 12: single agent blueprint has sequential flow
const blueprint12 = generateBlueprint('Random task');
const parsed12 = yaml.parse(blueprint12);
const compiled12 = compile(parsed12);
assert.ok(compiled12.stages, 'single agent blueprint compiles');

// Test 13: multiple agents create synthesiser in flow
const blueprint13 = generateBlueprint('Debug performance and security issues');
const parsed13 = yaml.parse(blueprint13);
assert.ok(parsed13.agents.synthesiser, 'synthesiser agent created for multi-agent blueprint');
assert.ok(parsed13.flow.includes('synthesiser'), 'synthesiser in flow');

// Test 14: generated blueprint agents have roles
const blueprint14 = generateBlueprint('Bug hunting task');
const parsed14 = yaml.parse(blueprint14);
Object.values(parsed14.agents).forEach(agent => {
  assert.ok(agent.role, 'each agent has a role field');
});

// Test 15: flow topology is correct for single agent
const blueprint15 = generateBlueprint('Review something');
const parsed15 = yaml.parse(blueprint15);
const compiled15 = compile(parsed15);
const agentCount = Object.keys(parsed15.agents).length;
if (agentCount === 1) {
  assert.strictEqual(compiled15.stages.length, 1, 'single agent = single stage');
}

// Test 16: flow topology is correct for multiple agents
const blueprint16 = generateBlueprint('Find bugs and review security');
const parsed16 = yaml.parse(blueprint16);
const compiled16 = compile(parsed16);
assert.ok(compiled16.stages.length >= 2, 'multiple agents create multiple stages');
const lastStage = compiled16.stages[compiled16.stages.length - 1];
assert.strictEqual(lastStage.agents[0], 'synthesiser', 'last stage is synthesiser');

// Test 17: blueprint name is generated from idea
const blueprint17 = generateBlueprint('Analyze the customer feedback');
const parsed17 = yaml.parse(blueprint17);
assert.ok(parsed17.name, 'blueprint has a name');
assert.strictEqual(typeof parsed17.name, 'string', 'name is a string');

// Test 18: blueprint description captures the idea
const blueprint18 = generateBlueprint('Research ML best practices');
const parsed18 = yaml.parse(blueprint18);
assert.ok(parsed18.description, 'blueprint has description');
assert.ok(parsed18.description.includes('research') || parsed18.description.includes('ML'), 'description relates to idea');

// Test 19: parseIdea case-insensitive matching
const idea19 = parseIdea('DEBUG this SECURITY issue with PERFORMANCE');
assert.ok(idea19.agents.includes('bug-hunter'), 'uppercase DEBUG matched');
assert.ok(idea19.agents.includes('security-reviewer'), 'uppercase SECURITY matched');
assert.ok(idea19.agents.includes('perf-reviewer'), 'uppercase PERFORMANCE matched');

// Test 20: blueprint is valid YAML that compiler doesn't reject
const blueprint20 = generateBlueprint('Complete system review');
const parsed20 = yaml.parse(blueprint20);
assert.doesNotThrow(() => {
  compile(parsed20);
}, 'generated blueprint compiles without error');

console.log('✓ suggestions module — all 20 tests pass');
