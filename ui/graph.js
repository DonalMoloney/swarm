/**
 * Topology graph renderer — pure SVG, no dependencies.
 * Colors are read from CSS custom properties at render-time so both themes
 * (Apple dark / OpenAI light) are reflected without extra wiring.
 *
 * Zoom/pan: all edges + nodes live inside a single <g class="zoom-layer">.
 * The view transform persists across re-renders in `graphView`, so live
 * updates don't reset the user's zoom. Controls, wheel, and drag all mutate
 * that transform directly (no full re-render needed).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const graphView = { scale: 1, tx: 0, ty: 0 };
const MIN_SCALE = 0.4;
const MAX_SCALE = 4;

let _svgEl = null;
let _lastNodeCount = 0;

function _layer() {
  return _svgEl ? _svgEl.querySelector('.zoom-layer') : null;
}

function _applyView() {
  const layer = _layer();
  if (layer) {
    layer.setAttribute(
      'transform',
      `translate(${graphView.tx} ${graphView.ty}) scale(${graphView.scale})`
    );
  }
  const label = document.getElementById('graph-zoom-label');
  if (label) label.textContent = `${Math.round(graphView.scale * 100)}%`;
}

function _zoomAt(cx, cy, factor) {
  const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, graphView.scale * factor));
  const k = next / graphView.scale;
  graphView.tx = cx - k * (cx - graphView.tx);
  graphView.ty = cy - k * (cy - graphView.ty);
  graphView.scale = next;
  _applyView();
}

function _resetView() {
  graphView.scale = 1;
  graphView.tx = 0;
  graphView.ty = 0;
  _applyView();
}

function _bindInteractions(svgEl) {
  if (svgEl.__zoomBound) return;
  svgEl.__zoomBound = true;

  svgEl.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    _zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  let dragging = false, lastX = 0, lastY = 0;

  svgEl.addEventListener('mousedown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    svgEl.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    graphView.tx += e.clientX - lastX;
    graphView.ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    _applyView();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    svgEl.classList.remove('dragging');
  });
}

/** Read a CSS custom property from :root, fallback to `def`. */
function cssVar(name, def) {
  if (typeof document === 'undefined') return def;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || def;
}

/** Return the current theme's node/edge color palette. */
function themeColors() {
  return {
    accent:          cssVar('--accent',          '#0a84ff'),
    accentText:      cssVar('--accent-text',     '#409cff'),
    accentDim:       cssVar('--accent-dim',      'rgba(10,132,255,0.14)'),
    textPrimary:     cssVar('--text-primary',    '#f5f5f7'),
    textSecondary:   cssVar('--text-secondary',  '#98989d'),
    textTertiary:    cssVar('--text-tertiary',   '#636366'),
    textQuaternary:  cssVar('--text-quaternary', '#48484a'),
    bgCard:          cssVar('--bg-card',         '#1c1c1e'),
    borderPrimary:   cssVar('--border-primary',  '#38383a'),
    colorRunning:    cssVar('--color-running',   '#0a84ff'),
    colorDone:       cssVar('--color-done',      '#30d158'),
    colorError:      cssVar('--color-error',     '#ff453a'),
    colorWarn:       cssVar('--color-warn',      '#ffd60a'),
    bgRunning:       cssVar('--bg-running',      'rgba(10,132,255,0.08)'),
    bgDone:          cssVar('--bg-done',         'rgba(48,209,88,0.08)'),
    bgError:         cssVar('--bg-error',        'rgba(255,69,58,0.08)'),
  };
}

