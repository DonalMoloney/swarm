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
ui/preview.html + ui/graph-layout.js  ← dry-run preview incl. Phase-2 group/condition topology
```

### Flow Syntax

The `flow` field in blueprints controls execution topology:

| Syntax | Behaviour |
|--------|-----------|
| `"A, B → C"` | A and B run in parallel, then C |
| `"A → B → C"` | Sequential pipeline |
| `"A, B, C"` | All parallel |
| `"A → B, C → D"` | Mixed: A, then B+C parallel, then D |
| `"G → if cond: X else: Y"` | Run group/agent G, then branch to X or Y based on condition `cond` (Phase 2) |

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
- `GET /graph-layout.js` → `ui/graph-layout.js` (pure execution-graph layout)
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

**Phase 2 — groups & conditions:**

```yaml
flow: "research → if high_confidence: synthesis else: fallback"
groups:
  research:
    agents: [searcher, analyst]
  synthesis:
    agents: [synthesizer]
  fallback:
    agents: [error_handler]
conditions:
  high_confidence:
    type: agent_output      # or: validation
    source: searcher
    check: confidence
    threshold: "> 0.8"
```

When `groups` are present or the flow contains `if`, `compile()` emits an
`execution_graph` (group + condition nodes) instead of linear `stages`.
Phase-1 blueprints are unaffected.

**Phase 2.2 — compound conditions & fallback retry:**

Conditions can be combined with `AND`/`OR`/`NOT` via a `compound` type. Operands
reference other condition names (including other compound conditions, nested
arbitrarily — cycles are rejected at validation time):

```yaml
conditions:
  both_signals:
    type: compound
    operator: AND               # AND | OR (≥2 operands) | NOT (exactly 1)
    operands: [high_confidence, relevant_result]
  ready:
    type: compound
    operator: OR
    operands: [both_signals, not_failed]
    retry_on_fallback: true     # after else branch runs, loop back to pre-branch stage
```

`compile()` adds a `resolved_conditions` map: each condition resolved into a
self-contained tree (compound operands expanded inline). `compileCondition(name,
conditions)` is exported for resolving a single condition recursively.

`retry_on_fallback: true` makes `buildExecutionGraph` emit a `retry` node after
the false branch: `{ type: 'retry', after: <falseId>, retry_target: <preBranchStageId>, condition_id }`.
See `swarms/compound-demo.yaml` for a worked example.

## Roadmap

The full phased plan from demo to end-to-end product lives in [`docs/superpowers/ROADMAP.md`](docs/superpowers/ROADMAP.md). Highlights:

- **Phase 3 — Reliable execution core** (timeouts/retries, structured agent-output contract, cost caps)
- **Phase 4 — Persistence & results** (durable run history, replay)
- **Phase 5 — Headless / CI runner** — trigger swarms on PRs, merges, or schedules without an interactive Claude Code session
- **Phases 6–9** — authoring/library, observability/cost, distribution, safety/governance

**Development workflow:** each phase is built in its own **git worktree** under `../worktrees/` on a `phase-N-<slug>` branch, merged into `main` via PR. See the ROADMAP's "Development Workflow" section.

## Key Constraints

- **Zero npm dependencies** — `runtime/simple-yaml.js` is a hand-rolled minimal YAML parser. Do not introduce `require()` calls for external packages.
- **No package.json** — Node.js built-ins only.
- **`.swarm/` is ephemeral** — cleared at the start of each swarm run. Do not persist state there across runs.
- **`swarms/output/` is gitignored** — runtime-generated results land here.
- The dashboard auto-selects a free port starting from 7700; the actual port is printed as JSON (`{ type: "dashboard_started", port, url }`).
