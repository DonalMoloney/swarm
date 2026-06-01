# Swarm Phase 2: Hierarchical Topology & Conditional Branching Design

**Date:** 2026-05-31  
**Focus:** Extend Swarm with grouped agents and conditional execution paths  
**Goal:** Support complex multi-agent workflows with validation-based, output-based, and user-directed branching

---

## Overview

Phase 1 delivered linear agent orchestration: `A → B → C`. Phase 2 adds:

1. **Hierarchical groups** — Agents organized into logical groups (research, synthesis, fallback) with visual and compositional structure
2. **Conditional branching** — Execution paths determined by validation results, agent outputs, or user choice
3. **Extended topology** — Preview shows groups as containers, conditions as decision points, branches as alternative flows

Result: Complex workflows with fallbacks, smart routing, and user control.

---

## Architecture

### Core Concepts

**Groups:**
- Logical collection of agents with shared purpose
- Agents declare `group: name` and optional `role` (lead, backup, fallback)
- Groups execute as units (all agents in a group run, then evaluate conditions)
- Visualized as rounded containers in topology

**Conditions:**
- Boolean logic gates that determine flow routing
- Three types:
  - **Validation:** checks blueprint validity (no-errors, no-warnings, all-pass)
  - **Agent-output:** evaluates agent result field (confidence > 0.8, status == "success")
  - **User-choice:** pauses execution, presents UI options
- Can be compounded with AND/OR/NOT

**Branches:**
- Alternative execution paths from a decision point
- True branch (condition pass) vs. false branch (condition fail)
- User-choice branches: one per option selected

### Execution Model

1. Group executes (all agents parallel)
2. Group completes
3. Outgoing conditions evaluated
4. Routing decision: true_branch or false_branch
5. Next group executes
6. Repeat until final group

User-choice conditions pause execution and show modal in preview UI.

### Files Modified

- **`swarms/` (blueprints)** — add `groups`, `conditions` sections
- **`runtime/compiler.js`** — parse groups/conditions, build execution graph with branches
- **`ui/preview.html`** — visualize groups, conditions, branches; handle user choices
- **`ui/wizard.html`** — blueprint editor: define groups, conditions

---

## Blueprint Syntax

### Groups Section (New)

```yaml
groups:
  research:
    description: "Parallel research agents"
    agents: [searcher, analyst]
  
  synthesis:
    description: "Aggregate findings"
    agents: [synthesizer]
  
  fallback:
    description: "Error recovery"
    agents: [error_handler]
```

- `description` (optional): Purpose of group
- `agents` (required): List of agent names in group

### Agents Section (Extended)

```yaml
agents:
  searcher:
    group: research
    prompt: "Search for..."
  
  analyst:
    group: research
    role: backup                    # optional: lead, backup, fallback
    prompt: "Analyze..."
  
  synthesizer:
    group: synthesis
    prompt: "Synthesize..."
  
  error_handler:
    group: fallback
    prompt: "Handle errors..."
```

- `group` (required if using Phase 2): Which group agent belongs to
- `role` (optional): Agent role within group (for UI hints)
- `prompt` (required): Agent instructions

### Conditions Section (New)

**Validation conditions:**
```yaml
conditions:
  validation_passed:
    type: validation
    criteria: "no-errors"          # no-errors, no-warnings, all-pass
```

**Agent-output conditions:**
```yaml
  high_confidence:
    type: agent_output
    source: searcher               # which agent to check
    check: "confidence"            # field name in agent result
    threshold: "> 0.8"             # operator + value (>, <, ==, !=, >=, <=)
  
  search_succeeded:
    type: agent_output
    source: searcher
    check: "status"
    threshold: "== success"
```

**User-choice conditions:**
```yaml
  user_picks_path:
    type: user_choice
    options:
      - label: "Deepen Research"
        next_group: research
      - label: "Proceed to Synthesis"
        next_group: synthesis
```

- `type` (required): validation, agent_output, user_choice
- Validation: `criteria` (no-errors, no-warnings, all-pass)
- Agent-output: `source`, `check`, `threshold`
- User-choice: `options` (label, next_group/next_flow)

### Flow Syntax (Extended)

**Simple branching:**
```yaml
flow: "research-group → if validation_passed: synthesis-group else: fallback-group"
```

**Multiple conditions (AND/OR):**
```yaml
flow: "research → if (high_confidence AND validation_passed): synthesis else: review"
```

**Multiple branches:**
```yaml
flow: "research → if high_confidence: synthesis else: deepen-research"
```

**User-choice routing:**
```yaml
flow: "research → if user_picks_path: (synthesis OR fallback) else: error"
```

**Backward compatible:** Old blueprints (no groups/conditions) still work:
```yaml
flow: "searcher → analyzer → synthesizer"
```

---

## Condition Evaluation

