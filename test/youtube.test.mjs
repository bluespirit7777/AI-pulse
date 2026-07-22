#!/usr/bin/env node
// Unit tests for the YouTube trending-videos helpers. No live network calls —
// every fetch response is a mock fixture. Run: node --test test/youtube.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchUrl, buildVideosStatsUrl, parseSearchResponse, parseISO8601Duration,
  parseVideosDetailsResponse, mergeVideoDetails, isShort, filterOutShorts,
  isAiRelevant, filterAiRelevant, isLikelyEnglish, filterEnglish,
  daysAgoISO, buildTopVideos, MAX_SHORT_SECONDS,
} from '../scripts/lib/youtube.mjs';

test('buildSearchUrl encodes query, key, and sorts by viewCount', () => {
  const url = buildSearchUrl({ query: 'Gemini AI', apiKey: 'KEY123', publishedAfter: '2026-07-01T00:00:00.000Z' });
  assert.ok(url.startsWith('https://www.googleapis.com/youtube/v3/search?'));
  assert.match(url, /q=Gemini\+AI/);
  assert.match(url, /order=viewCount/);
  assert.match(url, /type=video/);
  assert.match(url, /key=KEY123/);
  assert.match(url, /publishedAfter=2026-07-01/);
  assert.match(url, /relevanceLanguage=en/);
});

test('buildVideosStatsUrl joins video ids with commas and requests statistics + contentDetails', () => {
  const url = buildVideosStatsUrl({ videoIds: ['abc', 'def'], apiKey: 'KEY' });
  assert.match(url, /id=abc%2Cdef/);
  assert.match(url, /part=statistics%2CcontentDetails/);
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
  assert.equal(out[0].durationSeconds, null);
  assert.equal(out[0].thumbnailUrl, 'http://t/1.jpg');
});

test('parseSearchResponse handles an empty/missing items array', () => {
  assert.deepEqual(parseSearchResponse({}), []);
  assert.deepEqual(parseSearchResponse(null), []);
});

test('parseISO8601Duration parses hours/minutes/seconds in any combination', () => {
  assert.equal(parseISO8601Duration('PT45S'), 45);
  assert.equal(parseISO8601Duration('PT4M13S'), 253);
  assert.equal(parseISO8601Duration('PT1H2M3S'), 3723);
  assert.equal(parseISO8601Duration('PT10M'), 600);
  assert.equal(parseISO8601Duration('PT2H'), 7200);
});

test('parseISO8601Duration returns null for missing/malformed input, never a guessed 0', () => {
  assert.equal(parseISO8601Duration(null), null);
  assert.equal(parseISO8601Duration(''), null);
  assert.equal(parseISO8601Duration('not-a-duration'), null);
});

test('parseVideosDetailsResponse builds a videoId -> {viewCount, durationSeconds} map', () => {
  const json = { items: [
    { id: 'v1', statistics: { viewCount: '150000' }, contentDetails: { duration: 'PT4M13S' } },
    { id: 'v2', statistics: { viewCount: 'not-a-number' }, contentDetails: { duration: 'PT30S' } },
    { id: 'v3', statistics: {}, contentDetails: {} },
  ] };
  const map = parseVideosDetailsResponse(json);
  assert.deepEqual(map.get('v1'), { viewCount: 150000, durationSeconds: 253 });
  assert.equal(map.get('v2').viewCount, null);
  assert.equal(map.get('v2').durationSeconds, 30);
  assert.equal(map.get('v3').viewCount, null);
  assert.equal(map.get('v3').durationSeconds, null);
});

test('mergeVideoDetails attaches details by id and leaves unmatched videos at null, not 0/false', () => {
  const videos = [{ videoId: 'v1', title: 'a' }, { videoId: 'v9', title: 'b' }];
  const map = new Map([['v1', { viewCount: 500, durationSeconds: 400 }]]);
  const merged = mergeVideoDetails(videos, map);
  assert.equal(merged[0].viewCount, 500);
  assert.equal(merged[0].durationSeconds, 400);
  assert.equal(merged[1].viewCount, null);
  assert.equal(merged[1].durationSeconds, null);
});

