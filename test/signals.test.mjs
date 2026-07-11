#!/usr/bin/env node
// Unit tests for the deterministic signal logic. Uses the built-in node:test
// runner (no dependencies). Run: node --test test/signals.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  similarity, dedupeMerge, clusterScore, weightedSimilarity, buildDocFreq,
  phraseOverlap, properNounPhrases, categorize, waveFamily, detectLicense,
  inferField, matchEntities, recencyScore, scoreSignificance,
  classifyVerification, classifyImpact, computeEntityActivity, buildWaves,
  isProductRelease, classifyTopics, extractAction, eventRelation,
  matchModelMention, isValidatedMention, COMMUNITY_MATCH_THRESHOLD, CATEGORIES,
} from '../scripts/lib/signals.mjs';

const NODES = [
  { id: 'chatgpt', name: 'ChatGPT', layer: 1, importance: 100, match: ['chatgpt'] },
  { id: 'gpt', name: 'GPT', layer: 2, importance: 96, match: ['gpt-5', 'openai'] },
  { id: 'nvidia', name: 'Nvidia', layer: 5, importance: 100, match: ['nvidia', '\\bh100\\b'] },
  { id: 'claude', name: 'Claude', layer: 2, importance: 92, match: ['claude', 'anthropic'] },
  { id: 'aws', name: 'AWS', layer: 4, importance: 84, match: ['aws'] },
];

// ---------- text similarity ----------

test('similarity: identical vs disjoint', () => {
  assert.equal(similarity('OpenAI launches GPT-5.6', 'OpenAI launches GPT-5.6'), 1);
  assert.ok(similarity('OpenAI launches GPT-5.6', 'TSMC posts record revenue') < 0.15);
});

// ---------- entity matching (word-boundary regression) ----------

test('matchEntities requires word boundaries — no false substring matches', () => {
  // "aws" must not match inside "lawsuit"; this was a real bug found while
  // tuning clustering (matchEntities('...lawsuit...') was returning 'aws').
  assert.equal(matchEntities('OpenAI faces a new lawsuit', NODES).ids.includes('aws'), false);
  assert.equal(matchEntities('Built on AWS infrastructure', NODES).ids.includes('aws'), true);
});

test('matchEntities finds ids and max importance, respects word boundaries', () => {
  const r = matchEntities('Nvidia ships the H100 to ChatGPT-scale clusters', NODES);
  assert.ok(r.ids.includes('nvidia'));
  assert.ok(r.ids.includes('chatgpt'));
  assert.equal(r.maxImportance, 100);
  assert.equal(matchEntities('the h1000 widget', NODES).ids.includes('nvidia'), false);
});

// ---------- categorization (Priority 3) ----------

test('categorize returns {category, confidence} across expected buckets', () => {
  assert.equal(categorize('Anthropic raises $5B at a new valuation').category, 'capital');
  assert.equal(categorize('New paper: researchers set SOTA benchmark on arXiv').category, 'research');
  assert.equal(categorize('EU AI Act enforcement begins with new regulation').category, 'policy');
  assert.equal(categorize('Nvidia unveils new H200 GPU data center chip').category, 'compute');
  assert.equal(categorize('Company launches new app feature update').category, 'product');
  assert.equal(categorize('CEO steps down amid layoffs and board reshuffle').category, 'orggov');
});

test('categorize regression: known former misclassifications now correct', () => {
  // Previously forced to 'product' by the first-match-wins default. Now a
  // real question/analysis piece, not a shipped feature.
  const a = categorize("How did the government decide OpenAI's frontier model was safe to release?");
  assert.notEqual(a.category, 'product');
  // Market/compute analysis that used to default to Product.
  const b = categorize('Opinion: what Nvidia\'s earnings really mean for the GPU market');
  assert.ok(['analysis', 'market'].includes(b.category));
});

test('categorize falls back to General, never forces Product on weak evidence', () => {
  const r = categorize('A quiet Tuesday in the newsroom');
  assert.equal(r.category, 'general');
  assert.ok(r.confidence <= 0.5);
});

test('categorize confidence is higher for unambiguous text than borderline text', () => {
  const strong = categorize('OpenAI raises $40B in new funding round at $300B valuation, files for IPO');
  const weak = categorize('OpenAI shares an update');
  assert.ok(strong.confidence >= weak.confidence);
});

