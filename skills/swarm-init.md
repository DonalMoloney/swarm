---
name: swarm-init
description: Interactive wizard for creating a swarm blueprint step by step.
---

# /swarm new --wizard (Interactive Wizard)

Step-by-step interactive questionnaire to build a swarm blueprint from scratch. Great for learning the system or creating complex blueprints with custom logic.

## Usage

```
/swarm new --wizard
```

The wizard guides you through 6 steps and generates a complete blueprint YAML file.

## Wizard Steps

### Step 1: Name
```
What would you like to call this swarm?
> my-research-project
```

Used as the blueprint filename (`swarms/my-research-project.yaml`).

### Step 2: Description
```
Brief description of what this swarm does:
> Researches AI frameworks and compares their pros/cons for web applications
```

Displayed in the blueprint and dashboard.

### Step 3: Agents
```
How many agents do you need? (1-10, press Enter for 3)
> 4

Agent 1 name:
> researcher_1

Agent 1 role (brief):
> Research PyTorch ecosystem and capabilities

Agent 2 name:
> researcher_2

Agent 2 role (brief):
> Research TensorFlow ecosystem and capabilities

...
```

For each agent:
- Specify a name (slug format: `lowercase_with_underscores`)
- Specify a role/prompt (what this agent does)

### Step 4: Context
```
What context should agents have access to?
(comma-separated: git-diff, file-tree, stack-trace, recent-commits, none)
> git-diff, file-tree

This helps agents understand your codebase and recent changes.
```

Optional. Agents can work without context.

### Step 5: Flow
```
How should agents run?

1. Parallel (all at once, then synthesis)
   "agent_1, agent_2, agent_3 → synthesizer"

2. Sequential (pipeline)
   "agent_1 → agent_2 → agent_3"

3. Mixed (some parallel, some sequential)
   "agent_1, agent_2 → agent_3 → agent_4"

Enter your flow (or press Enter for: agents in parallel, then synthesis):
> researcher_1, researcher_2, researcher_3 → synthesis
```

Controls execution topology. See [flow syntax](/docs/swarm-authoring.md#flow-syntax).

### Step 6: Review
```
Here's your blueprint:

name: my-research-project
description: Researches AI frameworks and compares their pros/cons for web applications
flow: researcher_1, researcher_2, researcher_3 → synthesis
agents:
  researcher_1:
    prompt: Research PyTorch ecosystem and capabilities...
  researcher_2:
    prompt: Research TensorFlow ecosystem and capabilities...
  researcher_3:
    prompt: Research JAX ecosystem and capabilities...
  synthesis:
    prompt: Synthesize findings into a recommendation...

Save and run? (yes/no/edit)
> yes
```

After the wizard completes:
- **`yes`** — Save the blueprint and optionally run it
- **`no`** — Discard and exit
- **`edit`** — Show the YAML in an editor for manual tweaks

## Why Use the Wizard?

- **No YAML syntax needed** — Guided prompts instead of manual editing
- **Learn as you go** — Each step explains what it does
- **Best practices** — Recommends sensible defaults (3 agents, parallel-then-synthesis topology)
- **Less iteration** — Questions help you think through your blueprint upfront
- **Great for complex blueprints** — Multi-stage pipelines are easier to design interactively

## Example Walkthrough

```
/swarm new --wizard

Welcome to the Swarm Blueprint Wizard.
Let's create your blueprint step by step.

Step 1 of 6: Name
> code-review-team

Step 2 of 6: Description
> Multi-perspective code review: security, performance, style
> 

Step 3 of 6: Agents (3 by default)
How many agents? (1-10, default 3)
> 3

Agent 1 name:
> security-reviewer

Agent 1 role:
> Check for security vulnerabilities and unsafe patterns

Agent 2 name:
> performance-reviewer

Agent 2 role:
> Identify performance bottlenecks and optimization opportunities

Agent 3 name:
> style-reviewer

Agent 3 role:
> Review code style, readability, and architectural patterns

Step 4 of 6: Context
What context should agents access? (git-diff, file-tree, stack-trace, recent-commits, none)
> git-diff, file-tree

Step 5 of 6: Flow
Suggested: "security-reviewer, performance-reviewer, style-reviewer → synthesis"
Press Enter to accept, or enter your own:
> 

Step 6 of 6: Review
[Shows full YAML]
Save and run? (yes/no/edit)
> yes

✓ Blueprint saved: swarms/code-review-team.yaml
Ready to run? (yes/no)
> yes

Running /swarm code-review-team...
Dashboard: http://localhost:7700
```

## Tips

- **Press Enter** — Accepts the default suggestion
- **`none` for context** — If you don't want agents to see your code
- **Three agents** — Good starting point for research and review tasks
- **Synthesis agent** — Wizard auto-creates one if you have multiple parallel agents
- **Edit later** — You can always manually edit the YAML file afterward

## See Also

- [/swarm new](/swarm-new.md) — Quick suggest (non-interactive)
- [/swarm run](/swarm-run.md) — Execute a blueprint
- [Blueprint Authoring Guide](/docs/swarm-authoring.md) — Deep dive on YAML and flow syntax
