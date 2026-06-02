# Swarm — Claude Code Multi-Agent Plugin

Orchestrate parallel and sequential AI agent swarms from YAML blueprints, with a live web dashboard. Define who does what and in what order; Swarm handles the rest.

## Features

- **Topology graph** — topology diagram renders live as agents run; nodes colour-code by status (pending / running / done / error)
- **Live dashboard** — SSE-powered log stream, per-agent token counts, and elapsed time at `http://localhost:7700`
- **Blueprint library** — ready-made blueprints for research, code review, security audit, content creation, and incident response
- **Cost tracking** — per-agent token accounting, per-run USD budget cap, and a Cost tab in the dashboard
- **Conditional branching** — group agents, evaluate agent output, and route execution down true/false branches (Phase 2)
- **Compound conditions** — combine gates with `AND` / `OR` / `NOT` and retry on fallback (Phase 2.2)
- **Checkpoint & resume** — interrupted runs can be continued from the last completed stage
- **Run history** — every run is archived; replay any past run in the dashboard History tab
- **Zero dependencies** — pure Node.js 18+, no npm, no package.json

## Quick Start

```
/swarm research "compare top AI frameworks 2026"
/swarm code-review "PR #42 changes"
/swarm debug "TypeError in auth middleware"
```

The dashboard auto-starts at **http://localhost:7700** showing a live topology graph, agent status, and colour-coded log stream.

## Installation

Swarm is a Claude Code **plugin** (manifest at `.claude-plugin/plugin.json`). Install it the same way as any plugin — add the repo through a plugin marketplace, or clone it into a directory Claude Code discovers plugins from. The seven `/swarm*` slash commands in `commands/` are auto-discovered on load.

No npm install needed — the runtime uses only Node.js built-ins (Node 18+).

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

Blueprints live in `swarms/*.yaml`. Included examples:

| Blueprint | Topology | What it does |
|-----------|----------|--------------|
| `research` | parallel → pipeline | Searcher + analyst in parallel, synthesiser combines results |
| `code-review` | parallel → pipeline | Bug, perf, and security reviewers in parallel, summariser consolidates |
| `debug` | pipeline | Reproduce → diagnose → fix → verify in sequence |
| `security-audit` | parallel → pipeline | Vulnerability scan + dependency check, then remediation advice |
| `content-pipeline` | 4-stage pipeline | Research → outline → write → edit |
| `incident-response` | parallel → conditional | Log + metric analysis, then escalate or resolve based on severity |

### Flow syntax

| Flow string | Topology |
|-------------|----------|
| `"A, B → C"` | A and B in parallel, then C |
| `"A → B → C"` | Sequential pipeline |
| `"A, B, C"` | All three in parallel |
| `"A → B, C → D"` | A, then B+C parallel, then D |
| `"G → if cond: X else: Y"` | Run group G, branch on condition (Phase 2) |

Both `→` and `->` are accepted. Comma = parallel within a stage. Arrow = next stage.

### Blueprint reference

```yaml
name: my-swarm               # required — alphanumeric + hyphens
version: "1.0.0"             # optional
description: What this does  # required
flow: "agent-a, agent-b → agent-c"  # required — topology string
output: markdown             # optional — markdown | json

limits:                      # optional — per-run resource caps
  agent_timeout: 300         # seconds per agent attempt
  agent_retries: 1           # retries after timeout or error
  max_cost_usd: 1.00         # USD budget; run aborts gracefully if exceeded
  max_tokens: 200000         # total token budget

agents:
  agent-a:
    role: Describe exactly what this agent does.
    tools: [WebSearch, WebFetch]   # optional Claude tool allowlist
  agent-b:
    role: Describe this agent's role.
  agent-c:
    role: Combine inputs from agent-a and agent-b into a final report.
```

Required fields: `name`, `flow`, `agents`. Every agent named in `flow` must have an entry in `agents`.

### Phase 2 — groups and conditions

For conditional branching, add `groups` and `conditions`:

```yaml
flow: "research → if quality_ok: synthesis else: fallback"

groups:
  research:
    agents: [searcher, analyst]
  synthesis:
    agents: [synthesizer]
  fallback:
    agents: [error_handler]

conditions:
  quality_ok:
    type: agent_output
    source: searcher
    check: confidence
    threshold: "> 0.8"
```

