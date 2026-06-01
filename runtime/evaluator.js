// runtime/evaluator.js
'use strict';

// Evaluate a Phase-2 condition against captured agent results so the runner can
// deterministically route execution_graph branches.
//
// resultsByName: { <agentName>: { status, structured, contract: { ...fields } } }
// (the shape produced by runAgent / runStage)

function parseThreshold(threshold) {
  const s = String(threshold == null ? '' : threshold).trim();
  let m = s.match(/^(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (m) {
    const raw = m[2].trim().replace(/^["']|["']$/g, '');
    const n = Number(raw);
    return { op: m[1], value: raw !== '' && !isNaN(n) ? n : raw };
  }
  m = s.match(/^contains\s+(.+)$/i);
  if (m) return { op: 'contains', value: m[1].trim().replace(/^["']|["']$/g, '') };
  // bare value → equality
  return { op: '==', value: s.replace(/^["']|["']$/g, '') };
}

function compare(actual, op, value) {
  switch (op) {
    case '>':  return Number(actual) >  Number(value);
    case '<':  return Number(actual) <  Number(value);
    case '>=': return Number(actual) >= Number(value);
    case '<=': return Number(actual) <= Number(value);
    case '==': return String(actual) === String(value);
    case '!=': return String(actual) !== String(value);
    case 'contains': return String(actual).includes(String(value));
    default: return false;
  }
}

function evaluateCondition(condition, resultsByName) {
  const results = resultsByName || {};
  if (!condition || typeof condition !== 'object') return false;

  if (condition.type === 'agent_output') {
    const r = results[condition.source];
    if (!r || !r.contract) return false;
    const actual = r.contract[condition.check];
    if (actual === undefined || actual === null) return false;
    const { op, value } = parseThreshold(condition.threshold);
    return compare(actual, op, value);
  }

  if (condition.type === 'validation') {
    const all = Object.values(results);
    switch (condition.criteria) {
      case 'no-errors':   return all.every(r => r.status !== 'error');
      case 'no-warnings': return all.every(r => r.status === 'success');
      case 'all-pass':    return all.length > 0 && all.every(r => r.structured && r.status === 'success');
      default: return false;
    }
  }

  return false;
}

module.exports = { evaluateCondition, parseThreshold, compare };
