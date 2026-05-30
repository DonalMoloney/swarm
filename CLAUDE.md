# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Swarm is a Claude Code multi-agent plugin that orchestrates parallel and sequential agent swarms from YAML blueprints, with a live web dashboard. The `/swarm` slash command reads a blueprint, compiles it into execution stages, spawns Claude Code agents, and streams real-time progress to a local dashboard at `http://localhost:7700`.

## Commands

No build step. No npm. Pure Node.js with zero dependencies.

**Validate a blueprint:**
```bash
node runtime/compiler.js swarms/research.yaml
```

**Start the dashboard manually:**
```bash
node runtime/dashboard.js 7700
```

**Log an event:**
```bash
node runtime/events.js agent_start my-agent running "Starting analysis..."
node runtime/events.js clear   # reset event stream
```

**Install the skill:**
```bash
cp skills/swarm.md ~/.claude/skills/          # global
cp skills/swarm.md .claude/skills/            # project-level
```

**Run a swarm:**
```
/swarm research "compare AI frameworks"
/swarm code-review "PR #42"
/swarm debug "TypeError in auth middleware"
/swarm research "task" --dry-run              # print plan without executing
/swarm list                                    # list available blueprints
```

## Architecture

```
skills/swarm.md          ← Claude Code slash command (entry point)
       ↓ reads
swarms/*.yaml            ← blueprint definitions (flow + agent prompts)
       ↓ compiled by
runtime/compiler.js      ← flow string parser ("A, B → C" → execution stages)
       ↓ events logged to
runtime/events.js        ← appends JSON to .swarm/events.jsonl
       ↓ served by
runtime/dashboard.js     ← HTTP+SSE server (port 7700, auto-finds free port)
       ↓ rendered in
ui/index.html + ui/graph.js  ← topology SVG + live log dashboard
```

### Flow Syntax

The `flow` field in blueprints controls execution topology:

| Syntax | Behaviour |
|--------|-----------|
| `"A, B → C"` | A and B run in parallel, then C |
| `"A → B → C"` | Sequential pipeline |
| `"A, B, C"` | All parallel |
| `"A → B, C → D"` | Mixed: A, then B+C parallel, then D |

`→` and `->` are both accepted. Comma = parallel within a stage. Arrow = next stage.

### Event Stream Schema

Events are appended to `.swarm/events.jsonl` as newline-delimited JSON:

```json
{ "type": "agent_start", "agent": "searcher", "status": "running", "message": "...", "ts": 1234567890 }
{ "type": "agent_done",  "agent": "searcher", "status": "done",    "tokens": 1200, "ts": 1234567891 }
```

Types: `swarm_start`, `agent_start`, `agent_log`, `agent_done`, `agent_error`, `swarm_done`.

### Dashboard Routes

- `GET /` → `ui/index.html`
- `GET /graph.js` → `ui/graph.js`
- `GET /state` → all events as JSON array
- `GET /events` → SSE stream of live events
- `POST /event` → submit an event programmatically

### Blueprint Structure

```yaml
name: research
description: "Web research + synthesis"
flow: "searcher, analyst → synthesiser"
agents:
  searcher:
    prompt: "..."
  analyst:
    prompt: "..."
  synthesiser:
    prompt: "..."
```

Required fields: `name`, `flow`, `agents`. Every agent name in `flow` must have an entry in `agents`.

## Future Work

- **CI/CD integration** — trigger swarms automatically on PRs, merges, or scheduled jobs (GitHub Actions, GitLab CI, etc.) without requiring a Claude Code interactive session

## Key Constraints

- **Zero npm dependencies** — `runtime/simple-yaml.js` is a hand-rolled minimal YAML parser. Do not introduce `require()` calls for external packages.
- **No package.json** — Node.js built-ins only.
- **`.swarm/` is ephemeral** — cleared at the start of each swarm run. Do not persist state there across runs.
- **`swarms/output/` is gitignored** — runtime-generated results land here.
- The dashboard auto-selects a free port starting from 7700; the actual port is printed as JSON (`{ type: "dashboard_started", port, url }`).
