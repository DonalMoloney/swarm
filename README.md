# Swarm — Claude Code Multi-Agent Plugin

A `/swarm` slash command for Claude Code that orchestrates multi-agent swarms from YAML blueprints, with a live monitoring dashboard.

## Usage

```
/swarm <blueprint> "<task>"
/swarm <blueprint> "<task>" --dry-run
/swarm list
```

**Examples:**
```
/swarm research "compare top AI frameworks 2026"
/swarm code-review "PR #42 changes"
/swarm debug "TypeError in auth middleware"
```

The dashboard auto-starts at **http://localhost:7700** showing a live topology graph, agent status tree, and colour-coded log stream.

## Installation

Copy `skills/swarm.md` into your Claude Code skills directory (e.g. `~/.claude/skills/` or your project's `.claude/skills/`).

No npm install needed — the runtime uses only Node.js built-ins.

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
| `swarms/*.yaml` | Blueprint definitions |
| `runtime/compiler.js` | Parses flow string → execution plan |
| `runtime/dashboard.js` | HTTP + SSE server for live UI |
| `runtime/events.js` | Appends events to `.swarm/events.jsonl` |
| `runtime/simple-yaml.js` | Zero-dependency YAML parser |
| `ui/index.html` | Combined dashboard |
| `ui/graph.js` | SVG topology graph renderer |

## Dashboard

The combined dashboard shows three panels:

- **Topology graph** — nodes and directed edges, colour-coded by status (pending/running/done/error), animates live
- **Agent tree** — per-agent status, elapsed time, token count, output snippet
- **Live logs** — real-time SSE stream, colour-coded by agent

## Dry Run

Preview the execution plan without running any agents:

```
/swarm research "task" --dry-run
```

Prints the compiled stages and stops.

## Roadmap

- `--agents N` flag to scale parallel fan-out dynamically
- Hierarchical topology (supervisor + workers)
- Swarm output history viewer in dashboard
- Packageable as an installable Claude Code plugin
