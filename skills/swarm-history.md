---
name: swarm-history
description: Browse past swarm runs and open their outputs.
---

# /swarm history — Run History Browser

```
/swarm history                  — list all past runs, newest first
/swarm history <blueprint>      — filter by blueprint name
/swarm history open <id>        — print the output of a specific run
```

## Instructions

### list (no arguments or blueprint filter)

1. Run:
```bash
node -e "
const history = require('./runtime/history');
const filter = process.argv[2] || undefined;
const records = history.list(filter);
if (!records.length) {
  console.log('No runs yet. Use /swarm <blueprint> \"<task>\" to run a swarm.');
  process.exit(0);
}
const rows = records.map(r => {
  const d = new Date(r.ts).toISOString().slice(0,16).replace('T',' ');
  const task = r.task.length > 50 ? r.task.slice(0,50) + '...' : r.task;
  return \`  \${r.id.padEnd(24)} \${r.blueprint.padEnd(16)} \${task.padEnd(53)} \${d}\`;
});
console.log('  ' + 'ID'.padEnd(24) + ' ' + 'BLUEPRINT'.padEnd(16) + ' ' + 'TASK'.padEnd(53) + ' DATE');
console.log('  ' + '-'.repeat(100));
rows.forEach(r => console.log(r));
" -- <FILTER_ARG>
```

Replace `<FILTER_ARG>` with the blueprint name if provided, or omit the `-- <FILTER_ARG>` part for unfiltered.

### open

When invoked as `/swarm history open <id>`:

1. Run:
```bash
node -e "
const history = require('./runtime/history');
const record = history.get('<ID>');
if (!record) { console.log('Run not found: <ID>'); process.exit(1); }
const fs = require('fs');
const path = require('path');
const file = path.join('swarms', 'output', record.file);
if (!fs.existsSync(file)) { console.log('Output file not found: ' + file); process.exit(1); }
console.log(fs.readFileSync(file, 'utf8'));
"
```

Replace `<ID>` with the requested id.
