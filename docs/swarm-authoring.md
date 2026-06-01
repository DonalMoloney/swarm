# Swarm Blueprint Authoring Guide

Master blueprint design. Learn to structure complex multi-agent workflows using YAML, control execution topology, and optimize for speed and clarity.

## Blueprint Structure

A swarm blueprint is a YAML file that defines:
- **Blueprint metadata** — name, description, optional context providers and actions
- **Agent definitions** — role, prompt, optional context per agent
- **Flow topology** — how agents execute (parallel, sequential, or mixed)

### Minimal Example

```yaml
name: hello-swarm
description: "Say hello from two agents"
flow: "greeter1, greeter2"
agents:
  greeter1:
    prompt: "Say hello in English"
  greeter2:
    prompt: "Say hello in Spanish"
```

### Complete Example

```yaml
name: research
description: "Research a topic and synthesize findings"
context:
  - git-diff
  - file-tree
actions:
  - edit-files
flow: "researcher1, researcher2 → synthesizer"
agents:
  researcher1:
    prompt: |
      You are an expert researcher. Search for information about {task}.
      Focus on recent developments and credible sources.
    context:
      - git-diff
  researcher2:
    prompt: |
      You are an expert analyst. Analyze {task} from a critical perspective.
      Focus on limitations and edge cases.
    context:
      - file-tree
  synthesizer:
    prompt: |
      Synthesize the research findings into a cohesive summary.
      Highlight consensus and disagreements.
```

## Fields Reference

### Top-level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier (alphanumeric + hyphens, lowercase). Used as filename. |
| `description` | string | Yes | 1-2 sentence summary of what the blueprint does. |
| `flow` | string | Yes | Execution topology (see Flow Syntax). |
| `agents` | object | Yes | Agent definitions (see Agents Section). |
| `context` | array | No | Default context providers for all agents (see Context Providers). |
| `actions` | array | No | Permissions agents need: `edit-files`, `run-tests`, `open-pr`. |

### Agents Section

Each agent is defined under `agents:` with a key (agent name) and properties:

```yaml
agents:
  my-agent:
    prompt: "..."           # Required. Agent instructions.
    context:                # Optional. Agent-specific context providers.
      - git-diff
      - file-tree
```

#### Agent Properties

