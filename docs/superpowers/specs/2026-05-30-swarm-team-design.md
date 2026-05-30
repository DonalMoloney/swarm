# Swarm — Team & Intelligence Upgrade Design

**Date:** 2026-05-30
**Status:** Approved

## Overview

Three-phase upgrade to Swarm that transforms it from a single-user local tool into a team-oriented, context-aware, action-capable multi-agent orchestrator. All changes are backward-compatible — existing blueprints and skills continue to work unchanged.

---

## Architecture

### New files

| Path | Phase | Purpose |
|------|-------|---------|
| `runtime/history.js` | 1 | Read/write `swarms/output/index.json` run index |
| `runtime/context.js` | 2 | Gather repo context from providers, return formatted string |
| `runtime/decomposer.js` | 3 | Meta-agent task decomposition + chained swarm execution |
| `skills/swarm-scaffold.md` | 1 | `/swarm scaffold` and `/swarm validate` commands |
| `skills/swarm-history.md` | 1 | `/swarm history` command |
| `skills/swarm-decompose.md` | 3 | `/swarm decompose` command |
| `swarms/team/` | 1 | Shared team blueprints (git-tracked directory) |
| `swarms/output/index.json` | 1 | Append-only run history index |

### Modified files

| Path | Change |
|------|--------|
| `skills/swarm.md` | Add `--context` flag handling; call `history.js` on completion; show action permission gate |
| `ui/index.html` | Add History tab reading `swarms/output/index.json` |
| `runtime/compiler.js` | Validate `context` and `actions` fields; resolve `extends` inheritance |

### New blueprint fields (all optional)

```yaml
extends: team/code-review       # inherit agents + flow, override selectively

context:                         # Phase 2: auto-injected before agent prompts
  - git-diff
  - file-tree
  - stack-detect
  - recent-commits

actions:                         # Phase 3: unlocks agent capabilities
  - edit-files
  - run-tests
  - open-pr
```

---

## Phase 1 — Team Foundations

### Blueprint sharing

- `swarms/team/` directory committed to the repo; all teammates get blueprints via `git pull`
- `extends` field: child blueprint inherits parent's `flow` and `agents`, can override individual agents
- `/swarm list` groups output into **Local blueprints** and **Team blueprints**

**Inheritance resolution** (handled in `compiler.js`):
1. Load parent blueprint from `swarms/<extends>.yaml`
2. Deep-merge child `agents` over parent `agents`
3. Use child `flow` if present, else parent `flow`

### Output history

- `swarms/output/` becomes git-tracked (remove from `.gitignore` if present)
- Each run appends one record to `swarms/output/index.json`:

```json
{"id":"20260530-143201","blueprint":"code-review","task":"PR #42 changes","file":"code-review-20260530-143201.md","ts":1748610721}
```

- Output filenames: `<blueprint>-<YYYYMMDD-HHmmss>.md`

### `/swarm history` command (`skills/swarm-history.md`)

```
/swarm history                        — list all runs, newest first
/swarm history <blueprint>            — filter by blueprint name
/swarm history open <id>              — print output of a specific run
```

Renders a table: ID | Blueprint | Task | Date | File

### Authoring UX (`skills/swarm-scaffold.md`)

**`/swarm scaffold <name>`**
- Asks: number of agents, topology (parallel / sequential / mixed)
- Writes `swarms/<name>.yaml` with placeholder agents and commented flow guide
- Prints next steps: edit roles, then run `/swarm validate <name>`

**`/swarm validate <name>`**
- Runs `node runtime/compiler.js swarms/<name>.yaml`
- Translates compiler errors into human-readable messages:
  - Agent in flow but not defined in `agents`
  - Agent defined but not referenced in flow
  - Invalid flow syntax
  - Unknown `extends` target
- Exits with `✓ Blueprint valid — N agents, N stages` on success

### Dashboard history tab

- New **History** tab in `ui/index.html` alongside Topology and Logs
- Loads `swarms/output/index.json` on page open
- Renders clickable run list; clicking a run loads its markdown in a side panel

### `runtime/history.js`

```
history.append(record)    — append one record to index.json
history.list(filter?)     — return records, newest first, optional blueprint filter
history.get(id)           — return single record by id
```

Called by `swarm.md` on `swarm_done` to append the run. Called by `swarm-history.md` for listing/opening.

---

## Phase 2 — Intelligence Layer

### Context providers

`runtime/context.js` exposes a single function: `gather(providers[]) → string`. Each provider runs a shell command via Node's `child_process.execSync` and returns its output. The combined output is formatted as a `## Context` block.

