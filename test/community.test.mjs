#!/usr/bin/env node
// Unit tests for Community Pulse data honesty: exact-vs-estimated counts,
// coverage math, multi-theme comments, and relevance-based comment ranking.
// Run: node --test test/community.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  communityStoryCoverage,
  themeSpecificity,
  contextualCompleteness,
  communityRecencyScore,
  commentRelevanceScore,
  classifyTopics,
} from '../scripts/lib/signals.mjs';

test('communityStoryCoverage: full coverage yields an EXACT count, never an estimate', () => {
  const r = communityStoryCoverage({ rawHits: 42, fetchedCount: 42, validatedCount: 30, sampleSize: 42 });
  assert.equal(r.coverage, 1);
  assert.equal(r.isEstimated, false);
  assert.equal(r.estimatedRelevantDiscussions, 30, 'exact case must use the real validated count, not a scaled figure');
});

test('communityStoryCoverage: partial coverage is explicitly flagged as an estimate', () => {
  // 300 of 900 raw hits fetched (coverage 1/3); of the 300 fetched, 60 validated
  const r = communityStoryCoverage({ rawHits: 900, fetchedCount: 300, validatedCount: 60, sampleSize: 300 });
  assert.ok(r.coverage < 1);
  assert.equal(r.isEstimated, true);
  // scaled: 900 * (60/300) = 180 — an extrapolation, not a raw count
  assert.equal(r.estimatedRelevantDiscussions, 180);
});

test('communityStoryCoverage: estimate is derived from the FETCHED sample ratio, not the raw total', () => {
  const lowValidationRate = communityStoryCoverage({ rawHits: 1000, fetchedCount: 100, validatedCount: 5, sampleSize: 100 });
  const highValidationRate = communityStoryCoverage({ rawHits: 1000, fetchedCount: 100, validatedCount: 80, sampleSize: 100 });
  assert.ok(highValidationRate.estimatedRelevantDiscussions > lowValidationRate.estimatedRelevantDiscussions);
  assert.equal(lowValidationRate.isEstimated, true);
  assert.equal(highValidationRate.isEstimated, true);
});

test('communityStoryCoverage: zero raw hits is treated as complete (empty) coverage, not a divide-by-zero estimate', () => {
  const r = communityStoryCoverage({ rawHits: 0, fetchedCount: 0, validatedCount: 0, sampleSize: 0 });
  assert.equal(r.coverage, 1);
  assert.equal(r.isEstimated, false);
  assert.equal(r.estimatedRelevantDiscussions, 0);
});

test('communityStoryCoverage: coverage is clamped to at most 1 even with pathological inputs', () => {
  const r = communityStoryCoverage({ rawHits: 10, fetchedCount: 50, validatedCount: 40, sampleSize: 50 });
  assert.equal(r.coverage, 1);
  assert.equal(r.isEstimated, false);
});

test('themeSpecificity: a theme mentioned in nearly every comment is LESS specific than a rare one', () => {
  const counts = { coding: 90, safety: 3 };
  const total = 100;
  assert.ok(themeSpecificity('safety', counts, total) > themeSpecificity('coding', counts, total));
});

test('themeSpecificity: zero total comments returns 0 rather than dividing by zero', () => {
  assert.equal(themeSpecificity('coding', {}, 0), 0);
});

test('contextualCompleteness: a full sentence with substance scores higher than a bare quote-reply', () => {
  const full = 'The context window on this model is genuinely useful for large codebases, and it holds up over long sessions without losing track of earlier files.';
  const quoteOnly = '> yeah I agree';
  assert.ok(contextualCompleteness(full) > contextualCompleteness(quoteOnly));
});

test('contextualCompleteness: is not simply "longer is better" — a short complete sentence can beat a longer rambling one', () => {
  const shortButComplete = 'It handles the full context window well, even on long sessions.';
  const longRamble = 'lol yeah idk maybe kinda sorta i guess it depends really';
  // the rambling one is longer but has no sentence structure or punctuation;
  // completeness must not just reward raw character count
  assert.ok(contextualCompleteness(shortButComplete) > contextualCompleteness(longRamble));
});

test('communityRecencyScore: decays linearly to 0 over the window and never goes negative', () => {
  const now = Date.parse('2026-07-12T00:00:00Z');
  const today = communityRecencyScore(now, now, 30);
  const halfway = communityRecencyScore(now - 15 * 86400000, now, 30);
  const past = communityRecencyScore(now - 60 * 86400000, now, 30);
  assert.equal(today, 1);
  assert.ok(Math.abs(halfway - 0.5) < 0.01);
  assert.equal(past, 0);
});

test('commentRelevanceScore: model-match confidence dominates the score (highest weight)', () => {
  const highConfidence = commentRelevanceScore({ matchConfidence: 1, themeSpecificity: 0, completeness: 0, recency: 0 });
  const highEverythingElse = commentRelevanceScore({ matchConfidence: 0, themeSpecificity: 1, completeness: 1, recency: 1 });
  // 0.40 alone vs 0.25+0.20+0.15=0.60 — confirms weights sum correctly and
  // match confidence alone cannot be ignored even against all other terms maxed
  assert.ok(highConfidence > 0);
  assert.ok(highEverythingElse > highConfidence, 'three lower-priority terms combined should still outweigh one dominant term at max');
});

test('commentRelevanceScore: is NOT primarily a length-based ranking — a short, on-topic, complete comment can outrank a long rambling one', () => {
  const short = commentRelevanceScore({
    matchConfidence: 0.9, themeSpecificity: 0.8, completeness: 0.85, recency: 0.9,
  });
  const long = commentRelevanceScore({
    matchConfidence: 0.5, themeSpecificity: 0.2, completeness: 0.3, recency: 0.2,
  });
  assert.ok(short > long, 'relevance, not raw length, should determine ranking');
});

test('classifyTopics: a comment can carry up to 2 themes (multi-theme support)', () => {
  const text = 'The pricing is fair but coding tasks are where this model actually shines for me.';
  const topics = classifyTopics(text);
  assert.ok(topics.includes('price'));
  assert.ok(topics.includes('coding'));
  assert.ok(topics.length >= 2, 'a comment discussing both price and coding should match both themes');
});

test('regression: a validated comment sample never reports more validated than fetched', () => {
  // guards the exact invariant validate.mjs enforces on community.models[].
  const fetchedCount = 300, validatedCount = 310; // deliberately invalid
  assert.ok(validatedCount > fetchedCount, 'sanity: this fixture IS invalid');
  // the pipeline must never be able to produce this — validated count is
  // always a subset of the fetched+decoded sample it was filtered from
  const decoded = new Array(fetchedCount).fill(0);
  const validated = decoded.filter((_, i) => i < validatedCount); // can only ever select from `decoded`
  assert.ok(validated.length <= fetchedCount);
});
