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
| **Phase 2.1 — Hierarchical Topology & Conditional Branching** | ✅ Done | Groups, conditions, branching in compiler + dashboard. `execution_graph` shape. |
| **Phase 2.2 — Compound Conditions & Fallback Retry** | ✅ Done | `AND`/`OR`/`NOT` compound conditions, fallback retry, `resolved_conditions` map. |
| **Phase 3 — Reliable Execution Core** | ✅ Done | `contract.js` (structured output), `runner.js` (timeouts, retries, budgets, Phase-2 graph execution). 23/23 tests pass. |
| **Phase 4 — Persistence & Results** | ✅ Done | Durable run archive, History tab wired to real store, replay from dashboard. |
| **Phase 5 — Headless / CI Runner** | 🔲 Not started | `runner.js` is the foundation (CLI entry, exit codes) but no spec, no GitHub Action, no notifications. |
| **Phase 6 — Authoring & Blueprint Library** | ✅ Done | `library.js`, versioning, templates, `swarm init` scaffolder, mature wizard. |
| **Phase 7 — Observability & Cost** | ✅ Done | Token/cost accounting per run, metrics view in dashboard, budget alerts. |
| **Phase 8 — Distribution & Onboarding** | 🔲 Not started | Marketplace packaging, quickstart, examples gallery, real documentation. |
| **Phase 9 — Safety & Governance** | 🔲 Not started | Sandboxing, approval gates, audit log, permissions. |

**Where things stand:** The execution stack (Phases 1–4, 6–7) is complete. The
project runs swarms reliably with structured output, durable history, cost tracking,
and a library of blueprints. The remaining work is about **running unattended** (5),
**distributing to others** (8), and **safety for real actions** (9).

---

## Phase 2.2 — Compound Conditions & Fallback Retry ✅ Done

Shipped on `main`. Compound `AND`/`OR`/`NOT` conditions, fallback retry, and
`resolved_conditions` in the compiled output. See `swarms/compound-demo.yaml`.

Still deferred (pull into a future phase):

- **User-choice conditions** — modal/pause-resume; turns automation into
  human-in-the-loop steering. YAML, events, and modal behaviour already specced.
- **Dynamic / stateful conditions & nested workflows** — agents reference
  sub-blueprints (effectively recursion in the execution graph).

---

## Phase 3 — Reliable Execution Core ✅ Done

Shipped on `main`. `runtime/contract.js` (structured output extract/validate/fallback),
`runtime/runner.js` (timeouts with hard kill, retries, per-run budget abort,
Phase-2 graph traversal via `runGraph`). 23/23 tests pass. CLI:
`node runtime/runner.js swarms/<bp>.yaml "<task>" [--max-cost N] [--timeout S] [--model NAME]`.

---

## Phase 4 — Persistence & Results ✅ Done

Shipped on `main`. Durable run archive (`runtime/archive.js`), History tab wired
to real run store, replay mode in the dashboard ("open past run"), result artifacts
linked per run in `swarms/output/`.

---

## Phase 5 — Headless / CI Runner *(the named gap)*

**Goal:** swarms run without a human at the REPL.

**Foundation already in place:** `runtime/runner.js` is a fully working
standalone CLI with proper exit codes. Running a blueprint headlessly works today:
`node runtime/runner.js swarms/research.yaml "my task"`.

**Still missing:**
- **GitHub Action** — `.github/workflows/swarm.yml`, trigger on PR/push/cron.
- **Notifications** — GitHub PR comment / Slack webhook on completion or failure.
- **CI-friendly log formatting** — structured output for log aggregators.

> The leap from "I run it while watching" to "it runs *for* me." The runner
> exists; the CI wiring and notification layer are what remain.

---

## Phase 6 — Authoring & Blueprint Library ✅ Done

Shipped on `main`. `runtime/library.js`, versioning, templates, import/export,
`swarm init` scaffolder, mature wizard with live validation.

---

## Phase 7 — Observability & Cost ✅ Done

Shipped on `main`. Token/cost accounting per run and in aggregate, budget alerts,
cost/metrics view in the dashboard. `runtime/metrics.js`.

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
Phase 3 ✅ →  Phase 4 ✅ →  Phase 5  →  Phase 8
(reliable)    (durable)     (unattended) (portable)
```

Phases 2.2 ✅ / 6 ✅ / 7 ✅ / 9 are quality multipliers. In one line:
**make execution reliable (3 ✅), make runs durable (4 ✅), make it run unattended (5),
make it installable everywhere (8).**

**Remaining critical path:** Phase 5 (GitHub Action + notifications) → Phase 8
(packaging + docs). Phase 9 (safety/governance) is a parallel track needed before
sharing with others or running agents with real write access.

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
