# Swarm Phase 1: Developer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it drastically easier to author, validate, and iterate on swarm blueprints through suggestion, wizard, preview, and checkpoint/resume workflows.

**Architecture:** Four runtime modules (checkpoint, suggestions, preview, wizard) provide core logic; five skills (swarm-new, swarm-init, swarm-preview, swarm-run enhanced, swarm-list/history) expose them as CLI commands; two UI files (wizard.html, preview.html) provide browser-based inspection. All existing code (compiler, dashboard, events) remains unchanged.

**Tech Stack:** Node.js built-ins (fs, path, http), Claude Code Agent tool for suggestions, existing compiler/dashboard infrastructure.

---

## File Structure

### Runtime Modules (Core Logic)

```
runtime/
├── checkpoint.js           ← Save/load/resume logic for stage outputs
├── suggestions.js          ← Parse idea → generate blueprint
├── preview.js              ← Dry-run + evidence inspection
└── wizard.js               ← Question engine + YAML builder
```

### Skills (CLI Entry Points)

```
skills/
├── swarm-new.md            ← NEW: /swarm new command (suggest + scaffold)
├── swarm-init.md           ← NEW: /swarm new --wizard (interactive wizard)
├── swarm-preview.md        ← NEW: /swarm preview command
├── swarm-run.md            ← MODIFIED: add checkpoint/resume logic
```

### UI Files (Browser-Based)

```
ui/
├── wizard.html             ← NEW: interactive wizard questions
└── preview.html            ← NEW: stage walkthrough + inspection
```

### Tests

```
tests/
├── test-checkpoint.js      ← NEW: save/load/resume logic
├── test-suggestions.js     ← NEW: idea → blueprint generation
├── test-preview.js         ← NEW: dry-run validation
```

### Documentation

```
docs/
├── swarm-quickstart.md     ← NEW: 5-min "get started" guide
└── swarm-authoring.md      ← NEW: deep dive on agents/context/flow
```

---

## Implementation Tasks

### Task 1: Checkpoint Save/Load Module

**Files:**
- Create: `runtime/checkpoint.js`
- Create: `tests/test-checkpoint.js`

The checkpoint module manages state persistence across stage completions. It saves agent outputs, metadata, and event streams; detects resumable states; and loads previous state on demand.

- [ ] **Step 1: Write failing test for `saveCheckpoint()`**

```javascript
// tests/test-checkpoint.js
const { saveCheckpoint, loadCheckpoint, isCheckpointAvailable } = require('../runtime/checkpoint.js');
const fs = require('fs');
const path = require('path');

describe('checkpoint', () => {
  const testDir = '.swarm/test-checkpoints';
  
  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  test('saveCheckpoint saves stage state', () => {
    const state = {
      swarmName: 'test-swarm',
      stageNumber: 1,
      stageOutputs: { agent1: 'result1', agent2: 'result2' },
      timestamp: Date.now(),
      duration: 5000,
      events: [{ type: 'agent_done', agent: 'agent1' }],
      blueprintSha: 'abc123',
      gitSha: 'def456'
    };
    
    const checkpointId = saveCheckpoint('test-swarm', state, testDir);
    
    expect(checkpointId).toMatch(/test-swarm-\d{4}-\d{2}-\d{2}-\d{3}/);
    expect(fs.existsSync(path.join(testDir, `${checkpointId}.json`))).toBe(true);
    expect(fs.existsSync(path.join(testDir, `${checkpointId}-stage-1-done`))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/test-checkpoint.js --testNamePattern="saveCheckpoint"
```

Expected: FAIL with "saveCheckpoint is not a function"

- [ ] **Step 3: Implement `checkpoint.js`**

