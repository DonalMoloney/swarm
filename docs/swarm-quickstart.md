# Swarm Quick Start

Get started with Swarm in 5 minutes. Run your first multi-agent swarm in four easy steps.

## 1. Suggest a Blueprint (2 min)

Describe what you want to do, and Claude will generate a blueprint for you.

```
/swarm new "compare three Python web frameworks and recommend the best for my startup"
```

Claude will:
1. Analyze your description
2. Suggest a blueprint with agents and flow
3. Show you the YAML
4. Ask: Accept? (yes/no/edit)

**Respond with `yes`** to save the blueprint to `swarms/compare-frameworks.yaml`.

**Shortcut:** Use `--wizard` for interactive step-by-step:
```
/swarm new --wizard
```

## 2. Preview Before Running (1 min)

Check the topology and execution plan before you commit.

```
/swarm preview compare-frameworks
```

You'll see:
- **Topology graph** — Visual diagram of agent flow
- **Execution plan** — Which agents run when and in what order
- **Timing estimate** — How long the swarm will take
- **Validation** — Any warnings or issues

This is a safe, no-cost check. Great for new blueprints.

## 3. Run the Swarm (1 min)

Execute the blueprint against your task.

```
/swarm compare-frameworks "We're building a web app for a 5-person startup with a tight timeline"
```

Swarm will:
1. Parse your task and blueprint
2. Start the live dashboard at `http://localhost:7700`
3. Spawn agents in parallel (or sequence, depending on the flow)
4. Stream real-time progress to the dashboard
5. Save the final output to `swarms/output/compare-frameworks-<date>.md`

**Open the dashboard** at `http://localhost:7700` to watch agents working in real-time. You'll see:
- Topology graph with live agent status
- Log stream of each agent's output
- Progress bar showing stage completion

## 4. If It Fails, Resume (1 min)

If the swarm is interrupted (timeout, connection drop, cancelled), Swarm saves a checkpoint after each stage.

The next time you run the same blueprint, you'll see:

```
Checkpoint found: compare-frameworks (completed: stage 2 of 3, 10 minutes ago)
Resume from stage 3? (yes/no)
> yes

Resuming from stage 3...
```

**Answer `yes`** to skip completed stages and resume from where you left off. Perfect for:
- Network interruptions
- Tweaking a prompt mid-run
- Adding more context between stages

Or view all resumable runs:
```
/swarm history
```

---

## Next Steps

Now that you understand the basics:

- **Create more blueprints** — Try `/swarm new` with different tasks
- **Learn flow syntax** — See [Blueprint Authoring Guide](/docs/swarm-authoring.md) for advanced topologies
- **Explore context** — Add `--context git-diff,file-tree` to give agents visibility into your codebase
- **Customize agents** — Edit `swarms/your-blueprint.yaml` to tweak prompts and agent roles

## Links

- [/swarm run](/skills/swarm.md) — Full reference on running swarms
- [/swarm new](/skills/swarm-new.md) — Quick suggest mode
- [/swarm new --wizard](/skills/swarm-init.md) — Interactive wizard
- [/swarm preview](/skills/swarm-preview.md) — Preview before running
- [Blueprint Authoring Guide](/docs/swarm-authoring.md) — Deep dive on YAML and flow syntax
- [Swarm History](/skills/swarm-history.md) — View past runs and checkpoints