| Property | Type | Description |
|----------|------|-------------|
| `prompt` | string | Multi-line instructions for the agent. Supports `{task}` placeholder (replaced with user's task). |
| `context` | array | Optional. Context providers specific to this agent. Overrides blueprint-level context. |

## Context Providers

Agents can access context about your codebase and recent changes. Specify providers at blueprint level or per-agent.

### Available Providers

| Provider | What It Provides | Use Case |
|----------|------------------|----------|
| `git-diff` | Recent uncommitted changes (staging area + working tree) | Code review, debugging, impact analysis |
| `file-tree` | Project directory structure (non-binary files) | Understanding codebase layout, file organization |
| `stack-trace` | Most recent error stack trace from logs | Debugging, error analysis |
| `recent-commits` | Last 10 commits with messages and diffs | Understanding recent changes, context |
| `code-snippet` | User-provided code snippet (passed via CLI) | Focused code review, targeted analysis |

### Blueprint-level vs Agent-level Context

**Blueprint-level** (all agents see this):
```yaml
context:
  - git-diff
  - file-tree
```

**Agent-level** (only this agent sees this):
```yaml
agents:
  security-reviewer:
    prompt: "Review for vulnerabilities..."
    context:
      - git-diff
  style-reviewer:
    prompt: "Review style and readability..."
    context:
      - file-tree
```

**Merging:** If a blueprint has context at the top level AND an agent has its own context, the agent's context overrides (not append).

## Flow Syntax

Control execution topology using the `flow` field. Syntax:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `A, B, C` | All parallel | Three researchers run simultaneously |
| `A → B → C` | Sequential pipeline | A finishes, then B, then C |
| `A, B → C` | Parallel then sequential | A+B run together, then C uses their output |
| `A → B, C → D` | Mixed stages | A runs, then B+C parallel, then D |

**Symbols:**
- `,` = parallel within a stage (same row)
- `→` or `->` = next stage (proceed to next row)

**Rules:**
- Agent names must match keys in `agents:` section
- No cycles (DAG only)
- All agents referenced in `flow` must be defined
- Stage order is left-to-right in each arrow group

### Examples

#### Example 1: Fan-out then synthesis
```yaml
flow: "researcher1, researcher2, researcher3 → synthesizer"
```

Agents `researcher1`, `researcher2`, `researcher3` run in parallel.
When all complete, `synthesizer` runs with their output as context.

#### Example 2: Sequential pipeline
```yaml
flow: "scraper → parser → analyzer → reporter"
```

Runs one after another, each getting the previous output as context.

#### Example 3: Complex multi-stage
```yaml
flow: "searcher → analyzer1, analyzer2, analyzer3 → consensus → reviewer"
```

1. `searcher` runs first
2. `analyzer1`, `analyzer2`, `analyzer3` run in parallel (using searcher's output)
3. `consensus` synthesizes the three analyses
4. `reviewer` makes final recommendations

## Full Blueprint Examples

### Example 1: Code Review Blueprint

```yaml
name: code-review
description: "Multi-perspective code review: security, performance, style"
context:
  - git-diff
flow: "security-reviewer, perf-reviewer, style-reviewer → synthesis"
agents:
  security-reviewer:
    prompt: |
      You are a security expert. Review the code changes for:
      - Vulnerability patterns (SQLi, XSS, auth bypass, etc.)
      - Unsafe dependencies or versions
      - Secrets or credentials in code
      - Access control issues
      
      Be thorough and suggest fixes.
  perf-reviewer:
    prompt: |
      You are a performance engineer. Review the code changes for:
      - Algorithmic inefficiencies (O(n²) where O(n log n) is possible)
      - Memory leaks or excessive allocations
      - Database query inefficiencies (N+1 queries)
      - Missing caches or indexes
      
      Suggest optimization strategies.
  style-reviewer:
    prompt: |
      You are a code quality expert. Review for:
      - Readability and clarity
      - Code organization and cohesion
      - Test coverage gaps
      - Documentation needs
      - Architectural patterns and anti-patterns
  synthesis:
    prompt: |
      Synthesize the security, performance, and style reviews into a single cohesive code review.
      Organize findings by severity (critical, high, medium, low).
      Provide a final recommendation (approve, request changes, comment).
```

### Example 2: Research Blueprint

```yaml
name: research
description: "Multi-perspective research and synthesis"
flow: "researcher_a, researcher_b, researcher_c → analyst → synthesizer"
agents:
  researcher_a:
    prompt: |
      Research {task} focusing on recent developments and news.
      Use web search to find latest articles, papers, and announcements.
  researcher_b:
    prompt: |
      Research {task} focusing on technical specifications and capabilities.
      Deep dive into documentation, benchmarks, and comparisons.
  researcher_c:
    prompt: |
      Research {task} focusing on use cases and real-world adoption.
      Find examples, case studies, and testimonials.
  analyst:
    prompt: |
      Analyze the three research perspectives.
      Identify patterns, consensus, and disagreements.
  synthesizer:
    prompt: |
      Create a comprehensive report synthesizing all findings.
      Structure: Executive Summary, Findings by Category, Recommendations, References.
```

### Example 3: Debugging Blueprint

```yaml
name: debug-auth
description: "Multi-angle debugging: logs, code review, architecture"
context:
  - stack-trace
  - recent-commits
  - git-diff
flow: "log-analyzer, code-reviewer → debugger"
agents:
  log-analyzer:
    prompt: |
      Analyze the error logs and stack trace for {task}.
      Identify the failure point and trace backwards through the call stack.
      What are the immediate and root causes?
  code-reviewer:
    prompt: |
      Review the relevant code for {task}.
      Look at recent changes (git-diff) that might have introduced the bug.
      Check for logic errors, race conditions, or state management issues.
  debugger:
    prompt: |
      Combine log analysis and code review into a debugging report.
      Provide:
      1. Root cause
      2. Why it happened (code path explanation)
      3. Immediate fix
      4. Long-term prevention (tests, linting, etc.)
```

## Authoring Tips

### Clarity
- **Use clear role titles** — `security-reviewer` is better than `agent-2`
- **Write specific prompts** — "Review for SQL injection vulnerabilities" not "Review code"
- **Use `{task}` placeholder** — Claude substitutes the actual task into each prompt

### Topology
- **Parallel is faster** — Use parallel agents when they're independent (different perspectives)
- **Sequential for refinement** — Use pipelines when each stage builds on the previous (analyze → synthesize → polish)
- **Be selective** — 3 parallel agents + 1 synthesis = usually good; more agents don't always mean better results

### Context
- **Less is more** — Only include context that agents actually need
- **Large files slow agents down** — Use `file-tree` for structure, not full file contents
- **git-diff is focused** — Best for code review (only changed lines)
- **Don't use all at once** — Each context provider adds latency

### Prompts
- **Multi-line prompts** — Use `|` for readability:
  ```yaml
  prompt: |
    Line 1
    Line 2
    Line 3
  ```
- **Task-specific** — Mention the type of task (e.g., "code review", "research", "debug")
- **Examples help** — Include a sample output format if structured output is important
- **Constraints are useful** — E.g., "Be concise (< 5 bullet points)", "Focus on critical issues only"

### Performance
- **2-3 agent fan-outs** — Sweet spot for parallelism
- **Keep stages lean** — Avoid massive pipelines (A → B → C → D → E); break into fan-out groups
- **Timeout context gathering** — Very large codebases with `file-tree` can be slow
- **Test with preview** — Use `/swarm preview <blueprint>` to see estimated timing

## Common Patterns

### Pattern 1: Multi-perspective analysis
Useful for code review, design review, research.

```yaml
flow: "perspective1, perspective2, perspective3 → synthesis"
```

### Pattern 2: Sequential refinement
Useful for content creation, debugging, problem-solving.

```yaml
flow: "generator → reviewer → refiner"
```

### Pattern 3: Source → Process → Output
Useful for data pipelines, ETL, report generation.

```yaml
flow: "source_reader → processor1, processor2 → aggregator → reporter"
```

### Pattern 4: Checker + Implementer
Useful for validation and fixes.

```yaml
flow: "validator → reviewer → implementer"
```

## Validation

Before running a blueprint, use:

```
/swarm preview <blueprint>
```

This checks:
- ✓ YAML syntax is valid
- ✓ All agents in flow are defined
- ✓ Flow topology is acyclic (no loops)
- ✓ Context providers are recognized
- ✓ No duplicate agent names

## See Also

- [Swarm Quick Start](/docs/swarm-quickstart.md) — Get started fast
- [/swarm new](/skills/swarm-new.md) — Auto-generate blueprints
- [/swarm run](/skills/swarm.md) — Execute blueprints
- [/swarm preview](/skills/swarm-preview.md) — Validate before running

## Conditional Topology (Phase 2)

Blueprints can group agents and branch on conditions.

- **`groups`** — named sets of agents that execute as a unit. Each group needs an `agents` list; `description` is optional.
- **`conditions`** — named decision gates. Two types are supported:
  - `type: validation` with `criteria: no-errors | no-warnings | all-pass`
  - `type: agent_output` with `source` (an agent name), `check` (a field in that agent's JSON output), and `threshold` (e.g. `"> 0.8"`, `"== success"`).
- **Conditional flow** — `"G → if cond: trueTarget else: falseTarget"`. Targets are group or agent names. Note: comma-parallel syntax is not supported in Phase-2 flows — group the agents instead.

Note: condition *definitions* are validated and compiled into the execution
graph now. Live *evaluation* of conditions during a run is a later phase.

The dry-run preview visualizes Phase-2 blueprints: groups render as boxes,
conditions as diamonds, and branches as green (true) / red (false) edges.
The wizard builder can author `groups` and `conditions` programmatically.
