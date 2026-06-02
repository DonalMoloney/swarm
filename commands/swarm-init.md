---
name: swarm-init
description: Scaffold a new swarm blueprint from a template archetype (research, pipeline, parallel).
---

# /swarm init — Blueprint Scaffolder

Scaffolds a brand-new blueprint at `swarms/<name>.yaml` from one of three template
archetypes. This is the fast path for creating a blueprint; for a guided,
question-by-question build use `/swarm new --wizard` instead.

## Usage

```
/swarm init <name>                  — defaults to the "research" archetype
/swarm init <name> research         — fan-out research → synthesiser
/swarm init <name> pipeline         — sequential stage-by-stage pipeline
/swarm init <name> parallel         — N agents all running in parallel
```

`<name>` must be slug format: `lowercase-with-dashes` or `lowercase_with_underscores`.

## Instructions

When invoked as `/swarm init <name> [archetype]`:

1. Validate `<name>`: it must match `^[a-zA-Z0-9_][a-zA-Z0-9_-]*$`. Reject invalid names.
2. Check `swarms/<name>.yaml` does not already exist. If it does, stop and ask the
   user whether to overwrite — never clobber silently.
3. Pick the archetype (default `research` if omitted). If the archetype is not one
   of `research`, `pipeline`, `parallel`, list the valid options and stop.
4. Write `swarms/<name>.yaml` using the matching template below, substituting
   `<name>` for the chosen name. Always include the `version: "1.0.0"` field.
5. Validate the generated blueprint: run
   `node runtime/compiler.js swarms/<name>.yaml`. If it errors, fix and retry.
6. Tell the user the file path and remind them to edit the agent `role` fields, then
   run it with `/swarm <name> "<task>"`.

## Templates

### research — fan-out then synthesise

```yaml
name: <name>
version: "1.0.0"
description: "Fan-out research then synthesise a final report"
flow: "searcher, analyst → synthesiser"
output: markdown

agents:
  searcher:
    role: Search the web for relevant, recent sources on the task. Return findings with URLs and key points.
    tools: [WebSearch, WebFetch]

  analyst:
    role: Reason about the task from first principles — dimensions, trade-offs, non-obvious insights. Do not search.

  synthesiser:
    role: Combine the searcher and analyst inputs into a structured markdown report with a summary and recommendations.
```

### pipeline — sequential stages

```yaml
name: <name>
version: "1.0.0"
description: "Sequential stage-by-stage pipeline"
flow: "stage-1 → stage-2 → stage-3"
output: markdown

agents:
  stage-1:
    role: Describe the first step of the pipeline and what it should output for stage-2.

  stage-2:
    role: Take the output of stage-1 and transform it. Describe what to produce for stage-3.

  stage-3:
    role: Take the output of stage-2 and produce the final result.
```

### parallel — independent agents, no aggregation

```yaml
name: <name>
version: "1.0.0"
description: "Independent agents running in parallel"
flow: "worker-1, worker-2, worker-3"
output: markdown

agents:
  worker-1:
    role: Describe what worker-1 should independently do and return.

  worker-2:
    role: Describe what worker-2 should independently do and return.

  worker-3:
    role: Describe what worker-3 should independently do and return.
```

## Notes

- The `version` field is metadata only — bump it (e.g. `"1.1.0"`) when you make
  meaningful changes so the Library tab and `runtime/library.js` reflect the change.
- All three archetypes are Phase-1 flows (comma = parallel, `→` = next stage). For
  conditional/group topologies, copy `swarms/research-conditional.yaml` as a starting point.

## See Also

- `/swarm new --wizard` — guided, step-by-step interactive blueprint builder
- `/swarm new "<description>"` — generate a blueprint from a natural-language description
- The **Library** tab in the dashboard (`http://localhost:7700`) lists all blueprints
  with their name, description, flow, and version.
