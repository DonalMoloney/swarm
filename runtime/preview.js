/**
 * Preview & Validation Module
 *
 * Provides dry-run inspection of blueprints without executing agents.
 * Used by /swarm preview command to show topology and validation errors.
 */

const yaml = require('./simple-yaml');
const { compile, parseFlow } = require('./compiler');

/**
 * Extract agent names from a flow string.
 * Flow syntax: "a, b → c" or "a -> b -> c"
 *
 * @param {string} flowStr - Flow string
 * @returns {Set<string>} Set of agent names
 */
function extractAgentsFromFlow(flowStr) {
  const agents = new Set();

  // Split by both → and -> to handle both arrow types
  const stages = flowStr.split(/→|->/);

  for (const stage of stages) {
    // Split each stage by commas for parallel agents
    const parallelAgents = stage.split(',');

    for (const agent of parallelAgents) {
      const trimmed = agent.trim();
      if (trimmed) {
        agents.add(trimmed);
      }
    }
  }

  return agents;
}

/**
 * Validate a blueprint object.
 * Checks for required fields and consistency.
 *
 * @param {object} blueprint - Blueprint object
 * @returns {string[]} Array of error messages (empty if valid)
 */
function validateBlueprint(blueprint) {
  const errors = [];

  // Check required fields
  if (!blueprint.name) {
    errors.push('Missing required field: name');
  }

  if (!blueprint.flow) {
    errors.push('Missing required field: flow');
  }

  if (!blueprint.agents) {
    errors.push('Missing required field: agents (must be an object)');
  } else if (Array.isArray(blueprint.agents) || typeof blueprint.agents !== 'object') {
    errors.push('Missing required field: agents (must be an object)');
  }

  // Check that all agents in flow are defined (only if both flow and agents are valid)
  if (
    blueprint.flow &&
    blueprint.agents &&
    typeof blueprint.agents === 'object' &&
    !Array.isArray(blueprint.agents)
  ) {
    const flowAgents = extractAgentsFromFlow(blueprint.flow);
    const definedAgents = Object.keys(blueprint.agents);

    for (const agent of flowAgents) {
      if (!definedAgents.includes(agent)) {
        errors.push(`Flow references undefined agent: ${agent}`);
      }
    }
  }

  return errors;
}

/**
 * Generate an execution plan from blueprint YAML.
 * Compiles the blueprint and returns execution structure with error handling.
 *
 * @param {string} blueprintYaml - Raw YAML string
 * @returns {object} - { name, stages, agents, contexts, error? }
 */
function generateExecutionPlan(blueprintYaml) {
  try {
    // Parse YAML
    const blueprint = yaml.parse(blueprintYaml);

    // Validate blueprint
    const errors = validateBlueprint(blueprint);
    if (errors.length > 0) {
      return {
        error: errors.join('\n'),
      };
    }

    // Compile blueprint using existing compiler
    const compiled = compile(blueprint);

    // Return execution plan structure
    return {
      name: compiled.name,
      description: compiled.description || '',
      output: compiled.output || 'markdown',
      stages: compiled.stages,
      agents: compiled.agents,
      contexts: blueprint.context || [],
      actions: blueprint.actions || [],
    };
  } catch (err) {
    return {
      error: err.message,
    };
  }
}

module.exports = {
  extractAgentsFromFlow,
  validateBlueprint,
  generateExecutionPlan,
};
