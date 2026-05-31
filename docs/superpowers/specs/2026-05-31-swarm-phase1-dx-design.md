# Swarm Phase 1: Developer Experience Design

**Date:** 2026-05-31  
**Phase:** 1 of 4  
**Focus:** Developer Experience — authoring, validating, iterating on swarms  
**Outcome:** End-to-end workflow from idea → validated blueprint → running swarm

---

## Overview

Phase 1 makes it drastically easier to author, validate, and iterate on swarm blueprints. The ideal workflow:

1. **Describe** what you want (e.g., "code review with bug/perf/security reviewers")
2. **Scaffold** a blueprint (Claude suggests one, or use interactive wizard)
3. **Validate** without running (preview topology + execution plan + evidence inspection)
4. **Run** and get real-time progress
5. **Iterate** by editing YAML and resuming from checkpoints

The design provides **multiple paths** for different user preferences:
- **Quick path:** CLI suggestion (default) for experienced users
- **Learning path:** Interactive wizard for exploring capabilities
- **Evidence-based validation:** Full inspection before execution (superpowers-style)
- **Smart resumption:** Auto-resume from checkpoints on failure

---

## Section 1: CLI Commands

### New/Enhanced Commands

```bash
swarm new <idea>              # Suggest a blueprint based on your idea
swarm new <idea> --wizard     # Interactive wizard to build blueprint step-by-step
swarm preview <blueprint.yaml> # Show topology DAG + execution plan (dry-run)
swarm run <blueprint.yaml>    # Execute; auto-resume from checkpoint on failure
swarm list                    # List available blueprint templates
swarm history                 # Show past swarm runs and checkpoints
```

### Command Behavior

**`swarm new <idea>`** (Quick path)
- Parses your description (e.g., "debug TypeError in auth middleware")
- Claude generates a complete YAML blueprint
- Shows you what was generated; asks: accept, edit, or try again?
- Writes blueprint to `my-swarm.yaml` in current directory
- Takes ~5-10 seconds

**`swarm new <idea> --wizard`** (Learning path)
- Opens interactive browser-based questionnaire
- Guides through: blueprint name, agents, context providers, flow topology, prompts
- User can save/resume wizard sessions
- Generates YAML at the end
- Takes ~5-15 minutes (learning-oriented)

**`swarm preview <blueprint.yaml>`**
- Compiles blueprint and shows:
  - Topology DAG (visual)
  - Execution plan (text: stages, agents, context)
  - Evidence inspection (interactive stage walkthrough)
  - Failure predictions (warnings/errors)
- Does NOT spawn agents; 100% safe to run
- Helps catch mistakes before execution

**`swarm run <blueprint.yaml>`**
- Executes the swarm normally (uses existing dashboard)
- After each stage: saves checkpoint to `.swarm/checkpoints/`
- If stage fails: next `swarm run` detects checkpoint and asks "Resume?" vs "Start fresh?"
- Shows progress in real-time dashboard

**`swarm list`**
- Shows available built-in templates: `research.yaml`, `code-review.yaml`, `debug.yaml`, etc.
- Helps users discover existing patterns
- Used as reference for `swarm new` suggestions

**`swarm history`**
- Lists all past swarm runs with status (completed, failed, in-progress)
- Shows checkpoint status ("resumable from stage 3")
- Helps users find and re-run past swarms

---

## Section 2: Suggestion Algorithm

When you run `swarm new "your idea"`, the system:

1. **Parse intent** — extract: agents needed, their roles, approximate flow topology
   - Example: "code review" → agents: [bug-hunter, perf-reviewer, security-reviewer], flow: parallel → summary

2. **Match template** — look for similar existing blueprints
   - If close match found: use as starting point
   - If no match: generate from scratch using Claude

3. **Generate blueprint** — fill in complete YAML:
   - Agent prompts (contextual to your description)
   - Context providers (git-diff, file-tree, stack-trace, recent-commits as relevant)
   - Flow topology (parallel stages, sequential, or mixed)

4. **Show diff** — display the generated YAML and ask:
   - "Accept this blueprint?"
   - "Edit manually?" (opens editor)
   - "Try again?" (regenerate with refined description)

5. **Save** — write `<name>.yaml` to current directory; user can commit to git

**Source of suggestions:**
- Built-in templates in `swarms/*.yaml`
- Claude Code's agent capabilities (tool access, model versions, context providers)
- User's description and context

**Implementation:**
- New module: `runtime/suggestions.js` with `generateBlueprint(idea)` function
- Calls Claude API via Agent tool to generate YAML
- Validates result with existing `compiler.js`
- Returns YAML string + metadata (confidence, similar templates found)

---

## Section 3: Interactive Wizard

For users who want to learn or have specific requirements, `swarm new --wizard` provides a guided, multi-step experience.

### Wizard Flow (Browser-based)

