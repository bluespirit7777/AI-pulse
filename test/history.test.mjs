#!/usr/bin/env node
// Unit tests for event-history + range calculations. Run: node --test test/history.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCompactEvent, dayKey, mergeTodayEvents, neededDayKeys,
  computeRangeStats, buildRangesDoc, RANGE_HOURS,
} from '../scripts/lib/history.mjs';

const NODES = [
  { id: 'gpt', importance: 96 },
  { id: 'claude', importance: 92 },
  { id: 'nvidia', importance: 100 },
];

function ev(overrides) {
  return {
    id: 'id-1', clusterId: 'c1', title: 'Event', publishedAt: '2026-07-09T12:00:00Z',
    category: 'product', family: 'product', entityIds: ['gpt'], significance: 50,
    sourceCount: 1, verification: 'single', ...overrides,
  };
}

test('toCompactEvent strips a signal to only the retained fields', () => {
  const signal = {
    id: 'x', clusterId: 'c1', title: 'T', desc: 'a very long article body that should not be retained historically'.repeat(10),
    url: 'https://x', dateISO: '2026-07-09T00:00:00Z', category: 'product', family: 'product',
    significance: 70, sourceCount: 2, verification: 'corroborated', entityIds: ['gpt'],
  };
  const compact = toCompactEvent(signal);
  assert.deepEqual(Object.keys(compact).sort(), [
    'category', 'clusterId', 'entityIds', 'family', 'id', 'publishedAt',
    'significance', 'sourceCount', 'title', 'verification',
  ].sort());
  assert.equal(compact.publishedAt, signal.dateISO);
  assert.ok(!('desc' in compact), 'must not retain full article body historically');
  assert.ok(!('url' in compact), 'must not retain source URL historically (kept minimal)');
});

test('dayKey produces a stable UTC date string', () => {
  assert.equal(dayKey('2026-07-09T23:59:59Z'), '2026-07-09');
  assert.equal(dayKey(new Date('2026-07-09T00:00:00Z')), '2026-07-09');
});

test('mergeTodayEvents de-duplicates by clusterId, fresh replaces existing', () => {
  const existing = [ev({ clusterId: 'a', sourceCount: 1 }), ev({ clusterId: 'b', sourceCount: 1 })];
  const fresh = [ev({ clusterId: 'a', sourceCount: 3 }), ev({ clusterId: 'c', sourceCount: 1 })];
  const merged = mergeTodayEvents(existing, fresh);
  assert.equal(merged.length, 3); // a (updated), b (kept), c (new)
  const a = merged.find((e) => e.clusterId === 'a');
  assert.equal(a.sourceCount, 3, 'fresh data should win for a cluster seen again');
});

test('neededDayKeys covers the requested span inclusive of today', () => {
  const now = new Date('2026-07-10T12:00:00Z');
  const keys = neededDayKeys(now, 2);
  assert.deepEqual(keys, ['2026-07-10', '2026-07-09', '2026-07-08']);
});

test('computeRangeStats: current window only counts events inside the window', () => {
  const now = Date.parse('2026-07-10T00:00:00Z');
  const events = [
    ev({ publishedAt: '2026-07-09T12:00:00Z', entityIds: ['gpt'] }), // 12h ago — inside 24H
    ev({ publishedAt: '2026-07-05T00:00:00Z', entityIds: ['claude'] }), // 5d ago — outside 24H
  ];
  const stats = computeRangeStats(events, now, RANGE_HOURS['24H'], NODES, 200);
  assert.equal(stats.entityActivity.gpt, 1);
  assert.equal(stats.entityActivity.claude, 0);
  assert.equal(stats.eventCount, 1);
});

test('computeRangeStats: equivalent prior-period comparison, not a single fixed point', () => {
  const now = Date.parse('2026-07-17T00:00:00Z'); // exactly 7 days after base
  const events = [
    ev({ publishedAt: '2026-07-15T00:00:00Z', entityIds: ['gpt'] }), // 2 days ago — in current 7D window
    ev({ publishedAt: '2026-07-15T00:00:01Z', entityIds: ['gpt'] }),
    ev({ publishedAt: '2026-07-05T00:00:00Z', entityIds: ['gpt'] }), // 12 days ago — in PREVIOUS 7D window (7-14 days back)
  ];
  const stats = computeRangeStats(events, now, RANGE_HOURS['7D'], NODES, 400); // plenty of history depth
  assert.equal(stats.entityActivity.gpt, 2, 'current window should only count the two recent events');
  assert.equal(stats.entityDelta.gpt, 1, 'delta = current(2) - previous(1)');
});

