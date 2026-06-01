---
name: swarm
description: Orchestrate a multi-agent swarm from a YAML blueprint. Supports parallel fan-out and sequential pipeline topologies with a live dashboard.
---

# /swarm — Multi-Agent Swarm Orchestrator

Run a named swarm blueprint against a task. Spawns agents in the correct topology, streams progress to the live dashboard, and saves the final output.

## Usage

```
/swarm <blueprint> "<task>"
/swarm <blueprint> "<task>" --dry-run
/swarm list
```

## Instructions

When invoked, follow these steps exactly:

### 0. Parse arguments

Extract from the invocation:
- `BLUEPRINT_NAME` — first argument (e.g. `research`, `code-review`, `debug`)
- `TASK` — the quoted task description
- `DRY_RUN` — true if `--dry-run` flag present
- `CONTEXT_PROVIDERS` — value of `--context` flag if present (comma-separated, e.g. `git-diff,stack-detect`), else empty string

If the command is `/swarm list`, run: `ls swarms/*.yaml` and print the available blueprints, then stop.

If no blueprint name or task is provided, print:
```
Usage: /swarm <blueprint> "<task>"
       /swarm list

Available blueprints:
```
Then list `swarms/` contents and stop.

### 1. Read the blueprint

Read the file at `swarms/<BLUEPRINT_NAME>.yaml`. If it does not exist, list available blueprints and stop with a clear error.

### 2. Validate and compile

Run the compiler to validate and show the execution plan:
```bash
node runtime/compiler.js swarms/<BLUEPRINT_NAME>.yaml
```

If validation fails, show the errors and stop.

If `--dry-run` was specified, stop here after showing the plan.

### 3. Clear previous run state

```bash
mkdir -p .swarm && node runtime/events.js clear
```

### 4. Start the dashboard

```bash
node runtime/dashboard.js 7700 &
```

Wait 500ms for it to start. Print:
```
Dashboard: http://localhost:7700
```

### 5. Emit swarm_start event

Emit a `swarm_start` event with the blueprint name, task, agent list, and stages. Use this exact format — write a JSON line to `.swarm/events.jsonl`:

```bash
node runtime/events.js swarm_start "<BLUEPRINT_NAME>" "running" "<TASK>"
```

For the full stages structure, write it directly:
```bash
node -e "
const { compile } = require('./runtime/compiler.js');
const fs = require('fs');
const yaml = require('./runtime/simple-yaml.js');
const bp = yaml.parse(fs.readFileSync('swarms/<BLUEPRINT_NAME>.yaml','utf8'));
const plan = compile(bp);
const evt = { type:'swarm_start', agent:'<BLUEPRINT_NAME>', message:'<TASK>', stages: plan.stages, agents: Object.keys(bp.agents), ts: Date.now() };
fs.appendFileSync('.swarm/events.jsonl', JSON.stringify(evt)+'\n');
"
```

### 5b. Gather context

Determine the context providers to use:
1. If the blueprint has a `context:` field, use those providers.
2. If `--context` was passed on the command line, use those providers (comma-separated, no spaces).
3. If both are present, merge and deduplicate.
4. If neither, skip this step (`CONTEXT_BLOCK` = empty string).

If providers were determined, run:

```bash
node -e "
const { gather } = require('./runtime/context');
const providers = '<PROVIDERS>'.split(',').map(p => p.trim()).filter(Boolean);
process.stdout.write(gather(providers));
" > .swarm/context.txt
```

Set `CONTEXT_BLOCK` = contents of `.swarm/context.txt`.

If `CONTEXT_BLOCK` is non-empty, print:
```
Context gathered: <PROVIDERS>
```

### 5c. Actions permission gate

Check whether the blueprint declares an `actions` field with one or more values.

If `actions` is present and non-empty, **stop and show this prompt to the user before proceeding**:

```
⚠ This swarm has action permissions: <actions joined by ", ">
  Agents will be permitted to:
    - edit-files  → modify files in your working tree
    - run-tests   → execute shell commands (tests, builds)
    - open-pr     → run `gh pr create` to open a pull request

  Type "yes" to proceed, or anything else to cancel.
```

Wait for the user's response.
- If the user types exactly `yes` (case-insensitive), continue to step 6.
- If the user types anything else, emit:
  ```bash
  node runtime/events.js swarm_done swarm cancelled "Cancelled by user at permission gate"
  ```
  Then stop and print:
  ```
  Swarm cancelled.
  ```

If `--dry-run` is active, skip this gate entirely (dry runs never execute agents).

### 6. Execute the swarm

Parse the stages from the blueprint's flow string. For each stage:

**Parallel stage** (multiple agents separated by commas):
- Emit `agent_start` for each agent: `node runtime/events.js agent_start <name> running "Starting…"`
- Spawn all agents in this stage simultaneously using the Agent tool
- Each agent prompt = the agent's `prompt` from the blueprint + "\n\nTask: " + TASK + (if CONTEXT_BLOCK is non-empty: "\n\n" + CONTEXT_BLOCK) + (if stage > 0: "\n\nPrevious stage output:\n" + prior_output) + the **contract suffix**: a fenced ```json block instructing the agent to end with `{ "status": "success|partial|error", "summary": "<one line>", ...extra fields }`. Parse that block from each agent's output; if absent, treat the raw text as `{status:"success", summary:<first line>}`.
- After all complete, emit `agent_done` for each: `node runtime/events.js agent_done <name> done "<first 100 chars of output>"`

**Sequential stage** (single agent):
- Emit `agent_start`
- Spawn the agent with its role + task + all prior stage outputs concatenated
- Emit `agent_done` with a snippet of the output

### 7. Save output and record history

```bash
mkdir -p swarms/output
```

Write the final agent's output to `swarms/output/<BLUEPRINT_NAME>-<YYYYMMDD-HHmmss>.md`.

Then append to the run history index:

```bash
node -e "
const history = require('./runtime/history');
const id = '<BLUEPRINT_NAME>-<YYYYMMDD-HHmmss>';
history.append({
  id: id,
  blueprint: '<BLUEPRINT_NAME>',
  task: '<TASK>',
  file: id + '.md',
  ts: Date.now()
});
"
```

Replace `<BLUEPRINT_NAME>`, `<YYYYMMDD-HHmmss>`, and `<TASK>` with the actual values from this run.

### 8. Emit swarm_done

```bash
node runtime/events.js swarm_done swarm done "Swarm complete. Output saved."
```

### 9. Report to user

Print a summary:
```
✓ Swarm complete: <BLUEPRINT_NAME>
  Agents run: <count>
  Output: swarms/output/<file>
  Dashboard: http://localhost:7700
```

---

## Event types reference

| type | when |
|------|------|
| `swarm_start` | before any agents run |
| `agent_start` | when an agent begins |
| `agent_log` | mid-agent progress update (optional) |
| `agent_done` | agent completed successfully |
| `agent_error` | agent failed |
| `swarm_done` | all agents complete |

## Checkpoint & Resume

After each stage completes successfully, Swarm saves a checkpoint with:
- Stage number and timestamp
- All agent outputs from completed stages
- Enough context to resume execution

On the next run of the same blueprint, Swarm detects the checkpoint and prompts:

```
Checkpoint found: research (completed: stage 2 of 4, 5 minutes ago)
Resume from stage 3? (yes/no)
> yes

Resuming from stage 3...
```

If you answer `yes`, execution skips to stage 3 (all prior outputs are re-fed as context).

### Use Cases

- **Network timeout** — Agent partially complete, connection dropped. Resume later.
- **Prompt refinement** — Run stages 1-2, tweak the stage 3 prompt, resume from stage 3.
- **Interrupted session** — Had to stop mid-run. Resume the next day.
- **Debugging** — Run stage 1, inspect outputs, run stage 2 with adjusted context.

### How It Works

1. After each stage completes → `node runtime/checkpoint.js save <blueprint> <stage> <outputs>`
2. Next run → `node runtime/checkpoint.js detect <blueprint>` checks for recent checkpoint
3. If found → show resume prompt to user
4. If user resumes → skip to that stage, re-feed all prior outputs

### View Resumable Runs

```
/swarm history
```

Shows list of completed and resumable swarms:

```
Recent swarms:
  research              — stage 3 of 5 (4 hours ago)   [resumable]
  code-review           — stage 2 of 2 (complete)      [completed]
  debug-auth            — stage 1 of 3 (30 min ago)    [resumable]
```

Checkpoints are stored in `.swarm/checkpoints/<blueprint>/` and are automatically cleaned up after 7 days or when explicitly discarded.

## Error handling

- If an agent fails, emit `agent_error`, log the error, and continue with remaining agents
- Pass a `[FAILED: <agent>]` marker in the context for downstream pipeline agents
- If the dashboard port is taken, it will auto-increment — read the printed port from stdout

## Programmatic runner (Phase 3)

For linear/parallel blueprints (no groups/conditions), you may execute the swarm
with enforced timeouts, retries, and budgets instead of spawning agents by hand:

```bash
node runtime/runner.js swarms/<blueprint>.yaml "<task>" [--max-cost <usd>] [--timeout <seconds>] [--model <name>]
```

The runner drives the `claude` CLI per agent, appends the same events to
`.swarm/events.jsonl` (now including `tokens`, `cost_usd`, `status`, plus
`agent_retry` and `budget_exceeded`), saves output, and records history.
Blueprints that use Phase-2 groups/conditions are **not** handled by the runner —
run those with the steps above. Per-run limits come from the blueprint's
`limits:` block (or the CLI flags):

```yaml
limits:
  agent_timeout: 300   # seconds per agent attempt
  agent_retries: 1
  max_cost_usd: 1.00   # per-run budget; run aborts if exceeded
  max_tokens: 200000
```
