---
name: swarm-scaffold
description: Scaffold a new swarm blueprint or validate an existing one.
---

# /swarm scaffold — Blueprint Authoring Tools

Two sub-commands:

```
/swarm scaffold <name>    — generate a new blueprint at swarms/<name>.yaml
/swarm validate <name>    — lint and validate an existing blueprint
```

## Instructions

### scaffold

When invoked as `/swarm scaffold <name>`:

1. Ask: "How many agents? (2–6)"
2. Ask: "What topology? (a) all parallel  (b) sequential pipeline  (c) parallel then one summariser"
3. Generate `swarms/<name>.yaml` based on the answers:

**2 agents, topology (a) — parallel:**
```yaml
name: <name>
description: "<name> swarm"
flow: "agent-1, agent-2"
output: markdown

agents:
  agent-1:
    role: Describe what agent-1 should do and return.

  agent-2:
    role: Describe what agent-2 should do and return.
```

**3 agents, topology (c) — parallel then summariser:**
```yaml
name: <name>
description: "<name> swarm"
flow: "agent-1, agent-2 → summariser"
output: markdown

agents:
  agent-1:
    role: Describe what agent-1 should do and return.

  agent-2:
    role: Describe what agent-2 should do and return.

  summariser:
    role: You receive inputs from agent-1 and agent-2. Combine them into a final report.
```

**N agents, topology (b) — sequential pipeline:**
Generate `flow: "agent-1 → agent-2 → ... → agent-N"` with each agent referencing the previous.

4. Write the file. Print:
```
✓ Created swarms/<name>.yaml
  Next: edit the agent roles, then run /swarm validate <name>
```

### validate

When invoked as `/swarm validate <name>`:

1. Run:
```bash
node runtime/compiler.js swarms/<name>.yaml
```

2. If it succeeds, print:
```
✓ Blueprint valid — N agents, N stages
```

3. If it fails, translate compiler errors into human-readable messages:

| Compiler error | Human message |
|---------------|---------------|
| `Flow references undefined agents: X` | `✗ Agent "X" appears in flow but is not defined under agents:` |
| `Missing required field: flow` | `✗ Blueprint is missing a flow: field` |
| `Missing required field: agents` | `✗ Blueprint is missing an agents: section` |
| Any other error | Print the raw error prefixed with `✗` |

Print all errors, then:
```
  Fix the above, then re-run /swarm validate <name>
```
