#!/usr/bin/env node
// Unit tests for the GitHub Discussions helpers. No live network — GraphQL
// needs an auth token for every call (even public repos), so every response
// here is a mock fixture shaped like the real API. Run:
// node --test test/github-discussions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscussionsQueryBody, buildAuthHeaders, parseDiscussionsResponse, windowedDiscussions,
} from '../scripts/lib/github-discussions.mjs';

test('buildDiscussionsQueryBody targets the repo, orders by newest, passes variables (not string interpolation)', () => {
  const body = buildDiscussionsQueryBody({ owner: 'anthropics', name: 'claude-code-action', first: 15 });
  assert.match(body.query, /repository\(owner: \$owner, name: \$name\)/);
  assert.match(body.query, /orderBy: \{field: CREATED_AT, direction: DESC\}/);
  assert.deepEqual(body.variables, { owner: 'anthropics', name: 'claude-code-action', first: 15 });
  // the query string itself must not contain the literal repo name — everything
  // goes through $variables, so a repo name can never break out of the query
  assert.doesNotMatch(body.query, /claude-code-action/);
});

test('buildAuthHeaders sets a Bearer token and identifies the client', () => {
  const h = buildAuthHeaders('ghs_abc123');
  assert.equal(h.Authorization, 'Bearer ghs_abc123');
  assert.equal(h['User-Agent'], 'ai-pulse-community-pulse');
});

test('parseDiscussionsResponse normalizes nodes, builds urls, drops incomplete rows', () => {
  const json = {
    data: {
      repository: {
        discussions: {
          nodes: [
            {
              id: 'D_1', title: '/workflow command in Claude Code Plugin in Cursor',
              url: 'https://github.com/anthropics/claude-code-action/discussions/9001',
              createdAt: '2026-07-21T10:00:00Z', author: { login: 'someuser' },
              bodyText: 'Has anyone gotten the /workflow command working inside Cursor?',
              category: { name: 'General' }, comments: { totalCount: 3 },
            },
            { id: 'D_2', createdAt: '2026-07-20T00:00:00Z' }, // dropped: no title
            { title: 'no id or date' }, // dropped: no id/createdAt
          ],
        },
      },
    },
  };
  const out = parseDiscussionsResponse(json, { owner: 'anthropics', name: 'claude-code-action', label: 'Claude', org: 'Anthropic' });
  assert.equal(out.ok, true);
  assert.equal(out.discussions.length, 1);
  const d = out.discussions[0];
  assert.equal(d.id, 'D_1');
  assert.equal(d.author, 'someuser');
  assert.equal(d.category, 'General');
  assert.equal(d.commentCount, 3);
  assert.equal(d.label, 'Claude');
  assert.equal(d.org, 'Anthropic');
  assert.equal(d.repo, 'anthropics/claude-code-action');
  assert.equal(d.url, 'https://github.com/anthropics/claude-code-action/discussions/9001');
});

test('parseDiscussionsResponse falls back to a discussions-tab URL when a node has no url', () => {
  const out = parseDiscussionsResponse({
    data: { repository: { discussions: { nodes: [{ id: 'D_1', title: 'T', createdAt: '2026-07-20T00:00:00Z' }] } } },
  }, { owner: 'QwenLM', name: 'Qwen3.6', label: 'Qwen', org: 'Alibaba' });
  assert.equal(out.discussions[0].url, 'https://github.com/QwenLM/Qwen3.6/discussions');
});

test('parseDiscussionsResponse treats a GraphQL errors array as a failed source, not a crash', () => {
  const out = parseDiscussionsResponse({ errors: [{ message: 'Resource not accessible by integration' }] }, { owner: 'xai-org', name: 'grok-build', label: 'Grok', org: 'xAI' });
  assert.equal(out.ok, false);
  assert.equal(out.discussions.length, 0);
  assert.match(out.errorMessage, /not accessible/);
});

test('parseDiscussionsResponse treats a missing/null repository (Discussions disabled) as a failed source', () => {
  const out = parseDiscussionsResponse({ data: { repository: null } }, { owner: 'x', name: 'y', label: 'L', org: 'O' });
  assert.equal(out.ok, false);
  assert.equal(out.discussions.length, 0);
});

test('windowedDiscussions: fewer results than the fetch page, oldest already outside window -> exact (not estimated)', () => {
  const discussions = [
    { id: 1, createdAt: '2026-07-20T00:00:00Z' },
    { id: 2, createdAt: '2026-07-10T00:00:00Z' },
    { id: 3, createdAt: '2026-06-01T00:00:00Z' }, // outside a 30-day window from 2026-07-23
  ];
  const { inWindow, isEstimated } = windowedDiscussions(discussions, '2026-06-23T00:00:00.000Z');
  assert.deepEqual(inWindow.map((d) => d.id), [1, 2]);
  assert.equal(isEstimated, false); // the oldest fetched item is already older than the window -> complete
});

test('windowedDiscussions: the oldest fetched item is still inside the window -> estimated (a floor, more may exist)', () => {
  const discussions = [
    { id: 1, createdAt: '2026-07-20T00:00:00Z' },
    { id: 2, createdAt: '2026-07-15T00:00:00Z' },
  ];
  const { inWindow, isEstimated } = windowedDiscussions(discussions, '2026-06-23T00:00:00.000Z');
  assert.deepEqual(inWindow.map((d) => d.id), [1, 2]);
  assert.equal(isEstimated, true); // could not confirm there isn't more beyond the fetched page
});

test('windowedDiscussions handles an empty list without throwing', () => {
  const { inWindow, isEstimated } = windowedDiscussions([], '2026-06-23T00:00:00.000Z');
  assert.deepEqual(inWindow, []);
  assert.equal(isEstimated, false);
});
