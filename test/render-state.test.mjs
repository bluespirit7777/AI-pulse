// Guard test for the render-layer bug that is testable without a DOM.
//
// This project has zero npm dependencies (no jsdom), so the dashboard render
// modules are otherwise untested — which is exactly why the bug this covers
// survived. freshnessChip touches no document at all, so it CAN be tested.
//
// This file also used to cover river.js's reconcileFilter. That function was
// removed along with the river's entire filter UI, so its tests went with it
// rather than being left behind to imply a filtering model that no longer
// exists.
//
// Run: node --test test/render-state.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshnessChip } from '../js/freshness.js';

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
