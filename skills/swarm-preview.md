---
name: swarm-preview
description: Preview a blueprint topology, execution plan, and validation before running.
---

# /swarm preview

Validate and visualize a swarm blueprint before executing it. Shows topology graph, execution stages, agent details, and timing estimates.

## Usage

### Preview a blueprint
```
/swarm preview research
```

Shows the topology graph, execution plan, and validation status.

### Preview with format options
```
/swarm preview research --format=graph
/swarm preview research --format=plan
/swarm preview research --format=full
```

- `--format=graph` — Show topology visualization (SVG)
- `--format=plan` — Show execution stages and timing (text)
- `--format=full` — Show graph, plan, agents, and context (default)

## What It Shows

### 1. Topology Graph (SVG)
Visual representation of agent flow:

```
┌───────────────────────────────────────┐
│          research blueprint           │
└───────────────────────────────────────┘

    ┌─────────────┐   ┌─────────────┐
    │  searcher   │   │   analyst   │
    └──────┬──────┘   └──────┬──────┘
           │                 │
           └────────┬────────┘
                    │
             ┌──────▼──────┐
             │synthesizer  │
             └─────────────┘
```

Shows:
- Agent boxes with names
- Flow direction (top-to-bottom)
- Parallel stages (side-by-side)
- Sequential stages (vertically stacked)

### 2. Execution Plan
Breakdown of stages and timing:

```
Execution Plan
Stage 1 (parallel, ~30s):
  • searcher    — Search for frameworks online
  • analyst     — Analyze framework features

Stage 2 (sequential, ~20s):
  • synthesizer — Combine findings into recommendation

Total estimated time: ~50s
```

Shows:
- Stage number and concurrency (parallel/sequential)
- Agent name and prompt excerpt
- Estimated duration per agent
- Total run time

### 3. Agents Inspector
Details on each agent:

```
Agent: searcher
  Role: Search for frameworks online
  Context: git-diff, file-tree
  
Agent: analyst
  Role: Analyze framework features
  Context: (none)

Agent: synthesizer
  Role: Combine findings into recommendation
  Context: previous stage outputs
```

### 4. Validation Status
Checks blueprint correctness:

```
✓ Blueprint syntax valid
✓ All agents in flow are defined
✓ Context providers are valid
✓ Flow topology is acyclic

⚠ Warning: synthesis agent has no context (is this intentional?)
```

### 5. Context Summary
Lists gathered context for agents:

```
Context Providers
  git-diff  — Recent changes in repository
  file-tree — Project directory structure
```

## Examples

### Example 1: Research blueprint
```
/swarm preview research

Topology (research blueprint):
  ┌─────────────┐   ┌─────────────┐
  │  searcher   │   │   analyst   │
  └──────┬──────┘   └──────┬──────┘
         └────────┬────────┘
                  │
           ┌──────▼──────┐
           │synthesizer  │
           └─────────────┘

Execution Plan
Stage 1 (parallel, ~30s):
  • searcher   — Search the web for information
  • analyst    — Analyze key findings

Stage 2 (sequential, ~15s):
  • synthesizer — Synthesize into final report

Total: ~45 seconds

✓ Valid. Ready to run: /swarm research "<task>"
```

### Example 2: Code review blueprint
```
/swarm preview code-review --format=plan

Execution Plan
Stage 1 (parallel, ~20s):
  • security-reviewer  — Check for vulnerabilities
  • perf-reviewer      — Find performance issues
  • style-reviewer     — Review code style

Stage 2 (sequential, ~10s):
  • synthesis — Combine into final review

Total: ~30 seconds

✓ Valid. Ready to run: /swarm code-review "<task>"
```

## Tips

- **Use before running** — Especially for new or unfamiliar blueprints
- **Check timing estimates** — Long runs might benefit from parallel agents
- **Verify context** — Make sure the right context is being gathered
- **Graph format is useful** — Helps you understand complex topologies
- **Dry-run alternative** — Use `/swarm research --dry-run` to preview with actual task context

## See Also

- [/swarm run](/swarm-run.md) — Execute the blueprint
- [/swarm new](/swarm-new.md) — Create a new blueprint
- [Blueprint Authoring Guide](/docs/swarm-authoring.md) — Understanding flow syntax