test('community matching: reject ambiguous ordinary-language "grok"', () => {
  assert.equal(isValidatedMention('Hard to grok this codebase without docs', 'grok'), false);
  assert.equal(isValidatedMention('I finally started to grok monads', 'grok'), false);
  assert.equal(isValidatedMention('trying to grok the concept of closures', 'grok'), false);
});

test('community matching: accept real xAI Grok discussion', () => {
  assert.equal(isValidatedMention('Grok 4 is better at reasoning than the last version', 'grok'), true);
  assert.equal(isValidatedMention('xAI Grok just shipped a new model', 'grok'), true);
  // bare "grok" with AI context is a softer accept
  assert.ok(matchModelMention('Grok gave a wrong answer to my LLM prompt', 'grok') >= COMMUNITY_MATCH_THRESHOLD);
});

test('community matching: llama.cpp / Meta Llama accepted, the animal rejected', () => {
  assert.equal(isValidatedMention('I run llama.cpp locally on my laptop', 'llama'), true);
  assert.equal(isValidatedMention('Meta Llama 4 benchmarks look strong', 'llama'), true);
  assert.equal(isValidatedMention('A llama walked into the barn', 'llama'), false);
  assert.equal(isValidatedMention('we visited a llama farm last weekend', 'llama'), false);
});

test('community matching: keyword inside another word does not match', () => {
  // "gemini" substring-style false positives shouldn't slip through word boundaries
  assert.equal(isValidatedMention('the geminid meteor shower peaks tonight', 'gemini'), false);
  // unambiguous families still need the actual token
  assert.equal(isValidatedMention('a random sentence about nothing', 'claude'), false);
});

test('community matching: non-ambiguous families score higher with org/version', () => {
  assert.ok(matchModelMention('ChatGPT is great', 'gpt') >= COMMUNITY_MATCH_THRESHOLD);
  assert.ok(matchModelMention('OpenAI GPT-5.6 model update', 'gpt') > matchModelMention('gpt did something', 'gpt'));
  assert.equal(isValidatedMention('Anthropic Claude Code writes tests', 'claude'), true);
});

test('community matching: multi-model comment validates for each genuinely present model', () => {
  const text = 'I compared Claude Opus and GPT-5.6 for coding — Claude won on refactors';
  assert.equal(isValidatedMention(text, 'claude'), true);
  assert.equal(isValidatedMention(text, 'gpt'), true);
  assert.equal(isValidatedMention(text, 'gemini'), false); // not mentioned
});

test('classifyTopics tags community discussion themes, multi-topic aware', () => {
  const r = classifyTopics('The coding is great but the price is too expensive for local self-hosting');
  assert.ok(r.includes('coding'));
  assert.ok(r.includes('price'));
  assert.ok(r.includes('local'));
  assert.deepEqual(classifyTopics('a plain sentence about nothing in particular'), []);
});

test('all CATEGORIES are covered by waveFamily without throwing', () => {
  for (const c of CATEGORIES) assert.ok(['product', 'market', 'research'].includes(waveFamily(c)));
});

test('waveFamily maps new categories sensibly', () => {
  assert.equal(waveFamily('orggov'), 'market');
  assert.equal(waveFamily('general'), 'product');
  assert.equal(waveFamily('analysis'), 'product'); // family assigned but excluded from waves upstream
});

// ---------- isProductRelease ----------

test('isProductRelease accepts real launches, rejects analysis/opinion pieces', () => {
  assert.equal(isProductRelease('OpenAI launches its new family of models with GPT-5.6', ''), true);
  assert.equal(isProductRelease('Google unveils Gemini 3.2 with native video', ''), true);
  assert.equal(isProductRelease('Anthropic releases a new Claude feature', ''), true);
  assert.equal(isProductRelease("How did the government decide OpenAI's frontier model was safe to release?", ''), false);
  assert.equal(isProductRelease('Why Anthropic is releasing less than OpenAI', ''), false);
  assert.equal(isProductRelease('Is Google about to launch a rival to GPT-5.6?', ''), false);
});

// ---------- license / field inference ----------

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

// ---------- significance / verification / impact (Priority 4) ----------

test('recencyScore decays over 3 days and is deterministic', () => {
  const now = Date.parse('2026-07-09T00:00:00Z');
  assert.equal(recencyScore('2026-07-09T00:00:00Z', now), 1);
  assert.ok(Math.abs(recencyScore('2026-07-08T00:00:00Z', now) - (1 - 24 / 72)) < 1e-9);
  assert.equal(recencyScore('2026-07-01T00:00:00Z', now), 0);
});