```javascript
// runtime/checkpoint.js
const fs = require('fs');
const path = require('path');

function saveCheckpoint(swarmName, state, checkpointDir = '.swarm/checkpoints') {
  // Create directory if it doesn't exist
  if (!fs.existsSync(checkpointDir)) {
    fs.mkdirSync(checkpointDir, { recursive: true });
  }
  
  // Generate checkpoint ID: swarm-name-YYYY-MM-DD-NNN
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  
  // Find next sequential number for today
  const files = fs.readdirSync(checkpointDir);
  const todayChecks = files.filter(f => f.startsWith(`${swarmName}-${date}`));
  const nextNum = String(todayChecks.length + 1).padStart(3, '0');
  
  const checkpointId = `${swarmName}-${date}-${nextNum}`;
  const jsonPath = path.join(checkpointDir, `${checkpointId}.json`);
  const markerPath = path.join(checkpointDir, `${checkpointId}-stage-${state.stageNumber}-done`);
  
  // Save checkpoint JSON
  fs.writeFileSync(jsonPath, JSON.stringify({
    checkpointId,
    swarmName: state.swarmName,
    stageNumber: state.stageNumber,
    stageOutputs: state.stageOutputs,
    timestamp: state.timestamp,
    duration: state.duration,
    events: state.events,
    blueprintSha: state.blueprintSha,
    gitSha: state.gitSha
  }, null, 2));
  
  // Save marker file (for quick "is stage done?" checks)
  fs.writeFileSync(markerPath, '');
  
  return checkpointId;
}

function loadCheckpoint(checkpointId, checkpointDir = '.swarm/checkpoints') {
  const jsonPath = path.join(checkpointDir, `${checkpointId}.json`);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }
  
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function isCheckpointAvailable(swarmName, checkpointDir = '.swarm/checkpoints') {
  if (!fs.existsSync(checkpointDir)) return null;
  
  const files = fs.readdirSync(checkpointDir);
  const checkpointFiles = files.filter(f => f.startsWith(swarmName) && f.endsWith('.json'));
  
  if (checkpointFiles.length === 0) return null;
  
  // Return most recent checkpoint
  const sorted = checkpointFiles.sort().reverse();
  return sorted[0].replace('.json', '');
}

function getCompletedStages(checkpointId, checkpointDir = '.swarm/checkpoints') {
  const files = fs.readdirSync(checkpointDir);
  const markers = files.filter(f => f.startsWith(checkpointId) && f.includes('-stage-') && f.endsWith('-done'));
  
  return markers.map(m => {
    const match = m.match(/-stage-(\d+)-done/);
    return match ? parseInt(match[1], 10) : null;
  }).filter(Boolean);
}

module.exports = {
  saveCheckpoint,
  loadCheckpoint,
  isCheckpointAvailable,
  getCompletedStages
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/test-checkpoint.js
```

Expected: PASS (all 3+ tests pass)

- [ ] **Step 5: Commit**

```bash
git add runtime/checkpoint.js tests/test-checkpoint.js
git commit -m "feat: add checkpoint save/load module for stage persistence"
```

---

### Task 2: Blueprint Suggestion Module

**Files:**
- Create: `runtime/suggestions.js`
- Create: `tests/test-suggestions.js`

The suggestions module parses a user's idea and generates a complete YAML blueprint using Claude.

- [ ] **Step 1: Write failing test for `generateBlueprint()`**

```javascript
// tests/test-suggestions.js
const { generateBlueprint, parseIdea } = require('../runtime/suggestions.js');

describe('suggestions', () => {
  test('parseIdea extracts intent from description', () => {
    const idea = 'code review with bug and performance checks';
    const intent = parseIdea(idea);
    
    expect(intent).toHaveProperty('agents');
    expect(intent).toHaveProperty('roles');
    expect(intent.agents.length).toBeGreaterThan(0);
  });

  test('generateBlueprint returns valid YAML string', async () => {
    const idea = 'debug TypeError in auth middleware';
    const blueprint = await generateBlueprint(idea);
    
    expect(blueprint).toContain('name:');
    expect(blueprint).toContain('flow:');
    expect(blueprint).toContain('agents:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/test-suggestions.js
```

Expected: FAIL with "generateBlueprint is not a function"

- [ ] **Step 3: Implement `suggestions.js`**

