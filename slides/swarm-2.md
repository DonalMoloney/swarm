---
marp: true
theme: default
paginate: true
backgroundColor: #000000
color: #f5f5f7
style: |
  /* ─────────────────────────────────────────────
     Swarm · Apple-dark "Pro" theme
     SF Pro for prose · SF Mono for code
     System palette: blue #0a84ff · green #30d158 · purple #bf5af2
     ───────────────────────────────────────────── */
  :root {
    --bg: #000000;
    --surface: #1c1c1e;
    --surface-2: #2c2c2e;
    --hairline: #38383a;
    --text: #f5f5f7;
    --text-2: #aeaeb2;
    --text-3: #8e8e93;
    --blue: #0a84ff;
    --green: #30d158;
    --purple: #bf5af2;
    --red: #ff453a;
    --orange: #ff9f0a;
    --teal: #64d2ff;
  }

  section {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    font-size: 1.05em;
    letter-spacing: -0.011em;
    padding: 56px 76px;
    background: #000000;
  }
  h1 { color: var(--text); font-size: 2.7em; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.12em; line-height: 1.05; }
  h2 { color: var(--text); font-size: 1.62em; font-weight: 600; letter-spacing: -0.02em; padding-bottom: 0.32em; margin-bottom: 0.62em; border-bottom: 1px solid var(--hairline); }
  h3 { color: var(--text-2); font-size: 1.05em; font-weight: 500; margin: 0 0 0.3em 0; }
  p, li { color: var(--text-2); }
  code { font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace; background: var(--surface-2); color: var(--teal); padding: 2px 8px; border-radius: 6px; font-size: 0.9em; }
  pre { font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace; background: var(--surface); border: 1px solid var(--hairline); padding: 22px 26px; border-radius: 14px; font-size: 0.93em; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
  pre code { background: none; color: #e6e6eb; padding: 0; }
  strong { color: var(--text); font-weight: 600; }
  em { color: var(--green); font-style: normal; font-weight: 500; }
  ul { margin-top: 0.3em; }
  ul li { margin: 0.42em 0; line-height: 1.42; }
  ul li::marker { color: var(--blue); }
  table { width: 100%; border-collapse: collapse; font-size: 0.94em; }
  th { color: var(--text); font-weight: 600; border-bottom: 1px solid var(--hairline); padding: 10px 14px; text-align: left; }
  td { padding: 10px 14px; border-bottom: 1px solid var(--surface-2); color: var(--text-2); }
  tr:last-child td { border-bottom: none; }

  /* ── Layout ── */
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4em; align-items: start; margin-top: 0.5em; }
  .cols3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.1em; align-items: start; margin-top: 0.5em; }
  .box { background: var(--surface); border: 1px solid var(--hairline); padding: 16px 20px; border-radius: 14px; }
  .box strong { color: var(--blue); }
  .hero { font-family: "SF Mono", ui-monospace, monospace; font-size: 2.05em; font-weight: 600; color: var(--text); text-align: center; padding: 0.5em 0; letter-spacing: -0.01em; }
  .kicker { color: var(--text-3); font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 600; margin-bottom: 0.2em; }
  .lede { color: var(--text-2); font-size: 1.02em; margin: 0.1em 0 0.2em; }

  /* ── Cost cards (the "why" beat) ── */
  .cost-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.1em; margin: 0.7em 0 0.4em; }
  .cost { background: var(--surface); border: 1px solid var(--hairline); border-radius: 16px; padding: 18px 18px 16px; position: relative; overflow: hidden; }
  .cost::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--red); opacity: 0.85; }
  .cost .cicon { font-size: 1.5em; }
  .cost .ctitle { color: var(--text); font-weight: 600; font-size: 1.0em; margin: 0.35em 0 0.15em; }
  .cost .cbody { color: var(--text-2); font-size: 0.78em; line-height: 1.42; }
  .cost .cfix { color: var(--green); font-size: 0.72em; margin-top: 0.7em; font-weight: 500; }

  /* ── Gantt chart ── */
  .gantt { margin: 0.8em 0 0.4em; }
  .grow { display: flex; align-items: center; gap: 0.8em; margin: 0.5em 0; }
  .glabel { width: 110px; font-size: 0.74em; color: var(--text-2); font-weight: 600; text-align: right; flex-shrink: 0; }
  .gtrack { display: flex; flex: 1; gap: 5px; align-items: stretch; }
  .gstack { display: flex; flex-direction: column; gap: 5px; flex: 2; }
  .gbar { height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.72em; font-weight: 600; flex: 1; }
  .gbar.seq  { background: var(--surface-2); color: var(--text-2); border: 1px solid #48484a; }
  .gbar.par  { background: rgba(48,209,88,0.16);  color: var(--green);  border: 1px solid rgba(48,209,88,0.55); }
  .gbar.syn  { background: rgba(191,90,242,0.16);  color: var(--purple); border: 1px solid rgba(191,90,242,0.55); }
  .gbar.gap  { background: transparent; border: none; flex: 2; }
  .gcaption  { font-size: 0.7em; color: var(--text-3); margin-top: 0.5em; text-align: right; }

  /* ── Scorecard ── */
  .score-card { background: var(--surface); border: 1px solid var(--hairline); border-radius: 16px; padding: 16px 18px; }
  .score-card.winner { border: 1px solid rgba(10,132,255,0.7); box-shadow: 0 0 0 1px rgba(10,132,255,0.35), 0 12px 40px rgba(10,132,255,0.12); background: linear-gradient(180deg, rgba(10,132,255,0.08), var(--surface) 60%); }
  .score-name { font-size: 0.86em; font-weight: 600; margin-bottom: 0.55em; padding-bottom: 0.45em; border-bottom: 1px solid var(--hairline); color: var(--text); }
  .score-card.winner .score-name { color: var(--blue); }
  .sitem { font-size: 0.72em; margin: 0.3em 0; line-height: 1.3; color: var(--text-2); }
  .sitem.bad  { color: var(--text-3); }
  .sitem.good { color: var(--green); }
  .sitem.ok   { color: var(--orange); }

  /* ── Flow diagrams ── */
  .flow-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1em; margin-top: 0.5em; }
  .fex { background: var(--surface); border: 1px solid var(--hairline); border-radius: 14px; padding: 14px 16px; }
  .fexpr { font-family: "SF Mono", ui-monospace, monospace; font-size: 0.76em; color: var(--teal); margin-bottom: 0.55em; }
  .fviz { display: flex; align-items: center; gap: 7px; flex-wrap: nowrap; }
  .fnode { background: var(--surface-2); border: 1px solid #48484a; border-radius: 8px; padding: 5px 11px; font-size: 0.75em; color: var(--text); white-space: nowrap; font-weight: 500; }
  .fnode.r { background: rgba(191,90,242,0.16); border-color: rgba(191,90,242,0.6); color: var(--purple); }
  .farrow { color: var(--blue); font-size: 1em; }
  .fgroup { display: flex; flex-direction: column; gap: 5px; }
  .fdesc { font-size: 0.66em; color: var(--text-3); margin-top: 0.45em; }

  /* ── Pipeline ── */
  .pipeline { display: flex; align-items: stretch; gap: 0; margin: 1em 0; }
  .pstep { background: var(--surface); border: 1px solid var(--hairline); border-radius: 14px; padding: 12px 8px; flex: 1; text-align: center; min-width: 0; }
  .pstep.e { border-color: rgba(10,132,255,0.6); }
  .pstep.c { border-color: rgba(100,210,255,0.45); }
  .pstep.o { border-color: rgba(48,209,88,0.6); }
  .picon { font-size: 1.35em; }
  .pname { font-size: 0.7em; color: var(--text); margin-top: 4px; font-weight: 600; }
  .pdesc { font-size: 0.6em; color: var(--text-3); margin-top: 3px; line-height: 1.3; }
  .parrow { color: var(--blue); font-size: 1.25em; display: flex; align-items: center; padding: 0 3px; flex-shrink: 0; }

  /* ── Roadmap ── */
  .roadmap { display: flex; flex-direction: column; gap: 0.5em; margin-top: 0.6em; }
  .rrow { display: flex; align-items: center; gap: 0.9em; }
  .rdot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .rdot.done   { background: var(--green); box-shadow: 0 0 10px rgba(48,209,88,0.6); }
  .rdot.active { background: var(--blue); box-shadow: 0 0 10px rgba(10,132,255,0.6); }
  .rdot.future { background: transparent; border: 2px solid #48484a; }
  .rbar { flex: 1; height: 32px; border-radius: 9px; display: flex; align-items: center; padding: 0 16px; font-size: 0.76em; font-weight: 500; }
  .rbar.done   { background: rgba(48,209,88,0.1);  border: 1px solid rgba(48,209,88,0.35); color: var(--green); }
  .rbar.active { background: rgba(10,132,255,0.12); border: 1px solid rgba(10,132,255,0.5);  color: var(--blue); }
  .rbar.future { background: var(--surface); border: 1px solid var(--hairline); color: var(--text-3); }
  .rtag { font-size: 0.64em; color: var(--text-3); width: 74px; text-align: right; flex-shrink: 0; }

  /* ── Section / lead slides (Apple keynote) ── */
  section.lead {
    background: radial-gradient(120% 120% at 50% 0%, #1c1c1e 0%, #000000 60%);
    color: var(--text); text-align: center; justify-content: center; padding: 80px;
  }
  section.lead .kicker { color: var(--blue); text-align: center; }
  section.lead h1 { color: var(--text); font-size: 3.4em; font-weight: 700; letter-spacing: -0.035em; margin-bottom: 0.18em; }
  section.lead h2 { color: var(--text-2); border: none; font-size: 1.3em; font-weight: 400; letter-spacing: -0.01em; }
  section.lead p  { color: var(--text-3); font-size: 1em; }
  section.title { justify-content: center; background: radial-gradient(120% 120% at 50% 10%, #1c1c1e 0%, #000000 55%); }
  section.title h1 { font-size: 4.0em; font-weight: 700; letter-spacing: -0.04em; }
  section.demo { justify-content: center; text-align: center; background: #000000; }
  section.demo h1 { font-size: 2.0em; color: var(--text); font-weight: 600; }
  section.demo pre { text-align: left; font-size: 1.1em; box-shadow: 0 0 60px rgba(10,132,255,0.18); }
  section.lead strong, section.title strong { color: var(--blue); }
---

<!-- _class: title -->

<div class="kicker">Multi-agent orchestration for Claude Code</div>

# Swarm

### Stop prompting one agent. Start directing a team.

**One YAML file. One slash command. A workforce you can watch.**

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

<div class="kicker">Act I</div>

# The Brilliant Bottleneck

## One genius. One queue. One blinking cursor.

<!--
Don't explain the title. Move straight to the next slide.
The next diagram will do the work.
-->

---

## One Mind. One Queue. One Wait.

**A single agent does everything in sequence — each task waits for the last:**

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
<div class="gcaption">Same intelligence. Same output quality. Roughly half the wall-clock time.</div>

It's not that the model is slow. It's that *one* of anything is a queue. And a queue has three hidden taxes — let's name them.

<!--
"Think about hiring a house-moving team.
You could hire one brilliant person — genuinely excellent.
They pack the kitchen. Then the bedroom. Then the office.
Then they load the van. Then they drive. Then they unpack.

Or you hire a team. Kitchen and bedroom move in parallel.
The van is loaded the moment they're done.
Unpacking starts at the destination before the last box leaves.

Same people. Same intelligence. Completely different throughput.

AI agents hit exactly this wall. But speed is only the first of three taxes.
Set up the next slide: 'it's slower, yes — but it's also blind, and it's throwaway.'"
-->

---

## Why One Agent Is a Wall, Not a Speed Bump

**Three taxes you pay on every single-agent run:**

<div class="cost-grid">
<div class="cost">
  <div class="cicon">⏳</div>
  <div class="ctitle">Serial</div>
  <div class="cbody">Independent work that <em>could</em> run at once is forced into one line. You wait for the sum, not the slowest step.</div>
  <div class="cfix">→ fixed by parallelism</div>
</div>
<div class="cost">
  <div class="cicon">🙈</div>
  <div class="ctitle">Blind</div>
  <div class="cbody">You watch a cursor blink. No topology, no progress, no per-step cost. You hope — you don't know.</div>
  <div class="cfix">→ fixed by a live dashboard</div>
</div>
<div class="cost">
  <div class="cicon">🗑️</div>
  <div class="ctitle">Throwaway</div>
  <div class="cbody">The prompt that orchestrated it all lives in your scrollback. Next time, you reconstruct it from memory.</div>
  <div class="cfix">→ fixed by reusable blueprints</div>
</div>
</div>

*Hold these three. The rest of this talk is just paying each one off.*

<!--
"This is the spine of the whole talk. Three taxes.

Serial — you pay for the sum of the work, not the slowest piece.
Blind — you have no idea what's happening until it's done, or fails.
Throwaway — the clever orchestration prompt you typed is gone tomorrow.

Notice I've already told you the punchline for each:
parallelism, a dashboard, reusable blueprints.
Everything after this is me earning those three arrows.

So when you see the dashboard later — that's the 'blind' tax being paid.
When you see a blueprint file — that's 'throwaway' being paid.
Keep score."
-->

---

<!-- _class: lead -->

<div class="kicker">Act II</div>

# The Swarm

## Pay off all three — in one line of YAML

<!--
Lean into the energy here. The next slide is the payoff.
-->

---

## One Line. A Coordinated Team.

<div class="hero">searcher, analyst → synthesiser</div>

- **Comma** — agents that run *together*, in parallel, right now
- **Arrow** — a synchronisation barrier: block until every agent in the stage is done
- **Names** — each spawns a full Claude Code subagent with its own isolated context window
- The compiler turns this string into `{ stages: [["searcher","analyst"], ["synthesiser"]] }`

**That's the entire execution plan — and that's the *serial* tax gone.**

<!--
"Read that line out loud. 'searcher comma analyst arrow synthesiser.'
You can hear the structure.

Comma is 'these run together.' Arrow is 'synchronise here, then advance.'

The compiler — about 150 lines of vanilla JS, no parser library —
splits on arrows to get stages, then splits each stage on commas to get parallel sets.
It outputs a stages array: each inner array is a set of agents that run concurrently.
The runtime iterates outer-to-inner: spawn all agents in a stage, await all, then advance.

That's tax number one — 'serial' — paid in a single line."
-->

---

## "Why Not Just Use X?"

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
  <div class="score-name">Native Claude Code subagents</div>
  <div class="sitem ok">~ Zero deps, Claude-native</div>
  <div class="sitem bad">✗ Orchestrate by hand each time</div>
  <div class="sitem bad">✗ No reusable blueprint</div>
  <div class="sitem bad">✗ No topology or visibility</div>
  <div class="sitem bad">✗ No run history</div>
  <div class="sitem bad">✗ One-off, every time</div>
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

*LangChain and CrewAI build products **for your users**. Claude Code can already spawn subagents — but with no plan, no picture, no memory. Swarm is the steering wheel for the engine you already have.*

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

*Commit this file and the **throwaway** tax is gone — the orchestration is now an artifact you reuse, version, and share.*

<!--
"Notice what's not here.

No import statements. No class definitions. No framework boilerplate.
No Python environment. No package.json. Nothing to install.

The YAML parser is hand-rolled — 200 lines of vanilla JavaScript that handles
exactly the subset of YAML this project needs, nothing more.
No external dependencies, ever. Node.js built-ins: fs, http, path, child_process.

And here's tax number three — 'throwaway' — paid.
That clever orchestration isn't in your scrollback anymore.
It's a file. You commit it. Your teammate runs the exact same swarm tomorrow."
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

**Compiled by splitting on `→`, then on `,`. ~10 lines of JS. No grammar file.** Same model as a GitHub Actions `needs:`, a Makefile, a Unix pipeline.

<!--
"Four shapes. That's the entire vocabulary. There is no fifth.

And you already think in this model — a GitHub Actions 'needs:' block,
a Makefile dependency, a Unix pipe. Comma is 'together.' Arrow is 'then.'

Under the hood the compiler output is just a nested array.
The runtime walks it: Promise.all() per stage, then the next.
No graph library. No scheduler. Just arrays and promises.

Here's why this matters, and it's the whole point of the slide:
there is nothing new to learn. The barrier to designing a five-agent
pipeline is one line of text you could write from memory."
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

**Agents** are Claude Code subagents — spawned by the skill via Claude's native subagent instruction. Per-agent timeout and token-budget abort emit `agent_error` and halt the stage.

</div>
</div>

<!--
"This is the one slide where you can lose the room in plumbing. Don't.
Land a single idea: five parts, each does exactly one job, each replaceable.

The compiler is the brain — YAML in, a stages array out. That's the whole contract.
Stage N can't start until every agent in stage N-1 reports done. That's the rule.

If someone asks how the dashboard gets live data — it's just an HTTP stream,
plain text, no WebSocket, you could watch it with curl. Answer it in one breath, move on.

The reason this matters is trust. There's no magic here — five small pieces
you could read in an afternoon. Nothing hidden is exactly why you'd hand it real work.
Don't spend more than a minute here. The demo is what they came for."
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

**The dashboard consumes the stream live:**

- Topology graph — SVG DAG, nodes light up per event
- Event log — timestamped, per-agent, scrolling
- Token counter — per-agent cost, running total
- Stage tracker — which barrier is active right now

`GET /events` → `text/event-stream`
`GET /state` → full history as JSON array

</div>
</div>

**That's the *blind* tax paid — all three are now gone.** Mission control for your agent pipeline, not a blinking cursor.

<!--
"Think of it as NASA mission control for your agent pipeline.

During a Mars landing, nobody stares at a blinking cursor hoping for the best.
There's a room full of screens, each one showing a different system.
Everyone knows exactly what's happening at every moment.

That's the third tax — 'blind' — paid. Serial, throwaway, blind: all gone.

And here's the thing about visibility:
it's not just comfort. It changes what you're willing to delegate.
When you can see what's happening, you trust the system.
When you trust the system, you give it harder problems."
-->

---

<!-- _class: lead -->

<div class="kicker">Act III</div>

# See It Run

## The proof is a live dashboard, not a promise

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

<div class="kicker">The shift that matters</div>

# An agent is not a chatbot.

## It's a worker — with a desk, tools, and a task.

**Give each worker one job. Run them in parallel. Watch them work.**

*Serial, blind, throwaway — all three, paid. That's Swarm.*

<!--
"The thing I want you to leave with is not a feature list.

It's this reframe: an AI agent is not a smarter search box.
It's a worker. It has a desk — the context window.
It has tools — bash, file I/O, the web.
It has a task. And it loops until the task is done.

And like any workforce, you get dramatically more done
when you give each worker one focused job
and let them run in parallel.

Remember the three taxes? Serial, blind, throwaway.
Parallelism, the dashboard, blueprints. All three paid.

Swarm is the thing that lets you design that team in one line of YAML
and watch them execute in real time from your browser.

Questions?"
-->
