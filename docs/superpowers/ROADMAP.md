# Swarm Roadmap — From Demo to End-to-End Product

**Last updated:** 2026-06-01

This roadmap takes Swarm from "impressive demo" to a tool you reach for daily.
Phases are ordered by what unlocks **meaningful, trustworthy use** fastest, and
grounded in what already exists in the codebase versus what is genuinely missing.

---

## Current State

| Phase | Status | Summary |
|-------|--------|---------|
| **Phase 1 — Dashboard & Authoring UI** | ✅ Done | Live dashboard (topology, agents, log, history tabs), wizard, preview. Plus the polish/zoom/larger-node pass. |
| **Phase 2 — Hierarchical Topology & Conditional Branching** | 🎨 Designed | Groups, conditions, branching. MVP (2.1) + deferred (2.2). See `specs/2026-05-31-swarm-phase2-extend-capabilities-design.md`. |

**The gap:** P1 and P2 are about *describing and visualizing* swarms. Almost
nothing yet makes the **execution** itself reliable or durable. That is the
distance between a demo and a product.

---

## Phase 2.2 — Finish the Deferred Branching (carryover)

The Phase 2 spec explicitly punts these; pick them up once 2.1 lands.

- **User-choice conditions** — modal/pause-resume; turns automation into
  human-in-the-loop steering. YAML, events, and modal behaviour already specced.
- **Compound conditions** — `AND` / `OR` / `NOT` (parser extension in `compiler.js`).
- **Fallback retry** — on main-branch failure, attempt the `fallback` group.
- **Dynamic / stateful conditions & nested workflows** — agents reference
  sub-blueprints (effectively recursion in the execution graph).

---

## Phase 3 — Reliable Execution Core *(foundation everything else needs)*

**Goal:** agents run predictably and fail safely.

- Per-agent **timeouts, retries, and error propagation** (`agent_error` exists in
  the event schema but needs real semantics).
- A **structured agent-output contract** — agents return JSON with known fields.
  *Phase 2's `agent_output` conditions are inert until this exists: you cannot
  branch on `confidence > 0.8` if agents return free text.*
- Per-agent / per-run **token & cost caps** with graceful abort.

> Must precede Phase 2 branching going live — branches need something reliable
> to branch *on*.

---

## Phase 4 — Persistence & Results

**Goal:** runs you can revisit, not ephemeral noise.

- Durable **run history** — today `.swarm/` is wiped each run; `swarms/output/`
  survives but isn't indexed. The dashboard **already has a History tab and a
  `/history` route** — wire them to a real run store (a `runs/` directory of
  JSON keeps the zero-dependency rule).
- **Replay mode** — the dashboard's render path is fully event-driven (the mock
  proves a canned `events.jsonl` replays verbatim). Ship "open past run" as a
  first-class feature.
- Result artifacts linked per run.

---

## Phase 5 — Headless / CI Runner *(the named gap)*

**Goal:** swarms run without a human at the REPL.

- `runtime/runner.js` that drives agents via the **Agent SDK**, not an
  interactive Claude Code session.
- **GitHub Action + cron triggers**; proper exit codes; CI-friendly logs.
- **Notifications** (GitHub PR comment / Slack) on completion or failure.

> The leap from "I run it while watching" to "it runs *for* me." Largest
> architectural bet on the roadmap.

---

## Phase 6 — Authoring & Blueprint Library

**Goal:** making and sharing swarms is easy.

- Mature the **wizard** (live validation, the Phase 2 groups/conditions editor).
- A **blueprint library** with versioning, templates, import/export, and a
  `swarm init` scaffolder.

---

## Phase 7 — Observability & Cost

**Goal:** know what your swarms cost and how they behave over time.

- Token/cost accounting per run and in aggregate (the `tokens` field is already
  captured per agent); **budgets and alerts**; a cost/metrics view in the dashboard.

---

## Phase 8 — Distribution & Onboarding

**Goal:** installable, documented, adoptable — by you across every project, and
by others.

- Package as a proper **Claude Code plugin** (marketplace-installable),
  quickstart, an **examples gallery**, and real documentation.

---

## Phase 9 — Safety & Governance *(parallel track — pull earlier if shared)*

**Goal:** trust agents with real actions.

- **Sandboxing** of file/network actions, **approval gates** (ties into Phase 2.2
  user-choice), audit log, and permissions.

---

## Critical Path to Meaningful Daily Use

```
Phase 3  →  Phase 4  →  Phase 5  →  Phase 8
(reliable)  (durable)   (unattended) (portable)
```

Phases 2.2 / 6 / 7 / 9 are quality multipliers that interleave. In one line:
**make execution reliable (3), make runs durable (4), make it run unattended (5),
make it installable everywhere (8).**

---

## Development Workflow — One Git Worktree per Phase

Each phase (and each independent workstream within a phase) is developed in its
**own git worktree**, never directly on `main`. This keeps phases isolated, lets
multiple phases progress in parallel without clobbering each other, and keeps
`main` always releasable.

### Conventions

- **Location:** worktrees live under `../worktrees/` (sibling to the repo), e.g.
  `../worktrees/swarm-phase-3-execution-core`.
- **Branch naming:** `phase-N-<slug>` (e.g. `phase-3-execution-core`,
  `phase-5-headless-runner`). Sub-workstreams: `phase-N.M-<slug>`.
- **One worktree = one branch = one phase's PR.** Don't mix phases in a worktree.
- **Merge via PR into `main`.** Squash on merge; delete the branch and prune the
  worktree afterward.

### Create a phase worktree

```bash
# from the main repo
git worktree add ../worktrees/swarm-phase-3-execution-core -b phase-3-execution-core
cd ../worktrees/swarm-phase-3-execution-core
# …build the phase here, commit, push, open a PR…
```

### Finish and clean up

```bash
# after the PR merges
git worktree remove ../worktrees/swarm-phase-3-execution-core
git branch -d phase-3-execution-core      # local
git fetch --prune                          # drop the merged remote branch ref
```

### Why worktrees (not just branches)

- **True isolation** — each phase has its own working directory, so the dashboard
  (`localhost:7700`), `.swarm/` event stream, and `swarms/output/` of one phase
  never collide with another's while both are in flight.
- **Parallel review** — a phase can sit in review while you start the next in a
  fresh worktree, with no `git stash` churn.
- **Safe experimentation** — throwaway worktrees for spikes; remove without a trace.

> When isolation tooling beyond raw `git worktree` is available (e.g. the
> superpowers `using-git-worktrees` skill or native worktree commands), prefer it —
> it handles setup/teardown and stale-worktree pruning automatically.

---

## How Each Phase Ships

Every phase follows the same lifecycle:

1. **Spec** — brainstorm → design doc in `docs/superpowers/specs/`.
2. **Plan** — implementation plan in `docs/superpowers/plans/`.
3. **Build** — in a dedicated worktree (above), test-driven where practical.
4. **Verify** — run the dashboard / runner against a real blueprint; confirm
   events, topology, and outputs.
5. **PR → merge → prune worktree.**

Backward compatibility is non-negotiable: every phase must keep existing
blueprints working unchanged.