### Validation Conditions

**Trigger:** After a group completes, before transitioning

**Criteria:**
- `no-errors`: Blueprint has zero errors (strict)
- `no-warnings`: Zero errors and warnings (lenient)
- `all-pass`: All validation checks pass (custom)

**Result:** Boolean (pass → true branch, fail → else branch)

**Example:**
```yaml
conditions:
  blueprint_valid:
    type: validation
    criteria: no-errors

flow: "setup → if blueprint_valid: execute else: review"
```

### Agent-Output Conditions

**Trigger:** After specified agent completes

**Check types:**
- Numeric comparison: `confidence > 0.8`, `count >= 3`
- String match: `status == "success"`, `status != "partial"`
- Existence: `key_exists: "result"` (check if field present)
- Custom: any field in agent's JSON output

**Threshold syntax:**
- Operators: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Wildcards: `*` matches any value
- Patterns: `contains "error"` for substring match

**Result:** Boolean based on evaluation

**Example:**
```yaml
conditions:
  research_confident:
    type: agent_output
    source: searcher
    check: confidence
    threshold: "> 0.75"

flow: "research → if research_confident: synthesis else: deepen"
```

### User-Choice Conditions

**Trigger:** After a group completes, pauses execution

**UI behavior:** Preview shows modal with options, user selects one

**Options structure:**
```yaml
options:
  - label: "Use shallow analysis"
    next_group: synthesis
  - label: "Deepen research further"
    next_group: research
  - label: "Try different approach"
    next_group: alternative_research
```

**Result:** User selection → execution routes to chosen `next_group`

**Stored in state:** User choice logged in `.swarm/events.jsonl` for audit/replay

**Example:**
```yaml
conditions:
  user_decides_depth:
    type: user_choice
    options:
      - label: "Shallow"
        next_group: synthesis
      - label: "Deep"
        next_group: extended_research

flow: "research → if user_decides_depth: (synthesis OR extended_research)"
```

### Compound Conditions

**AND logic:**
```yaml
flow: "research → if (high_confidence AND validation_passed): synthesis else: review"
```
Both conditions must be true to follow true branch.

**OR logic:**
```yaml
flow: "research → if (time_exceeded OR confident): synthesis else: continue"
```
Either condition can be true.

**NOT logic:**
```yaml
flow: "research → if NOT time_exceeded: synthesis else: fallback"
```
Negates condition result.

---

## Execution Graph

### Compiler Output

The compiler builds an execution graph with:
- **Nodes:** Groups (units of execution), Conditions (decision points)
- **Edges:** Flow paths (true/false/choice branches)
- **Stages:** Topologically sorted execution order

**Example (research → if high_confidence: synthesis else: fallback):**

```json
{
  "name": "research-synthesis",
  "description": "Research with conditional synthesis or fallback",
  "groups": [
    {
      "id": "research",
      "agents": ["searcher", "analyst"],
      "description": "Parallel research"
    },
    {
      "id": "synthesis",
      "agents": ["synthesizer"],
      "description": "Aggregate findings"
    },
    {
      "id": "fallback",
      "agents": ["error_handler"],
      "description": "Error recovery"
    }
  ],
  "conditions": [
    {
      "id": "high_confidence",
      "type": "agent_output",
      "source": "searcher",
      "check": "confidence",
      "threshold": "> 0.8"
    }
  ],
  "execution_graph": {
    "stages": [
      {
        "id": "s1",
        "type": "group",
        "group_id": "research",
        "agents": ["searcher", "analyst"]
      },
      {
        "id": "c1",
        "type": "condition",
        "condition_id": "high_confidence",
        "true_next": "s2",
        "false_next": "s3"
      },
      {
        "id": "s2",
        "type": "group",
        "group_id": "synthesis",
        "agents": ["synthesizer"]
      },
      {
        "id": "s3",
        "type": "group",
        "group_id": "fallback",
        "agents": ["error_handler"]
      }
    ]
  }
}
```

### State Tracking

During execution, state tracks:
- Current stage
- Completed agents
- Condition evaluation results
- User choices
- Branch decisions

**Logged to `.swarm/events.jsonl`:**
```json
{ "type": "condition_evaluated", "condition": "high_confidence", "result": true, "branch": "synthesis", "ts": 1234567890 }
{ "type": "user_choice", "condition": "user_picks_path", "selection": "synthesis", "ts": 1234567891 }
```

---

## UI Updates

### Preview: Topology Visualization

**Groups as containers:**
- Rounded rectangle with agent nodes inside
- Group label at top: "Research (Parallel)"
- Agents colored by group

**Conditions as decision nodes:**
- Diamond shape between groups
- Label shows condition: "if high_confidence"
- True branch (green edge), false/else branch (red edge)