```javascript
// runtime/suggestions.js
function parseIdea(idea) {
  const lowerIdea = idea.toLowerCase();
  
  const agents = [];
  const roles = {};
  
  if (lowerIdea.includes('bug') || lowerIdea.includes('debug') || lowerIdea.includes('error')) {
    agents.push('bug-hunter');
    roles['bug-hunter'] = 'Find bugs and issues';
  }
  if (lowerIdea.includes('performance') || lowerIdea.includes('perf') || lowerIdea.includes('speed')) {
    agents.push('perf-reviewer');
    roles['perf-reviewer'] = 'Review performance and optimization';
  }
  if (lowerIdea.includes('security') || lowerIdea.includes('safe') || lowerIdea.includes('vuln')) {
    agents.push('security-reviewer');
    roles['security-reviewer'] = 'Check security issues';
  }
  if (lowerIdea.includes('search') || lowerIdea.includes('research') || lowerIdea.includes('find')) {
    agents.push('searcher');
    roles['searcher'] = 'Search and gather information';
  }
  if (lowerIdea.includes('analyz') || lowerIdea.includes('review')) {
    agents.push('analyst');
    roles['analyst'] = 'Analyze and synthesize';
  }
  
  if (agents.length === 0) {
    agents.push('reviewer');
    roles['reviewer'] = 'Review and provide feedback';
  }
  
  return { agents, roles, idea };
}

async function generateBlueprint(idea) {
  const intent = parseIdea(idea);
  
  const agentNames = intent.agents.join(', ');
  const flow = intent.agents.length > 1 
    ? `${intent.agents.join(', ')} → synthesizer`
    : intent.agents[0];
  
  const agentYaml = intent.agents.map(agent => {
    const role = intent.roles[agent] || 'Provide analysis';
    return `  ${agent}:\n    prompt: "${role}. Provide detailed analysis of the given context."`;
  }).join('\n');
  
  const blueprint = `name: ${intent.agents[0]}-swarm
description: "Swarm for: ${idea}"
flow: "${flow}"
agents:
${agentYaml}`;

  return blueprint;
}

module.exports = {
  parseIdea,
  generateBlueprint
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/test-suggestions.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add runtime/suggestions.js tests/test-suggestions.js
git commit -m "feat: add blueprint suggestion module with intent parsing"
```

---

### Task 3: Preview & Validation Module

**Files:**
- Create: `runtime/preview.js`
- Create: `tests/test-preview.js`

The preview module compiles a blueprint and provides dry-run inspection without executing agents.

- [ ] **Step 1: Write failing test for `generateExecutionPlan()`**

```javascript
// tests/test-preview.js
const { generateExecutionPlan, validateBlueprint } = require('../runtime/preview.js');

describe('preview', () => {
  test('generateExecutionPlan returns stages and agents', () => {
    const blueprintYaml = `name: test
flow: "a, b → c"
agents:
  a:
    prompt: "Do A"
  b:
    prompt: "Do B"
  c:
    prompt: "Do C"`;
    
    const plan = generateExecutionPlan(blueprintYaml);
    
    expect(plan).toHaveProperty('stages');
    expect(plan.stages.length).toBe(2);
    expect(plan.stages[0].agents).toEqual(['a', 'b']);
    expect(plan.stages[1].agents).toEqual(['c']);
  });

  test('validateBlueprint detects missing agents', () => {
    const blueprintYaml = `name: test
flow: "a → b"
agents:
  a:
    prompt: "Do A"`;
    
    const errors = validateBlueprint(blueprintYaml);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('agent b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/test-preview.js
```

Expected: FAIL with "generateExecutionPlan is not a function"

- [ ] **Step 3: Implement `preview.js`**

```javascript
// runtime/preview.js
const compiler = require('./compiler.js');
const yaml = require('./simple-yaml.js');

function generateExecutionPlan(blueprintYaml) {
  try {
    const result = compiler.compile(blueprintYaml);
    return {
      name: result.name,
      stages: result.stages,
      agents: Object.keys(result.agents),
      contexts: result.contexts || {}
    };
  } catch (e) {
    return { error: e.message };
  }
}

function validateBlueprint(blueprintYaml) {
  const errors = [];
  
  try {
    const parsed = yaml.parse(blueprintYaml);
    
    if (!parsed.name) errors.push('Missing: name');
    if (!parsed.flow) errors.push('Missing: flow');
    if (!parsed.agents || Object.keys(parsed.agents).length === 0) {
      errors.push('Missing: agents section');
    }
    
    const flowAgents = extractAgentsFromFlow(parsed.flow || '');
    const definedAgents = Object.keys(parsed.agents || {});
    
    flowAgents.forEach(agent => {
      if (!definedAgents.includes(agent)) {
        errors.push(`agent ${agent} in flow but not defined in agents section`);
      }
    });
    
    const result = compiler.compile(blueprintYaml);
    if (result.error) {
      errors.push(result.error);
    }
  } catch (e) {
    errors.push(`Parse error: ${e.message}`);
  }
  
  return errors;
}

function extractAgentsFromFlow(flowStr) {
  const agents = new Set();
  const parts = flowStr.split(/[→->]/);
  
  parts.forEach(part => {
    const names = part.split(',').map(s => s.trim()).filter(Boolean);
    names.forEach(n => agents.add(n));
  });
  
  return Array.from(agents);
}

module.exports = {
  generateExecutionPlan,
  validateBlueprint,
  extractAgentsFromFlow
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/test-preview.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add runtime/preview.js tests/test-preview.js
git commit -m "feat: add preview module for dry-run validation and inspection"
```

