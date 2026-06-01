# Swarm — Claude Code Multi-Agent Plugin

Orchestrate parallel and sequential AI agent swarms from YAML blueprints, with a live web dashboard. Define who does what and in what order; Swarm handles the rest.

## Quick Start

```
/swarm research "compare top AI frameworks 2026"
/swarm code-review "PR #42 changes"
/swarm debug "TypeError in auth middleware"
```

The dashboard auto-starts at **http://localhost:7700** showing a live topology graph, agent status, and colour-coded log stream.

## Installation

Copy the skills you want into your Claude Code skills directory:

```bash
# Global (available in all projects)
cp skills/*.md ~/.claude/skills/

# Project-local
cp skills/*.md .claude/skills/
```

No npm install needed — runtime uses only Node.js built-ins.

## Commands

| Command | Description |
|---------|-------------|
| `/swarm <blueprint> "<task>"` | Run a blueprint against a task |
| `/swarm <blueprint> "<task>" --dry-run` | Preview execution plan without running |
| `/swarm list` | List available blueprints |
| `/swarm-init` | Interactive wizard to build a blueprint step by step |
| `/swarm-new "<description>"` | Generate a new blueprint from a natural language description |
| `/swarm-preview <blueprint>` | Preview topology, plan, and validation before running |
| `/swarm-history` | Browse past swarm runs and open their outputs |
| `/swarm-decompose "<goal>"` | Break a large goal into an ordered sequence of swarm runs |
| `/swarm-scaffold <blueprint>` | Scaffold a new blueprint or validate an existing one |

## Blueprints

Blueprints live in `swarms/*.yaml`. Three are included:

| Blueprint | Topology | What it does |
|-----------|----------|--------------|
| `research` | parallel → pipeline | Searcher + analyst in parallel, synthesiser combines results |
| `code-review` | parallel → pipeline | Bug, perf, and security reviewers in parallel, summariser consolidates |
| `debug` | pipeline | Reproduce → diagnose → fix → verify in sequence |

### Flow string syntax

| Flow string | Topology |
|-------------|----------|
| `"A, B → C"` | A and B in parallel, then C |
| `"A → B → C"` | Sequential pipeline |
| `"A, B, C"` | All three in parallel |
| `"A → B, C → D"` | A, then B+C parallel, then D |

Both `→` and `->` are accepted.

### Writing your own blueprint

```yaml
name: my-swarm
description: What this swarm does
flow: "agent-a, agent-b → agent-c"
output: markdown   # markdown | json

agents:
  agent-a:
    role: Describe exactly what this agent should do and return.
    tools: [WebSearch, WebFetch]   # optional

  agent-b:
    role: Describe this agent's role.

  agent-c:
    role: You receive inputs from agent-a and agent-b. Combine them into a final report.
```

Required fields: `name`, `flow`, `agents`. Every agent name in `flow` must have an entry in `agents`.

## Architecture

```
/swarm research "task"
       ↓
skills/swarm.md          ← Claude Code skill (entry point)
       ↓ reads
swarms/research.yaml     ← blueprint: agents + flow string
       ↓ compiles
runtime/compiler.js      ← flow string → execution stages
       ↓ starts
runtime/dashboard.js     ← local HTTP+SSE server (port 7700)
       ↓ executes
Agent tool × N           ← Claude Code native agent spawning
       ↓ writes
.swarm/events.jsonl      ← append-only event stream
       ↓ streams to
ui/index.html            ← topology graph + task tree + live logs
```

## File Reference

| Path | Purpose |
|------|---------|
| `skills/swarm.md` | `/swarm` slash command |
| `skills/swarm-init.md` | Interactive blueprint wizard |
| `skills/swarm-new.md` | Generate blueprint from description |
| `skills/swarm-preview.md` | Preview + validate before running |
| `skills/swarm-history.md` | Browse past run outputs |
| `skills/swarm-decompose.md` | Decompose large goals into swarm sequences |
| `skills/swarm-scaffold.md` | Scaffold or validate a blueprint |
| `swarms/*.yaml` | Blueprint definitions |
| `runtime/compiler.js` | Parses flow string → execution plan |
| `runtime/dashboard.js` | HTTP + SSE server for live UI |
| `runtime/events.js` | Appends events to `.swarm/events.jsonl` |
| `runtime/wizard.js` | Step-by-step blueprint creation logic |
| `runtime/preview.js` | Blueprint validation and plan preview |
| `runtime/decomposer.js` | Meta-agent goal decomposition |
| `runtime/history.js` | Past run indexing and retrieval |
| `runtime/checkpoint.js` | Run state checkpointing |
| `runtime/context.js` | Shared execution context |
| `runtime/suggestions.js` | Blueprint suggestions engine |
| `runtime/simple-yaml.js` | Zero-dependency YAML parser |
| `ui/index.html` | Main live dashboard |
| `ui/wizard.html` | Blueprint creation wizard UI |
| `ui/preview.html` | Blueprint preview UI |
| `ui/graph.js` | SVG topology graph renderer |

## Dashboard

The dashboard at `http://localhost:7700` shows three panels:

- **Topology graph** — nodes and directed edges, colour-coded by status (pending / running / done / error), animates live
- **Agent tree** — per-agent status, elapsed time, token count, output snippet
- **Live logs** — real-time SSE stream, colour-coded by agent

## Event Stream Schema

Events are written to `.swarm/events.jsonl` as newline-delimited JSON:

```json
{ "type": "agent_start", "agent": "searcher", "status": "running", "message": "...", "ts": 1234567890 }
{ "type": "agent_done",  "agent": "searcher", "status": "done", "tokens": 1200, "ts": 1234567891 }
```

Types: `swarm_start`, `agent_start`, `agent_log`, `agent_done`, `agent_error`, `swarm_done`.

## Manual Commands

```bash
# Validate a blueprint
node runtime/compiler.js swarms/research.yaml

# Start the dashboard manually
node runtime/dashboard.js 7700

# Log an event
node runtime/events.js agent_start my-agent running "Starting analysis..."
node runtime/events.js clear   # reset event stream

# Run tests
node tests/run-all.js
```

## Constraints

- **Zero npm dependencies** — do not add `require()` calls for external packages
- **No package.json** — Node.js built-ins only
- **`.swarm/` is ephemeral** — cleared at the start of each run
- **`swarms/output/` is gitignored** — runtime-generated results land here

## Roadmap

- `--agents N` flag to scale parallel fan-out dynamically
- Hierarchical topology (supervisor + workers)
- CI/CD integration — trigger swarms on PRs or scheduled jobs without an interactive session
- Swarm output history viewer in dashboard
- Packageable as an installable Claude Code plugin
