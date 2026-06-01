#!/usr/bin/env node
/**
 * Blueprint library — catalogs swarm blueprints in swarms/ with metadata.
 *
 * Exposes:
 *   list()          → [{ name, description, flow, version, file, agents }]
 *   get(name)       → full parsed blueprint (or null)
 *   validate(name)  → { ok, errors }   (runs the compiler)
 */

const fs = require('fs');
const path = require('path');

const yaml = require('./simple-yaml.js');
const { compile, resolveExtends } = require('./compiler.js');

const SWARMS_DIR = path.join(process.cwd(), 'swarms');

function isValidName(name) {
  return /^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/.test(name);
}

function blueprintPath(name) {
  return path.join(SWARMS_DIR, `${name}.yaml`);
}

function parseFile(file) {
  return yaml.parse(fs.readFileSync(file, 'utf8'));
}

function loadBlueprint(name) {
  if (!isValidName(name)) {
    throw new Error(`Invalid blueprint name "${name}"`);
  }
  return parseFile(blueprintPath(name));
}

function list() {
  let files;
  try {
    files = fs.readdirSync(SWARMS_DIR);
  } catch {
    return [];
  }

  return files
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      const name = f.replace(/\.yaml$/, '');
      try {
        const bp = parseFile(path.join(SWARMS_DIR, f));
        return {
          name: bp.name || name,
          description: bp.description || '',
          flow: bp.flow || '',
          version: bp.version || '0.0.0',
          file: f,
          agents: bp.agents ? Object.keys(bp.agents) : [],
        };
      } catch (e) {
        return { name, description: '', flow: '', version: '0.0.0', file: f, agents: [], error: e.message };
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function get(name) {
  if (!isValidName(name)) return null;
  const file = blueprintPath(name);
  if (!fs.existsSync(file)) return null;
  return parseFile(file);
}

function validate(name) {
  try {
    let bp = get(name);
    if (!bp) return { ok: false, errors: [`Blueprint "${name}" not found`] };
    bp = resolveExtends(bp, loadBlueprint);
    compile(bp);
    return { ok: true, errors: [] };
  } catch (e) {
    return { ok: false, errors: [e.message] };
  }
}

module.exports = { list, get, validate };

if (require.main === module) {
  const cmd = process.argv[2] || 'list';
  if (cmd === 'list') {
    console.log(JSON.stringify(list(), null, 2));
  } else if (cmd === 'get') {
    console.log(JSON.stringify(get(process.argv[3]), null, 2));
  } else if (cmd === 'validate') {
    console.log(JSON.stringify(validate(process.argv[3]), null, 2));
  } else {
    console.error('Usage: node library.js [list|get <name>|validate <name>]');
    process.exit(1);
  }
}