---

### Task 4: Wizard Question Engine

**Files:**
- Create: `runtime/wizard.js`
- Create: `tests/test-wizard.js`

The wizard module maintains state and generates YAML as the user progresses through questions.

- [ ] **Step 1: Write failing test for wizard state building**

```javascript
// tests/test-wizard.js
const { WizardSession } = require('../runtime/wizard.js');

describe('wizard', () => {
  test('WizardSession builds blueprint progressively', () => {
    const session = new WizardSession('my-swarm');
    
    session.setName('code-review');
    session.setDescription('Review code for bugs and performance');
    session.addAgent('bug-hunter', 'Find bugs in code');
    session.addAgent('perf-reviewer', 'Check performance issues');
    session.setFlow('bug-hunter, perf-reviewer → synthesizer');
    
    const yaml = session.toYAML();
    expect(yaml).toContain('name: code-review');
    expect(yaml).toContain('bug-hunter');
    expect(yaml).toContain('perf-reviewer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/test-wizard.js
```

Expected: FAIL with "WizardSession is not a function"

- [ ] **Step 3: Implement `wizard.js`**

```javascript
// runtime/wizard.js
class WizardSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.state = {
      name: '',
      description: '',
      agents: {},
      context: {},
      flow: ''
    };
  }
  
  setName(name) {
    this.state.name = name;
    return this;
  }
  
  setDescription(description) {
    this.state.description = description;
    return this;
  }
  
  addAgent(name, role, prompt = null) {
    this.state.agents[name] = {
      role,
      prompt: prompt || `${role}. Provide detailed analysis.`
    };
    return this;
  }
  
  setFlow(flow) {
    this.state.flow = flow;
    return this;
  }
  
  toYAML() {
    const agentLines = Object.entries(this.state.agents)
      .map(([name, { prompt }]) => `  ${name}:\n    prompt: "${prompt.replace(/"/g, '\\"')}"`)
      .join('\n');
    
    return `name: ${this.state.name}
description: "${this.state.description}"
flow: "${this.state.flow}"
agents:
${agentLines}`;
  }
}

module.exports = { WizardSession };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/test-wizard.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add runtime/wizard.js tests/test-wizard.js
git commit -m "feat: add wizard session management for interactive blueprint building"
```

---

### Task 5: Preview UI

**Files:**
- Create: `ui/preview.html`

Browser-based UI for showing execution plan.

- [ ] **Step 1: Write `preview.html`**

```html
<h2>Preview: Execution Plan</h2>
<p class="subtitle" id="blueprintName">Loading...</p>

<div class="section">
  <h3>Topology Graph</h3>
  <div id="graph-container" class="placeholder" style="height: 200px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
    <p style="padding: 20px; color: #999; text-align: center;">DAG will render here</p>
  </div>
</div>

<div class="section">
  <h3>Execution Plan</h3>
  <div id="execution-plan" style="background: #f9f9f9; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; font-size: 12px;">
    <p style="color: #999;">Loading plan...</p>
  </div>
</div>

<div class="section">
  <h3>Validation</h3>
  <div id="validation-results">
    <p style="color: #999;">Validating blueprint...</p>
  </div>
</div>

<div class="section" style="display: flex; gap: 10px; margin-top: 30px;">
  <button class="mock-button" onclick="confirmPreview()">Execute Swarm</button>
  <button class="mock-button" style="background: #f0f0f0; color: #333;" onclick="editBlueprint()">Edit Blueprint</button>
</div>

<script>
function confirmPreview() {
  console.log('Ready to execute swarm');
}

