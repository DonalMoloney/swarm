// runtime/notify.test.js
// Tests for the zero-dependency notification module.
// Does NOT make real HTTP calls — verifies pure formatting and no-op behaviour.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { notify, formatGithubComment, formatSlackPayload } = require('./notify');

// ─── Shared test event ────────────────────────────────────────────────────────

const DONE_EVENT = {
  blueprint: 'research',
  task: 'compare AI frameworks',
  status: 'done',
  totalTokens: 1500,
  totalCostUsd: 0.0123,
};

const ABORTED_EVENT = {
  blueprint: 'code-review',
  task: 'PR #42',
  status: 'aborted',
  totalTokens: 300,
  totalCostUsd: 0.002,
};

const ERROR_EVENT = {
  blueprint: 'debug',
  task: 'TypeError in auth',
  status: 'error',
  totalTokens: 0,
  totalCostUsd: 0,
};

// ─── No-op behaviour ─────────────────────────────────────────────────────────

test('notify() resolves immediately when no config provided', async () => {
  // Must not throw and must resolve (timeout would indicate it tried HTTP)
  await assert.doesNotReject(() => notify(DONE_EVENT, {}));
});

test('notify() is a no-op when only partial github config is given (missing prNumber)', async () => {
  await assert.doesNotReject(() =>
    notify(DONE_EVENT, { githubToken: 'tok', githubRepo: 'owner/repo' })
  );
});

test('notify() is a no-op when only partial github config is given (missing token)', async () => {
  await assert.doesNotReject(() =>
    notify(DONE_EVENT, { githubRepo: 'owner/repo', prNumber: '42' })
  );
});

// ─── GitHub comment formatting ────────────────────────────────────────────────

test('formatGithubComment includes blueprint name', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(comment.includes('research'), 'must include blueprint name');
});

test('formatGithubComment includes task text', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(comment.includes('compare AI frameworks'), 'must include the task');
});

test('formatGithubComment includes status', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(comment.includes('done'), 'must include status');
});

test('formatGithubComment includes token count', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(comment.includes('1,500'), 'must include formatted token count');
});

test('formatGithubComment includes cost with 4 decimal places', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(comment.includes('$0.0123'), 'must include cost');
});

test('formatGithubComment uses success emoji for done status', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(comment.includes('✅'), 'done => green checkmark');
});

test('formatGithubComment uses warning emoji for aborted status', () => {
  const comment = formatGithubComment(ABORTED_EVENT);
  assert.ok(comment.includes('⚠️'), 'aborted => warning');
});

test('formatGithubComment uses error emoji for error status', () => {
  const comment = formatGithubComment(ERROR_EVENT);
  assert.ok(comment.includes('❌'), 'error => red cross');
});

test('formatGithubComment includes runUrl when provided', () => {
  const event = { ...DONE_EVENT, runUrl: 'https://ci.example.com/runs/42' };
  const comment = formatGithubComment(event);
  assert.ok(comment.includes('https://ci.example.com/runs/42'), 'must include run URL');
});

test('formatGithubComment omits runUrl row when not provided', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(!comment.includes('Run URL'), 'should not include Run URL row');
});

test('formatGithubComment is a markdown table', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(comment.includes('|'), 'must contain markdown table pipes');
  assert.ok(comment.includes('---'), 'must contain table separator');
});

// ─── Slack payload formatting ─────────────────────────────────────────────────

test('formatSlackPayload returns object with text field', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  assert.ok(typeof payload.text === 'string', 'payload must have text string');
});

test('formatSlackPayload text includes blueprint name', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  assert.ok(payload.text.includes('research'), 'text must include blueprint name');
});

test('formatSlackPayload text includes status', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  assert.ok(payload.text.includes('done'), 'text must include status');
});

test('formatSlackPayload has attachments array', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  assert.ok(Array.isArray(payload.attachments), 'must have attachments array');
  assert.ok(payload.attachments.length > 0, 'must have at least one attachment');
});

test('formatSlackPayload attachment has fields with Blueprint and Task', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  const fields = payload.attachments[0].fields;
  assert.ok(Array.isArray(fields), 'attachment must have fields');
  const fieldTitles = fields.map(f => f.title);
  assert.ok(fieldTitles.includes('Blueprint'), 'must have Blueprint field');
  assert.ok(fieldTitles.includes('Task'), 'must have Task field');
  assert.ok(fieldTitles.includes('Tokens'), 'must have Tokens field');
  assert.ok(fieldTitles.includes('Cost'), 'must have Cost field');
});

test('formatSlackPayload attachment color is "good" for done', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  assert.equal(payload.attachments[0].color, 'good');
});

test('formatSlackPayload attachment color is "warning" for aborted', () => {
  const payload = formatSlackPayload(ABORTED_EVENT);
  assert.equal(payload.attachments[0].color, 'warning');
});

test('formatSlackPayload attachment color is "danger" for error', () => {
  const payload = formatSlackPayload(ERROR_EVENT);
  assert.equal(payload.attachments[0].color, 'danger');
});

test('formatSlackPayload includes runUrl field when provided', () => {
  const event = { ...DONE_EVENT, runUrl: 'https://ci.example.com/runs/42' };
  const payload = formatSlackPayload(event);
  const fields = payload.attachments[0].fields;
  const urlField = fields.find(f => f.title === 'Run URL');
  assert.ok(urlField, 'must include Run URL field');
  assert.equal(urlField.value, 'https://ci.example.com/runs/42');
});

test('formatSlackPayload attachment has ts (unix timestamp)', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  assert.ok(typeof payload.attachments[0].ts === 'number', 'must have numeric ts');
});

// ─── JSON serializability ─────────────────────────────────────────────────────

test('formatSlackPayload output is JSON-serializable', () => {
  const payload = formatSlackPayload(DONE_EVENT);
  assert.doesNotThrow(() => JSON.stringify(payload), 'must be JSON serializable');
});

test('formatGithubComment output is a non-empty string', () => {
  const comment = formatGithubComment(DONE_EVENT);
  assert.ok(typeof comment === 'string' && comment.length > 0, 'must be a non-empty string');
});
