#!/usr/bin/env node
// Unit tests for the Launch Radar helpers. No live network — every response is
// a mock fixture. Run: node --test test/launchradar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHfModelsUrl, buildGithubReleasesUrl,
  parseHfModels, parseGithubReleases,
  dedupeById, sortByRecency, markNew, mergeKnownIds, buildRadarSnapshot,
} from '../scripts/lib/launchradar.mjs';

test('buildHfModelsUrl requests newest-first models for an org, no auth params', () => {
  const url = buildHfModelsUrl({ org: 'Qwen', limit: 10 });
  assert.ok(url.startsWith('https://huggingface.co/api/models?'));
  assert.match(url, /author=Qwen/);
  assert.match(url, /sort=createdAt/);
  assert.match(url, /direction=-1/);
  assert.match(url, /limit=10/);
  assert.doesNotMatch(url, /key=|token=/i);
});

test('buildGithubReleasesUrl targets a repo\'s releases, newest first', () => {
  const url = buildGithubReleasesUrl({ repo: 'openai/openai-python', perPage: 5 });
  assert.equal(url, 'https://api.github.com/repos/openai/openai-python/releases?per_page=5');
});

test('parseHfModels normalizes, builds a stable id + url, drops items with no id or timestamp', () => {
  const json = [
    { id: 'Qwen/Qwen3.6-30B', createdAt: '2026-07-20T10:00:00.000Z' },
    { modelId: 'Qwen/Qwen-Image-2', createdAt: '2026-07-19T10:00:00.000Z' }, // modelId alias
    { id: 'Qwen/no-timestamp' }, // dropped: no createdAt
    { createdAt: '2026-07-18T10:00:00.000Z' }, // dropped: no id
  ];
  const out = parseHfModels(json, { org: 'Qwen', label: 'Qwen' });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'hf:Qwen/Qwen3.6-30B');
  assert.equal(out[0].source, 'huggingface');
  assert.equal(out[0].label, 'Qwen');
  assert.equal(out[0].title, 'Qwen3.6-30B'); // org stripped
  assert.equal(out[0].kind, 'model');
  assert.equal(out[0].url, 'https://huggingface.co/Qwen/Qwen3.6-30B');
  assert.equal(out[0].at, '2026-07-20T10:00:00.000Z');
  assert.equal(out[1].id, 'hf:Qwen/Qwen-Image-2');
});

test('parseGithubReleases builds id from repo@tag, drops drafts, flags prereleases', () => {
  const json = [
    { tag_name: 'v2.47.0', published_at: '2026-07-22T00:00:00Z', html_url: 'https://github.com/openai/openai-python/releases/tag/v2.47.0' },
    { tag_name: 'v2.48.0-beta', published_at: '2026-07-23T00:00:00Z', prerelease: true },
    { tag_name: 'v-draft', draft: true, published_at: '2026-07-24T00:00:00Z' }, // dropped
    { name: 'no dates' }, // dropped: no timestamp
  ];
  const out = parseGithubReleases(json, { repo: 'openai/openai-python', label: 'OpenAI', org: 'OpenAI' });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'gh:openai/openai-python@v2.47.0');
  assert.equal(out[0].title, 'openai-python v2.47.0');
  assert.equal(out[0].kind, 'sdk-release');
  assert.equal(out[0].label, 'OpenAI');
  assert.equal(out[1].kind, 'sdk-prerelease');
});

test('dedupeById keeps first occurrence only', () => {
  const out = dedupeById([{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'c' }]);
  assert.deepEqual(out.map((e) => e.id), ['a', 'b', 'c']);
});

test('sortByRecency orders newest-first by the source timestamp', () => {
  const out = sortByRecency([
    { id: 'a', at: '2026-07-10T00:00:00Z' },
    { id: 'b', at: '2026-07-22T00:00:00Z' },
    { id: 'c', at: '2026-07-15T00:00:00Z' },
  ]);
  assert.deepEqual(out.map((e) => e.id), ['b', 'c', 'a']);
});

test('markNew: cold start marks nothing new; otherwise only unseen ids are new', () => {
  const entries = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const coldStart = markNew(entries, new Set(), { firstRun: true });
  assert.deepEqual(coldStart.map((e) => e.isNew), [false, false, false]);
  const diffed = markNew(entries, new Set(['a', 'c']), { firstRun: false });
  assert.deepEqual(diffed.map((e) => e.isNew), [false, true, false]); // only 'b' is new
});