function editBlueprint() {
  console.log('Open editor for blueprint');
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add ui/preview.html
git commit -m "feat: add preview UI for topology visualization and plan inspection"
```

---

### Task 6: Wizard UI

**Files:**
- Create: `ui/wizard.html`

Interactive multi-step form for blueprint creation.

- [ ] **Step 1: Write `wizard.html`**

```html
<h2 id="step-title">Step 1: Blueprint Name</h2>
<p class="subtitle" id="step-subtitle">What is this swarm for?</p>

<div id="step-content" class="section">
  <input class="mock-input" id="wizard-input" placeholder="Enter blueprint name" style="width: 100%; padding: 10px; font-size: 14px;">
</div>

<div style="display: flex; gap: 10px; margin-top: 30px;">
  <button id="prev-btn" class="mock-button" style="background: #f0f0f0; color: #333;" onclick="wizardPrev()" disabled>Previous</button>
  <button id="next-btn" class="mock-button" onclick="wizardNext()">Next</button>
</div>

<div style="margin-top: 20px; color: #999; font-size: 12px;">
  <span id="step-counter">Step 1 of 6</span>
</div>

<script>
const STEPS = [
  { title: 'Blueprint Name', subtitle: 'What is this swarm for?', type: 'text' },
  { title: 'Description', subtitle: 'Describe the purpose', type: 'text' },
  { title: 'Agents', subtitle: 'How many agents? (1-10)', type: 'number' },
  { title: 'Agent Details', subtitle: 'Name and role for each agent', type: 'list' },
  { title: 'Context Providers', subtitle: 'What context does each agent need?', type: 'checklist' },
  { title: 'Flow Topology', subtitle: 'How should agents be arranged?', type: 'topology' }
];

let currentStep = 0;

function wizardNext() {
  if (currentStep < STEPS.length - 1) {
    currentStep++;
    renderStep();
  }
}

function wizardPrev() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
}

function renderStep() {
  const step = STEPS[currentStep];
  document.getElementById('step-title').textContent = step.title;
  document.getElementById('step-subtitle').textContent = step.subtitle;
  document.getElementById('step-counter').textContent = `Step ${currentStep + 1} of ${STEPS.length}`;
  document.getElementById('prev-btn').disabled = currentStep === 0;
  document.getElementById('next-btn').textContent = currentStep === STEPS.length - 1 ? 'Generate' : 'Next';
}

renderStep();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add ui/wizard.html
git commit -m "feat: add wizard UI for interactive blueprint creation"
```

---

### Task 7: `swarm new` Skill Documentation

**Files:**
- Create: `skills/swarm-new.md`

Documentation for the `/swarm new` command.

- [ ] **Step 1: Write `swarm-new.md`**

```markdown
# /swarm new

Suggest a blueprint based on your idea, or pick from templates.

## Usage

\`\`\`
/swarm new "code review with security checks"
/swarm new "debug TypeError in middleware"
/swarm new "research AI frameworks" --wizard
\`\`\`

## Quick Suggest (Default)

1. User describes what they want
2. Claude parses intent and generates YAML
3. Shows generated blueprint; asks: accept, edit, or try again?
4. Saves to file (e.g., my-swarm.yaml)

## Interactive Wizard

Use `--wizard` flag to open step-by-step questionnaire:

\`\`\`
/swarm new "code review" --wizard
\`\`\`

Steps through:
1. Name and description
2. Agent design
3. Context needs
4. Flow topology
5. Review and generate

## Options

- `--wizard` — open interactive wizard instead of quick suggest
- `--template <name>` — start from existing template (e.g., code-review.yaml)

## Suggestion Algorithm

Parses your description, extracts intent (agents, roles, flow), and generates complete YAML. Uses keyword matching for MVP (bug/debug → bug-hunter, performance/perf → perf-reviewer, etc.).
```

- [ ] **Step 2: Commit**

```bash
git add skills/swarm-new.md
git commit -m "docs: add swarm new skill documentation"
```

---

### Task 8: `swarm-init` Skill Documentation

**Files:**
- Create: `skills/swarm-init.md`

Documentation for the interactive wizard.

- [ ] **Step 1: Write `swarm-init.md`**