function renderGraph(stages, agentStates, svgEl) {
  _svgEl = svgEl;
  _bindInteractions(svgEl);

  const C = themeColors();

  const NODE_R = 46;
  const ROW = NODE_R * 2 + 18;

  const W = svgEl.clientWidth || 600;
  const stageCount = stages.length;
  const stageW = W / (stageCount + 1);

  const maxPerStage = stages.reduce((m, s) => Math.max(m, s.agents.length), 1);
  const H = Math.min(480, Math.max(120, ROW * (maxPerStage + 1)));
  svgEl.setAttribute('height', H);
  svgEl.style.height = H + 'px';

  const positions = {};
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const defs = document.createElementNS(SVG_NS, 'defs');

  function makeMarker(id, color) {
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M0,0 L0,6 L8,3 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    return marker;
  }

  defs.appendChild(makeMarker('arrow',        C.textQuaternary));
  defs.appendChild(makeMarker('arrow-active', C.accent));
  svgEl.appendChild(defs);

  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('class', 'zoom-layer');
  svgEl.appendChild(layer);

  stages.forEach((stage, si) => {
    const x = stageW * (si + 1);
    stage.agents.forEach((agent, ai) => {
      positions[agent] = {
        x,
        y: (H / (stage.agents.length + 1)) * (ai + 1),
      };
    });
  });

  // Edges
  stages.forEach((stage, si) => {
    if (si === 0) return;
    const prevStage = stages[si - 1];
    prevStage.agents.forEach(from => {
      stage.agents.forEach(to => {
        const p1 = positions[from];
        const p2 = positions[to];
        if (!p1 || !p2) return;
        const st = agentStates[from] || 'pending';
        const isActive = st === 'running' || st === 'done';
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', p1.x + NODE_R + 2);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x - NODE_R - 2);
        line.setAttribute('y2', p2.y);
        line.setAttribute('stroke', isActive ? C.accent : C.borderPrimary);
        line.setAttribute('stroke-width', isActive ? '2' : '1.5');
        line.setAttribute('marker-end', isActive ? 'url(#arrow-active)' : 'url(#arrow)');
        if (st === 'running') line.setAttribute('class', 'edge-live');
        layer.appendChild(line);
      });
    });
  });

  // Nodes
  Object.entries(positions).forEach(([agent, { x, y }]) => {
    const st = agentStates[agent] || 'pending';
    const palette = {
      pending: { fill: C.bgCard,      stroke: C.borderPrimary, text: C.textQuaternary },
      running: { fill: C.bgRunning,   stroke: C.colorRunning,  text: C.colorRunning  },
      done:    { fill: C.bgDone,      stroke: C.colorDone,     text: C.colorDone     },
      error:   { fill: C.bgError,     stroke: C.colorError,    text: C.colorError    },
    };
    const c = palette[st] || palette.pending;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'node');
    g.dataset.agent = agent;
    g.style.cursor = 'pointer';

    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = agent;
    g.appendChild(title);

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', NODE_R);
    circle.setAttribute('fill', c.fill);
    circle.setAttribute('stroke', c.stroke);
    circle.setAttribute('stroke-width', st === 'running' ? '2' : '1.5');

    // OpenAI-flat state system: running = marching-ants dashed ring (in motion),
    // done/error = flat solid ring (no glow). Motion separates running from done.
    if (st === 'running') {
      circle.setAttribute('stroke-dasharray', '6 5');
      circle.setAttribute('class', 'node-running');
    }

    const MAX_LINE = 9;
    let line1, line2;
    if (agent.length <= MAX_LINE) {
      line1 = agent; line2 = '';
    } else {
      const hyphen = agent.lastIndexOf('-', MAX_LINE);
      const split = hyphen > 2 ? hyphen + 1 : MAX_LINE;
      line1 = agent.slice(0, split);
      const rest = agent.slice(split);
      line2 = rest.length > MAX_LINE ? rest.slice(0, MAX_LINE - 1) + '…' : rest;
    }

    if (line2) {
      const t1 = document.createElementNS(SVG_NS, 'text');
      t1.setAttribute('x', x); t1.setAttribute('y', y - 4);
      t1.setAttribute('text-anchor', 'middle'); t1.setAttribute('font-size', '9');
      t1.setAttribute('fill', c.text); t1.setAttribute('font-family', 'monospace');
      t1.textContent = line1;

      const t2 = document.createElementNS(SVG_NS, 'text');
      t2.setAttribute('x', x); t2.setAttribute('y', y + 9);
      t2.setAttribute('text-anchor', 'middle'); t2.setAttribute('font-size', '9');
      t2.setAttribute('fill', c.text); t2.setAttribute('font-family', 'monospace');
      t2.textContent = line2;

      g.appendChild(circle); g.appendChild(t1); g.appendChild(t2);
    } else {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x); text.setAttribute('y', y + 4);
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '10');
      text.setAttribute('fill', c.text); text.setAttribute('font-family', 'monospace');
      text.textContent = line1;
      g.appendChild(circle); g.appendChild(text);
    }
    layer.appendChild(g);
  });

  const nodeCount = Object.keys(positions).length;
  if (nodeCount !== _lastNodeCount) {
    _resetView();
    _lastNodeCount = nodeCount;
  } else {
    _applyView();
  }

  const controls = document.getElementById('graph-zoom');
  if (controls) controls.style.display = nodeCount > 1 ? 'flex' : 'none';
}