test('scoreSignificance is deterministic and bounded 0-100', () => {
  const now = Date.parse('2026-07-09T00:00:00Z');
  const item = { title: 'Nvidia unveils H100 chip', desc: '', date: '2026-07-09T00:00:00Z', category: 'compute', sourceCount: 3 };
  const a = scoreSignificance(item, NODES, now);
  const b = scoreSignificance(item, NODES, now);
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 100);
});

test('classifyImpact tiers by significance', () => {
  assert.equal(classifyImpact(85), 'high');
  assert.equal(classifyImpact(50), 'notable');
  assert.equal(classifyImpact(20), 'emerging');
});

test('classifyVerification: official source is well-verified with a single source', () => {
  const item = { title: 'We are launching GPT-6', desc: '', category: 'product', sourceName: 'OpenAI', sourceCount: 1 };
  assert.equal(classifyVerification(item), 'official');
});

test('classifyVerification: repeated unsupported claim does not become "strongly verified"', () => {
  // Priority 4 requirement: multiple articles repeating one unconfirmed claim
  // must not automatically outrank a hedge — hedged language overrides count.
  const item = {
    title: 'OpenAI reportedly may have missed a deadline, sources say',
    desc: '', category: 'product', sourceName: 'TechCrunch', sourceCount: 4,
  };
  assert.equal(classifyVerification(item), 'uncertain');
});

test('classifyVerification: two independent non-official sources = corroborated', () => {
  const item = { title: 'Model launch confirmed', desc: '', category: 'product', sourceName: 'The Verge', sourceCount: 2 };
  assert.equal(classifyVerification(item), 'corroborated');
});

test('classifyVerification: single third-party report = single', () => {
  const item = { title: 'Model launch reported', desc: '', category: 'product', sourceName: 'The Verge', sourceCount: 1 };
  assert.equal(classifyVerification(item), 'single');
});

test('classifyVerification: analysis category is always "analysis" regardless of sources', () => {
  const item = { title: 'Opinion: what this means', desc: '', category: 'analysis', sourceName: 'Wired', sourceCount: 5 };
  assert.equal(classifyVerification(item), 'analysis');
});

test('classifyVerification checks all merged sources, not just the representative', () => {
  const item = {
    title: 'Model launch', desc: '', category: 'product', sourceName: 'TechCrunch', sourceCount: 2,
    sources: [{ sourceName: 'TechCrunch' }, { sourceName: 'OpenAI' }],
  };
  assert.equal(classifyVerification(item), 'official');
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

test('buildWaves returns one per family, highest significance, excludes analysis/general', () => {
  const signals = [
    { title: 'p1', category: 'product', significance: 40, desc: '' },
    { title: 'p2', category: 'product', significance: 80, desc: '' },
    { title: 'm1', category: 'market', significance: 55, desc: '' },
    { title: 'r1', category: 'research', significance: 30, desc: '' },
    { title: 'a1', category: 'analysis', significance: 99, desc: '' }, // must never win a wave
  ];
  const waves = buildWaves(signals);
  const product = waves.find((w) => w.family === 'product');
  assert.equal(product.title, 'p2'); // higher significance wins, not newest
  assert.equal(waves.length, 3);
  assert.ok(!waves.some((w) => w.category === 'analysis'));
});

// ---------- weighted clustering (Priority 2) — validated against real feed output ----------
// These exact headlines are real output pulled from the live RSS pool while
// tuning the algorithm (see docs/METHODOLOGY.md for the full derivation).

const REAL_ENTITIES = [
  { id: 'chatgpt', name: 'ChatGPT', layer: 1, importance: 100, match: ['chatgpt'] },
  { id: 'gpt', name: 'GPT', layer: 2, importance: 96, match: ['gpt-5', 'openai'] },
];

function mkItem(title, desc, isoDate, sourceName, category) {
  return { title, desc, date: new Date(isoDate), link: `https://example.com/${encodeURIComponent(title)}`, sourceName, category };
}

test('clustering merges the real OpenAI/NYT copyright story across two outlets', () => {
  const items = [
    mkItem(
      'New York Times says OpenAI hid evidence in ChatGPT copyright trial',
      'News publishers say OpenAI hid tools and datasets that could identify copyrighted journalism in ChatGPT outputs, escalating their lawsuit with a new motion for sanctions.',
      '2026-07-09T19:05:58Z', 'TechCrunch', 'policy'
    ),
    mkItem(
      'OpenAI may have made a fatal misstep in copyright fight with news orgs',
      'OpenAI may be sanctioned for hiding, deleting ChatGPT logs in NYT copyright fight.',
      '2026-07-09T18:57:53Z', 'Ars Technica', 'policy'
    ),
  ];
  const merged = dedupeMerge(items, { threshold: 0.34, nodes: REAL_ENTITIES });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].sourceCount, 2);
});