**Step 1: Blueprint metadata**
- Name: "my-swarm" (defaults to auto-generated)
- Description: "What is this swarm for?"
- Tags: [research, debugging, code-review, etc.] (for organization)

**Step 2: Agent design**
- How many agents? (1-10 recommended)
- For each agent:
  - Name: "searcher", "bug-hunter", etc.
  - Role: "What does this agent do?"
  - Offer templates: "Code reviewer", "Researcher", "Debugger", "Custom"

**Step 3: Context needs**
- For each agent, select which context it needs:
  - [ ] git-diff (what changed)
  - [ ] file-tree (project structure)
  - [ ] stack-trace (error trace)
  - [ ] recent-commits (git history)
- Preview: "searcher will get 120 lines of git-diff + 5 recent commits"

**Step 4: Agent prompts**
- For each agent:
  - Show template prompt (e.g., "You are a code reviewer. Find bugs...")
  - Allow customization or write custom
  - Live preview of what prompt will look like

**Step 5: Flow topology**
- Visual diagram builder:
  - Drag agents into stages (boxes)
  - Stages are executed sequentially; agents within a stage run in parallel
  - Example: [searcher, analyst] → [synthesizer]
  - Validate: all agents used? any circular dependencies?

**Step 6: Review & generate**
- Show final YAML
- Confirm and save to file

### Implementation

- New module: `runtime/wizard.js` with question engine + YAML builder
- New skill: `skills/swarm-init.md` orchestrates wizard CLI
- New UI: `ui/wizard.html` (web-based questionnaire)
- Wizard state saved to `.swarm/wizard-session.json` (allows resume)
- Final output: complete, validated YAML blueprint

---

## Section 4: Preview & Validation

`swarm preview <blueprint.yaml>` shows what would happen without running agents.

### Part A: Topology Graph (Visual)