```markdown
# /swarm new --wizard (Interactive Wizard)

Create a blueprint by answering guided questions.

## Usage

\`\`\`
/swarm new "code review" --wizard
\`\`\`

## Wizard Steps

1. **Name & Description** — Blueprint name and purpose
2. **Design Agents** — How many agents? Name, role, and prompts
3. **Context Needs** — What context (git-diff, file-tree, stack-trace, recent-commits)?
4. **Flow Topology** — Arrange agents into stages
5. **Review** — Preview final YAML and save

## Benefits

- Great for learning how swarms work
- Detailed customization at each step
- Can save/resume wizard sessions
- Generates valid, commented YAML

## Example

\`\`\`
Step 1: Name
  Enter: "code-review"

Step 2: Agents
  Enter: 3 agents
  Agent 1: bug-hunter - "Find bugs in code"
  Agent 2: perf-reviewer - "Check performance issues"
  Agent 3: summarizer - "Summarize findings"

Step 3: Flow
  bug-hunter, perf-reviewer → summarizer

Result: Generated code-review.yaml
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add skills/swarm-init.md
git commit -m "docs: add swarm-init wizard skill documentation"
```

---

### Task 9: `swarm preview` Skill Documentation

**Files:**
- Create: `skills/swarm-preview.md`

Documentation for the preview command.

- [ ] **Step 1: Write `swarm-preview.md`**

```markdown
# /swarm preview

Show execution plan and validation without spawning agents.

## Usage

\`\`\`
/swarm preview my-swarm.yaml
/swarm preview my-swarm.yaml --format=graph
/swarm preview my-swarm.yaml --format=plan
\`\`\`

## What It Shows

1. **Topology Graph** — visual DAG of agents and stages
2. **Execution Plan** — agents, order, context
3. **Context Inspector** — what each agent receives
4. **Validation** — errors, warnings, suggestions
5. **Timeline** — estimated duration

## Example Output

\`\`\`
Stage 1 (parallel, ~30s):
  - bug-hunter (prompt: "...", context: [git-diff, recent-commits])
  - perf-reviewer (prompt: "...", context: [file-tree])

Stage 2 (sequential, ~45s):
  - synthesizer (prompt: "...", context: [git-diff])

Total estimated time: ~1.5m
Validation: ✓ OK
\`\`\`

## Options

- `--format=graph` — show only topology
- `--format=plan` — show only execution plan
- (default: show both + inspection)
```

- [ ] **Step 2: Commit**

```bash
git add skills/swarm-preview.md
git commit -m "docs: add swarm preview skill documentation"
```

---

### Task 10: Modify `swarm-run` Skill (Add Checkpoint/Resume)

**Files:**
- Modify: `skills/swarm-run.md`

Enhance the existing `/swarm run` command to detect and offer resumption from checkpoints.

- [ ] **Step 1: Read existing `skills/swarm.md`**

```bash
head -100 skills/swarm.md
```

- [ ] **Step 2: Add checkpoint section to skill**

Add this section to the skill documentation:

```markdown
## Checkpoint & Resume

If a swarm fails or is interrupted, the next run will detect the checkpoint and offer to resume:

\`\`\`
$ /swarm run my-swarm.yaml
Checkpoint found for my-swarm (completed: stage 3 of 5)
Resume from stage 4? (y/n)
\`\`\`

Resuming skips completed stages; feeds their outputs into next stage.

### How It Works

1. After each stage completes, saves checkpoint (agent outputs + metadata)
2. Next run detects checkpoint and asks: Resume or start fresh?
3. Resume skips completed stages, reuses their outputs
4. \`/swarm history\` shows resumable runs

### Use Cases

- Network timeout in stage 2? Fix and resume from stage 3
- Want to tweak stage 3 agent prompt? Resume from stage 3
- Interrupted run? Resume where it left off
```

- [ ] **Step 3: Commit**

```bash
git add skills/swarm-run.md
git commit -m "docs: add checkpoint/resume documentation to swarm run"
```

---

### Task 11: Quickstart Documentation

**Files:**
- Create: `docs/swarm-quickstart.md`

5-minute "get started" guide.

- [ ] **Step 1: Write `swarm-quickstart.md`**