**Example topology:**
```
┌─ Research Group (Parallel) ─┐
│  [Searcher] [Analyst]       │
└─────────────┬───────────────┘
              │
         ◇ high_confidence?
        / \
    (yes) (no)
      /     \
     /       \
┌─ Synthesis ┐ ┌─ Fallback ─┐
│[Synthesizer]│ │[Error Hdlr]│
└─────────────┘ └─────────────┘
```

**Legend (updated):**
- Blue rounded box = Group
- Green circle = Agent
- Orange circle = Fallback agent
- Diamond = Condition
- Green edge = Success/true path
- Red edge = Failure/else path

**Interactivity:**
- Hover group → highlight agents inside
- Hover condition → show condition logic popup
- Hover branch edge → highlight flow path
- Click group → show group details (agents, roles)

### Preview: Execution Plan

**Collapsible sections (extended):**
```
Stage 1: Research Group (Parallel, ~30s)
  ▼ searcher
    Prompt: "Search for..."
    Context: [git-diff, recent-commits]
  ▼ analyst
    Prompt: "Analyze..."
    Context: [file-tree]

Stage 2: Decision Point
  ◇ Condition: high_confidence
    ├─ True branch (confidence > 0.8) → Stage 3: Synthesis
    └─ False branch (else) → Stage 4: Fallback

Stage 3: Synthesis Group (~20s)
  ▼ synthesizer
    Prompt: "Synthesize..."

Stage 4: Fallback Group (~15s) [if needed]
  ▼ error_handler
    Prompt: "Handle errors..."
```

**Condition details on hover:**
- Condition type, source agent, check field, threshold
- Which branches it gates

### Wizard: Blueprint Editor

**New sections:**
- **Groups editor:** Define groups, assign agents
- **Conditions editor:** Define conditions (type, criteria/source/check/threshold)
- **Flow editor:** Extended to support `if/else/` syntax

**Validation:**
- All agents in conditions `source` field must exist
- All groups referenced in flow must be defined
- All agents assigned to exactly one group

---

## Implementation Scope

### MVP (Phase 2.1) — Implement Now

> Runtime/compiler foundation delivered by plan `2026-06-01-swarm-phase2-conditional-topology.md`. UI visualization and live condition evaluation tracked separately.

**Core features:**
- [x] Blueprints support `groups`, `conditions` sections
- [x] Flow syntax: `"group → if condition: branch1 else: branch2"`
- [x] Compiler builds execution graph with branches
- [x] Validation conditions: `type: validation, criteria: no-errors/no-warnings/all-pass`
- [x] Agent-output conditions: `type: agent_output, source, check, threshold`
- [ ] Execution follows branches: evaluates condition, routes true/false
- [ ] Preview UI: groups as containers, conditions as diamonds, branches as labeled paths
- [ ] Wizard extends: define groups, conditions, conditional flow
- [ ] Events logged with branch decisions

**Not included:** User-choice conditions, compound conditions (AND/OR), fallback retry, nested workflows

### Extended (Phase 2.2) — Future

- [ ] User-choice conditions: modal UI, user selection, pause/resume
- [ ] Compound conditions: AND/OR/NOT operators
- [ ] Fallback retry: if main branch fails, attempt fallback
- [ ] Dynamic conditions: agent output used in later conditions (state tracking)
- [ ] Nested workflows: agents reference sub-blueprints

---

## Success Criteria

Phase 2 MVP is complete when:

- [ ] Groups defined in YAML, agents assigned to groups
- [ ] Conditions defined (validation + agent-output types)
- [ ] Flow syntax extended to support `if/else/` branching
- [ ] Compiler parses groups/conditions, builds execution graph
- [ ] Topology visualization shows groups and condition branches
- [ ] Execution evaluates conditions, routes to true/false branches
- [ ] Preview shows execution plan with decision points
- [ ] Wizard supports defining groups and conditions
- [ ] All branch decisions logged in events
- [ ] Backward compatible: Phase 1 blueprints still work

---

## Design Philosophy

**Principle: Progressive complexity**

Start simple (linear flows), extend to grouped agents, then add conditionals. Each layer is optional and backward-compatible.

**Principle: Visual clarity**

Groups, conditions, branches should be obvious in topology. No hidden logic.

**Principle: Minimal syntax extension**

Reuse existing YAML structure. Groups = agents + group field. Conditions = new section. Flow = minimal extension (`if/else/`).

**Principle: User control**

User-choice conditions (Phase 2.2) let users steer execution, not just automation.

---

## Notes

- All improvements use existing tech stack (Node.js, HTML/CSS/JS)
- Phase 1 UI enhancements remain (polish, validation, micro-interactions)
- Backward compatible: Phase 1 blueprints work unchanged
- Compiler output (execution graph) versioned for future extensions
- Dark GitHub theme consistent throughout