test('isShort treats <= MAX_SHORT_SECONDS as a Short and unknown duration as NOT a Short', () => {
  assert.equal(isShort(45), true);
  assert.equal(isShort(MAX_SHORT_SECONDS), true);
  assert.equal(isShort(MAX_SHORT_SECONDS + 1), false);
  assert.equal(isShort(600), false);
  assert.equal(isShort(null), false); // unknown duration — don't over-filter
});

test('filterOutShorts drops only videos at/under the Shorts duration threshold', () => {
  const videos = [
    { videoId: 'short', durationSeconds: 40 },
    { videoId: 'long', durationSeconds: 400 },
    { videoId: 'unknown', durationSeconds: null },
  ];
  const out = filterOutShorts(videos).map((v) => v.videoId);
  assert.deepEqual(out, ['long', 'unknown']);
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

test('isLikelyEnglish keeps Latin-script titles and drops titles dominated by a non-Latin script', () => {
  assert.equal(isLikelyEnglish('Gemini 3 Pro full review and benchmarks'), true);
  assert.equal(isLikelyEnglish('ChatGPT Sol vs Claude Opus 4.8'), true);
  assert.equal(isLikelyEnglish('Gemini 3 Pro AI'), true); // brand + latin — keep
  assert.equal(isLikelyEnglish('जेमिनी 3 प्रो का पूरा रिव्यू'), false); // Hindi
  assert.equal(isLikelyEnglish('ChatGPTの使い方を徹底解説する動画'), false); // Japanese dominates
  assert.equal(isLikelyEnglish('클로드 오푸스 완벽 가이드'), false); // Korean
  assert.equal(isLikelyEnglish('双子座 AI 完整评测教程视频'), false); // Chinese dominates
});

test('isLikelyEnglish does not over-filter: no-letter titles and ties are kept', () => {
  assert.equal(isLikelyEnglish('🔥🔥🔥 2026 !!!'), true); // no letters at all
  assert.equal(isLikelyEnglish(''), true);
  assert.equal(isLikelyEnglish(null), true);
  assert.equal(isLikelyEnglish('AI 人工'), true); // 2 latin vs 2 han — tie stays
});

test('filterEnglish removes only the non-Latin-dominated titles', () => {
  const videos = [
    { title: 'Gemini 3 Pro review' },
    { title: 'ジェミニ 3 プロ 徹底レビュー' },
    { title: 'Claude Opus deep dive' },
  ];
  const out = filterEnglish(videos).map((v) => v.title);
  assert.deepEqual(out, ['Gemini 3 Pro review', 'Claude Opus deep dive']);
});

test('daysAgoISO computes a real ISO timestamp N days before `now`', () => {
  const now = Date.parse('2026-07-15T00:00:00.000Z');
  assert.equal(daysAgoISO(7, now), '2026-07-08T00:00:00.000Z');
});

test('buildTopVideos filters relevance + Shorts, attaches details, re-sorts by real view count, caps to maxResults', () => {
  const searchJson = {
    items: [
      { id: { videoId: 'a' }, snippet: { title: 'ChatGPT tips', description: '', channelTitle: 'C1', publishedAt: '2026-07-10T00:00:00Z' } },
      { id: { videoId: 'b' }, snippet: { title: 'ChatGPT tricks', description: '', channelTitle: 'C2', publishedAt: '2026-07-11T00:00:00Z' } },
      { id: { videoId: 'z' }, snippet: { title: 'Gemini Horoscope', description: 'zodiac forecast', channelTitle: 'C3', publishedAt: '2026-07-11T00:00:00Z' } },
      { id: { videoId: 's' }, snippet: { title: 'ChatGPT in 30 seconds', description: '', channelTitle: 'C4', publishedAt: '2026-07-11T00:00:00Z' } },
      { id: { videoId: 'hi' }, snippet: { title: 'चैटजीपीटी का पूरा रिव्यू हिंदी में', description: 'AI', channelTitle: 'C5', publishedAt: '2026-07-11T00:00:00Z' } },
    ],
  };
  const statsJson = { items: [
    { id: 'a', statistics: { viewCount: '1000' }, contentDetails: { duration: 'PT5M' } },
    { id: 'b', statistics: { viewCount: '5000' }, contentDetails: { duration: 'PT4M' } },
    { id: 's', statistics: { viewCount: '999999' }, contentDetails: { duration: 'PT30S' } }, // huge views but a Short — must be excluded
    { id: 'hi', statistics: { viewCount: '888888' }, contentDetails: { duration: 'PT6M' } }, // huge views but Hindi — must be excluded
  ] };
  const out = buildTopVideos(searchJson, statsJson, { maxResults: 5 });
  assert.equal(out.length, 2); // zodiac + Short + non-English all filtered out despite views
  assert.ok(!out.some((v) => v.videoId === 'hi'));
  assert.equal(out[0].videoId, 'b');
  assert.equal(out[0].viewCount, 5000);
  assert.equal(out[1].videoId, 'a');
});

test('buildTopVideos reports per-stage survivor counts via onStage, in pipeline order', () => {
  const searchJson = {
    items: [
      { id: { videoId: 'a' }, snippet: { title: 'ChatGPT tips', description: '', channelTitle: 'C1', publishedAt: '2026-07-10T00:00:00Z' } },
      { id: { videoId: 'z' }, snippet: { title: 'Gemini Horoscope', description: 'zodiac forecast', channelTitle: 'C3', publishedAt: '2026-07-11T00:00:00Z' } },
      { id: { videoId: 's' }, snippet: { title: 'ChatGPT in 30 seconds', description: '', channelTitle: 'C4', publishedAt: '2026-07-11T00:00:00Z' } },
    ],
  };
  const statsJson = { items: [
    { id: 'a', statistics: { viewCount: '1000' }, contentDetails: { duration: 'PT5M' } },
    { id: 's', statistics: { viewCount: '999999' }, contentDetails: { duration: 'PT30S' } },
  ] };
  const stages = [];
  buildTopVideos(searchJson, statsJson, { maxResults: 5, onStage: (label, count) => stages.push([label, count]) });
  assert.deepEqual(stages, [
    ['raw search results', 3],
    ['after AI-relevance filter', 2], // zodiac entry dropped
    ['after English filter', 2],
    ['after Shorts filter', 1], // the Short dropped
  ]);
});

test('buildTopVideos works with no onStage passed (default no-op, matches every other call site)', () => {
  const searchJson = { items: [{ id: { videoId: 'a' }, snippet: { title: 'ChatGPT tips', description: '', channelTitle: 'C1', publishedAt: '2026-07-10T00:00:00Z' } }] };
  const statsJson = { items: [{ id: 'a', statistics: { viewCount: '1000' }, contentDetails: { duration: 'PT5M' } }] };
  assert.doesNotThrow(() => buildTopVideos(searchJson, statsJson, { maxResults: 5 }));
});

test('buildTopVideos caps results to maxResults', () => {
  const searchJson = { items: Array.from({ length: 8 }, (_, i) => ({
    id: { videoId: `v${i}` }, snippet: { title: `ChatGPT video ${i}`, description: '', channelTitle: 'C', publishedAt: '2026-07-10T00:00:00Z' },
  })) };
  const statsJson = { items: Array.from({ length: 8 }, (_, i) => ({ id: `v${i}`, statistics: { viewCount: String(1000 - i) }, contentDetails: { duration: 'PT5M' } })) };
  const out = buildTopVideos(searchJson, statsJson, { maxResults: 5 });
  assert.equal(out.length, 5);
  assert.equal(out[0].videoId, 'v0'); // highest view count
});
