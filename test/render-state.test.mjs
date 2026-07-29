// Guard tests for the two render-layer bugs that are testable without a DOM.
//
// This project has zero npm dependencies (no jsdom), so the ten dashboard
// render modules are otherwise untested — which is exactly why the bugs these
// cover survived. Both functions here were deliberately kept DOM-free so they
// CAN be tested: freshness.js touches no document at all, and river.js's
// filter reconciliation is pure state logic lifted out of the render closure.
//
// Run: node --test test/render-state.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshnessChip } from '../js/freshness.js';
import { reconcileFilter } from '../js/river.js';

// ---------------------------------------------------------- freshnessChip
// A malformed dateISO used to throw RangeError out of `new Date(x).toISOString()`.
// Because this chip is built inside the river's and waves' innerHTML string
// concatenation, that one bad row took down the ENTIRE section.

test('freshnessChip renders a chip for a valid date', () => {
  const now = Date.parse('2026-07-29T12:00:00Z');
  const html = freshnessChip('2026-07-29T11:30:00Z', now);
  assert.match(html, /fr-chip/);
  assert.match(html, /fr-fresh/);          // < 1h old
  assert.match(html, /30 min ago/);
});

test('freshnessChip does not throw on a malformed date, and says so honestly', () => {
  const now = Date.parse('2026-07-29T12:00:00Z');
  for (const bad of ['not-a-date', '', null, undefined, 'yesterday', {}]) {
    let html;
    assert.doesNotThrow(() => { html = freshnessChip(bad, now); }, `threw on ${JSON.stringify(bad)}`);
    assert.match(html, /fr-chip/, 'still emits a chip');
    assert.match(html, /date unknown/, 'labels the gap rather than inventing a time');
    assert.doesNotMatch(html, /NaN|Invalid/, 'never leaks NaN/Invalid Date to the reader');
  }
});

test('freshnessChip picks its age class from real age', () => {
  const now = Date.parse('2026-07-29T12:00:00Z');
  assert.match(freshnessChip('2026-07-29T11:59:00Z', now), /fr-fresh/);   // minutes
  assert.match(freshnessChip('2026-07-29T06:00:00Z', now), /fr-recent/);  // 6h
  assert.match(freshnessChip('2026-07-20T12:00:00Z', now), /fr-old/);     // 9d
});

// ------------------------------------------------------- reconcileFilter
// The river rebuilds its innerHTML on every data refresh. Filters now persist
// across that rebuild — but only while the selection still matches something,
// or the reader would be left staring at an empty list with no visible cause.

test('reconcileFilter keeps selections that still exist in the new data', () => {
  const next = reconcileFilter(
    { cat: 'product', entity: 'gpt', time: '7D' },
    ['product', 'research'],
    ['gpt', 'claude'],
  );
  assert.deepEqual(next, { cat: 'product', entity: 'gpt', time: '7D' });
});

test('reconcileFilter drops a category that vanished from the feed', () => {
  const next = reconcileFilter(
    { cat: 'policy', entity: 'all', time: 'all' },
    ['product', 'research'],
    ['gpt'],
  );
  assert.equal(next.cat, 'all', 'falls back to All rather than filtering to nothing');
});

test('reconcileFilter drops an entity that vanished from the feed', () => {
  const next = reconcileFilter(
    { cat: 'all', entity: 'mistral', time: 'all' },
    ['product'],
    ['gpt', 'claude'],
  );
  assert.equal(next.entity, 'all');
});

test('reconcileFilter keeps "all" untouched and rejects an unknown time window', () => {
  assert.deepEqual(
    reconcileFilter({ cat: 'all', entity: 'all', time: 'all' }, [], []),
    { cat: 'all', entity: 'all', time: 'all' },
  );
  assert.equal(
    reconcileFilter({ cat: 'all', entity: 'all', time: '90D' }, [], []).time,
    'all',
    'an unrecognised window would filter everything out',
  );
});

test('reconcileFilter never mutates the object it was given', () => {
  const prev = { cat: 'policy', entity: 'mistral', time: '24H' };
  const snapshot = { ...prev };
  reconcileFilter(prev, ['product'], ['gpt']);
  assert.deepEqual(prev, snapshot);
});
