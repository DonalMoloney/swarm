# Swarm — Claude Code Multi-Agent Plugin

A Claude Code native swarm orchestration plugin with a live monitoring dashboard.

## What It Is

A `/swarm` slash command that reads YAML blueprint files, compiles them into parallel/pipeline agent topologies using Claude Code's native `Agent` tool, and streams live progress to a local web dashboard.

## Architecture

```
User: /swarm research "compare top AI frameworks"
         ↓
skills/swarm.md        ← Claude Code skill (entry point)
         ↓ reads
swarms/research.yaml   ← blueprint: agents + flow string
         ↓ compiles
runtime/compiler.js    ← flow string → execution plan
         ↓ starts
runtime/dashboard.js   ← local HTTP+SSE server (port 7700)
         ↓ executes
Agent tool × N         ← Claude Code native agent spawning
         ↓ writes
.swarm/events.jsonl    ← append-only event stream
         ↓ streams to
ui/index.html          ← topology graph + task tree + live logs
```

## Topologies

| Flow string          | Topology                       |
|----------------------|--------------------------------|
| `"A, B → C"`         | A and B in parallel, then C    |
| `"A → B → C"`        | Sequential pipeline            |
| `"A, B, C"`          | All three in parallel          |
| `"A → B, C → D"`     | A, then B+C parallel, then D   |

## Files

| Path | Purpose |
|------|---------|
| `skills/swarm.md` | `/swarm` slash command — reads blueprint, runs topology |
| `swarms/*.yaml` | Blueprint definitions |
| `runtime/compiler.js` | Parses flow string → execution stages |
| `runtime/dashboard.js` | HTTP + SSE server for live UI |
| `runtime/events.js` | Appends events to `.swarm/events.jsonl` |
| `ui/index.html` | Combined dashboard (graph + tree + logs) |
| `.swarm/events.jsonl` | Runtime event stream (ephemeral) |

## Blueprints Included

- `research.yaml` — parallel web search + analysis → synthesiser
- `code-review.yaml` — parallel bug/perf/security review → summary
- `debug.yaml` — sequential reproduce → diagnose → fix → verify

## Usage

```
/swarm research "compare top AI frameworks 2026"
/swarm code-review "PR #42 changes"
/swarm debug "TypeError in auth middleware"
/swarm research "task" --dry-run    ← prints plan without running
```

## Alternatives Considered

- **Option A (Pure Skills):** No fixed algorithm, Claude interprets skill files directly. Simpler but non-deterministic orchestration. Can be layered on top later.
- **Option C (YAML + runtime):** Human-readable config with a standalone runner. More portable but more moving parts. YAML blueprints here are essentially Option C's config format — difference is the orchestrator is Claude Code itself, not a separate process.

## Next Steps

- [ ] Add `--agents N` override to scale parallel fan-out dynamically
- [ ] Add `hierarchical` topology (supervisor + workers)
- [ ] Package as installable Claude Code plugin
- [ ] Add swarm output history viewer to dashboard