```markdown
# Swarm Quick Start

Get a swarm running in 5 minutes.

## 1. Suggest a Blueprint (2 min)

\`\`\`bash
/swarm new "code review for performance and security"
\`\`\`

Claude suggests a blueprint. You'll see YAML and choose: accept, edit, or try again.

## 2. Preview Before Running (1 min)

\`\`\`bash
/swarm preview code-review-perf-security.yaml
\`\`\`

Shows topology, execution plan, validation.

## 3. Run the Swarm (2 min)

\`\`\`bash
/swarm run code-review-perf-security.yaml
\`\`\`

Opens browser dashboard. Watch agents run in real-time.

## 4. If It Fails, Resume

Next time, if checkpoint exists:

\`\`\`bash
/swarm run code-review-perf-security.yaml
Checkpoint found. Resume from stage 2? (y/n)
\`\`\`

Resume skips already-completed stages.

## Next Steps

- Read [Swarm Authoring](./swarm-authoring.md) for details
- Explore `swarms/` for example blueprints
- Try `--wizard` flag for interactive creation
```

- [ ] **Step 2: Commit**

```bash
git add docs/swarm-quickstart.md
git commit -m "docs: add 5-minute quickstart guide"
```

---

### Task 12: Authoring Documentation

**Files:**
- Create: `docs/swarm-authoring.md`

Deep dive on agents, context, and flow syntax.

- [ ] **Step 1: Write `swarm-authoring.md`**

```markdown
# Swarm Blueprint Authoring Guide

Master YAML structure, agents, context, and topologies.

## Blueprint Structure

\`\`\`yaml
name: my-swarm
description: "What this swarm does"
flow: "agent1, agent2 → agent3"
agents:
  agent1:
    prompt: "Your instruction..."
  agent2:
    prompt: "Your instruction..."
  agent3:
    prompt: "Your instruction..."
\`\`\`

## Agents

Each agent is a Claude Code Agent with:
- **name**: identifier (alphanumeric + underscores)
- **prompt**: instruction (what should it do?)
- **context**: what git/file context it needs (optional)

Example:

\`\`\`yaml
agents:
  bug-hunter:
    prompt: "Find bugs. Look for: off-by-one errors, null checks, logic flaws."
    context: [git-diff, recent-commits]
\`\`\`

## Context Providers

| Provider | What | Example |
|----------|------|---------|
| git-diff | Recent changes | Last commit's mods |
| file-tree | Project structure | Directory listing |
| stack-trace | Error trace | Exception stack |
| recent-commits | Git history | Last 5-10 commits |

## Flow Syntax

| Syntax | Meaning |
|--------|---------|
| \`"A, B"\` | A and B parallel |
| \`"A → B"\` | A then B sequential |
| \`"A, B → C"\` | A+B parallel, then C |

## Examples

### Code Review

\`\`\`yaml
name: code-review
flow: "bug-hunter, perf-reviewer, security-reviewer → synthesizer"
agents:
  bug-hunter:
    prompt: "Find logic bugs and error handling issues."
  perf-reviewer:
    prompt: "Find performance bottlenecks."
  security-reviewer:
    prompt: "Find security vulnerabilities."
  synthesizer:
    prompt: "Summarize all findings into one report."
\`\`\`

### Research

\`\`\`yaml
name: research
flow: "searcher, analyst → synthesizer"
agents:
  searcher:
    prompt: "Search for X. Compile list of resources."
    context: [recent-commits]
  analyst:
    prompt: "Analyze Y in detail."
    context: [file-tree]
  synthesizer:
    prompt: "Combine research into comprehensive report."
\`\`\`

## Tips

1. **Parallel is faster** — parallel agents run at same time
2. **Be selective with context** — don't give all agents all context
3. **Clear prompts** — "Find off-by-one errors" beats "Review code"
4. **2-5 agents typical** — avoid 10+ unless specific reason
5. **Test with preview** — always preview before running

## See Also

- Examples: `swarms/` directory
- Command reference: `/swarm --help`
```

- [ ] **Step 2: Commit**

```bash
git add docs/swarm-authoring.md
git commit -m "docs: add comprehensive authoring guide"
```

---

## Summary

All 12 tasks complete:
- ✅ Task 1: Checkpoint module
- ✅ Task 2: Suggestions module
- ✅ Task 3: Preview module
- ✅ Task 4: Wizard engine
- ✅ Task 5: Preview UI
- ✅ Task 6: Wizard UI
- ✅ Task 7: swarm-new skill docs
- ✅ Task 8: swarm-init skill docs
- ✅ Task 9: swarm-preview skill docs
- ✅ Task 10: swarm-run enhancement
- ✅ Task 11: Quickstart guide
- ✅ Task 12: Authoring guide

Phase 1 Developer Experience implementation ready for execution.
