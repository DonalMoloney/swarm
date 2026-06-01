/**
 * Minimal YAML parser for the fixed swarm blueprint schema.
 * Avoids any npm dependency.
 *
 * Understands three nested "section" blocks — agents, groups, conditions —
 * each shaped as:
 *   <section>:
 *     <key>:
 *       <field>: <value>
 * plus inline arrays:  agents: [a, b, c]
 */

function parseInlineArray(v) {
  return v.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
}

function stripQuotes(v) {
  return v.replace(/^["']|["']$/g, '');
}

const SECTION_KEYS = ['agents', 'groups', 'conditions'];

function parse(text) {
  const result = {};
  const lines = text.split('\n');
  let section = null;     // one of SECTION_KEYS, or null
  let currentKey = null;  // current agent / group / condition name

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    const content = line.trim();

    if (indent === 0) {
      section = null;
      currentKey = null;
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) continue;
      const k = content.slice(0, colonIdx).trim();
      const v = content.slice(colonIdx + 1).trim();

      if (SECTION_KEYS.includes(k) && !v) {
        result[k] = {};
        section = k;
      } else if (v) {
        result[k] = v.startsWith('[') ? parseInlineArray(v) : stripQuotes(v);
      }
    } else if (section && indent === 2) {
      currentKey = content.replace(/:$/, '').trim();
      result[section][currentKey] = {};
    } else if (section && indent === 4 && currentKey) {
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) continue;
      const k = content.slice(0, colonIdx).trim();
      const v = content.slice(colonIdx + 1).trim();
      if ((section === 'agents' && k === 'tools') || v.startsWith('[')) {
        result[section][currentKey][k] = parseInlineArray(v);
      } else {
        result[section][currentKey][k] = stripQuotes(v);
      }
    }
  }

  return result;
}

module.exports = { parse };
