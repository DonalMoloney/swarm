#!/usr/bin/env node
/**
 * Parses a swarm blueprint's flow string into an ordered execution plan.
 *
 * Flow string syntax:
 *   comma  = parallel (same stage)
 *   →  or -> = next stage
 *
 * Examples:
 *   "A, B → C"       → [{parallel:[A,B]}, {sequential:[C]}]
 *   "A → B → C"      → [{sequential:[A]}, {sequential:[B]}, {sequential:[C]}]
 *   "A, B, C"        → [{parallel:[A,B,C]}]
 *   "A → B, C → D"   → [{sequential:[A]}, {parallel:[B,C]}, {sequential:[D]}]
 */

function parseFlow(flowString) {
  const stages = flowString
    .split(/→|->/)
    .map(stage => stage.trim())
    .filter(Boolean)
    .map(stage => {
      const agents = stage.split(',').map(a => a.trim()).filter(Boolean);
      return agents.length > 1
        ? { type: 'parallel', agents }
        : { type: 'sequential', agents };
    });

  return stages;
}

function validateBlueprint(blueprint) {
  const errors = [];

  if (!blueprint.name) errors.push('Missing required field: name');
  if (!blueprint.flow) errors.push('Missing required field: flow');
  if (!blueprint.agents || typeof blueprint.agents !== 'object') {
    errors.push('Missing required field: agents (must be an object)');
  }

  if (blueprint.flow && blueprint.agents) {
    const stages = parseFlow(blueprint.flow);
    const allAgentNames = stages.flatMap(s => s.agents);
    const defined = Object.keys(blueprint.agents);
    const unknown = allAgentNames.filter(a => !defined.includes(a));
    if (unknown.length) {
      errors.push(`Flow references undefined agents: ${unknown.join(', ')}`);
    }
  }

  return errors;
}

function resolveExtends(blueprint, loadBlueprint, _seen) {
  if (!blueprint.extends) return blueprint;
  const seen = _seen || new Set();
  if (seen.has(blueprint.name)) {
    throw new Error(`Circular extends detected: "${blueprint.name}" extends itself`);
  }
  seen.add(blueprint.name);
  let parent = loadBlueprint(blueprint.extends);
  parent = resolveExtends(parent, loadBlueprint, seen);
  const resolved = {
    ...parent,
    ...blueprint,
    agents: { ...parent.agents, ...blueprint.agents },
    flow: blueprint.flow || parent.flow,
  };
  delete resolved.extends;
  if (!blueprint.name) {
    throw new Error('Blueprint must declare a "name" field');
  }
  resolved.name = blueprint.name; // child name always wins
  return resolved;
}

function compile(blueprint) {
  if (blueprint.extends) {
    throw new Error('Blueprint has unresolved "extends" field — call resolveExtends() before compile()');
  }
  const errors = validateBlueprint(blueprint);
  if (errors.length) {
    throw new Error(`Blueprint validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
  }

  const stages = parseFlow(blueprint.flow);

  return {
    name: blueprint.name,
    description: blueprint.description || '',
    output: blueprint.output || 'markdown',
    stages,
    agents: blueprint.agents,
  };
}

// Print execution plan when called directly
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const blueprintPath = process.argv[2];
  if (!blueprintPath) {
    console.error('Usage: node compiler.js <blueprint.yaml>');
    process.exit(1);
  }

  // Simple YAML parser for our fixed schema (avoids npm dependency)
  function parseSimpleYaml(text) {
    const result = {};
    const lines = text.split('\n');
    let currentKey = null;
    let currentIndent = 0;
    let inAgents = false;
    let currentAgent = null;

    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.match(/^(\s*)/)[1].length;
      const content = line.trim();

      if (indent === 0) {
        inAgents = false;
        currentAgent = null;
        const [k, ...rest] = content.split(':');
        const v = rest.join(':').trim();
        if (k === 'agents') {
          result.agents = {};
          inAgents = true;
        } else if (v) {
          result[k.trim()] = v.replace(/^["']|["']$/g, '');
        }
        currentKey = k.trim();
      } else if (inAgents && indent === 2) {
        currentAgent = content.replace(':', '');
        result.agents[currentAgent] = {};
      } else if (inAgents && indent === 4 && currentAgent) {
        const [k, ...rest] = content.split(':');
        const v = rest.join(':').trim();
        if (k === 'tools') {
          result.agents[currentAgent].tools = v
            .replace(/[\[\]]/g, '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);
        } else {
          result.agents[currentAgent][k.trim()] = v.replace(/^["']|["']$/g, '');
        }
      }
    }
    return result;
  }

  const yaml = require('./simple-yaml.js');
  const raw = fs.readFileSync(path.resolve(blueprintPath), 'utf8');
  let blueprint = yaml.parse ? yaml.parse(raw) : parseSimpleYaml(raw);

  function loadBlueprint(name) {
    if (!/^[a-zA-Z0-9_/-]+$/.test(name) || name.includes('..')) {
      throw new Error(`Invalid blueprint name "${name}": only alphanumeric, dash, underscore, and single forward-slash allowed`);
    }
    const p = path.resolve(path.dirname(blueprintPath), '..', `${name}.yaml`);
    const src = fs.readFileSync(p, 'utf8');
    return yaml.parse ? yaml.parse(src) : parseSimpleYaml(src);
  }

  blueprint = resolveExtends(blueprint, loadBlueprint);

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
}

module.exports = { parseFlow, compile, validateBlueprint, resolveExtends };
