#!/usr/bin/env node
// Unit tests for the Discourse forum helpers. No live network — mock fixtures
// shaped like real community.openai.com / discuss.ai.google.dev search.json.
// Run: node --test test/discourse.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscourseSearchUrl, discourseAfterDate, parseDiscourseSearch } from '../scripts/lib/discourse.mjs';

test('buildDiscourseSearchUrl encodes the whole query (operators included) and trims a trailing slash', () => {
  const url = buildDiscourseSearchUrl({ base: 'https://community.openai.com/', query: 'GPT-5.6 after:2026-06-23 order:latest' });
  assert.equal(url, 'https://community.openai.com/search.json?q=GPT-5.6%20after%3A2026-06-23%20order%3Alatest');
});

test('discourseAfterDate emits a UTC YYYY-MM-DD', () => {
  assert.equal(discourseAfterDate(Date.parse('2026-07-23T09:15:00Z')), '2026-07-23');
});

test('parseDiscourseSearch normalizes topics + posts, builds URLs from slug, drops incomplete rows', () => {
  const json = {
    topics: [
      { id: 1387941, title: '5.6 pro downgraded to 5.5 mini', slug: '5-6-pro-downgraded', posts_count: 3, reply_count: 1, views: 210, created_at: '2026-07-23T07:29:12.936Z', last_posted_at: '2026-07-23T11:12:29.557Z' },
      { id: 999, title: 'no created_at' }, // dropped: no created_at
      { id: 1000, slug: 's', created_at: '2026-07-20T00:00:00Z' }, // dropped: no title
    ],
    posts: [
      { id: 1921760, username: 'bowie_dai', blurb: 'the returned model is a downgrade model', created_at: '2026-07-23T07:29:13.002Z', topic_id: 1387941, like_count: 0 },
      { id: 2, username: 'x', created_at: '2026-07-23T00:00:00Z', topic_id: 1387941 }, // dropped: no blurb
    ],
    grouped_search_result: { more_full_page_results: true },
  };
  const out = parseDiscourseSearch(json, { base: 'https://community.openai.com' });
  assert.equal(out.topics.length, 1);
  assert.equal(out.topics[0].id, 1387941);
  assert.equal(out.topics[0].url, 'https://community.openai.com/t/5-6-pro-downgraded/1387941');
  assert.equal(out.topics[0].replyCount, 1);
  assert.equal(out.topics[0].views, 210);
  assert.equal(out.topics[0].createdAt, '2026-07-23T07:29:12.936Z');
  assert.equal(out.posts.length, 1);
  assert.equal(out.posts[0].username, 'bowie_dai');
  assert.equal(out.posts[0].blurb, 'the returned model is a downgrade model');
  // post URL is built from the topic's slug looked up by topic_id
  assert.equal(out.posts[0].url, 'https://community.openai.com/t/5-6-pro-downgraded/1387941');
  assert.equal(out.more, true); // more_full_page_results → the set is a floor
});

test('parseDiscourseSearch: missing slug falls back to a topic-id URL, never a broken link', () => {
  const out = parseDiscourseSearch({
    topics: [{ id: 42, title: 'T', created_at: '2026-07-22T00:00:00Z' }],
    posts: [{ id: 7, blurb: 'b', created_at: '2026-07-22T00:00:00Z', topic_id: 42 }],
  }, { base: 'https://discuss.ai.google.dev' });
  assert.equal(out.topics[0].url, 'https://discuss.ai.google.dev/t/42');
  assert.equal(out.posts[0].url, 'https://discuss.ai.google.dev/t/42');
});

test('parseDiscourseSearch honors sinceISO — anything older than the window is dropped', () => {
  const json = {
    topics: [
      { id: 1, title: 'recent', slug: 'r', created_at: '2026-07-20T00:00:00Z' },
      { id: 2, title: 'old', slug: 'o', created_at: '2026-05-01T00:00:00Z' },
    ],
    posts: [
      { id: 10, blurb: 'recent post', created_at: '2026-07-20T00:00:00Z', topic_id: 1 },
      { id: 11, blurb: 'old post', created_at: '2026-05-01T00:00:00Z', topic_id: 2 },
    ],
  };
  const out = parseDiscourseSearch(json, { base: 'https://community.openai.com', sinceISO: '2026-06-23T00:00:00.000Z' });
  assert.deepEqual(out.topics.map((t) => t.id), [1]);
  assert.deepEqual(out.posts.map((p) => p.id), [10]);
});

test('parseDiscourseSearch handles empty/missing arrays without throwing', () => {
  assert.deepEqual(parseDiscourseSearch({}, { base: 'https://x' }), { topics: [], posts: [], more: false });
  assert.deepEqual(parseDiscourseSearch(null, { base: 'https://x' }), { topics: [], posts: [], more: false });
});