test('mergeKnownIds unions current-first, de-dupes, and caps length', () => {
  const merged = mergeKnownIds(['old1', 'old2'], ['new1', 'old1'], 3);
  assert.deepEqual(merged, ['new1', 'old1', 'old2']); // current first, dupes removed, capped to 3
});

test('buildRadarSnapshot cold start: everything is baseline, zero newly detected', () => {
  const allEntries = [
    { id: 'hf:Qwen/A', label: 'Qwen', title: 'A', url: 'u', at: '2026-07-22T00:00:00Z', source: 'huggingface' },
    { id: 'gh:openai/openai-python@v1', label: 'OpenAI', title: 'openai-python v1', url: 'u', at: '2026-07-21T00:00:00Z', source: 'github' },
  ];
  const snap = buildRadarSnapshot({ prevSnapshot: null, allEntries, sources: [], now: Date.parse('2026-07-23T00:00:00Z') });
  assert.equal(snap.firstRun, true);
  assert.equal(snap.newCount, 0);
  assert.equal(snap.entries.length, 2);
  assert.equal(snap.entries.every((e) => e.isNew === false), true);
  assert.equal(snap.knownIds.length, 2);
});

test('buildRadarSnapshot second run: a genuinely new id is detected exactly once', () => {
  const first = buildRadarSnapshot({
    prevSnapshot: null,
    allEntries: [{ id: 'hf:Qwen/A', label: 'Qwen', title: 'A', url: 'u', at: '2026-07-20T00:00:00Z', source: 'huggingface' }],
    sources: [], now: Date.parse('2026-07-20T00:00:00Z'),
  });
  // second run: A still present + a brand-new B
  const second = buildRadarSnapshot({
    prevSnapshot: first,
    allEntries: [
      { id: 'hf:Qwen/B', label: 'Qwen', title: 'B', url: 'u', at: '2026-07-23T00:00:00Z', source: 'huggingface' },
      { id: 'hf:Qwen/A', label: 'Qwen', title: 'A', url: 'u', at: '2026-07-20T00:00:00Z', source: 'huggingface' },
    ],
    sources: [], now: Date.parse('2026-07-23T00:00:00Z'),
  });
  assert.equal(second.newCount, 1);
  assert.equal(second.newlyDetected[0].id, 'hf:Qwen/B');
  assert.equal(second.entries.find((e) => e.id === 'hf:Qwen/B').isNew, true);
  assert.equal(second.entries.find((e) => e.id === 'hf:Qwen/A').isNew, false);

  // third run with the SAME data must NOT re-flag B (it's now known)
  const third = buildRadarSnapshot({
    prevSnapshot: second,
    allEntries: [
      { id: 'hf:Qwen/B', label: 'Qwen', title: 'B', url: 'u', at: '2026-07-23T00:00:00Z', source: 'huggingface' },
      { id: 'hf:Qwen/A', label: 'Qwen', title: 'A', url: 'u', at: '2026-07-20T00:00:00Z', source: 'huggingface' },
    ],
    sources: [], now: Date.parse('2026-07-24T00:00:00Z'),
  });
  assert.equal(third.newCount, 0);
});

test('buildRadarSnapshot preserves firstSeenAt across runs (detection time is stable)', () => {
  const first = buildRadarSnapshot({
    prevSnapshot: null,
    allEntries: [{ id: 'x', label: 'L', title: 'T', url: 'u', at: '2026-07-20T00:00:00Z', source: 'github' }],
    sources: [], now: Date.parse('2026-07-20T12:00:00Z'),
  });
  const firstSeen = first.entries[0].firstSeenAt;
  assert.equal(firstSeen, '2026-07-20T12:00:00.000Z');
  const second = buildRadarSnapshot({
    prevSnapshot: first,
    allEntries: [{ id: 'x', label: 'L', title: 'T', url: 'u', at: '2026-07-20T00:00:00Z', source: 'github' }],
    sources: [], now: Date.parse('2026-07-25T00:00:00Z'),
  });
  assert.equal(second.entries[0].firstSeenAt, firstSeen); // unchanged despite a later run
});

test('buildRadarSnapshot caps the displayed list to displayLimit', () => {
  const allEntries = Array.from({ length: 50 }, (_, i) => ({
    id: `id${i}`, label: 'L', title: `T${i}`, url: 'u',
    at: new Date(Date.parse('2026-07-01T00:00:00Z') + i * 3600e3).toISOString(), source: 'huggingface',
  }));
  const snap = buildRadarSnapshot({ prevSnapshot: null, allEntries, sources: [], displayLimit: 30, now: Date.now() });
  assert.equal(snap.entries.length, 30);
});
