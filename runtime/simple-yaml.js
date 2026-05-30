/**
 * Minimal YAML parser for the fixed swarm blueprint schema.
 * Avoids any npm dependency.
 */

function parse(text) {
  const result = {};
  const lines = text.split('\n');
  let inAgents = false;
  let currentAgent = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    const content = line.trim();

    if (indent === 0) {
      inAgents = false;
      currentAgent = null;
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) continue;
      const k = content.slice(0, colonIdx).trim();
      const v = content.slice(colonIdx + 1).trim();

      if (k === 'agents') {
        result.agents = {};
        inAgents = true;
      } else if (v) {
        result[k] = v.replace(/^["']|["']$/g, '');
      }
    } else if (inAgents && indent === 2) {
      currentAgent = content.replace(':', '').trim();
      result.agents[currentAgent] = {};
    } else if (inAgents && indent === 4 && currentAgent) {
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) continue;
      const k = content.slice(0, colonIdx).trim();
      const v = content.slice(colonIdx + 1).trim();
      if (k === 'tools') {
        result.agents[currentAgent].tools = v
          .replace(/[\[\]]/g, '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
      } else {
        result.agents[currentAgent][k] = v.replace(/^["']|["']$/g, '');
      }
    }
  }

  return result;
}

module.exports = { parse };
