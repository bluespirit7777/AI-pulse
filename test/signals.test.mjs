#!/usr/bin/env node
// Unit tests for the deterministic signal logic. Uses the built-in node:test
// runner (no dependencies). Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  similarity, dedupeMerge, categorize, waveFamily, detectLicense, inferField,
  matchEntities, recencyScore, scoreSignificance, confidenceTier,
  computeEntityActivity, buildWaves, isProductRelease, CATEGORIES,
} from '../scripts/lib/signals.mjs';

const NODES = [
  { id: 'chatgpt', name: 'ChatGPT', layer: 1, importance: 100, match: ['chatgpt'] },
  { id: 'nvidia', name: 'Nvidia', layer: 5, importance: 100, match: ['nvidia', '\\bh100\\b'] },
  { id: 'claude', name: 'Claude', layer: 2, importance: 92, match: ['claude', 'anthropic'] },
];

test('similarity: identical vs disjoint', () => {
  assert.equal(similarity('OpenAI launches GPT-5.6', 'OpenAI launches GPT-5.6'), 1);
  assert.ok(similarity('OpenAI launches GPT-5.6', 'TSMC posts record revenue') < 0.15);
});

test('dedupeMerge merges near-identical titles and counts sources', () => {
  const items = [
    { title: 'OpenAI launches new GPT-5.6 model today', link: 'a', date: new Date('2026-07-09'), sourceName: 'Verge', desc: '' },
    { title: 'OpenAI launches new GPT-5.6 model', link: 'b', date: new Date('2026-07-08'), sourceName: 'TechCrunch', desc: '' },
    { title: 'TSMC reports record quarterly revenue', link: 'c', date: new Date('2026-07-09'), sourceName: 'Ars', desc: '' },
  ];
  const merged = dedupeMerge(items, 0.5);
  assert.equal(merged.length, 2);
  const gpt = merged.find((m) => /gpt/i.test(m.title));
  assert.equal(gpt.sourceCount, 2);
  // earliest publication becomes canonical
  assert.equal(gpt.link, 'b');
});

test('categorize routes to expected buckets', () => {
  assert.equal(categorize('Anthropic raises $5B at a new valuation'), 'capital');
  assert.equal(categorize('New paper: researchers set SOTA benchmark'), 'research');
  assert.equal(categorize('EU AI Act enforcement begins with new regulation'), 'policy');
  assert.equal(categorize('Nvidia unveils new H200 GPU data center chip'), 'compute');
  assert.equal(categorize('Company launches new app feature'), 'product');
});

test('waveFamily maps categories to three families', () => {
  assert.equal(waveFamily('research'), 'research');
  assert.equal(waveFamily('capital'), 'market');
  assert.equal(waveFamily('policy'), 'market');
  assert.equal(waveFamily('product'), 'product');
  assert.equal(waveFamily('adoption'), 'product');
});

test('detectLicense distinguishes apache/mit/open/custom', () => {
  assert.equal(detectLicense('released under Apache 2.0').lic, 'apache');
  assert.equal(detectLicense('under the MIT License').lic, 'mit');
  assert.equal(detectLicense('open-weight model on Hugging Face').lic, 'open weights');
  assert.equal(detectLicense('proprietary hosted model').lic, 'see model card');
});

test('inferField picks a research domain', () => {
  assert.equal(inferField('new humanoid robot with dexterous hands'), 'Robotics');
  assert.equal(inferField('protein folding breakthrough in drug discovery'), 'Biology');
  assert.equal(inferField('a generic announcement'), 'Research');
});

test('matchEntities finds ids and max importance, respects word boundaries', () => {
  const r = matchEntities('Nvidia ships the H100 to ChatGPT-scale clusters', NODES);
  assert.ok(r.ids.includes('nvidia'));
  assert.ok(r.ids.includes('chatgpt'));
  assert.equal(r.maxImportance, 100);
  // "h100" boundary should not match inside "h1000"
  assert.equal(matchEntities('the h1000 widget', NODES).ids.includes('nvidia'), false);
});

test('recencyScore decays over 3 days and is deterministic', () => {
  const now = Date.parse('2026-07-09T00:00:00Z');
  assert.equal(recencyScore('2026-07-09T00:00:00Z', now), 1);
  assert.ok(Math.abs(recencyScore('2026-07-08T00:00:00Z', now) - (1 - 24 / 72)) < 1e-9);
  assert.equal(recencyScore('2026-07-01T00:00:00Z', now), 0); // older than 3 days => 0
});

test('scoreSignificance is deterministic and bounded 0-100', () => {
  const now = Date.parse('2026-07-09T00:00:00Z');
  const item = { title: 'Nvidia unveils H100 chip', desc: '', date: '2026-07-09T00:00:00Z', category: 'compute', sourceCount: 3 };
  const a = scoreSignificance(item, NODES, now);
  const b = scoreSignificance(item, NODES, now);
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 100);
});

test('confidenceTier by corroboration', () => {
  assert.equal(confidenceTier(3), 'strong');
  assert.equal(confidenceTier(2), 'moderate');
  assert.equal(confidenceTier(1), 'early');
});

test('computeEntityActivity counts mentions across signals', () => {
  const signals = [
    { title: 'ChatGPT gets an update', desc: '' },
    { title: 'Nvidia and ChatGPT', desc: 'H100' },
  ];
  const counts = computeEntityActivity(signals, NODES);
  assert.equal(counts.chatgpt, 2);
  assert.equal(counts.nvidia, 1);
  assert.equal(counts.claude, 0);
});

test('buildWaves returns one per family, highest significance', () => {
  const signals = [
    { title: 'p1', category: 'product', significance: 40, desc: '' },
    { title: 'p2', category: 'product', significance: 80, desc: '' },
    { title: 'm1', category: 'market', significance: 55, desc: '' },
    { title: 'r1', category: 'research', significance: 30, desc: '' },
  ];
  const waves = buildWaves(signals);
  const product = waves.find((w) => w.family === 'product');
  assert.equal(product.title, 'p2'); // higher significance wins, not newest
  assert.equal(waves.length, 3);
});

test('isProductRelease accepts real launches, rejects analysis/opinion pieces', () => {
  assert.equal(isProductRelease('OpenAI launches its new family of models with GPT-5.6', ''), true);
  assert.equal(isProductRelease('Google unveils Gemini 3.2 with native video', ''), true);
  assert.equal(isProductRelease('Anthropic releases a new Claude feature', ''), true);
  // the exact false positive this was written to fix
  assert.equal(isProductRelease("How did the government decide OpenAI's frontier model was safe to release?", ''), false);
  assert.equal(isProductRelease('Why Anthropic is releasing less than OpenAI', ''), false);
  assert.equal(isProductRelease('Is Google about to launch a rival to GPT-5.6?', ''), false);
});

test('all CATEGORIES are covered by waveFamily without throwing', () => {
  for (const c of CATEGORIES) assert.ok(['product', 'market', 'research'].includes(waveFamily(c)));
});
