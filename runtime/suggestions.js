#!/usr/bin/env node
/**
 * Suggestion module for blueprint generation.
 * Parses user ideas and generates complete YAML blueprints.
 */

/**
 * Keyword patterns for agent detection.
 * Maps keywords (case-insensitive) to agent names.
 * Order matters: more specific patterns should come first.
 */
const AGENT_KEYWORDS = [
  ['bug-hunter', /\b(bugs?|debug|error|fix|correction)\b/i],
  ['perf-reviewer', /\b(performance|perf|optimize|latency|speed|benchmark)\b/i],
  ['security-reviewer', /\b(security|vulnerabilities?|audit|exploit|breach)\b/i],
  ['analyst', /\b(analyz[a-z]*|review|assess|evaluate|examine|inspect)\b/i],
  ['searcher', /\b(search|research|discover|explore|investigate)\b/i],
];

/**
 * Role descriptions for each agent type.
 */
const AGENT_ROLES = {
  'bug-hunter': 'Review the provided code or task for correctness bugs, logic errors, and edge cases. Be specific — include file paths and line references where possible. Report only high-confidence issues.',
  'perf-reviewer': 'Review the provided code or task for performance issues — unnecessary work, inefficient algorithms, missing caching. Be specific and concrete.',
  'security-reviewer': 'Review the provided code or task for security vulnerabilities. Reference OWASP where relevant.',
  'searcher': 'Search the web for the most relevant and recent sources on the given task. Return a structured list of findings with URLs and key points.',
  'analyst': 'Analyze the task from first principles. Break it down into key dimensions, identify trade-offs, and surface non-obvious insights.',
  'reviewer': 'Review the provided code or task and provide comprehensive feedback on quality, correctness, and potential improvements.',
};

/**
 * parseIdea(idea) - Extract intent from user description.
 *
 * @param {string} idea - User's task description
 * @returns {object} - { agents: [...], roles: {...}, idea }
 */
function parseIdea(idea) {
  const detected = new Set();

  // Check each keyword pattern
  for (const [agentName, pattern] of AGENT_KEYWORDS) {
    if (pattern.test(idea)) {
      detected.add(agentName);
    }
  }

  // If no agents detected, use default
  const agents = detected.size > 0 ? Array.from(detected) : ['reviewer'];

  // Build roles object
  const roles = {};
  agents.forEach(agent => {
    roles[agent] = AGENT_ROLES[agent];
  });

  return {
    agents,
    roles,
    idea,
  };
}

/**
 * generateBlueprint(idea) - Generate complete YAML blueprint.
 *
 * @param {string} idea - User's task description
 * @returns {string} - Valid YAML blueprint string
 */
function generateBlueprint(idea) {
  const parsed = parseIdea(idea);
  const { agents, roles } = parsed;

  // Generate blueprint name (slugify the idea)
  const name = generateBlueprintName(idea);

  // Generate blueprint description
  const description = `Swarm blueprint auto-generated for: ${idea}`;

  // Build flow topology
  const flow = buildFlow(agents);

  // Add synthesiser agent if multiple agents
  if (agents.length > 1) {
    roles['synthesiser'] = 'Consolidate outputs from parallel agents into a comprehensive result. Present findings clearly and remove any duplicates.';
  }

  // Build YAML string
  let yaml = `name: ${name}\n`;
  yaml += `description: ${description}\n`;
  yaml += `flow: "${flow}"\n`;
  yaml += `output: markdown\n\n`;
  yaml += `agents:\n`;

  for (const agent of agents) {
    yaml += `  ${agent}:\n`;
    yaml += `    role: ${roles[agent]}\n`;
  }

  // Add synthesiser agent if needed
  if (agents.length > 1) {
    yaml += `  synthesiser:\n`;
    yaml += `    role: ${roles['synthesiser']}\n`;
  }

  return yaml;
}

/**
 * generateBlueprintName(idea) - Create a slug from the idea.
 *
 * @param {string} idea - User's task description
 * @returns {string} - Slugified name
 */
function generateBlueprintName(idea) {
  return idea
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('-') || 'swarm';
}

/**
 * buildFlow(agents) - Generate flow topology.
 *
 * Single agent: "agent"
 * Multiple agents: "agent1, agent2 → synthesiser"
 *
 * @param {array} agents - List of agent names
 * @returns {string} - Flow string
 */
function buildFlow(agents) {
  if (agents.length === 1) {
    return agents[0];
  }
  return `${agents.join(', ')} → synthesiser`;
}

module.exports = {
  parseIdea,
  generateBlueprint,
};
