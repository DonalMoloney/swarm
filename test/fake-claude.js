#!/usr/bin/env node
// test/fake-claude.js
// Stub of `claude -p <prompt> --output-format json` for tests. No network.
// Behavior is driven by markers in the prompt:
//   contains "SLEEP"   -> sleep 5s (to trigger the runner timeout)
//   contains "NOJSON"  -> return text with no contract block
//   otherwise          -> return a valid contract envelope
const args = process.argv.slice(2);
const pIdx = args.indexOf('-p');
const prompt = pIdx !== -1 ? (args[pIdx + 1] || '') : '';

function emit(result) {
  process.stdout.write(JSON.stringify({
    result,
    usage: { input_tokens: 100, output_tokens: 20 },
    total_cost_usd: 0.005,
    is_error: false,
  }));
}

if (prompt.includes('SLEEP')) {
  setTimeout(() => emit('late'), 5000);
} else if (prompt.includes('NOJSON')) {
  emit('just prose, no contract');
} else if (prompt.includes('HIGHCONF')) {
  emit('Done.\n```json\n{"status":"success","summary":"ok","confidence":0.95}\n```');
} else if (prompt.includes('LOWCONF')) {
  emit('Done.\n```json\n{"status":"success","summary":"ok","confidence":0.3}\n```');
} else {
  emit('Done.\n```json\n{"status":"success","summary":"ok"}\n```');
}