- DAG showing: agents, stages, dependencies
- Example: "Stage 1: [searcher, analyst] (parallel) → Stage 2: synthesizer"
- Rendered as SVG in browser (reuse dashboard graph.js)
- Shows estimated wall-clock time (parallel stages don't add time)

### Part B: Execution Plan (Text)

Text breakdown of what agents would spawn, in what order:

```
Stage 1 (parallel):
  - searcher: prompt="Search for X...", context=[git-diff, recent-commits]
  - analyst: prompt="Analyze Y...", context=[file-tree]

Stage 2 (sequential):
  - synthesizer: prompt="Combine Z...", context=[git-diff]
```

Includes:
- Validation warnings (unused context, missing agents, typos)
- Context size estimates (e.g., "git-diff: 250 lines")
- Prompt word count per agent

### Part C: Evidence-Based Inspection (Interactive)

**Superpowers-style verification before execution:**

1. **Stage-by-stage walkthrough**
   - Step through execution one stage at a time (like a debugger)
   - Before each stage: show exact inputs agents will receive
   - Ask: "Continue?" or "Inspect?"

2. **Context Inspector**
   - Drill down on context per agent
   - Show actual git-diff / file-tree / stack-trace that agents get
   - Verify context is what you expect (catch bugs early)
   - Example: "searcher gets 120 lines of git-diff; analyst gets 3 files (15KB)"

3. **Agent Capability Matrix**
   - What can each agent do?
   - Available tools, model version, estimated token budget
   - Helps you understand agent constraints

4. **Failure Prediction**
   - Red flags: missing context, circular dependencies, typos in agent names
   - Yellow warnings: agents with no context, unused context providers
   - Suggested fixes (e.g., "agent 'analyzer' not in flow; did you mean 'analyst'?")

5. **Execution Timeline**
   - Rough estimates per stage
   - Parallel vs. sequential impact on wall-clock time
   - Total estimated token budget
   - Helps you avoid surprises

### Implementation

- New module: `runtime/preview.js` with dry-run + inspection logic
- Reuses existing `compiler.js` for parsing
- New skill: `skills/swarm-preview.md` CLI entry
- New UI: `ui/preview.html` for interactive inspection
- Validation rules defined in config (extensible)

---

## Section 5: Checkpoint & Resume

When `swarm run` executes, it saves state after each stage. If something fails, the next run automatically resumes.

### Checkpoint Mechanism

**After each stage completes:**
```
.swarm/checkpoints/
├── my-swarm-2026-05-31-001.json          # metadata + outputs
├── my-swarm-2026-05-31-001-stage-1-done  # marker file
└── my-swarm-2026-05-31-001-stage-2-done  # marker file
```

**Checkpoint contents:**
- Stage number completed
- Timestamp and duration
- Agent outputs (what each agent returned)
- Event stream up to that point (for replay)
- Blueprint + context snapshot (for reproducibility)
- Git commit SHA (for context tracking)

### Resume Logic

When you run `swarm run blueprint.yaml`:
1. System detects checkpoint exists
2. Asks user: "Resume from stage 3? (2 stages already completed)" or "Start fresh?"
3. If resume: feed stage-2 outputs into stage-3 agents; skip stages 1-2
4. If fresh: delete checkpoint; start from stage 1

**Use case:** You run a swarm, stage 2 agent fails due to network timeout. You fix it (or wait). Re-run the swarm: it resumes from stage 3 (stages 1-2 outputs are cached, no re-running).

### Checkpoint Visibility

**`swarm history`** — shows all past swarms:
```
my-swarm-2026-05-31-001 [FAILED]     (stage 2, resumable)
my-swarm-2026-05-31-002 [COMPLETED] (all stages)
research-2026-05-30-001 [IN PROGRESS] (stage 3 of 4)
```

**Dashboard indicator** — checkmarks on completed stages; alert on failures

### Implementation

- New module: `runtime/checkpoint.js` with save/load/validate logic
- Modify `runtime/dashboard.js` to emit checkpoint events
- Modify `skills/swarm-run.md` to detect and resume
- Checkpoints stored in `.swarm/checkpoints/` (gitignored)
- Automatic cleanup: remove checkpoints older than 30 days

---

## Section 6: Implementation Architecture

### New & Modified Files

```
skills/swarm-new.md              ← NEW: /swarm new command
skills/swarm-init.md             ← NEW: interactive wizard orchestration
skills/swarm-preview.md          ← NEW: /swarm preview command
skills/swarm-run.md              ← MODIFIED: add checkpoint/resume
runtime/suggestions.js           ← NEW: suggestion algorithm
runtime/wizard.js                ← NEW: wizard question engine
runtime/preview.js               ← NEW: dry-run + evidence inspection
runtime/checkpoint.js            ← NEW: save/load checkpoint logic
ui/preview.html                  ← NEW: stage walkthrough UI
ui/wizard.html                   ← NEW: wizard question UI
docs/swarm-quickstart.md         ← NEW: 5-min "new to swarm" guide
docs/swarm-authoring.md          ← NEW: deep dive on agents/context/flow
```

### Component Dependencies

```
User invokes: swarm new "idea"
  ↓
skills/swarm-new.md (CLI entry)
  ├─→ runtime/suggestions.js (default path)
  └─→ skills/swarm-init.md + runtime/wizard.js (--wizard path)
  ↓
Write my-swarm.yaml (or .yaml file from wizard)

User invokes: swarm preview my-swarm.yaml
  ↓
skills/swarm-preview.md
  ├─→ runtime/compiler.js (parse YAML)
  ├─→ runtime/preview.js (inspect + validate)
  └─→ ui/preview.html (render walkthrough UI)

User invokes: swarm run my-swarm.yaml
  ↓
skills/swarm-run.md (existing, enhanced)
  ├─→ runtime/checkpoint.js (detect resume state)
  ├─→ runtime/compiler.js (parse YAML)
  ├─→ runtime/dashboard.js (live execution)
  └─→ runtime/checkpoint.js (save after each stage)
```

### Data Persistence

```
.swarm/
├── checkpoints/
│   ├── my-swarm-2026-05-31-001.json
│   ├── my-swarm-2026-05-31-001-stage-1-done
│   └── ...
├── events.jsonl          (existing, live event stream)
└── wizard-session.json   (wizard state for resume)

swarms/
├── research.yaml         (existing)
├── code-review.yaml      (existing)
├── debug.yaml            (existing)
└── output/               (existing, runtime-generated results)
```

### Design Principles

1. **Progressive disclosure** — quick path (suggest) first; learning path (wizard) available
2. **Evidence before execution** — preview shows everything; no surprises when you run
3. **Failure recovery** — checkpoints make failure cheap; resume saves time
4. **Reusability** — all runtime modules are pure functions; easy to test
5. **Zero new dependencies** — use existing Node.js built-ins + Claude Code primitives

---

## Success Criteria

Phase 1 is done when:

- [ ] User can create a blueprint with `swarm new "idea"` in <30 seconds
- [ ] User can preview blueprint without running agents
- [ ] Wizard is usable for learning (takes ~10 min, generates valid blueprint)
- [ ] Failed swarms can be resumed without re-running completed stages
- [ ] All 4 commands work: new, preview, run, history
- [ ] Documentation covers quickstart + deep dive on authoring
- [ ] No breaking changes to existing `/swarm` command

---

## Next Steps

After Phase 1 completes:

- **Phase 2:** Extend capabilities (hierarchical topology, conditional branching, more context providers)
- **Phase 3:** Robustness (error handling, retries, timeouts, state persistence)
- **Phase 4:** Scale & performance (100+ agents, optimized streaming)

---

## Notes

- All checkpoint data is ephemeral (`.swarm/` is gitignored)
- Suggestions rely on Claude API; require authenticated session
- Wizard is browser-based (requires visual companion to be running)
- All YAML blueprints are user-editable; no lock-in to generated format
