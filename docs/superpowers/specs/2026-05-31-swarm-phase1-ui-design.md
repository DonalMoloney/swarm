# Swarm Phase 1 UI Improvements Design

**Date:** 2026-05-31  
**Focus:** Visual polish, interaction flow, guidance, and delight for preview.html and wizard.html  
**Goal:** Transform minimal functional UIs into polished, guided, premium experiences

---

## Overview

Phase 1 delivered functional UIs (preview.html, wizard.html) with a dark GitHub theme. This design improves them across four dimensions:

1. **Visual Polish** — Better typography, spacing, color, depth, layout
2. **Interaction Flow** — Smooth transitions, micro-interactions, responsive feedback
3. **Helpful Guidance** — Progressive disclosure, tips, hints, validation messages
4. **Delight** — Celebratory success states, color coding, engaging micro-interactions

The result: UIs feel premium, guide users through workflows, and provide confidence at every step.

---

## Section 1: Wizard UI (ui/wizard.html)

### Current State
- Dark GitHub theme (minimal styling)
- 6-step form with basic navigation
- Step counter only (text-based progress)
- No inline guidance or examples
- No validation feedback or error states
- Basic buttons with no hover effects

### Improvements

#### 1.1 Visual Layout & Typography

**Header:**
- Larger step title (h2, ~20px, bold, #58a6ff blue)
- Descriptive subtitle below (12px, #8b949e gray, explains what step is asking)
- Horizontal progress bar (6 steps, showing current position)
- Remove simple counter; replace with bar + number

**Step Content Area:**
- Add card styling: light border (#21262d), subtle background gradient
- Generous padding: 24px (vs current 16px)
- Clear section separation with dividers

**Typography:**
- Upgrade font sizing and weight
- Input labels: bold, clear, 12px
- Placeholder text: helpful examples (e.g., "e.g., 'research', 'code-review'")
- Error text: red (#f85149), prominent

#### 1.2 Progressive Disclosure & Guidance

**Per-Step Context:**
- Below subtitle: brief description of what to enter
- Below input: example text in gray (non-interactive, shows format)
- On-demand tips: small info icon (?) that reveals detailed guidance on hover

**Input Validation:**
- Real-time validation as user types
- Visual indicators:
  - ✓ Green checkmark (valid input)
  - ✗ Red X (invalid input)
  - ? Gray question mark (incomplete, neutral)
- Error message below input (if invalid): short, friendly explanation
- Success feedback: brief checkmark animation when moving to next step

**Progress Visibility:**
- Horizontal progress bar updates as user completes steps
- Completed steps show checkmark icon
- Current step highlighted in blue
- Future steps grayed out

#### 1.3 Micro-Interactions

**Transitions:**
- Step change: smooth fade-out → fade-in (200ms)
- Input focus: subtle glow effect (blue outline + light shadow)
- Button hover: color shift (darker blue) + slight scale (1.02x)
- Button active (press): scale down slightly (0.98x)

**Feedback:**
- Loading state on "Next" button: spinner icon + "Processing..." text
- Success on step completion: checkmark animation (0.5s)
- Error shake animation on validation failure (200ms)

**Button States:**
- Enabled: bright blue (#1f6feb), cursor pointer
- Disabled: gray (#21262d), cursor not-allowed, reduced opacity
- "Generate" button (final step): green (#238636) instead of blue, indicates action

#### 1.4 Color Coding & Validation

**Input States:**
- Default: #21262d border, #0d1117 background
- Focus: #1f6feb border, slight glow
- Valid: #238636 border, green checkmark
- Invalid: #f85149 border, red X, error message
- Completed step: #238636 accent on left border

**Overall Color Palette:**
- Primary action: #1f6feb (blue)
- Success: #238636 (green)
- Error: #f85149 (red)
- Background: #0d1117 (dark)
- Text: #e6edf3 (light)
- Muted: #8b949e (gray)

#### 1.5 Success Screen

When wizard completes (all steps done):
- Full-screen celebratory message (centered)
- Large green checkmark icon (48px)
- "Blueprint Created Successfully!" (h2, large, bold)
- Show generated YAML in collapsible section
- Two buttons: "Execute Now" (green) + "Edit & Review" (blue)

---

## Section 2: Preview UI (ui/preview.html)

### Current State
- Dark GitHub theme (minimal styling)
- Three sections: Topology, Execution Plan, Validation (stacked)
- Monospace text for all content
- Basic buttons with no states
- Limited visual hierarchy
- No interactive elements (hover, click)

### Improvements

#### 2.1 Visual Layout & Cards

**Header:**
- Larger blueprint name (h2, ~20px, bold, #58a6ff)
- Status badge: color-coded (ready/warning/error) with icon
  - ✅ Ready (green)
  - ⚠️ Warnings (yellow)
  - ❌ Errors (red)

**Sections as Cards:**
- Each section (Topology, Plan, Validation) is a card:
  - Border: 1px #21262d
  - Background: subtle gradient (#161b22 → #0d1117)
  - Padding: 16px
  - Border-radius: 6px
  - Subtle shadow on hover

**Spacing:**
- Gap between cards: 12px
- Cards in flex container: max-width, centered

#### 2.2 Topology Graph

**Visual Improvements:**
- Node colors: blue for agents, green for synthesizer
- Edges: lighter gray (#30363d) with rounded ends
- Stages labeled: "Stage 1 (parallel)" / "Stage 2 (sequential)"
- Font: slightly larger labels (12px)

**Interactivity:**
- Hover agent node: show tooltip with agent details
  - Name, prompt (first 50 chars), context providers
- Hover edge: highlight the dependency
- Legend below graph: explains node colors

**Legend:**
- Blue circle = Agent
- Green circle = Synthesizer
- Blue arrow = Sequential
- Curved arrows = Parallel stage

#### 2.3 Execution Plan

**Formatting:**
- Syntax highlighting: agent names in blue, context in green, stage numbers in gray
- Clear hierarchy: "Stage 1" header → indented agents → estimated duration

**Collapsible Sections:**
- Each stage is collapsible (click header to expand/collapse)
- Default: first stage expanded, others collapsed
- Icons: ▼ expanded, ▶ collapsed

**Content per Stage:**
```
Stage 1 (parallel, ~30s)
  ▼ searcher
    Prompt: "Search for..."
    Context: [git-diff, recent-commits] (250 lines)
  ▶ analyst
    Prompt: "Analyze..."
    Context: [file-tree] (5 files, 15KB)
```

**Estimated Duration:**
- Per stage: "~30s" (based on agent count + context size)
- Total: "Estimated total: ~1.5m"

#### 2.4 Validation Results

**Status Indicator:**
- Icon + text at top: "✅ Valid", "⚠️ 2 Warnings", "❌ 3 Errors"
- Color-coded: green, yellow, red

**Results Organized by Severity:**
1. **Errors** (red section, if any):
   - List each error with icon ❌
   - Explain what's wrong
   - Suggest fix (e.g., "Agent 'analyzer' not in flow. Did you mean 'analyst'?")

2. **Warnings** (yellow section, if any):
   - List each warning with icon ⚠️
   - "Agent 'unused-agent' not mentioned in flow"
   - "Agent 'searcher' has no context (may be intentional)"

3. **Info** (blue section, optional):
   - Helpful notes (not errors)
   - "Total token estimate: ~2,400 tokens per run"

**Expandable Details:**
- Each issue is clickable → expands to show full explanation
- Collapsed by default (clean view)

#### 2.5 Micro-Interactions & Feedback

**Loading State:**
- While generating plan: spinner animation + "Generating preview..."
- Each section fades in as it loads (staggered: graph → plan → validation)

**Button States:**
- "Execute Swarm" button:
  - Disabled (gray) until validation passes
  - Enabled (green #238636) when valid
  - Hover: darker green, tooltip "Run this swarm"
  - Active: scale down slightly

- "Edit Blueprint" button:
  - Always enabled (blue #1f6feb)
  - Hover: darker blue, tooltip "Open editor"

**Hover Effects:**
- Cards: subtle shadow increase
- Legend items: highlight corresponding nodes in graph
- Error/warning items: highlight in matching color

#### 2.6 Success State

When blueprint is valid:
- Status badge: "✅ Ready to Execute" (green, prominent)
- Validation section: brief "All validation checks passed" message
- "Execute Swarm" button: bright green, highlighted

---

## Implementation Details

### Files to Modify

1. **ui/wizard.html** (~400 lines)
   - Update header with progress bar component
   - Add step content template with examples
   - Add validation feedback (checkmarks, errors)
   - Add micro-interaction animations (CSS transitions)
   - Update success screen

2. **ui/preview.html** (~350 lines)
   - Update header with status badge
   - Convert sections to card layout
   - Add graph legend and interactivity
   - Format execution plan with collapsible stages
   - Add validation result organization
   - Add hover effects and micro-interactions

### CSS & Styling

- Keep dark GitHub theme base colors
- Add gradient backgrounds (subtle, not garish)
- Define standard spacing scale: 8px, 12px, 16px, 24px
- Animation/transition duration: 200ms (standard)
- Hover effects: color shift + scale/shadow
- Shadow: `0 3px 12px rgba(0,0,0,0.3)` (subtle)

### JavaScript Enhancements

**Wizard:**
- Real-time validation as user types
- Progress bar update as steps complete
- Animations on step transitions
- Success screen display

**Preview:**
- Toggle collapsible sections
- Hover/tooltip interactions
- Graph legend highlighting
- Loading state management

---

## Success Criteria

Phase 1 UI improvements are done when:

- [ ] Wizard feels guided (tips, examples, validation clear)
- [ ] Preview shows full picture (topology clear, plan organized, validation obvious)
- [ ] Both UIs have smooth transitions and micro-interactions
- [ ] Color coding is consistent (blue for primary, green for success, red for error)
- [ ] Responsive to user actions (immediate feedback)
- [ ] Professional, polished appearance (not sterile or minimal)
- [ ] All validation states are clear (valid/invalid/warning)
- [ ] Success states are celebratory (users feel accomplishment)

---

## Design Philosophy

**Approach: Delightful + Guided**

1. **Guidance first** — Users never feel lost; every step is clear
2. **Feedback immediately** — Validation, progress, and outcomes are instant
3. **Polish throughout** — Spacing, typography, color, and animation all refined
4. **Delight in details** — Micro-interactions, success states, visual hierarchy make it feel premium
5. **Dark theme consistent** — Follows Claude Code aesthetic (dark backgrounds, blue/green accents)

---

## Notes

- All improvements use HTML/CSS/JS only (no new dependencies)
- Animations are 200ms or less (snappy, not slow)
- Mobile-responsive: cards stack on small screens
- Accessibility: all interactive elements have clear visual feedback
- Dark theme: maintains #0d1117 background, #e6edf3 text, #1f6feb blue accents
