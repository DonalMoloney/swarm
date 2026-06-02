---
marp: true
theme: default
paginate: true
backgroundColor: #050d1a
color: #e8f4fd
style: |
  section {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 1.08em;
    padding: 52px 72px;
  }
  h1 { color: #06b6d4; font-size: 2.6em; margin-bottom: 0.15em; line-height: 1.1; }
  h2 { color: #38bdf8; font-size: 1.6em; border-bottom: 2px solid #0c2d4a; padding-bottom: 0.3em; margin-bottom: 0.6em; }
  h3 { color: #7dd3fc; font-size: 1.05em; margin: 0 0 0.3em 0; }
  code { background: #071526; color: #67e8f9; padding: 3px 8px; border-radius: 4px; font-size: 0.95em; }
  pre { background: #071526; border-left: 4px solid #06b6d4; padding: 20px 24px; border-radius: 8px; font-size: 0.95em; box-shadow: -4px 0 24px rgba(6,182,212,0.18); }
  strong { color: #f0abfc; }
  em { color: #34d399; font-style: normal; }
  ul { margin-top: 0.3em; }
  ul li { margin: 0.45em 0; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; font-size: 0.95em; }
  th { color: #38bdf8; border-bottom: 2px solid #0c2d4a; padding: 10px 14px; text-align: left; }
  td { padding: 10px 14px; border-bottom: 1px solid #0a1e33; }
  tr:last-child td { border-bottom: none; }

  /* ── Layout ── */
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5em; align-items: start; margin-top: 0.5em; }
  .cols3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.2em; align-items: start; margin-top: 0.5em; }
  .box { background: #071e36; border-left: 3px solid #06b6d4; padding: 16px 18px; border-radius: 8px; }
  .hero { font-size: 2.2em; font-weight: bold; color: #06b6d4; text-align: center; padding: 0.4em 0; letter-spacing: -0.01em; text-shadow: 0 0 30px rgba(6,182,212,0.4); }

  /* ── Gantt chart ── */
  .gantt { margin: 0.8em 0 0.4em; }
  .grow { display: flex; align-items: center; gap: 0.8em; margin: 0.45em 0; }
  .glabel { width: 110px; font-size: 0.75em; color: #7dd3fc; text-align: right; flex-shrink: 0; }
  .gtrack { display: flex; flex: 1; gap: 4px; align-items: stretch; }
  .gstack { display: flex; flex-direction: column; gap: 4px; flex: 2; }
  .gbar { height: 30px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 0.72em; font-weight: bold; flex: 1; }
  .gbar.seq  { background: #1a3a5c; color: #7dd3fc;  border: 1px solid #0369a1; }
  .gbar.par  { background: #0f3d2a; color: #34d399;  border: 1px solid #059669; }
  .gbar.syn  { background: #2d1a4a; color: #f0abfc;  border: 1px solid #9333ea; }
  .gbar.gap  { background: transparent; border: none; flex: 2; }
  .gcaption  { font-size: 0.68em; color: #475569; margin-top: 0.5em; text-align: right; }

  /* ── Scorecard ── */
  .score-card { background: #071e36; border: 1px solid #0c2d4a; border-radius: 10px; padding: 14px 16px; }
  .score-card.winner { border: 2px solid #06b6d4; box-shadow: 0 0 20px rgba(6,182,212,0.15); }
  .score-name { font-size: 0.85em; font-weight: bold; margin-bottom: 0.5em; padding-bottom: 0.4em; border-bottom: 1px solid #0c2d4a; color: #e8f4fd; }
  .score-card.winner .score-name { color: #06b6d4; }
  .sitem { font-size: 0.72em; margin: 0.28em 0; line-height: 1.3; }
  .sitem.bad  { color: #f87171; }
  .sitem.good { color: #34d399; }
  .sitem.ok   { color: #fbbf24; }

  /* ── Flow diagrams ── */
  .flow-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2em; margin-top: 0.5em; }
  .fex { background: #071e36; border: 1px solid #0c2d4a; border-radius: 8px; padding: 12px 14px; }
  .fexpr { font-size: 0.75em; color: #67e8f9; margin-bottom: 0.5em; }
  .fviz { display: flex; align-items: center; gap: 7px; flex-wrap: nowrap; }
  .fnode { background: #0c2d4a; border: 1px solid #0369a1; border-radius: 5px; padding: 4px 10px; font-size: 0.75em; color: #e8f4fd; white-space: nowrap; }
  .fnode.r { background: #2d1a4a; border-color: #9333ea; color: #f0abfc; }
  .farrow { color: #06b6d4; font-size: 1em; }
  .fgroup { display: flex; flex-direction: column; gap: 5px; }
  .fdesc { font-size: 0.68em; color: #475569; margin-top: 0.4em; }

  /* ── Pipeline ── */
  .pipeline { display: flex; align-items: stretch; gap: 0; margin: 1em 0; }
  .pstep { background: #071e36; border: 1px solid #0c2d4a; border-radius: 8px; padding: 10px 8px; flex: 1; text-align: center; min-width: 0; }
  .pstep.e { border-color: #06b6d4; }
  .pstep.c { border-color: #0369a1; }
  .pstep.o { border-color: #34d399; }
  .picon { font-size: 1.3em; }
  .pname { font-size: 0.68em; color: #7dd3fc; margin-top: 3px; font-weight: bold; }
  .pdesc { font-size: 0.6em; color: #475569; margin-top: 2px; line-height: 1.3; }
  .parrow { color: #06b6d4; font-size: 1.3em; display: flex; align-items: center; padding: 0 2px; flex-shrink: 0; }

  /* ── Roadmap ── */
  .roadmap { display: flex; flex-direction: column; gap: 0.55em; margin-top: 0.6em; }
  .rrow { display: flex; align-items: center; gap: 0.9em; }
  .rdot { width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0; }
  .rdot.done   { background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,0.5); }
  .rdot.active { background: #38bdf8; box-shadow: 0 0 8px rgba(56,189,248,0.5); }
  .rdot.future { background: transparent; border: 2px solid #1e3a5c; }
  .rbar { flex: 1; height: 30px; border-radius: 5px; display: flex; align-items: center; padding: 0 14px; font-size: 0.76em; }
  .rbar.done   { background: #0f3d2a; border-left: 3px solid #34d399; color: #34d399; }
  .rbar.active { background: #071e36; border-left: 3px solid #38bdf8; color: #38bdf8; }
  .rbar.future { background: #071526; border-left: 3px solid #1e3a5c; color: #475569; }
  .rtag { font-size: 0.65em; color: #475569; width: 72px; text-align: right; flex-shrink: 0; }

  /* ── Section slides ── */
  section.lead {
    background: linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0284c7 100%);
    color: white; text-align: center; justify-content: center; padding: 80px;
  }
  section.lead h1 { color: white; font-size: 3.2em; text-shadow: 0 2px 24px rgba(0,0,0,0.5); margin-bottom: 0.2em; }
  section.lead h2 { color: rgba(255,255,255,0.78); border: none; font-size: 1.3em; font-weight: normal; }
  section.lead p  { color: rgba(255,255,255,0.6); font-size: 1em; }
  section.title { justify-content: center; }
  section.title h1 { font-size: 3.8em; }
  section.demo { justify-content: center; text-align: center; background: #020810; }
  section.demo h1 { font-size: 2.2em; color: #06b6d4; }
  section.demo pre { text-align: left; font-size: 1.15em; box-shadow: 0 0 50px rgba(6,182,212,0.25); }
---

<!-- _class: title -->

# Swarm

### Multi-agent orchestration for Claude Code

**Stop prompting one agent. Start orchestrating a team.**

<!--
Pause. Three full seconds. Let it land.

"Everything I'm about to show you runs inside this terminal.
No Python. No npm. No servers. No API dashboard.
One YAML file. One slash command.

I want to give you a new mental model for AI agents —
not as a smarter chatbot, but as a workforce you can direct."
-->

---

<!-- _class: lead -->

# Act I
## The Brilliant Bottleneck

<!--
Don't explain the title. Move straight to the next slide.
The next diagram will do the work.
-->

---

## One Mind. One Queue. One Wait.

**Every task waits for the one before it:**

<div class="gantt">
<div class="grow">
  <div class="glabel">One agent</div>
  <div class="gtrack">
    <div class="gbar seq">Research</div>
    <div class="gbar seq">Analysis</div>
    <div class="gbar syn">Synthesis</div>
  </div>
</div>
<div class="grow">
  <div class="glabel">Swarm</div>
  <div class="gtrack">
    <div class="gstack">
      <div class="gbar par">Research</div>
      <div class="gbar par">Analysis</div>
    </div>
    <div class="gbar syn">Synthesis</div>
  </div>
</div>
</div>
<div class="gcaption">Same intelligence. Same output quality. Half the wall-clock time.</div>

- One context window — the agent's entire world, shared across all concerns
- No coordination — it cannot hand work to a parallel copy of itself
- Opaque — you watch a cursor blink and hope for the best

<!--
"Think about hiring a house-moving team.
You could hire one brilliant person — genuinely excellent.
They pack the kitchen. Then the bedroom. Then the office.
Then they load the van. Then they drive. Then they unpack.

Or you hire a team. Kitchen and bedroom move in parallel.
The van is loaded the moment they're done.
Unpacking starts at the destination before the last box leaves.

Same people. Same intelligence. Completely different throughput.

AI agents hit exactly this wall. And this is the wall Swarm breaks."
-->

---

<!-- _class: lead -->

# Act II
## The Swarm

<!--
Lean into the energy here. The next slide is the payoff.
-->

---

## One Line. A Coordinated Team.

<div class="hero">searcher, analyst → synthesiser</div>

- **Comma** — agents that run *together*, in parallel, right now
- **Arrow** — a synchronisation barrier: block until all agents in the stage complete
- **Names** — each spawns a full Claude Code subagent with its own isolated context window
- The compiler turns this string into `{ stages: [["searcher","analyst"], ["synthesiser"]] }`

**That's the entire execution plan. Written in one line of YAML.**

<!--
"Read that line out loud. 'searcher comma analyst arrow synthesiser.'
You can hear the structure.

Comma is 'these run together.' Arrow is 'synchronise here, then advance.'

The compiler — about 150 lines of vanilla JS, no parser library —
splits on arrows to get stages, then splits each stage on commas to get parallel sets.
It outputs a stages array: each inner array is a set of agents that run concurrently.
The runtime iterates outer-to-inner: spawn all agents in a stage, await all, then advance.

You described a parallel pipeline in the time it takes to write a filename."
-->

---

## Not a Framework. Not a Server. Not Even a Package.

<div class="cols3">
<div class="score-card">
  <div class="score-name">LangChain / CrewAI</div>
  <div class="sitem bad">✗ Write Python to orchestrate</div>
  <div class="sitem bad">✗ Manage a Python environment</div>
  <div class="sitem bad">✗ Deploy and host a server</div>
  <div class="sitem bad">✗ No live execution dashboard</div>
  <div class="sitem bad">✗ Not Claude-native</div>
  <div class="sitem ok">~ Some blueprint reuse</div>
</div>
<div class="score-card">
  <div class="score-name">AutoGen / Native Claude Code</div>
  <div class="sitem bad">✗ Write code to orchestrate</div>
  <div class="sitem ok">~ Zero deps (Claude Code)</div>
  <div class="sitem bad">✗ No reusable blueprint</div>
  <div class="sitem bad">✗ No dashboard or visibility</div>
  <div class="sitem ok">~ Claude-native (Claude Code)</div>
  <div class="sitem bad">✗ One-off every time</div>
</div>
<div class="score-card winner">
  <div class="score-name">⚡ Swarm</div>
  <div class="sitem good">✓ Describe topology in YAML</div>
  <div class="sitem good">✓ Zero dependencies, ever</div>
  <div class="sitem good">✓ Runs inside your editor</div>
  <div class="sitem good">✓ Live topology dashboard</div>
  <div class="sitem good">✓ Built for Claude Code</div>
  <div class="sitem good">✓ Blueprints reuse forever</div>
</div>
</div>

*Those build products for your users. Swarm is a tool for **you**, right now, in your editor.*

<!--
"LangChain is excellent. CrewAI is excellent. They're for shipping products.
They ask you to write code that describes orchestration.

Swarm inverts this completely. The YAML IS the program.
You don't import a framework — you write a blueprint and type a slash command.

Claude Code can already spawn subagents natively.
But there's no blueprint, no topology, no dashboard, no history.
It's like having the engine but no steering wheel.
Swarm is the steering wheel."
-->

---

## 3× Faster. Same Quality. Zero Extra Work.

**`/swarm code-review "PR #42"`**

<div class="gantt">
<div class="grow">
  <div class="glabel">One agent</div>
  <div class="gtrack">
    <div class="gbar seq">Security</div>
    <div class="gbar seq">Performance</div>
    <div class="gbar seq">Style</div>
    <div class="gbar syn">Report</div>
  </div>
</div>
<div class="grow">
  <div class="glabel">Swarm</div>
  <div class="gtrack">
    <div class="gstack">
      <div class="gbar par">Security</div>
      <div class="gbar par">Performance</div>
      <div class="gbar par">Style</div>
    </div>
    <div class="gbar syn">Report</div>
  </div>
</div>
</div>
<div class="gcaption">4 sequential steps → 2 parallel stages. Reusable on every PR. Forever.</div>

- Three *specialist* agents — each focused, each with its own full context window
- One synthesiser — reads all three, writes one structured report
- *No prompt juggling. No copy-paste. Just run it again.*

<!--
"Here's the moment I want you to feel, not just understand.

Three agents run at the same time.
Security is reading your auth module.
Performance is already inside your database layer.
Style is checking your naming conventions.

They don't know about each other. They don't need to.
Each one has a fresh context window, entirely focused on its domain.

The synthesiser waits. Then it reads all three reports
and produces one clean, structured finding.

The same quality a single agent would eventually produce —
but in the time the slowest specialist takes, not the sum of all three.

And next PR? Same command. Same quality. Same speed."
-->

---

## One File. That's the Whole Program.

```yaml
name: code-review
flow: "security, performance, style → synthesiser"

agents:
  security:
    prompt: "You are a security expert. Hunt for vulnerabilities:
             SQL injection, broken auth, exposed secrets, insecure deps..."
  performance:
    prompt: "You are a performance engineer. Profile for N+1 queries,
             blocking I/O, memory leaks, inefficient algorithms..."
  style:
    prompt: "You are a senior engineer. Check naming, complexity,
             dead code, consistency with the existing codebase..."
  synthesiser:
    prompt: "You have three specialist reports. Combine them into a
             single structured code review with prioritised findings..."
```

*Parsed by `runtime/simple-yaml.js` — a hand-rolled 200-line parser. No npm. No `package.json`. Node.js built-ins only.*

<!--
"Notice what's not here.

No import statements. No class definitions. No framework boilerplate.
No Python environment. No package.json. Nothing to install.

The YAML parser is hand-rolled — 200 lines of vanilla JavaScript that handles
exactly the subset of YAML this project needs, nothing more.
No external dependencies, ever. Node.js built-ins: fs, http, path, child_process.

You describe WHO does WHAT and in WHAT ORDER.
The flow string drives everything else.

If you can write a GitHub Actions workflow,
you already know how to write a Swarm blueprint."
-->

---

## A Language You Already Know

<div class="flow-grid">
<div class="fex">
  <div class="fexpr">"A, B → C"</div>
  <div class="fviz">
    <div class="fgroup"><div class="fnode">A</div><div class="fnode">B</div></div>
    <div class="farrow">→</div>
    <div class="fnode r">C</div>
  </div>
  <div class="fdesc">stages: [["A","B"], ["C"]] — C blocked until A+B done</div>
</div>
<div class="fex">
  <div class="fexpr">"A → B → C"</div>
  <div class="fviz">
    <div class="fnode">A</div>
    <div class="farrow">→</div>
    <div class="fnode">B</div>
    <div class="farrow">→</div>
    <div class="fnode r">C</div>
  </div>
  <div class="fdesc">stages: [["A"], ["B"], ["C"]] — full serial pipeline</div>
</div>
<div class="fex">
  <div class="fexpr">"A, B, C"</div>
  <div class="fviz">
    <div class="fgroup"><div class="fnode">A</div><div class="fnode">B</div><div class="fnode">C</div></div>
  </div>
  <div class="fdesc">stages: [["A","B","C"]] — one stage, all concurrent</div>
</div>
<div class="fex">
  <div class="fexpr">"A → B, C → D"</div>
  <div class="fviz">
    <div class="fnode">A</div>
    <div class="farrow">→</div>
    <div class="fgroup"><div class="fnode">B</div><div class="fnode">C</div></div>
    <div class="farrow">→</div>
    <div class="fnode r">D</div>
  </div>
  <div class="fdesc">stages: [["A"], ["B","C"], ["D"]]</div>
</div>
</div>

**Compiled by splitting on `→`, then on `,`. ~10 lines of JS. No grammar file.**

<!--
"Say the first one out loud: 'A comma B arrow C.'
You can hear it. Comma is 'together.' Arrow is 'synchronise, then advance.'

The compiler output is just a nested array — stages and agent IDs.
The runtime iterates it: Promise.all() per stage, then the next.
No graph library. No scheduler. Just arrays and promises.

This is the same topology as a GitHub Actions 'needs:' block,
a Makefile dependency, a Unix pipeline.
You've been thinking in this model for years."
-->

---

## Five Components. One Purpose.

<div class="pipeline">
  <div class="pstep e">
    <div class="picon">📄</div>
    <div class="pname">Blueprint</div>
    <div class="pdesc">swarms/*.yaml — flow + prompts</div>
  </div>
  <div class="parrow">→</div>
  <div class="pstep c">
    <div class="picon">⚙️</div>
    <div class="pname">Compiler</div>
    <div class="pdesc">"A, B → C" → execution stages</div>
  </div>
  <div class="parrow">→</div>
  <div class="pstep c">
    <div class="picon">🤖</div>
    <div class="pname">Agents</div>
    <div class="pdesc">Claude Code × N, one per node</div>
  </div>
  <div class="parrow">→</div>
  <div class="pstep c">
    <div class="picon">📡</div>
    <div class="pname">Events</div>
    <div class="pdesc">JSONL stream per agent</div>
  </div>
  <div class="parrow">→</div>
  <div class="pstep o">
    <div class="picon">📊</div>
    <div class="pname">Dashboard</div>
    <div class="pdesc">Live topology at :7700</div>
  </div>
</div>

<div class="cols">
<div class="box">

**`compiler.js`** exports `compile(yaml)` → `{ stages: [[id, ...], ...] }` for linear flows, or `{ execution_graph: {...} }` when `groups`/`if` are present. ~150 lines. No parser lib.

**`events.js`** appends newline-delimited JSON to `.swarm/events.jsonl`. One call per event type: `swarm_start` · `agent_start` · `agent_log` · `agent_done` · `agent_error` · `swarm_done`.

</div>
<div class="box">

**`dashboard.js`** serves `GET /events` as `text/event-stream` — each event pushed as `data: <json>\n\n`. No WebSocket. No npm. Auto-selects a free port from 7700 upward.

**Agents** are Claude Code subagents — spawned by the skill itself via Claude's native subagent instruction. Per-agent timeout and token-budget abort emit `agent_error` and halt the stage.

</div>
</div>

<!--
"Five components. Each one has exactly one job and a clear interface.

The compiler is the intellectual core. Its contract is simple:
in goes a parsed YAML blueprint, out comes a stages array.
Stage N cannot start until every agent in stage N-1 has emitted agent_done.

The event schema is the contract between runtime and dashboard.
Every event has: type, agent, status, message, ts, tokens.
The dashboard is fully event-driven — the mock dashboard proved this:
you can replay any run verbatim from a canned events.jsonl file.

SSE is the right choice here.
It's a one-way HTTP stream — Content-Type: text/event-stream.
The browser opens a connection and keeps it open.
The server pushes data: lines. That's it.
You could test the entire event stream with curl."
-->

---

## You're No Longer Flying Blind.

<div class="cols">
<div>

**Every agent emits structured events:**

```json
{"type":"agent_start","agent":"security",
 "status":"running","ts":1748823600}

{"type":"agent_log","agent":"security",
 "message":"Scanning auth module...","ts":1748823612}

{"type":"agent_done","agent":"security",
 "status":"done","tokens":1840,"ts":1748823651}
```

</div>
<div>

**Dashboard consumes the stream live:**

- Topology graph — SVG DAG, nodes light up per event
- Event log — timestamped, per-agent, scrolling
- Token counter — per-agent cost, running total
- Stage tracker — which barrier is active right now

`GET /events` → `text/event-stream`
`GET /state` → full history as JSON array

</div>
</div>

<!--
"Think of it as NASA mission control for your agent pipeline.

During a Mars landing, nobody stares at a blinking cursor hoping for the best.
There's a room full of screens, each one showing a different system.
Everyone knows exactly what's happening at every moment.

That's what the dashboard gives you.

And here's the thing about visibility:
it's not just comfort. It changes what you're willing to delegate.
When you can see what's happening, you trust the system.
When you trust the system, you give it harder problems."
-->

---

<!-- _class: lead -->

# Act III
## See It Run

<!--
Energy up. The demo is the payoff for everything they just sat through.
Have the browser tab ready. Have the terminal ready.
-->

---

## From Zero to Team in One Command

```bash
# Start a research swarm
/swarm research    "compare top AI coding assistants in 2026"

# Full code review — three specialists + one synthesiser
/swarm code-review "PR #42 — payment flow refactor"

# Sequential debug pipeline — reproduce, diagnose, fix, verify
/swarm debug       "NullPointerException in checkout service"

# See the execution graph before spending a single token
/swarm research "topic" --dry-run

# List every available blueprint
/swarm list
```

*No install. No config. No environment. Already running inside Claude Code.*

<!--
"Everything you see here runs in the same terminal you already use.

The dry-run flag is the one I use before every non-trivial run.
Preview the full execution graph — every agent, every stage, every prompt —
before a single token is spent. Confirm your blueprint does what you think it does.

Same discipline as terraform plan before terraform apply.
Check your work. Then run it."
-->

---

<!-- _class: demo -->

# `/swarm research "what makes a good multi-agent framework"`

```
Watch → http://localhost:7700
```

<!--
Don't say anything. Run the command. Let the dashboard speak.

As it runs, point silently at:
→ The topology graph lighting up node by node
→ Token counts climbing per agent in real time
→ The synthesiser grayed out, waiting for both parallel agents
→ The synthesiser activating the moment both report done
→ The final output landing in the event log

If something goes wrong — timeout, error, anything — don't apologise.
Say "and this is what a graceful failure looks like" and show the error event.
Real systems fail gracefully. That's the feature.
-->

---

## From Tool to Infrastructure

<div class="roadmap">
  <div class="rrow">
    <div class="rdot done"></div>
    <div class="rbar done">Flow compiler + live dashboard — the foundation</div>
    <div class="rtag">Phase 1 ✓</div>
  </div>
  <div class="rrow">
    <div class="rdot done"></div>
    <div class="rbar done">Groups + conditional branching — evaluated &amp; routed at runtime: if confidence &gt; 0.8 …</div>
    <div class="rtag">Phase 2 ✓</div>
  </div>
  <div class="rrow">
    <div class="rdot done"></div>
    <div class="rbar done">Reliable execution — timeouts, retries, cost caps, structured agent-output contract</div>
    <div class="rtag">Phase 3 ✓</div>
  </div>
  <div class="rrow">
    <div class="rdot done"></div>
    <div class="rbar done">Durable run history — reopen, replay, and compare any past swarm</div>
    <div class="rtag">Phase 4 ✓</div>
  </div>
  <div class="rrow">
    <div class="rdot done"></div>
    <div class="rbar done">Blueprint library + versioning — reusable swarms, scaffolded with one command</div>
    <div class="rtag">Phase 6 ✓</div>
  </div>
  <div class="rrow">
    <div class="rdot done"></div>
    <div class="rbar done">Token &amp; cost observability — per-agent and per-run spend, live in the dashboard</div>
    <div class="rtag">Phase 7 ✓</div>
  </div>
  <div class="rrow">
    <div class="rdot active"></div>
    <div class="rbar active">Headless CI runner — swarms triggered by PR merges, schedules, webhooks</div>
    <div class="rtag">Phase 5 →</div>
  </div>
</div>

*Six phases shipped. Phase 5 is the leap: from "I run it while watching" to "it runs for me, while I sleep."*

<!--
"Six phases shipped — the foundation, conditional branching that actually
executes, a reliable execution core, durable run history, a blueprint
library, and live cost observability. One phase left, and it's the one
that matters most.

Phase 5 is the bet I'm most excited about.
Right now you have to be at your machine, in Claude Code, to run a swarm.
Phase 5 is a headless runner — a GitHub Action, a cron job, a PR webhook.
A swarm that fires when you merge, posts findings as a PR comment,
and pages you only if something goes wrong.

That's the moment this stops being a developer tool
and starts being infrastructure your whole team depends on."
-->

---

<!-- _class: lead -->

# Thank you

## *The shift that matters*

An agent is not a chatbot.
It's a worker — with a desk, tools, and a task.

**Give each worker one job. Run them in parallel. Watch them work.**

*That's Swarm.*

<!--
"The thing I want you to leave with is not a feature list.

It's this reframe: an AI agent is not a smarter search box.
It's a worker. It has a desk — the context window.
It has tools — bash, file I/O, the web.
It has a task. And it loops until the task is done.

And like any workforce, you get dramatically more done
when you give each worker one focused job
and let them run in parallel.

Swarm is the thing that lets you design that team in one line of YAML
and watch them execute in real time from your browser.

Questions?"
-->