test('computeRangeStats: never fabricates a delta when the previous window is incomplete', () => {
  const now = Date.parse('2026-07-10T00:00:00Z');
  const events = [ev({ publishedAt: '2026-07-09T12:00:00Z', entityIds: ['gpt'] })];
  // historyDepthHours much less than 2x the requested range (24H needs 48h of history)
  const stats = computeRangeStats(events, now, RANGE_HOURS['24H'], NODES, 20);
  assert.equal(stats.previousWindowComplete, false);
  assert.deepEqual(stats.entityDelta, {}, 'must be empty, not a fabricated number, when history is too shallow');
});

test('computeRangeStats: topEntities sorted descending, zero-activity entities excluded', () => {
  const now = Date.parse('2026-07-10T00:00:00Z');
  const events = [
    ev({ publishedAt: '2026-07-09T12:00:00Z', entityIds: ['gpt'] }),
    ev({ publishedAt: '2026-07-09T13:00:00Z', entityIds: ['gpt'] }),
    ev({ publishedAt: '2026-07-09T14:00:00Z', entityIds: ['claude'] }),
  ];
  const stats = computeRangeStats(events, now, RANGE_HOURS['24H'], NODES, 200);
  assert.equal(stats.topEntities[0].id, 'gpt');
  assert.equal(stats.topEntities[0].count, 2);
  assert.ok(!stats.topEntities.some((e) => e.id === 'nvidia'), 'zero-activity entities excluded from topEntities');
});

test('buildRangesDoc: historyDepthDays reflects collection start, not article publish age', () => {
  // A single day of collection can legitimately contain an event published
  // 45 days ago (the staleness filter allows up to 60 days) — this must NOT
  // be reported as 45 days of history. This is the exact bug found and fixed
  // while building Priority 1.
  const now = Date.parse('2026-07-10T12:00:00Z');
  const collectionStartMs = Date.parse('2026-07-10T00:00:00Z'); // collection started today
  const events = [ev({ publishedAt: '2026-05-26T00:00:00Z' })]; // article is 45 days old
  const doc = buildRangesDoc(events, now, NODES, collectionStartMs);
  assert.ok(doc.historyDepthDays < 1, `expected <1 day of history, got ${doc.historyDepthDays}`);
});

test('buildRangesDoc: dailyCategoryHistory never exceeds actual collection depth', () => {
  const now = Date.parse('2026-07-10T12:00:00Z');
  const collectionStartMs = Date.parse('2026-07-10T00:00:00Z');
  const events = [
    ev({ publishedAt: '2026-05-01T00:00:00Z', collectedOn: '2026-07-10' }), // old article, collected today
    ev({ publishedAt: '2026-07-10T00:00:00Z', collectedOn: '2026-07-10' }),
  ];
  const doc = buildRangesDoc(events, now, NODES, collectionStartMs);
  assert.equal(doc.dailyCategoryHistory.length, 1, 'both events collected today — only one day of history should appear');
  assert.equal(doc.dailyCategoryHistory[0].date, '2026-07-10');
});

test('buildRangesDoc produces all three ranges', () => {
  const now = Date.parse('2026-07-10T12:00:00Z');
  const doc = buildRangesDoc([ev({})], now, NODES, now - 200 * 3.6e6);
  assert.deepEqual(Object.keys(doc.ranges).sort(), ['24H', '30D', '7D'].sort());
});

test('computeRangeStats handles empty events without throwing', () => {
  const now = Date.parse('2026-07-10T00:00:00Z');
  const stats = computeRangeStats([], now, RANGE_HOURS['24H'], NODES, 0);
  assert.equal(stats.eventCount, 0);
  assert.equal(stats.previousWindowComplete, false);
  assert.deepEqual(stats.topEntities, []);
});