| Provider | Shell command | Notes |
|----------|--------------|-------|
| `git-diff` | `git diff HEAD` | Falls back to `git diff --cached` if working tree is clean |
| `file-tree` | `find . -not -path './.git/*' -not -path './node_modules/*' -not -path './swarms/output/*'` | Depth-limited to 4 levels |
| `stack-detect` | Read manifest files in order: `package.json`, `go.mod`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `pom.xml` | Returns `"Node.js 20, Express 4"` style string |
| `recent-commits` | `git log --oneline -10` | Includes author and date |

**Context block format** prepended to every agent prompt:

```
## Context

Stack: Node.js 20, zero npm dependencies
Recent commits (last 10):
  abc1234 add swarm validate command (Donal, 2026-05-29)
  ...

Git diff:
  runtime/history.js  (+120, -0)
  ...

Project structure:
  runtime/
  skills/
  swarms/
  ui/
```

### Blueprint `context` field

Declared providers are gathered once before any agents spawn. The same context block is injected into all agents in the swarm.

### `--context` flag

Appended to any `/swarm` invocation to inject context on blueprints that don't declare it:

```
/swarm code-review "PR #42" --context git-diff
/swarm debug "TypeError" --context git-diff,stack-detect
```

Multiple providers comma-separated, no spaces.

---

## Phase 3 — Power Features

### Task decomposition

**`/swarm decompose "<goal>"` (`skills/swarm-decompose.md`)**

1. Spawns a meta-agent with the goal and the list of available blueprints
2. Meta-agent returns a structured JSON plan: ordered array of `{step, blueprint, task, reason}`
3. Skill prints the plan and asks for confirmation before executing
4. Executes each step as a normal `/swarm` run; each step receives prior step's output as injected context
5. Final output saved as a single combined markdown file

**`runtime/decomposer.js`**

```
decomposer.plan(goal, blueprints[]) → steps[]    — call meta-agent, parse JSON plan
decomposer.execute(steps[])                       — run steps in sequence, thread outputs
```

Meta-agent prompt instructs it to return only valid JSON matching:
```json
[{"step":1,"blueprint":"team/security-audit","task":"...","reason":"..."}]
```

Plan is validated against available blueprints before execution begins. Unknown blueprint names cause the plan to be rejected with a clear error.

**Dashboard decomposition view**

- Top-level plan tree showing each step
- Each step expandable to show its sub-swarm topology graph and logs inline

### Action-capable agents

**`actions` blueprint field** is a permission declaration. Agents in blueprints without `actions` are read-only (current behaviour, unchanged).

| Action | Agent capability | Implementation |
|--------|-----------------|----------------|
| `edit-files` | May write to working tree | Agent spawned with Edit/Write tools |
| `run-tests` | May run shell commands | Agent spawned with Bash unlocked |
| `open-pr` | May call `gh pr create` | Agent spawned with Bash, scoped prompt restricts to `gh` |

**Permission gate** — shown before any agents run when `actions` is declared:

```
⚠ This swarm has action permissions: edit-files, run-tests
  Agents will modify files and run commands in your working tree.
  Proceed? [y/N]
```

User must type `y` to continue. `--dry-run` always skips execution regardless.

---

## Data flow (complete)

```
/swarm smart-review "PR #42"
  ↓
skills/swarm.md
  ↓ resolves extends
runtime/compiler.js          compile + validate blueprint
  ↓ gathers context
runtime/context.js           git-diff + stack-detect → context block
  ↓ checks actions
permission gate               (if actions declared)
  ↓ starts dashboard
runtime/dashboard.js
  ↓ spawns agents (context block prepended to each prompt)
Agent tool × N
  ↓ appends run record
runtime/history.js           → swarms/output/index.json
  ↓ saves output
swarms/output/<name>-<ts>.md
  ↓ emits swarm_done
ui/index.html                live topology + logs + history tab
```

---

## Constraints (unchanged from existing)

- Zero npm dependencies — all new modules use Node.js built-ins only
- No `package.json`
- `.swarm/` remains ephemeral — cleared at start of each run
- `swarms/output/` is now git-tracked (index.json and output files)

---

## Future work

- CI/CD integration — trigger swarms automatically on PRs, merges, or scheduled jobs (GitHub Actions, GitLab CI) without requiring an interactive Claude Code session
- `--agents N` flag to scale parallel fan-out dynamically
- Blueprint marketplace / shareable registry across repos
- Swarm v3 clean redesign once usage patterns are established
