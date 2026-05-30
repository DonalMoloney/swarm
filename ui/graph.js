/**
 * Topology graph renderer — pure SVG, no dependencies.
 * Draws agent nodes and directed edges based on swarm stage data.
 */

function renderGraph(stages, agentStates, svgEl) {
  const W = svgEl.clientWidth || 600;
  const H = svgEl.clientHeight || 200;
  const stageCount = stages.length;
  const stageW = W / (stageCount + 1);

  const positions = {};
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  function makeMarker(id, color) {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L8,3 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    return marker;
  }

  defs.appendChild(makeMarker('arrow', '#484f58'));
  defs.appendChild(makeMarker('arrow-active', '#58a6ff'));
  svgEl.appendChild(defs);

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
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p1.x + 24);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x - 24);
        line.setAttribute('y2', p2.y);
        line.setAttribute('stroke', isActive ? '#58a6ff' : '#30363d');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('marker-end', isActive ? 'url(#arrow-active)' : 'url(#arrow)');
        svgEl.appendChild(line);
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

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 22);
    circle.setAttribute('fill', c.fill);
    circle.setAttribute('stroke', c.stroke);
    circle.setAttribute('stroke-width', state === 'running' ? '2' : '1.5');

    if (state === 'running') {
      circle.setAttribute('class', 'pulse');
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('fill', c.text);
    text.setAttribute('font-family', 'monospace');
    text.textContent = agent.length > 8 ? agent.slice(0, 7) + '…' : agent;

    g.appendChild(circle);
    g.appendChild(text);
    svgEl.appendChild(g);
  });
}

window.renderGraph = renderGraph;
