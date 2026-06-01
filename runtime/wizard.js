/**
 * WizardSession: Interactive blueprint creation state manager
 *
 * Manages the state of a wizard session for building swarm blueprints step-by-step.
 * All public methods are chainable (return `this`) for fluent API.
 */

class WizardSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.state = {
      name: null,
      description: null,
      agents: {},
      context: null,
      flow: null,
      groups: {},
      conditions: {}
    };
  }

  /**
   * Set the blueprint name
   * @param {string} name - Blueprint name
   * @returns {WizardSession} this for chaining
   */
  setName(name) {
    this.state.name = name;
    return this;
  }

  /**
   * Set the blueprint description
   * @param {string} description - Blueprint description
   * @returns {WizardSession} this for chaining
   */
  setDescription(description) {
    this.state.description = description;
    return this;
  }

  /**
   * Add an agent to the blueprint
   * @param {string} name - Agent identifier
   * @param {string} role - Agent role description
   * @param {string} [prompt] - Agent prompt. If not provided, auto-generated from role
   * @returns {WizardSession} this for chaining
   */
  addAgent(name, role, prompt) {
    const generatedPrompt = prompt || this._generatePrompt(role);
    this.state.agents[name] = {
      role,
      prompt: generatedPrompt
    };
    return this;
  }

  /**
   * Set the execution flow topology
   * @param {string} flow - Flow string (e.g. "A, B → C")
   * @returns {WizardSession} this for chaining
   */
  setFlow(flow) {
    this.state.flow = flow;
    return this;
  }

  /**
   * Add a group of agents.
   * @param {string} name - Group name
   * @param {string[]} agents - Agent names in the group
   * @returns {WizardSession} this for chaining
   */
  addGroup(name, agents) {
    this.state.groups[name] = { agents: Array.isArray(agents) ? agents : [agents] };
    return this;
  }

  /**
   * Add a condition.
   * @param {string} name - Condition name
   * @param {object} def - Condition definition (type + type-specific fields)
   * @returns {WizardSession} this for chaining
   */
  addCondition(name, def) {
    this.state.conditions[name] = { ...def };
    return this;
  }

  /**
   * Set context providers for an agent
   * @param {string} agent - Agent name
   * @param {string[]} providers - Array of provider names (e.g. ['github', 'slack'])
   * @returns {WizardSession} this for chaining
   */
  setContext(agent, providers) {
    if (!this.state.context) {
      this.state.context = {};
    }
    this.state.context[agent] = providers;
    return this;
  }

  /**
   * Generate a prompt from a role description
   * Used when addAgent() is called without an explicit prompt
   * @private
   */
  _generatePrompt(role) {
    return `You are a ${role}. ${role} is your primary responsibility. Execute this role effectively.`;
  }

  /**
   * Generate YAML blueprint string from current state
   * @returns {string} Valid YAML blueprint
   */
  toYAML() {
    const lines = [];

    // name field
    if (this.state.name) {
      lines.push(`name: ${this.state.name}`);
    } else {
      lines.push('name: null');
    }

    // description field
    if (this.state.description) {
      lines.push(`description: ${this._formatYamlValue(this.state.description)}`);
    }

    // flow field (always quoted)
    if (this.state.flow) {
      lines.push(`flow: "${this.state.flow.replace(/"/g, '\\"')}"`);
    }

    // groups section (Phase 2)
    const groupNames = Object.keys(this.state.groups);
    if (groupNames.length > 0) {
      lines.push('');
      lines.push('groups:');
      for (const g of groupNames) {
        lines.push(`  ${g}:`);
        lines.push(`    agents: [${this.state.groups[g].agents.join(', ')}]`);
      }
    }

    // conditions section (Phase 2)
    const condNames = Object.keys(this.state.conditions);
    if (condNames.length > 0) {
      lines.push('');
      lines.push('conditions:');
      for (const c of condNames) {
        const def = this.state.conditions[c];
        lines.push(`  ${c}:`);
        for (const [k, v] of Object.entries(def)) {
          const needsQuote = typeof v === 'string' && /[>:<=]/.test(v);
          lines.push(`    ${k}: ${needsQuote ? `"${v}"` : v}`);
        }
      }
    }

    // agents section
    lines.push('');
    lines.push('agents:');

    const agentNames = Object.keys(this.state.agents);
    if (agentNames.length === 0) {
      lines.push('  {}');
    } else {
      for (const agentName of agentNames) {
        const agent = this.state.agents[agentName];
        lines.push(`  ${agentName}:`);
        lines.push(`    role: ${this._formatYamlValue(agent.role)}`);
        lines.push(`    prompt: ${this._formatYamlValue(agent.prompt)}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Format a value for YAML output
   * Wraps in quotes if it contains special characters
   * @private
   */
  _formatYamlValue(str) {
    if (!str) return '""';
    // If string contains special characters or spaces, wrap in quotes
    if (str.includes('"') || str.includes('→') || str.includes('->')) {
      // Escape internal quotes
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }
}

module.exports = WizardSession;
