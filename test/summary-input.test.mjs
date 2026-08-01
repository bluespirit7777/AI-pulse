#!/usr/bin/env node
// Guard tests for the AI Summary Wave's input grouping.
//
// groupByFamily decides which signals each hand-written summary is supposed to
// cover. If it drifts, the summaries describe a different universe of events
// than the stream beneath them — the one failure mode that would make the
// section actively misleading rather than merely absent.
//
// Run: node --test test/summary-input.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByFamily, SUMMARY_FAMILIES, WINDOW_HOURS } from '../scripts/lib/summary-input.mjs';

const NOW = Date.parse('2026-08-01T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3.6e6).toISOString();

const sig = (over = {}) => ({
  id: 'https://example.com/' + Math.random().toString(36).slice(2),
  title: 'A signal', category: 'product', significance: 50,
  dateISO: hoursAgo(1), ...over,
});

test('buckets categories into the same three families the rest of the site uses', () => {
  const groups = groupByFamily([
    sig({ category: 'research' }),
    sig({ category: 'market' }), sig({ category: 'capital' }),
    sig({ category: 'compute' }), sig({ category: 'policy' }), sig({ category: 'orggov' }),
    sig({ category: 'product' }), sig({ category: 'opensource' }), sig({ category: 'adoption' }),
  ], NOW);

  assert.equal(groups.research.length, 1, 'research is its own family');
  assert.equal(groups.market.length, 5, 'market absorbs market/capital/compute/policy/orggov');
  assert.equal(groups.product.length, 3, 'everything else eligible is product');
});

test('excludes commentary rather than summarising the discourse', () => {
  // analysis/general are opinion ABOUT events. buildWaves() drops them, so the
  // summary must too, or it would describe the conversation instead of the news.
  const groups = groupByFamily([
    sig({ category: 'analysis' }),
    sig({ category: 'general' }),
    sig({ category: 'product' }),
  ], NOW);

  assert.equal(groups.product.length, 1, 'only the real product signal survives');
  assert.equal(
    SUMMARY_FAMILIES.reduce((n, f) => n + groups[f].length, 0), 1,
    'analysis and general must not land in ANY family',
  );
});

test('re-derives family from category instead of trusting the signal\'s own family field', () => {
  // Each signal carries a `family` assigned WITHOUT the commentary exclusion,
  // so a `general` signal arrives already labelled family:"product". Reading
  // that field would quietly readmit exactly what the previous test excludes.
  const groups = groupByFamily([sig({ category: 'general', family: 'product' })], NOW);
  assert.equal(groups.product.length, 0, 'a mislabelled commentary signal must still be excluded');
});

test('keeps only the last 24 hours', () => {
  const groups = groupByFamily([
    sig({ category: 'product', dateISO: hoursAgo(1) }),
    sig({ category: 'product', dateISO: hoursAgo(23.9) }),
    sig({ category: 'product', dateISO: hoursAgo(25) }),
    sig({ category: 'product', dateISO: hoursAgo(72) }),
  ], NOW);
  assert.equal(groups.product.length, 2, 'only signals inside the window');
  assert.equal(WINDOW_HOURS, 24, 'the documented window the procedure doc quotes');
});

test('drops undated and future-dated signals rather than guessing', () => {
  const groups = groupByFamily([
    sig({ category: 'product', dateISO: undefined }),
    sig({ category: 'product', dateISO: 'not-a-date' }),
    sig({ category: 'product', dateISO: new Date(NOW + 6 * 3.6e6).toISOString() }),
    sig({ category: 'product', dateISO: hoursAgo(2) }),
  ], NOW);
  assert.equal(groups.product.length, 1, 'a bad or impossible timestamp is not silently included');
});

test('orders each family by significance so the writer leads with what mattered', () => {
  const groups = groupByFamily([
    sig({ category: 'product', title: 'low', significance: 20 }),
    sig({ category: 'product', title: 'high', significance: 90 }),
    sig({ category: 'product', title: 'mid', significance: 55 }),
  ], NOW);
  assert.deepEqual(groups.product.map((s) => s.title), ['high', 'mid', 'low']);
});

test('always returns all three families, even when one is empty', () => {
  // The procedure has to be able to say "nothing in Research today" honestly
  // rather than crash or silently omit the key.
  const groups = groupByFamily([sig({ category: 'product' })], NOW);
  for (const fam of SUMMARY_FAMILIES) {
    assert.ok(Array.isArray(groups[fam]), `${fam} must always be an array`);
  }
  assert.equal(groups.research.length, 0);
});

test('survives an empty or junk feed without throwing', () => {
  assert.deepEqual(groupByFamily([], NOW), { product: [], market: [], research: [] });
  assert.deepEqual(groupByFamily(undefined, NOW), { product: [], market: [], research: [] });
  assert.equal(groupByFamily([null, undefined], NOW).product.length, 0);
});