See [`docs/swarm-authoring.md`](docs/swarm-authoring.md) for the full blueprint YAML reference including compound conditions (`AND` / `OR` / `NOT`).

## Architecture

```
/swarm research "task"
       ↓
commands/swarm.md        ← Claude Code slash command (entry point)
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
| `commands/swarm.md` | `/swarm` slash command |
| `commands/swarm-init.md` | Interactive blueprint wizard |
| `commands/swarm-new.md` | Generate blueprint from description |
| `commands/swarm-preview.md` | Preview + validate before running |
| `commands/swarm-history.md` | Browse past run outputs |
| `commands/swarm-decompose.md` | Decompose large goals into swarm sequences |
| `commands/swarm-scaffold.md` | Scaffold or validate a blueprint |
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

The dashboard at `http://localhost:7700` shows four tabs:

- **Live** — topology graph (nodes + directed edges, colour-coded by status), agent tree (status, elapsed time, token count), and real-time SSE log stream colour-coded by agent
- **History** — past runs listed by blueprint and timestamp; click any run to replay its event stream in the Live view
- **Library** — browse and load installed blueprints without leaving the browser
- **Cost** — per-agent token and USD cost breakdown for the current run

### Dashboard routes

| Route | Description |
|-------|-------------|
| `GET /` | Main dashboard UI |
| `GET /state` | All events for the current run as a JSON array |
| `GET /events` | SSE stream of live events |
| `POST /event` | Submit an event programmatically |
| `GET /run/<id>/events` | Replay a past run's event stream |
| `GET /graph.js` | SVG topology graph renderer |
| `GET /graph-layout.js` | Execution-graph layout engine |

## Event Stream Schema

Events are written to `.swarm/events.jsonl` as newline-delimited JSON:

```json
{ "type": "agent_start", "agent": "searcher", "status": "running", "message": "...", "ts": 1234567890 }
{ "type": "agent_done",  "agent": "searcher", "status": "done", "tokens": 1200, "ts": 1234567891 }
```

Types: `swarm_start`, `agent_start`, `agent_log`, `agent_done`, `agent_error`, `swarm_done`.

## CLI Reference

```bash
# Validate a blueprint (shows compiled execution plan)
node runtime/compiler.js swarms/<blueprint>.yaml

# Start the dashboard manually on port 7700
node runtime/dashboard.js 7700

# Log an event to the stream
node runtime/events.js agent_start my-agent running "Starting analysis..."
node runtime/events.js clear   # reset event stream

# Run a blueprint headlessly (CI/CD mode)
node runtime/runner.js swarms/<blueprint>.yaml "<task>" \
  [--max-cost <usd>] \
  [--timeout <seconds>] \
  [--model <model-name>]

# Run tests
node --test runtime/runner.test.js runtime/contract.test.js
```

### Runner flags

| Flag | Description |
|------|-------------|
| `--max-cost <usd>` | Override the blueprint's `limits.max_cost_usd` |
| `--timeout <seconds>` | Override `limits.agent_timeout` per agent |
| `--model <name>` | Claude model to use (default: claude-sonnet) |

## Constraints

- **Zero npm dependencies** — do not add `require()` calls for external packages
- **No package.json** — Node.js built-ins only
- **`.swarm/` is ephemeral** — cleared at the start of each run
- **`swarms/output/` is gitignored** — runtime-generated results land here

## Contributing

Contributions are welcome. The project has a strict zero-dependency rule (no npm, no package.json).

```bash
# Clone and enter the repo
git clone https://github.com/donalmoloney/swarm
cd swarm

# Validate a blueprint to confirm the runtime is working
node runtime/compiler.js swarms/research.yaml

# Run the test suite
node --test runtime/runner.test.js runtime/contract.test.js
```

Each phase of development is built in its own git worktree on a `phase-N-<slug>` branch, merged into `main` via PR. See [`docs/superpowers/ROADMAP.md`](docs/superpowers/ROADMAP.md) for the full roadmap and development workflow.

### Key constraints

- **Zero npm dependencies** — do not add `require()` calls for external packages
- **No package.json** — Node.js built-ins only
- **`.swarm/` is ephemeral** — cleared at the start of each run; do not rely on it across runs
- **`swarms/output/` is gitignored** — runtime-generated results land here
- **Backward compatible** — every change must keep existing blueprints working unchanged
