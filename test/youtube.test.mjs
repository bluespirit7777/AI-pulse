#!/usr/bin/env node
// Unit tests for the YouTube trending-videos helpers. No live network calls —
// every fetch response is a mock fixture. Run: node --test test/youtube.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchUrl, buildVideosStatsUrl, parseSearchResponse, parseVideosStatsResponse,
  mergeViewCounts, isAiRelevant, filterAiRelevant, daysAgoISO, buildTopVideos,
} from '../scripts/lib/youtube.mjs';

test('buildSearchUrl encodes query, key, and sorts by viewCount', () => {
  const url = buildSearchUrl({ query: 'Gemini AI', apiKey: 'KEY123', publishedAfter: '2026-07-01T00:00:00.000Z' });
  assert.ok(url.startsWith('https://www.googleapis.com/youtube/v3/search?'));
  assert.match(url, /q=Gemini\+AI/);
  assert.match(url, /order=viewCount/);
  assert.match(url, /type=video/);
  assert.match(url, /key=KEY123/);
  assert.match(url, /publishedAfter=2026-07-01/);
});

test('buildVideosStatsUrl joins video ids with commas', () => {
  const url = buildVideosStatsUrl({ videoIds: ['abc', 'def'], apiKey: 'KEY' });
  assert.match(url, /id=abc%2Cdef/);
  assert.match(url, /part=statistics/);
});

test('parseSearchResponse normalizes items and drops malformed entries', () => {
  const json = {
    items: [
      { id: { videoId: 'v1' }, snippet: { title: 'ChatGPT review', channelTitle: 'Tech Chan', publishedAt: '2026-07-10T00:00:00Z', description: 'a chatbot review', thumbnails: { medium: { url: 'http://t/1.jpg' } } } },
      { id: {}, snippet: { title: 'no id' } }, // missing videoId — dropped
      { snippet: { title: 'no id field at all' } }, // missing id entirely — dropped
    ],
  };
  const out = parseSearchResponse(json);
  assert.equal(out.length, 1);
  assert.equal(out[0].videoId, 'v1');
  assert.equal(out[0].url, 'https://www.youtube.com/watch?v=v1');
  assert.equal(out[0].viewCount, null);
  assert.equal(out[0].thumbnailUrl, 'http://t/1.jpg');
});

test('parseSearchResponse handles an empty/missing items array', () => {
  assert.deepEqual(parseSearchResponse({}), []);
  assert.deepEqual(parseSearchResponse(null), []);
});

test('parseVideosStatsResponse builds a videoId -> viewCount map, skipping invalid counts', () => {
  const json = { items: [
    { id: 'v1', statistics: { viewCount: '150000' } },
    { id: 'v2', statistics: { viewCount: 'not-a-number' } },
    { id: 'v3', statistics: {} },
  ] };
  const map = parseVideosStatsResponse(json);
  assert.equal(map.get('v1'), 150000);
  assert.equal(map.has('v2'), false);
  assert.equal(map.has('v3'), false);
});

test('mergeViewCounts attaches counts by id and leaves unmatched videos at null, not 0', () => {
  const videos = [{ videoId: 'v1', title: 'a' }, { videoId: 'v9', title: 'b' }];
  const map = new Map([['v1', 500]]);
  const merged = mergeViewCounts(videos, map);
  assert.equal(merged[0].viewCount, 500);
  assert.equal(merged[1].viewCount, null);
});

test('isAiRelevant accepts videos with clear AI context', () => {
  assert.equal(isAiRelevant('Gemini AI just got a huge update', 'Google DeepMind news'), true);
  assert.equal(isAiRelevant('ChatGPT vs Claude coding comparison', ''), true);
});

test('isAiRelevant rejects the zodiac-sign false positive when no AI context is present', () => {
  assert.equal(isAiRelevant('Gemini Weekly Horoscope', 'Your zodiac forecast for this week'), false);
  assert.equal(isAiRelevant('Gemini and Sagittarius compatibility', 'astrology tarot reading'), false);
});

test('isAiRelevant lets ambiguous-but-not-known-false-positive titles through', () => {
  // no AI signal AND no zodiac signal either — not the known failure mode, so don't over-filter
  assert.equal(isAiRelevant('Some random video', 'no relevant keywords here'), true);
});

test('filterAiRelevant removes only the zodiac-flagged entries', () => {
  const videos = [
    { title: 'Gemini AI review', description: 'Google model' },
    { title: 'Gemini Horoscope Today', description: 'astrology' },
  ];
  const out = filterAiRelevant(videos);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Gemini AI review');
});

test('daysAgoISO computes a real ISO timestamp N days before `now`', () => {
  const now = Date.parse('2026-07-15T00:00:00.000Z');
  assert.equal(daysAgoISO(7, now), '2026-07-08T00:00:00.000Z');
});

test('buildTopVideos filters, attaches view counts, re-sorts by real count, and caps to maxResults', () => {
  const searchJson = {
    items: [
      { id: { videoId: 'a' }, snippet: { title: 'ChatGPT tips', description: '', channelTitle: 'C1', publishedAt: '2026-07-10T00:00:00Z' } },
      { id: { videoId: 'b' }, snippet: { title: 'ChatGPT tricks', description: '', channelTitle: 'C2', publishedAt: '2026-07-11T00:00:00Z' } },
      { id: { videoId: 'z' }, snippet: { title: 'Gemini Horoscope', description: 'zodiac forecast', channelTitle: 'C3', publishedAt: '2026-07-11T00:00:00Z' } },
    ],
  };
  // 'a' has fewer views than 'b' even though search.list listed it first —
  // the real stats call should win the final ordering.
  const statsJson = { items: [
    { id: 'a', statistics: { viewCount: '1000' } },
    { id: 'b', statistics: { viewCount: '5000' } },
  ] };
  const out = buildTopVideos(searchJson, statsJson, { maxResults: 5 });
  assert.equal(out.length, 2); // zodiac entry filtered out
  assert.equal(out[0].videoId, 'b');
  assert.equal(out[0].viewCount, 5000);
  assert.equal(out[1].videoId, 'a');
});

test('buildTopVideos caps results to maxResults', () => {
  const searchJson = { items: Array.from({ length: 8 }, (_, i) => ({
    id: { videoId: `v${i}` }, snippet: { title: `ChatGPT video ${i}`, description: '', channelTitle: 'C', publishedAt: '2026-07-10T00:00:00Z' },
  })) };
  const statsJson = { items: Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, statistics: { viewCount: String(1000 - i) } })) };
  const out = buildTopVideos(searchJson, statsJson, { maxResults: 5 });
  assert.equal(out.length, 5);
  assert.equal(out[0].videoId, 'v0'); // highest view count
});
