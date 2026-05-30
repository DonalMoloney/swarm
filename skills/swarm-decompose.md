---
name: swarm-decompose
description: Break a large goal into an ordered sequence of swarm runs using a meta-agent decomposer.
---

# /swarm decompose — Task Decomposition

```
/swarm decompose "<goal>"
/swarm decompose "<goal>" --dry-run
```

## Instructions

### 1. Parse arguments

Extract:
- `GOAL` — the quoted goal string
- `DRY_RUN` — true if `--dry-run` is present

### 2. List available blueprints

```bash
node -e "
const { listBlueprints } = require('./runtime/decomposer');
const list = listBlueprints();
console.log(list.join('\n'));
"
```

Save the output as `AVAILABLE_BLUEPRINTS` (newline-separated list).

### 3. Call the meta-agent

Spawn an agent with this prompt (fill in `GOAL` and `AVAILABLE_BLUEPRINTS`):

```
You are a task planner for a multi-agent system called Swarm.

Your job is to decompose the following goal into an ordered sequence of swarm runs.

Goal: <GOAL>

Available blueprints:
<AVAILABLE_BLUEPRINTS>

Rules:
- Use only blueprints from the available list above.
- Each step must have: step (number), blueprint (exact name), task (specific instruction for that run), reason (why this step is needed).
- Order steps so each one can use the output of the previous.
- Use 2–5 steps. Fewer is better — do not add steps unless they are clearly needed.
- Return ONLY a valid JSON array. No prose, no markdown fences. Example:
  [{"step":1,"blueprint":"research","task":"research X","reason":"need context before reviewing"},{"step":2,"blueprint":"code-review","task":"review based on research findings","reason":"apply research to find issues"}]
```

Save the agent's response as `META_AGENT_OUTPUT`.

### 4. Parse and validate the plan

Write `META_AGENT_OUTPUT` to `.swarm/meta-plan-raw.txt`:

```bash
mkdir -p .swarm
```

Then parse and validate:

```bash
node -e "
const { parsePlan, validatePlan, listBlueprints } = require('./runtime/decomposer');
const fs = require('fs');
const raw = fs.readFileSync('.swarm/meta-plan-raw.txt', 'utf8');
const steps = parsePlan(raw);
const available = listBlueprints();
const errors = validatePlan(steps, available);
if (errors.length) {
  console.error('Plan validation failed:');
  errors.forEach(e => console.error('  • ' + e));
  process.exit(1);
}
console.log(JSON.stringify(steps, null, 2));
"
```

If validation fails (non-zero exit), show the errors and stop.

### 5. Show plan and confirm

Print the plan to the user in this format:

```
Decomposition plan for: <GOAL>
─────────────────────────────────────────────────────
  Step 1: [blueprint: research]
          Task: research X
          Why:  need context before reviewing

  Step 2: [blueprint: code-review]
          Task: review based on research findings
          Why:  apply research to find issues
─────────────────────────────────────────────────────
  2 steps. Each step's output feeds into the next.
```

If `--dry-run`, stop here.

Otherwise ask the user:
```
Proceed with this plan? [y/N]
```

If the user does not confirm with `y` (case-insensitive), print `Decomposition cancelled.` and stop.

### 6. Execute steps in sequence

For each step in order:

1. Print: `── Step N/TOTAL: <blueprint> — <task> ──`

2. Run the swarm for this step. If step N > 1, inject the prior step's output:
   - Use task text: `<task>\n\nContext from previous step:\n<prior_output>`

3. Save this step's final agent output as `STEP_N_OUTPUT`.

4. Print on completion: `✓ Step N complete`

### 7. Save combined output

Create the output file at `swarms/output/decompose-<YYYYMMDD-HHmmss>.md`:

```markdown
# Decomposition: <GOAL>

## Step 1 — <blueprint>: <task>
<step 1 output>

## Step 2 — <blueprint>: <task>
<step 2 output>
```

Record in history:

```bash
node -e "
const history = require('./runtime/history');
history.append({
  id: 'decompose-<YYYYMMDD-HHmmss>',
  blueprint: 'decompose',
  task: '<GOAL>',
  file: 'decompose-<YYYYMMDD-HHmmss>.md',
  ts: Date.now()
});
"
```

### 8. Report to user

```
✓ Decomposition complete: <N> steps
  Goal: <GOAL>
  Output: swarms/output/decompose-<YYYYMMDD-HHmmss>.md
  Dashboard: http://localhost:7700
```
