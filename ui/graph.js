/**
 * Topology graph renderer — pure SVG, no dependencies.
 * Draws agent nodes and directed edges based on swarm stage data.
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

let _svgEl = null;       // most recently rendered <svg>
let _lastNodeCount = 0;  // reset the view when the topology changes shape

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

// Zoom while keeping the point (cx, cy) — in svg pixel coords — visually fixed.
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

// Bind wheel-zoom and drag-pan once per <svg> element.
function _bindInteractions(svgEl) {
  if (svgEl.__zoomBound) return;
  svgEl.__zoomBound = true;

  svgEl.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    _zoomAt(x, y, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  svgEl.addEventListener('mousedown', e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    svgEl.classList.add('dragging');
  });

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    graphView.tx += e.clientX - lastX;
    graphView.ty += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    _applyView();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    svgEl.classList.remove('dragging');
  });
}

function renderGraph(stages, agentStates, svgEl) {
  _svgEl = svgEl;
  _bindInteractions(svgEl);

  const NODE_R = 34;
  const ROW = NODE_R * 2 + 10; // node diameter + vertical breathing room

  const W = svgEl.clientWidth || 600;
  const stageCount = stages.length;
  const stageW = W / (stageCount + 1);

  // Grow the canvas vertically so the busiest parallel stage doesn't overlap.
  // Capped — beyond the cap the user pans/zooms instead of the panel taking over.
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

  defs.appendChild(makeMarker('arrow', '#484f58'));
  defs.appendChild(makeMarker('arrow-active', '#58a6ff'));
  svgEl.appendChild(defs);

  // Everything zoomable goes inside this layer
  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('class', 'zoom-layer');
  svgEl.appendChild(layer);

  // Calculate node positions
  stages.forEach((stage, si) => {
    const x = stageW * (si + 1);
    const agentCount = stage.agents.length;
    stage.agents.forEach((agent, ai) => {
      const y = (H / (agentCount + 1)) * (ai + 1);
      positions[agent] = { x, y };
    });
  });

  // Draw edges between consecutive stages
  stages.forEach((stage, si) => {
    if (si === 0) return;
    const prevStage = stages[si - 1];
    prevStage.agents.forEach(from => {
      stage.agents.forEach(to => {
        const p1 = positions[from];
        const p2 = positions[to];
        if (!p1 || !p2) return;
        const state = agentStates[from] || 'pending';
        const isActive = state === 'running' || state === 'done';
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', p1.x + NODE_R + 2);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x - NODE_R - 2);
        line.setAttribute('y2', p2.y);
        line.setAttribute('stroke', isActive ? '#58a6ff' : '#30363d');
        line.setAttribute('stroke-width', isActive ? '2' : '1.5');
        line.setAttribute('marker-end', isActive ? 'url(#arrow-active)' : 'url(#arrow)');
        // Marching-dash animation while the upstream agent is live
        if (state === 'running') line.setAttribute('class', 'edge-live');
        layer.appendChild(line);
      });
    });
  });

  // Draw nodes
  Object.entries(positions).forEach(([agent, { x, y }]) => {
    const state = agentStates[agent] || 'pending';
    const colors = {
      pending: { fill: '#161b22', stroke: '#30363d', text: '#484f58' },
      running: { fill: '#1f6feb22', stroke: '#58a6ff', text: '#58a6ff' },
      done:    { fill: '#23863622', stroke: '#3fb950', text: '#3fb950' },
      error:   { fill: '#f8514922', stroke: '#f85149', text: '#f85149' },
    };
    const c = colors[state] || colors.pending;

    const g = document.createElementNS(SVG_NS, 'g');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', NODE_R);
    circle.setAttribute('fill', c.fill);
    circle.setAttribute('stroke', c.stroke);
    circle.setAttribute('stroke-width', state === 'running' ? '2' : '1.5');

    // Glow active nodes in their state color (drop-shadow keyed to the stroke)
    if (state !== 'pending') {
      const intensity = state === 'running' ? 8 : 5;
      circle.style.filter = `drop-shadow(0 0 ${intensity}px ${c.stroke})`;
    }

    if (state === 'running') {
      circle.setAttribute('class', 'pulse');
    }

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '12');
    text.setAttribute('fill', c.text);
    text.setAttribute('font-family', 'monospace');
    text.textContent = agent.length > 12 ? agent.slice(0, 11) + '…' : agent;

    g.appendChild(circle);
    g.appendChild(text);
    layer.appendChild(g);
  });

  // Reset the view when the topology changes shape (e.g. a new swarm starts),
  // otherwise preserve the user's current zoom/pan across live updates.
  const nodeCount = Object.keys(positions).length;
  if (nodeCount !== _lastNodeCount) {
    _resetView();
    _lastNodeCount = nodeCount;
  } else {
    _applyView();
  }

  // Zoom controls are only useful with more than one node
  const controls = document.getElementById('graph-zoom');
  if (controls) controls.style.display = nodeCount > 1 ? 'flex' : 'none';
}

/**
 * Render a Phase-2 execution graph (groups as rounded rects, conditions as
 * diamonds, true/false branch edges) into an SVG element.
 * Uses the pure layout from graph-layout.js.
 */
