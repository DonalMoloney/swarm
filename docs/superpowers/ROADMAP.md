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
| **Phase 5 — Headless / CI Runner** | ✅ Done | GitHub Actions workflow, zero-dep `notify.js` (GitHub PR comment + Slack), `--ci` annotation mode, `--notify-slack` / `--notify-pr` CLI flags. |
| **Phase 6 — Authoring & Blueprint Library** | ✅ Done | `library.js`, versioning, templates, `swarm init` scaffolder, mature wizard. |
| **Phase 7 — Observability & Cost** | ✅ Done | Token/cost accounting per run, metrics view in dashboard, budget alerts. |
| **Phase 8 — Distribution & Onboarding** | ✅ Done | `plugin.json` manifest, enriched README, three example blueprints (`security-audit`, `content-pipeline`, `incident-response`), `docs/swarm-authoring.md`. |
| **Phase 9 — Safety & Governance** | ✅ Done | Persistent audit log (`swarms/audit.jsonl`), `permissions` block + `--allowedTools` passthrough, approval gates (`requires_approval: true`), CI auto-deny, `docs/testing.md`. |

**All phases complete.** The full roadmap — from demo to production-ready — has shipped. Every phase from dashboard and authoring through execution, persistence, CI, distribution, and safety/governance is on `main`.

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

## Phase 5 — Headless / CI Runner *(shipped)*

**Goal:** swarms run without a human at the REPL.

**What shipped:**

- **`runtime/notify.js`** — zero-dependency notification module using Node built-ins. Posts markdown summary to GitHub PR comment and/or Slack webhook. Pure formatter functions exported for testing.
- **`.github/workflows/swarm.yml`** — reusable GitHub Actions workflow (`workflow_dispatch` + `workflow_call`). Security-hardened: inputs bound to `env:` vars, validated with regex, `SWARM_TASK` passed via `spawnSync` args (never shell-interpolated). Uploads `swarms/output/` as artifacts.
- **`--ci` flag** in `runtime/runner.js` — GitHub Actions annotation format (`::error::`, `::warning::`, `::notice::`, `::group::`/`::endgroup::`). Writes markdown summary to `$GITHUB_STEP_SUMMARY`.
- **`--notify-slack <url>`** and **`--notify-pr <repo> <pr>`** CLI flags; also reads `SLACK_WEBHOOK_URL`, `SWARM_NOTIFY_REPO`, `SWARM_NOTIFY_PR` from env.
- **`runtime/notify.test.js`** — 26 tests (no HTTP calls made).

> The leap from "I run it while watching" to "it runs *for* me."

---

## Phase 6 — Authoring & Blueprint Library ✅ Done

Shipped on `main`. `runtime/library.js`, versioning, templates, import/export,
`swarm init` scaffolder, mature wizard with live validation.

---

## Phase 7 — Observability & Cost ✅ Done

Shipped on `main`. Token/cost accounting per run and in aggregate, budget alerts,
cost/metrics view in the dashboard. `runtime/metrics.js`.

---

## Phase 8 — Distribution & Onboarding *(done)*

**Goal:** installable, documented, adoptable — by you across every project, and
by others.

**Shipped:**

- `plugin.json` — Claude Code plugin manifest listing all seven skills; marketplace-installable.
- Enriched `README.md` — Features section, full blueprint YAML reference, flow syntax table, Phase 2 groups/conditions syntax, dashboard route table, CLI flag reference, and Contributing section.
- Three polished example blueprints:
  - `swarms/security-audit.yaml` — parallel vulnerability scan + dependency check → remediation advisor, with `limits:` block
  - `swarms/content-pipeline.yaml` — 4-stage sequential research → outline → write → edit pipeline
  - `swarms/incident-response.yaml` — parallel log + metric investigation → conditional escalation/resolution (Phase 2 groups + conditions)
- `docs/swarm-authoring.md` — comprehensive authoring guide: full YAML field reference, Phase 2 groups/conditions, Phase 2.2 compound conditions (`AND`/`OR`/`NOT`), `limits:` block, structured output contract, and runner-vs-skill guidance.

---

## Phase 9 — Safety & Governance *(shipped)*

**Goal:** trust agents with real actions.

**Shipped:**

- **Persistent audit log** (`swarms/audit.jsonl`) — append-only JSONL, survives across runs. `runtime/audit.js` exposes `appendAuditEntry` / `readAuditLog` with optional `limit`, `blueprint`, and `since` filters. Wired into `runtime/runner.js` after each run (non-fatal).
- **Blueprint-level `permissions` block** — optional `allowed_tools`, `denied_tools`, `allowed_paths` fields parsed from YAML. Per-agent `allowed_tools` override takes precedence. When set, the runner appends `--allowedTools <tool1>,<tool2>,...` to the `claude` CLI invocation.
- **Approval gates** — set `requires_approval: true` on any agent. The runner pauses before spawning that agent and prompts the user interactively. Typing `y`/`yes` proceeds; anything else emits `agent_error` with `reason: approval_denied` and continues remaining agents. In `--ci` mode, gates auto-deny with a `::warning::` log line.
- **`docs/testing.md`** — test suite guide covering how to run tests, what each file covers, the `SWARM_CLAUDE_BIN` stub pattern, writing new tests, and manual blueprint testing.
- **`runtime/audit.test.js`** — 7 tests covering append, read order, limit, blueprint filter, since filter, auto-directory creation, and missing-file guard.

---

## Critical Path to Meaningful Daily Use

```
Phase 3 ✅ →  Phase 4 ✅ →  Phase 5 ✅ →  Phase 8 ✅
(reliable)    (durable)     (unattended)   (portable)
```

Phases 2.2 ✅ / 6 ✅ / 7 ✅ are all shipped. The entire critical path is complete.

**Only Phase 9 remains** (safety/governance — sandboxing, approval gates, audit log).
Pull it forward before sharing Swarm with others or running agents with real write access.

Phase 9 (Safety & Governance) is now complete. All phases are in progress or done.

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
