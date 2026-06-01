# Swarm Phase 4: Persistence & Results

**Date:** 2026-06-01
**Branch:** `phase-4-persistence-results`
**Focus:** Make each run's full event stream durable and let the dashboard replay any past run.
**Goal:** Turn ephemeral runs into a revisitable history — the "open a past run and watch it again" capability the dashboard's event-driven UI already makes possible.

---

## Overview

Persistence is **half-built**:

- `runtime/history.js` keeps a durable run index at `swarms/output/index.json`
  (`{id, blueprint, task, file, ts}`, atomic writes). Phase 3's runner already
  calls `history.append`.
- The dashboard serves `/history` (the index) and `/output/<file>` (the run's
  markdown), and the UI has History/Decompose tabs.

The gaps that block "durable history + replay":

1. **Past runs are not replayable.** The dashboard replays the *live*
   `.swarm/events.jsonl`, but `.swarm/` is wiped at the start of every run
   (`swarm.md` step 3). A finished run's event stream is lost, and the index
   stores only summary metadata — not the events.
2. **Thin records.** Index entries lack `status`, `tokens`, `cost_usd`,
   `agentCount`, even though Phase 3's `swarm_done` now carries totals.

Phase 4 closes both: archive each run's events durably, enrich the index, and
add dashboard + UI replay that feeds archived events through the **existing**
event-driven render path (the same mechanism the mock uses).

### Non-Goals (deferred)

- Fixing checkpoint-resume durability (`checkpoint.js` writes to the ephemeral
  `.swarm/checkpoints/`, which the run-start clear wipes) — a separate concern.
- CI triggers / headless scheduling (Phase 5).
- Cost dashboards/budgets visualization (Phase 7).

---

## Decisions (locked)

- **Archive location:** `swarms/output/<id>.events.jsonl` — alongside the
  existing output `.md` and `index.json`.
- **Replay UX:** clicking a row in the **History** tab loads that run's archived
  events and **animates them in the Live view** (topology + log), reusing the
  existing `processEvent` render path.

---

## Architecture

| Unit | File | Responsibility | Depends on |
|------|------|----------------|------------|
| Archive | `runtime/archive.js` (new) | `archiveRun(run)` writes `<id>.events.jsonl` + enriched index record; `loadRunEvents(id)` | `history`, `fs`, `path` |
| Runner integration | `runtime/runner.js` (modify) | Collect emitted events; enrich `swarm_start` with `stages`+`agents`; call `archiveRun` on completion | `archive`, `compiler` |
| Dashboard route | `runtime/dashboard.js` (modify) | `GET /run/<id>/events` → archived events as JSON (path-safe) | `archive` |
| UI replay | `ui/index.html` (modify) | History row click → `replayRun(id)`: switch to Live, reset, replay archived events on a fixed cadence | existing render fns |
| Ignore rule | `.gitignore` (modify) | Ignore `swarms/output/*.jsonl` (archived events are runtime artifacts) | — |
| Tests | `runtime/archive.test.js` (new), `runtime/runner.test.js` (extend) | unit + integration | `node:test` |

### `runtime/archive.js`

```js
// archiveRun({ id, blueprint, task, events, status, totalTokens,
//              totalCostUsd, agentCount, outputFile, ts }) -> eventsPath
//   - writes events (one JSON per line) to swarms/output/<id>.events.jsonl (atomic)
//   - appends an enriched record to the index via history.append:
//     { id, blueprint, task, file, events_file, status, tokens, cost_usd,
//       agentCount, ts }
// loadRunEvents(id) -> [event, …]   (path-safe; [] if absent)
```

Output dir resolves from `process.env.SWARM_OUTPUT_DIR || <cwd>/swarms/output`
(test seam, mirroring `history.js`'s `SWARM_INDEX_PATH`).

### Runner integration

`run()` already emits events through `opts.emit`. Phase 4 wraps that to also
**collect** them, enriches the `swarm_start` event with `stages: plan.stages`
and `agents: Object.keys(blueprint.agents)` (so replay can draw the topology and
register agents), and on completion calls `archiveRun(...)` with the collected
events, the Phase 3 totals, status, and `agentCount`. The live
`.swarm/events.jsonl` path is unchanged.

### Dashboard route

`GET /run/<id>/events` → `loadRunEvents(path.basename(id))` as a JSON array.
`path.basename` prevents traversal; the file lives under `swarms/output/`.

### UI replay

- New `replayRun(id)`: `showTab('live')` → `resetView()` → `fetch('/run/'+id+'/events')`
  → play events on a fixed cadence (~250 ms/event) through `processEvent`.
- New `resetView()`: reset `state`, clear the log stream, restore the empty
  agents panel, reset the agent color map.
- History row click switches from `openRun` (show markdown) to `replayRun(r.id)`.
- Replay closes the live `EventSource` to avoid interleaving; a reload returns to
  live mode.

---

## Event Schema (unchanged shape, richer index)

No new event types. The index record gains fields (all additive, backward
compatible — old records without them still render):

```json
{ "id": "research-20260601-…", "blueprint": "research", "task": "…",
  "file": "research-….md", "events_file": "research-….events.jsonl",
  "status": "done", "tokens": 14980, "cost_usd": 0.041, "agentCount": 3,
  "ts": 0 }
```

---

## Testing (zero-dep `node:test`)

- **`archive.test.js`** — `archiveRun` writes the events file (line count matches)
  and appends an enriched record (via `SWARM_OUTPUT_DIR`/`SWARM_INDEX_PATH` temp
  seam + `chdir`); `loadRunEvents` round-trips; missing run → `[]`; traversal id
  (`../x`) is contained by `path.basename`.
- **`runner.test.js` (extend)** — after `run()` on the fake-claude stub, assert
  `swarms/output/<id>.events.jsonl` exists, its events include `swarm_start`
  (with `stages`+`agents`) and `swarm_done`, and the index record carries
  `status`/`tokens`/`agentCount`.
- **Manual verification** (no DOM/server test harness in repo): start the
  dashboard, `curl /run/<id>/events`, and click a History row to confirm the
  Live view replays. Documented as explicit steps in the plan.

---

## Success Criteria

- [ ] `runtime/archive.js` archives events + enriches the index; `loadRunEvents` reads them back.
- [ ] `.gitignore` ignores `swarms/output/*.jsonl`.
- [ ] The runner archives every run; `swarm_start` carries `stages`+`agents`.
- [ ] `GET /run/<id>/events` returns the archived stream (path-safe).
- [ ] Clicking a History row replays the run in the Live view (topology + log animate).
- [ ] `node --test` passes (existing 37 + new archive/runner tests).
- [ ] Backward compatible: `/history`, `/output/<file>`, and old index records still work.

---

## Design Philosophy

- **Keep what the UI already assumes exists.** The dashboard was built to render
  an event stream; Phase 4 simply *persists* that stream and feeds it back.
  Replay reuses `processEvent` verbatim — no parallel renderer.
- **Additive & backward compatible.** New fields, new files, new route; nothing
  existing changes shape.
- **Zero-dep, test-seam everywhere.** `SWARM_OUTPUT_DIR` mirrors the existing
  `SWARM_INDEX_PATH` so tests never touch the real output dir.
