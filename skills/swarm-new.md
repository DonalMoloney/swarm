---
name: swarm-new
description: Generate a new swarm blueprint from a natural language description.
---

# /swarm new

Generate a new swarm blueprint from a description. Claude will suggest an initial YAML blueprint that you can accept, edit, or iterate on.

## Usage

### Quick suggest
```
/swarm new "compare three AI frameworks and recommend the best for web apps"
```

Claude will:
1. Analyze your description
2. Suggest a blueprint with relevant agents and flow
3. Show you the generated YAML
4. Ask: Accept? (yes/no/edit)

### With wizard mode
```
/swarm new --wizard
```

Opens an interactive questionnaire with 6 steps to guide you through blueprint creation. See [/swarm new --wizard](/swarm-init.md) for details.

### With template
```
/swarm new --template research "my new task"
```

Start with a predefined template (research, code-review, debug, analyze) and customize it for your task.

## How It Works

### Quick Suggest Algorithm

1. **Extract intent** — Parse your description for key concepts (e.g., "compare frameworks" → `comparison` tag)
2. **Keyword match** — Match tags to agent roles (research → searcher, analyst, synthesizer)
3. **Infer topology** — Determine if agents should run in parallel or sequence
   - Parallel (fan-out): exploratory tasks (research, audit, analyze multiple sources)
   - Sequential (pipeline): refinement tasks (suggest → review → polish)
4. **Generate YAML** — Create a blueprint with:
   - Appropriate agent count
   - Clear role prompts based on intent
   - Reasonable flow (usually fan-out then synthesis)
5. **Show for review** — Display the YAML and ask if you want to proceed

### Response Loop

After Claude shows the blueprint:

- **`yes`** — Accept the blueprint, save it as `swarms/<name>.yaml`, offer to run it
- **`no`** — Discard and start over (or suggest alternatives)
- **`edit`** — Show the YAML in an editor, make changes, validate
- **`try`** — Run a dry-run preview with `/swarm preview`

## Examples

### Example 1: Research task
```
/swarm new "research the latest AI safety regulations across US, EU, and China"
```

**Suggested blueprint:**
```yaml
name: ai-safety-research
description: "Research latest AI safety regulations across regions"
flow: "us-researcher, eu-researcher, china-researcher → synthesizer"
agents:
  us-researcher:
    prompt: "Research latest US AI safety regulations and policies..."
  eu-researcher:
    prompt: "Research latest EU AI safety regulations (GDPR, AI Act)..."
  china-researcher:
    prompt: "Research latest China AI regulations..."
  synthesizer:
    prompt: "Synthesize findings from three regions into a summary report..."
```

### Example 2: Code review task
```
/swarm new "review this PR for security and performance issues"
```

**Suggested blueprint:**
```yaml
name: code-review-security-perf
description: "Security and performance code review"
flow: "security-reviewer, perf-reviewer → synthesis"
agents:
  security-reviewer:
    prompt: "Review the PR for security vulnerabilities..."
  perf-reviewer:
    prompt: "Review the PR for performance issues..."
  synthesis:
    prompt: "Combine security and performance findings into a clear review..."
```

## Tips

- **Be specific** — "compare frameworks" is better than "analyze stuff"
- **Mention agent count** — "have 3 researchers" guides the suggestion
- **Mention flow preference** — "parallel research then synthesis" vs "sequential pipeline"
- **Use templates for common tasks** — `--template research` is faster for well-known patterns
- **Iterate** — If the first suggestion isn't right, say "no" and try a different description

## See Also

- [/swarm new --wizard](/swarm-init.md) — Interactive step-by-step wizard
- [/swarm run](/swarm-run.md) — Execute a blueprint
- [/swarm preview](/swarm-preview.md) — Preview before running
- [Blueprint Authoring Guide](/docs/swarm-authoring.md) — Deep dive on YAML structure
