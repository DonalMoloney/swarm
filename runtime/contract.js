// runtime/contract.js
'use strict';

const STATUSES = ['success', 'partial', 'error'];

function extractContract(text) {
  if (typeof text !== 'string') return { contract: null, structured: false, raw: text };
  const re = /```json\s*([\s\S]*?)```/gi;
  let m, last = null;
  while ((m = re.exec(text)) !== null) last = m[1];
  if (last === null) return { contract: null, structured: false, raw: text };
  let parsed;
  try { parsed = JSON.parse(last.trim()); }
  catch { return { contract: null, structured: false, raw: text }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { contract: null, structured: false, raw: text };
  }
  if (!STATUSES.includes(parsed.status) || typeof parsed.summary !== 'string') {
    return { contract: null, structured: false, raw: text };
  }
  return { contract: parsed, structured: true, raw: text };
}

function fallbackContract(text) {
  const firstLine = String(text || '').split('\n').map(l => l.trim()).find(Boolean) || '';
  return { status: 'success', summary: firstLine.slice(0, 200), _unstructured: true };
}

module.exports = { extractContract, fallbackContract, STATUSES };