function renderExecutionGraph(executionGraph, svgEl) {
  const layout = (typeof layoutExecutionGraph !== 'undefined'
    ? layoutExecutionGraph
    : require('./graph-layout').layoutExecutionGraph)(executionGraph);

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
  defs.appendChild(marker('g-true', '#3fb950'));
  defs.appendChild(marker('g-false', '#f85149'));
  defs.appendChild(marker('g-seq', '#58a6ff'));
  svgEl.appendChild(defs);

  const edgeColor = { true: '#3fb950', false: '#f85149', seq: '#58a6ff' };

  // edges first (under nodes)
  layout.edges.forEach(e => {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', e.x1); line.setAttribute('y1', e.y1);
    line.setAttribute('x2', e.x2); line.setAttribute('y2', e.y2);
    line.setAttribute('stroke', edgeColor[e.kind] || '#484f58');
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

  // nodes
  layout.nodes.forEach(n => {
    const g = document.createElementNS(NS, 'g');
    if (n.shape === 'diamond') {
      const r = n.w / 2;
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', `${n.cx},${n.cy - r} ${n.cx + r},${n.cy} ${n.cx},${n.cy + r} ${n.cx - r},${n.cy}`);
      poly.setAttribute('fill', '#1f6feb22'); poly.setAttribute('stroke', '#d29922'); poly.setAttribute('stroke-width', '1.5');
      g.appendChild(poly);
    } else {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', n.cx - n.w / 2); rect.setAttribute('y', n.cy - n.h / 2);
      rect.setAttribute('width', n.w); rect.setAttribute('height', n.h);
      rect.setAttribute('rx', '8'); rect.setAttribute('fill', '#161b22'); rect.setAttribute('stroke', '#30363d'); rect.setAttribute('stroke-width', '1.5');
      g.appendChild(rect);
    }
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', n.cx); label.setAttribute('y', n.shape === 'diamond' ? n.cy + 3 : n.cy - 4);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', '11');
    label.setAttribute('fill', '#e6edf3'); label.setAttribute('font-family', 'monospace');
    label.textContent = n.label;
    g.appendChild(label);
    if (n.shape === 'rect' && n.agents.length) {
      const sub = document.createElementNS(NS, 'text');
      sub.setAttribute('x', n.cx); sub.setAttribute('y', n.cy + 12);
      sub.setAttribute('text-anchor', 'middle'); sub.setAttribute('font-size', '8');
      sub.setAttribute('fill', '#8b949e'); sub.setAttribute('font-family', 'monospace');
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
    zoomIn() { _zoomAt((_svgEl?.clientWidth || 0) / 2, (_svgEl?.clientHeight || 0) / 2, 1.25); },
    zoomOut() { _zoomAt((_svgEl?.clientWidth || 0) / 2, (_svgEl?.clientHeight || 0) / 2, 1 / 1.25); },
    reset: _resetView,
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderGraph, renderExecutionGraph };
}
