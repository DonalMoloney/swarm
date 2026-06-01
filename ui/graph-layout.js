/**
 * Pure layout for a Phase-2 execution graph.
 * No DOM, no dependencies — usable in the browser and in node tests.
 *
 * Input:  { stages: [ {id,type:'group',group_id,agents} | {id,type:'condition',condition_id,true_next,false_next} ] }
 * Output: { width, height, nodes:[...positioned...], edges:[...with endpoints...] }
 */

const COL_W = 170;   // horizontal spacing between columns
const ROW_H = 90;    // vertical spacing between rows
const MARGIN = 24;   // canvas padding
const RECT_W = 130;  // group box width
const RECT_H = 54;   // group box height
const DIAMOND = 64;  // condition diamond bounding size

function buildEdges(stages) {
  const edges = [];
  const byId = Object.fromEntries(stages.map(s => [s.id, s]));
  const branchTargets = new Set();
  for (const n of stages) {
    if (n.type === 'condition') {
      branchTargets.add(n.true_next);
      branchTargets.add(n.false_next);
    }
  }
  // condition → branch targets
  for (const n of stages) {
    if (n.type === 'condition') {
      if (byId[n.true_next]) edges.push({ from: n.id, to: n.true_next, kind: 'true' });
      if (byId[n.false_next]) edges.push({ from: n.id, to: n.false_next, kind: 'false' });
    }
  }
  // sequential: a group that is immediately followed by a condition flows into it
  for (let i = 0; i < stages.length - 1; i++) {
    const cur = stages[i];
    const next = stages[i + 1];
    if (cur.type === 'group' && next.type === 'condition') {
      edges.push({ from: cur.id, to: next.id, kind: 'seq' });
    }
  }
  return edges;
}

function assignColumns(stages, edges) {
  const col = {};
  for (const n of stages) col[n.id] = 0;
  // relax (DAG longest-path); iterate stages.length times for safety
  for (let it = 0; it < stages.length; it++) {
    for (const e of edges) {
      if (col[e.to] < col[e.from] + 1) col[e.to] = col[e.from] + 1;
    }
  }
  return col;
}

function layoutExecutionGraph(graph) {
  const stages = (graph && graph.stages) || [];
  const edges = buildEdges(stages);
  const col = assignColumns(stages, edges);

  // rows: stack nodes within each column in stage order
  const rowCounter = {};
  const node = {};
  let maxRow = 0;
  let maxCol = 0;

  for (const s of stages) {
    const c = col[s.id];
    const r = rowCounter[c] || 0;
    rowCounter[c] = r + 1;
    maxCol = Math.max(maxCol, c);
    maxRow = Math.max(maxRow, r);

    const isCond = s.type === 'condition';
    const w = isCond ? DIAMOND : RECT_W;
    const h = isCond ? DIAMOND : RECT_H;
    const cx = MARGIN + c * COL_W + RECT_W / 2;
    const cy = MARGIN + r * ROW_H + RECT_H / 2;

    node[s.id] = {
      id: s.id,
      type: s.type,
      shape: isCond ? 'diamond' : 'rect',
      label: isCond ? s.condition_id : s.group_id,
      agents: isCond ? [] : (s.agents || []),
      col: c,
      row: r,
      cx,
      cy,
      w,
      h,
    };
  }

  const positionedEdges = edges.map(e => ({
    from: e.from,
    to: e.to,
    kind: e.kind,
    x1: node[e.from].cx,
    y1: node[e.from].cy,
    x2: node[e.to].cx,
    y2: node[e.to].cy,
  }));

  return {
    width: MARGIN * 2 + (maxCol + 1) * COL_W,
    height: MARGIN * 2 + (maxRow + 1) * ROW_H,
    nodes: Object.values(node),
    edges: positionedEdges,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { layoutExecutionGraph };
}
if (typeof window !== 'undefined') {
  window.layoutExecutionGraph = layoutExecutionGraph;
}