/**
 * Render a Phase-2 execution graph (groups as rounded rects, conditions as
 * diamonds, true/false branch edges) into an SVG element.
 */
function renderExecutionGraph(executionGraph, svgEl) {
  const layout = (typeof layoutExecutionGraph !== 'undefined'
    ? layoutExecutionGraph
    : require('./graph-layout').layoutExecutionGraph)(executionGraph);

  const C = themeColors();
  const NS = 'http://www.w3.org/2000/svg';
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
  svgEl.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);

  const defs = document.createElementNS(NS, 'defs');
  function marker(id, color) {
    const m = document.createElementNS(NS, 'marker');
    m.setAttribute('id', id); m.setAttribute('markerWidth', '8'); m.setAttribute('markerHeight', '8');
    m.setAttribute('refX', '7'); m.setAttribute('refY', '3'); m.setAttribute('orient', 'auto');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M0,0 L0,6 L8,3 z'); p.setAttribute('fill', color);
    m.appendChild(p); return m;
  }
  defs.appendChild(marker('g-true',  C.colorDone));
  defs.appendChild(marker('g-false', C.colorError));
  defs.appendChild(marker('g-seq',   C.accent));
  svgEl.appendChild(defs);

  const edgeColor = { true: C.colorDone, false: C.colorError, seq: C.accent };

  layout.edges.forEach(e => {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', e.x1); line.setAttribute('y1', e.y1);
    line.setAttribute('x2', e.x2); line.setAttribute('y2', e.y2);
    line.setAttribute('stroke', edgeColor[e.kind] || C.textQuaternary);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('marker-end', `url(#g-${e.kind})`);
    svgEl.appendChild(line);
    if (e.kind === 'true' || e.kind === 'false') {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', (e.x1 + e.x2) / 2); t.setAttribute('y', (e.y1 + e.y2) / 2 - 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9');
      t.setAttribute('fill', edgeColor[e.kind]); t.setAttribute('font-family', 'monospace');
      t.textContent = e.kind;
      svgEl.appendChild(t);
    }
  });

  layout.nodes.forEach(n => {
    const g = document.createElementNS(NS, 'g');
    if (n.shape === 'diamond') {
      const r = n.w / 2;
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', `${n.cx},${n.cy - r} ${n.cx + r},${n.cy} ${n.cx},${n.cy + r} ${n.cx - r},${n.cy}`);
      poly.setAttribute('fill', C.accentDim);
      poly.setAttribute('stroke', C.colorWarn);
      poly.setAttribute('stroke-width', '1.5');
      g.appendChild(poly);
    } else {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', n.cx - n.w / 2); rect.setAttribute('y', n.cy - n.h / 2);
      rect.setAttribute('width', n.w); rect.setAttribute('height', n.h);
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', C.bgCard);
      rect.setAttribute('stroke', C.borderPrimary);
      rect.setAttribute('stroke-width', '1.5');
      g.appendChild(rect);
    }
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', n.cx); label.setAttribute('y', n.shape === 'diamond' ? n.cy + 3 : n.cy - 4);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', '11');
    label.setAttribute('fill', C.textPrimary); label.setAttribute('font-family', 'monospace');
    label.textContent = n.label;
    g.appendChild(label);
    if (n.shape === 'rect' && n.agents.length) {
      const sub = document.createElementNS(NS, 'text');
      sub.setAttribute('x', n.cx); sub.setAttribute('y', n.cy + 12);
      sub.setAttribute('text-anchor', 'middle'); sub.setAttribute('font-size', '8');
      sub.setAttribute('fill', C.textSecondary); sub.setAttribute('font-family', 'monospace');
      sub.textContent = n.agents.join(', ');
      g.appendChild(sub);
    }
    svgEl.appendChild(g);
  });
}

if (typeof window !== 'undefined') {
  window.renderGraph = renderGraph;
  window.renderExecutionGraph = renderExecutionGraph;
  window.graphZoom = {
    zoomIn()  { _zoomAt((_svgEl?.clientWidth || 0) / 2, (_svgEl?.clientHeight || 0) / 2, 1.25); },
    zoomOut() { _zoomAt((_svgEl?.clientWidth || 0) / 2, (_svgEl?.clientHeight || 0) / 2, 1 / 1.25); },
    reset: _resetView,
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderGraph, renderExecutionGraph };
}