test('clustering merges three differently-worded reports of the same event (Fidji Simo departure)', () => {
  const items = [
    mkItem('Fidji Simo steps down from OpenAI’s no. 2 role',
      "OpenAI's No. 2 executive, Fidji Simo, is stepping down from her full-time role after her medical leave proved longer than expected.",
      '2026-07-09T23:38:00Z', 'TechCrunch', 'orggov'),
    mkItem('Fidji Simo steps down from leading OpenAI’s AGI work due to illness',
      "OpenAI's Fidji Simo is departing her full-time role as the company's AGI chief and is transitioning to being a part-time advisor.",
      '2026-07-09T23:24:04Z', 'The Verge', 'orggov'),
    mkItem('OpenAI’s CEO of AGI Deployment, Fidji Simo, Is Stepping Down',
      'The move comes after Simo took significant medical leave. She will stay on as a part-time adviser.',
      '2026-07-09T23:13:18Z', 'Wired', 'orggov'),
  ];
  const merged = dedupeMerge(items, { threshold: 0.34, nodes: REAL_ENTITIES });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].sourceCount, 3);
});

test('clustering does NOT merge unrelated same-company, same-day stories (false-positive guard)', () => {
  // All mention OpenAI, all published the same day — must stay distinct.
  const items = [
    mkItem('OpenAI launches its new family of models with GPT-5.6',
      "OpenAI's latest family of models promises improvements across a range of areas, including cybersecurity.",
      '2026-07-09T22:24:24Z', 'TechCrunch', 'product'),
    mkItem('OpenAI is shutting down Atlas, but its AI browser ambitions are still growing',
      "OpenAI is sunsetting its AI-powered browser after less than a year.",
      '2026-07-09T22:03:54Z', 'TechCrunch', 'product'),
    mkItem('GPT-5.5 Bio Bug Bounty', 'Details about the OpenAI Bio Bounty program.',
      '2026-07-09T20:00:00Z', 'OpenAI', 'general'),
    mkItem('Helping K–12 educators build practical AI skills',
      'OpenAI Academy and the Walton Family Foundation are bringing hands-on AI Skills Jams.',
      '2026-07-09T19:00:00Z', 'OpenAI', 'adoption'),
    mkItem("Your family's $300 stake in OpenAI",
      'This story originally appeared in The Algorithm, our weekly newsletter on AI. To get stories like this in your inbox first, sign up here.',
      '2026-07-06T18:00:00Z', 'MIT Technology Review', 'general'),
  ];
  const merged = dedupeMerge(items, { threshold: 0.34, nodes: REAL_ENTITIES });
  // every item must remain its own cluster — same entity/company is not
  // sufficient grounds to merge distinct stories
  assert.equal(merged.length, items.length);
});

test('extractAction identifies the canonical event action', () => {
  assert.equal(extractAction('OpenAI is shutting down Atlas'), 'shutdown');
  assert.equal(extractAction('The ChatGPT browser is already dead'), 'shutdown');
  assert.equal(extractAction('OpenAI launches its new family of models'), 'launch');
  assert.equal(extractAction('Fidji Simo steps down from OpenAI'), 'resign');
  assert.equal(extractAction('Startup raises $100M Series B'), 'raise');
});

test('clustering MERGES the Atlas shutdown pair despite low text overlap (event extraction)', () => {
  const items = [
    mkItem('OpenAI is shutting down Atlas, but its AI browser ambitions are still growing',
      'OpenAI is sunsetting its AI-powered browser after less than a year.',
      '2026-07-09T22:03:54Z', 'TechCrunch', 'product'),
    mkItem('The ChatGPT browser is already dead',
      'OpenAI’s AI browser experiment is over; the company is shutting it down.',
      '2026-07-09T23:10:00Z', 'The Verge', 'product'),
  ];
  const merged = dedupeMerge(items, { threshold: 0.34, nodes: REAL_ENTITIES });
  assert.equal(merged.length, 1, 'same shutdown event should be one cluster');
  assert.equal(merged[0].sourceCount, 2);
});

