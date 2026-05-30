#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VALID_PROVIDERS = ['git-diff', 'file-tree', 'stack-detect', 'recent-commits'];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function gitDiff() {
  let diff = run('git diff HEAD');
  if (!diff) diff = run('git diff --cached');
  if (!diff) return 'No uncommitted changes.';
  const lines = diff.split('\n');
  const files = [];
  let current = null;
  let added = 0; let removed = 0;
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (current) files.push(`  ${current}  (+${added}, -${removed})`);
      current = line.split(' b/')[1] || line;
      added = 0; removed = 0;
    } else if (line.startsWith('+') && !line.startsWith('+++')) { added++; }
    else if (line.startsWith('-') && !line.startsWith('---')) { removed++; }
  }
  if (current) files.push(`  ${current}  (+${added}, -${removed})`);
  return files.length ? files.join('\n') : 'No file changes detected.';
}

function fileTree() {
  const raw = run(
    "find . -not -path './.git/*' -not -path './node_modules/*' " +
    "-not -path './swarms/output/*' -not -path './.swarm/*' " +
    "-maxdepth 4 -type f"
  );
  if (!raw) return 'Could not read file tree.';
  const lines = raw.split('\n').filter(Boolean).sort();
  return lines.slice(0, 80).join('\n') + (lines.length > 80 ? `\n  … (${lines.length - 80} more)` : '');
}

function stackDetect() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      const fw = deps.find(d => ['express','fastify','next','nuxt','react','vue','angular'].includes(d));
      const ver = pkg.engines && pkg.engines.node ? ` ${pkg.engines.node}` : '';
      return `Node.js${ver}${fw ? ', ' + fw : ''}`;
    } catch { return 'Node.js'; }
  }
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    const line = fs.readFileSync(path.join(cwd, 'go.mod'), 'utf8').split('\n')[0];
    return `Go (${line.replace('module ', '')})`;
  }
  if (fs.existsSync(path.join(cwd, 'requirements.txt')) || fs.existsSync(path.join(cwd, 'pyproject.toml'))) {
    return 'Python';
  }
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) return 'Rust';
  if (fs.existsSync(path.join(cwd, 'pom.xml'))) return 'Java (Maven)';
  const sample = run("find . -maxdepth 3 -type f \\( -name '*.js' -o -name '*.ts' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \\)");
  if (!sample) return 'Unknown';
  const exts = sample.split('\n').map(f => path.extname(f)).filter(Boolean);
  const counts = {};
  exts.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const map = { '.js': 'JavaScript/Node.js', '.ts': 'TypeScript', '.py': 'Python', '.go': 'Go', '.rs': 'Rust' };
  return top ? (map[top[0]] || top[0]) : 'Unknown';
}

function recentCommits() {
  const log = run('git log --oneline --format="%h %s (%an, %ar)" -10');
  return log || 'No git history found.';
}

const PROVIDERS = {
  'git-diff':       { label: 'Git diff',          fn: gitDiff },
  'file-tree':      { label: 'Project structure',  fn: fileTree },
  'stack-detect':   { label: 'Stack',              fn: stackDetect },
  'recent-commits': { label: 'Recent commits',     fn: recentCommits },
};

function gather(providers) {
  if (!providers || providers.length === 0) return '';
  const sections = [];
  for (const name of providers) {
    if (!PROVIDERS[name]) continue;
    const { label, fn } = PROVIDERS[name];
    const output = fn();
    if (output) sections.push(`**${label}:**\n${output}`);
  }
  if (!sections.length) return '';
  return `## Context\n\n${sections.join('\n\n')}`;
}

module.exports = { gather, VALID_PROVIDERS };
