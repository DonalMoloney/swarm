// runtime/notify.js
// Zero-dependency notification module for CI/headless swarm runs.
// Sends a summary to a GitHub PR comment and/or a Slack webhook after a run.
//
// API:
//   notify(event, opts) -> Promise<void>
//   formatGithubComment(event) -> string       (exported for testing)
//   formatSlackPayload(event)  -> object       (exported for testing)
//
// event: { type, blueprint, task, status, totalTokens, totalCostUsd, runUrl? }
// opts:  { githubToken?, slackWebhook?, githubRepo?, prNumber? }
//
// If neither githubToken+repo nor slackWebhook is provided, resolves immediately (no-op).

'use strict';

const https = require('https');

// Pure formatting helpers — no I/O, fully testable.

function statusEmoji(status) {
  if (status === 'done') return '✅';
  if (status === 'aborted') return '⚠️';
  return '❌';
}

function formatGithubComment(event) {
  const { blueprint, task, status, totalTokens, totalCostUsd, runUrl } = event;
  const emoji = statusEmoji(status);
  const cost = typeof totalCostUsd === 'number' ? `$${totalCostUsd.toFixed(4)}` : 'n/a';
  const tokens = typeof totalTokens === 'number' ? totalTokens.toLocaleString() : 'n/a';
  const lines = [
    `## ${emoji} Swarm Run — \`${blueprint}\``,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Blueprint** | \`${blueprint}\` |`,
    `| **Task** | ${task} |`,
    `| **Status** | ${status} |`,
    `| **Tokens** | ${tokens} |`,
    `| **Cost** | ${cost} |`,
  ];
  if (runUrl) lines.push(`| **Run URL** | [View run](${runUrl}) |`);
  lines.push('');
  lines.push('*Posted by [Swarm CI runner](https://github.com/anthropics/swarm)*');
  return lines.join('\n');
}

function formatSlackPayload(event) {
  const { blueprint, task, status, totalTokens, totalCostUsd, runUrl } = event;
  const emoji = statusEmoji(status);
  const cost = typeof totalCostUsd === 'number' ? `$${totalCostUsd.toFixed(4)}` : 'n/a';
  const tokens = typeof totalTokens === 'number' ? totalTokens.toLocaleString() : 'n/a';

  const text = `${emoji} *Swarm \`${blueprint}\`* — ${status}`;
  const fields = [
    { title: 'Blueprint', value: blueprint, short: true },
    { title: 'Status', value: status, short: true },
    { title: 'Task', value: task, short: false },
    { title: 'Tokens', value: tokens, short: true },
    { title: 'Cost', value: cost, short: true },
  ];
  if (runUrl) fields.push({ title: 'Run URL', value: runUrl, short: false });

  return {
    text,
    attachments: [
      {
        color: status === 'done' ? 'good' : status === 'aborted' ? 'warning' : 'danger',
        fields,
        footer: 'Swarm CI runner',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

// Low-level HTTP POST helper using Node built-ins only.
function httpPost(urlString, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: raw });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function postGithubComment(event, { githubToken, githubRepo, prNumber }) {
  if (!githubToken || !githubRepo || !prNumber) return;
  const body = formatGithubComment(event);
  const url = `https://api.github.com/repos/${githubRepo}/issues/${prNumber}/comments`;
  await httpPost(url, { body }, {
    Authorization: `Bearer ${githubToken}`,
    'User-Agent': 'swarm-ci-runner/1.0',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });
}

async function postSlackMessage(event, { slackWebhook }) {
  if (!slackWebhook) return;
  const payload = formatSlackPayload(event);
  await httpPost(slackWebhook, payload, {});
}

/**
 * Send run-completion notifications.
 * Never throws — errors are logged as warnings so CI pipelines continue.
 *
 * @param {object} event   - { blueprint, task, status, totalTokens, totalCostUsd, runUrl? }
 * @param {object} opts    - { githubToken?, slackWebhook?, githubRepo?, prNumber? }
 * @returns {Promise<void>}
 */
async function notify(event, opts = {}) {
  const { githubToken, slackWebhook, githubRepo, prNumber } = opts;

  const hasGithub = !!(githubToken && githubRepo && prNumber);
  const hasSlack = !!slackWebhook;

  if (!hasGithub && !hasSlack) return; // no-op

  const tasks = [];
  if (hasGithub) {
    tasks.push(
      postGithubComment(event, opts).catch((err) => {
        process.stderr.write(`[swarm/notify] GitHub comment failed: ${err.message}\n`);
      })
    );
  }
  if (hasSlack) {
    tasks.push(
      postSlackMessage(event, opts).catch((err) => {
        process.stderr.write(`[swarm/notify] Slack webhook failed: ${err.message}\n`);
      })
    );
  }

  await Promise.all(tasks);
}

module.exports = { notify, formatGithubComment, formatSlackPayload };