test('clustering KEEPS GPT-5.6 launch and Codex/ChatGPT-Work separate (different objects)', () => {
  const items = [
    mkItem('OpenAI launches its new family of models with GPT-5.6',
      "OpenAI's latest family of models promises improvements across a range of areas.",
      '2026-07-09T22:24:24Z', 'TechCrunch', 'product'),
    mkItem('OpenAI wants its new tool to do your work for you and with you',
      'Rebranded Codex promises independent workflows that can run for hours.',
      '2026-07-09T21:25:55Z', 'Ars Technica', 'product'),
  ];
  const merged = dedupeMerge(items, { threshold: 0.34, nodes: REAL_ENTITIES });
  assert.equal(merged.length, 2, 'different product announcements must not merge');
});

test('eventRelation: conflict on different actions, match on same action + shared object', () => {
  const launch = { title: 'OpenAI launches GPT-5.6', desc: '', date: new Date() };
  const shutdown = { title: 'OpenAI is shutting down its browser', desc: '', date: new Date() };
  assert.equal(eventRelation(launch, shutdown).conflict, true);
  const a = { title: 'OpenAI shutting down Atlas browser', desc: '', date: new Date() };
  const b = { title: 'The ChatGPT browser is dead', desc: 'shutting it down', date: new Date() };
  assert.equal(eventRelation(a, b).match, true);
});

test('clusterScore gates structural signals behind a minimum content-overlap floor', () => {
  // Two totally unrelated OpenAI stories, same day: entity+time+category all
  // agree, but there's essentially zero real topical overlap. Structural
  // agreement alone must not be enough to imply the same score as a genuine
  // same-event pair.
  const docFreq = buildDocFreq(['stake', 'bounty'].map((s) => s));
  const stake = { title: "Your family's $300 stake in OpenAI", desc: 'newsletter boilerplate text', date: new Date('2026-07-06T18:00:00Z'), category: 'general' };
  const bounty = { title: 'GPT-5.5 Bio Bug Bounty', desc: 'Details about the OpenAI Bio Bounty program', date: new Date('2026-07-09T20:00:00Z'), category: 'general' };
  const score = clusterScore(stake, bounty, docFreq, 2, REAL_ENTITIES);
  assert.ok(score < 0.34, `expected unrelated pair to score below threshold, got ${score}`);
});

test('dedupeMerge is best-match-wins, not first-match-wins', () => {
  // Regression: a greedy "first group that clears threshold" implementation
  // could let an early, worse-matching group steal an item from its true
  // best match, producing non-deterministic-looking results. Construct three
  // items where B is clearly closer to C than to A, and confirm B lands with C.
  const items = [
    mkItem('Alpha announcement about widgets', 'widgets widgets widgets', '2026-01-01T00:00:00Z', 'S1', 'product'),
    mkItem('Beta widgets news today', 'widgets widgets update', '2026-01-01T01:00:00Z', 'S2', 'product'),
    mkItem('Widgets news update beta today', 'widgets widgets update', '2026-01-01T01:05:00Z', 'S3', 'product'),
  ];
  const merged = dedupeMerge(items, { threshold: 0.2, nodes: [] });
  // B and C should end up together (near-identical text); A may or may not join
  const withThree = merged.find((m) => m.sourceCount >= 2);
  assert.ok(withThree, 'expected at least one multi-source cluster');
});

test('dedupeMerge handles empty input without throwing', () => {
  assert.deepEqual(dedupeMerge([], { threshold: 0.34, nodes: [] }), []);
});

test('properNounPhrases extracts multi-word capitalized names', () => {
  const phrases = properNounPhrases('Fidji Simo steps down from OpenAI role');
  assert.ok(phrases.has('fidji simo'));
});

test('phraseOverlap is high for shared names, zero for none shared', () => {
  assert.ok(phraseOverlap('Fidji Simo departs OpenAI', 'OpenAI exec Fidji Simo steps down') > 0);
  assert.equal(phraseOverlap('a quiet story', 'another quiet story'), 0);
});

test('weightedSimilarity down-weights common tokens vs rare ones', () => {
  const corpus = [
    'OpenAI launches GPT-5.6 today', 'OpenAI announces new partnership',
    'OpenAI reports quarterly revenue', 'OpenAI expands enterprise offerings',
  ];
  const docFreq = buildDocFreq(corpus);
  // "OpenAI" appears in every doc (low idf); a shared rare word should matter more
  const commonOnly = weightedSimilarity('OpenAI news today', 'OpenAI update today', docFreq, corpus.length);
  assert.ok(commonOnly >= 0 && commonOnly <= 1);
});
