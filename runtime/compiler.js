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

  const usesPhase2 = !!blueprint.groups || /\bif\s/.test(blueprint.flow || '');

  if (blueprint.flow && blueprint.agents && !usesPhase2) {
    const stages = parseFlow(blueprint.flow);
    const allAgentNames = stages.flatMap(s => s.agents);
    const defined = Object.keys(blueprint.agents);
    const unknown = allAgentNames.filter(a => !defined.includes(a));
    if (unknown.length) {
      errors.push(`Flow references undefined agents: ${unknown.join(', ')}`);
    }
  }

  if (blueprint.context !== undefined) {
    const { VALID_PROVIDERS } = require('./context');
    if (!Array.isArray(blueprint.context)) {
      errors.push('context must be an array of provider names');
    } else {
      const invalid = blueprint.context.filter(p => !VALID_PROVIDERS.includes(p));
      if (invalid.length) {
        errors.push(`Unknown context providers: ${invalid.join(', ')} (valid: ${VALID_PROVIDERS.join(', ')})`);
      }
    }
  }

  if (blueprint.actions !== undefined) {
    const VALID_ACTIONS = ['edit-files', 'run-tests', 'open-pr'];
    if (!Array.isArray(blueprint.actions)) {
      errors.push('actions must be an array');
    } else {
      const invalid = blueprint.actions.filter(a => !VALID_ACTIONS.includes(a));
      if (invalid.length) {
        errors.push(`Unknown actions: ${invalid.join(', ')} (valid: ${VALID_ACTIONS.join(', ')})`);
      }
    }
  }

  if (blueprint.groups !== undefined) {
    if (typeof blueprint.groups !== 'object' || Array.isArray(blueprint.groups)) {
      errors.push('groups must be an object');
    } else {
      const definedAgents = blueprint.agents ? Object.keys(blueprint.agents) : [];
      for (const [gname, g] of Object.entries(blueprint.groups)) {
        if (!Array.isArray(g.agents) || g.agents.length === 0) {
          errors.push(`Group "${gname}" must list at least one agent`);
          continue;
        }
        const missing = g.agents.filter(a => !definedAgents.includes(a));
        if (missing.length) {
          errors.push(`Group "${gname}" references undefined agents: ${missing.join(', ')}`);
        }
      }
    }
  }

  // Flat (non-conditional) group flows: every token must be a defined group or agent.
  // Conditional (`if`) flows are validated separately.
  if (blueprint.flow && blueprint.agents && blueprint.groups &&
      typeof blueprint.groups === 'object' && !Array.isArray(blueprint.groups) &&
      !/\bif\s/.test(blueprint.flow)) {
    const allTokens = parseFlow(blueprint.flow).flatMap(s => s.agents);
    const definedGroups = Object.keys(blueprint.groups);
    const definedAgents = Object.keys(blueprint.agents);
    const unknown = allTokens.filter(t => !definedGroups.includes(t) && !definedAgents.includes(t));
    if (unknown.length) {
      errors.push(`Flow references undefined groups or agents: ${unknown.join(', ')}`);
    }
  }

  const VALID_CONDITION_TYPES = ['validation', 'agent_output'];
  const VALID_CRITERIA = ['no-errors', 'no-warnings', 'all-pass'];

  if (blueprint.conditions !== undefined) {
    if (typeof blueprint.conditions !== 'object' || Array.isArray(blueprint.conditions)) {
      errors.push('conditions must be an object');
    } else {
      const definedAgents = blueprint.agents ? Object.keys(blueprint.agents) : [];
      for (const [cname, c] of Object.entries(blueprint.conditions)) {
        if (!c || typeof c !== 'object' || Array.isArray(c)) {
          errors.push(`Condition "${cname}" must be an object`);
          continue;
        }
        if (!VALID_CONDITION_TYPES.includes(c.type)) {
          errors.push(`Condition "${cname}" has invalid type "${c.type}" (valid: ${VALID_CONDITION_TYPES.join(', ')})`);
          continue;
        }
        if (c.type === 'validation' && !VALID_CRITERIA.includes(c.criteria)) {
          errors.push(`Condition "${cname}" has invalid criteria "${c.criteria}" (valid: ${VALID_CRITERIA.join(', ')})`);
        }
        if (c.type === 'agent_output') {
          if (!c.source) errors.push(`Condition "${cname}" (agent_output) is missing "source"`);
          else if (!definedAgents.includes(c.source)) errors.push(`Condition "${cname}" references undefined source agent "${c.source}"`);
          if (!c.check) errors.push(`Condition "${cname}" (agent_output) is missing "check"`);
          if (!c.threshold) errors.push(`Condition "${cname}" (agent_output) is missing "threshold"`);
        }
      }
    }
  }

  if (blueprint.flow && /\bif\s/.test(blueprint.flow)) {
    const definedConditions = blueprint.conditions ? Object.keys(blueprint.conditions) : [];
    const definedGroups = blueprint.groups ? Object.keys(blueprint.groups) : [];
    const definedAgents = blueprint.agents ? Object.keys(blueprint.agents) : [];
    const isKnownTarget = (name) => definedGroups.includes(name) || definedAgents.includes(name);
    const segments = blueprint.flow.split(/→|->/).map(s => s.trim()).filter(Boolean);

    for (const seg of segments) {
      if (/^if\s/.test(seg)) {
        const m = seg.match(/^if\s+(.+?):\s*(.+?)\s+else:\s*(.+)$/);
        if (!m) { errors.push(`Malformed conditional flow segment: "${seg}"`); continue; }
        const cond = m[1].trim();
        const trueTarget = m[2].trim();
        const falseTarget = m[3].trim();
        if (!definedConditions.includes(cond)) {
          errors.push(`Flow references undefined condition "${cond}"`);
        }
        for (const target of [trueTarget, falseTarget]) {
          if (!isKnownTarget(target)) {
            errors.push(`Flow branch target "${target}" is not a defined group or agent`);
          }
        }
      } else {
        for (const name of seg.split(',').map(s => s.trim()).filter(Boolean)) {
          if (!isKnownTarget(name)) {
            errors.push(`Flow references "${name}" which is not a defined group or agent`);
          }
        }
      }
    }
  }

  if (blueprint.flow && usesPhase2 && blueprint.flow.includes(',')) {
    errors.push('Phase-2 flows do not support comma-parallel syntax — list agents in a group instead');
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

function buildExecutionGraph(blueprint) {
  const tokens = blueprint.flow.split(/→|->/).map(t => t.trim()).filter(Boolean);
  const stages = [];
  let sCount = 0;
  let cCount = 0;
  const stageIdFor = {};
  const pushed = new Set();

  function groupAgents(name) {
    if (blueprint.groups && blueprint.groups[name]) return blueprint.groups[name].agents;
    return [name]; // a bare agent name acts as its own single-agent stage
  }
  function allocId(name) {
    if (!stageIdFor[name]) stageIdFor[name] = `s${++sCount}`;
    return stageIdFor[name];
  }
  function pushStage(name) {
    const id = allocId(name);
    if (!pushed.has(id)) {
      pushed.add(id);
      stages.push({ id, type: 'group', group_id: name, agents: groupAgents(name) });
    }
    return id;
  }

  for (const token of tokens) {
    if (token.includes(',')) {
      throw new Error(`Phase-2 flow does not support comma-parallel syntax: "${token}" — use a group instead`);
    }
    if (/^if\s/.test(token)) {
      const m = token.match(/^if\s+(.+?):\s*(.+?)\s+else:\s*(.+)$/);
      if (!m) throw new Error(`Malformed conditional flow segment: "${token}"`);
      const condName = m[1].trim();
      const trueName = m[2].trim();
      const falseName = m[3].trim();
      const cid = `c${++cCount}`;
      const trueId = allocId(trueName);
      const falseId = allocId(falseName);
      stages.push({ id: cid, type: 'condition', condition_id: condName, true_next: trueId, false_next: falseId });
      pushStage(trueName);
      pushStage(falseName);
    } else {
      pushStage(token);
    }
  }

  return { stages };
}

function compile(blueprint) {
  if (blueprint.extends) {
    throw new Error('Blueprint has unresolved "extends" field — call resolveExtends() before compile()');
  }
  const errors = validateBlueprint(blueprint);
  if (errors.length) {
    throw new Error(`Blueprint validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
  }

  const usesPhase2 = !!blueprint.groups || /\bif\s/.test(blueprint.flow || '');

  if (usesPhase2) {
    return {
      name: blueprint.name,
      description: blueprint.description || '',
      output: blueprint.output || 'markdown',
      groups: blueprint.groups || {},
      conditions: blueprint.conditions || {},
      execution_graph: buildExecutionGraph(blueprint),
      agents: blueprint.agents,
    };
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
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_/-]*$/.test(name) || name.includes('..')) {
      throw new Error(`Invalid blueprint name "${name}": only alphanumeric, dash, underscore, and single forward-slash allowed`);
    }
    const p = path.resolve(path.dirname(blueprintPath), '..', `${name}.yaml`);
    const blueprintsRoot = path.resolve(path.dirname(blueprintPath), '..');
    if (!p.startsWith(blueprintsRoot + path.sep)) {
      throw new Error(`Blueprint path "${name}" resolves outside the swarms directory`);
    }
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

module.exports = { parseFlow, compile, validateBlueprint, resolveExtends, buildExecutionGraph };
