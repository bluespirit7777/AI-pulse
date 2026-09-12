#!/usr/bin/env node
// Unit tests for the four scoped curated leaderboard views.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEADERBOARD_VIEWS, LEADERBOARD_OVERALL_DISCLAIMER, leaderboardOverall } from '../js/curated.js';

test('LEADERBOARD_VIEWS has exactly the 4 required views, in order', () => {
  assert.deepEqual(LEADERBOARD_VIEWS.map((v) => v.id), ['overall', 'reasoning', 'agentic', 'cost']);
  assert.deepEqual(LEADERBOARD_VIEWS.map((v) => v.label), ['Overall balance', 'Reasoning', 'Agentic coding', 'Cost efficiency']);
});

test('only the Overall balance view carries the editorial-synthesis disclaimer', () => {
  const [overall, ...rest] = LEADERBOARD_VIEWS;
  assert.equal(overall.disclaimer, LEADERBOARD_OVERALL_DISCLAIMER);
  for (const v of rest) assert.equal(v.disclaimer, null, `${v.id} should not carry the Overall disclaimer`);
});

test('the disclaimer text itself matches the exact required wording', () => {
  assert.equal(LEADERBOARD_OVERALL_DISCLAIMER, 'Editorial synthesis—not a universal benchmark ranking.');
});

test('every row names its source and current snapshot', () => {
  const sourceRe = /(artificial analysis|lmarena|arena|terminal-bench|pricing|model card)/i;
  const dateRe = /(sep 2026|as of|snapshot)/i;
  for (const view of LEADERBOARD_VIEWS) {
    for (const row of view.data) {
      assert.ok(row.note && row.note.length > 0, `${view.id}/${row.model} has an empty note`);
      assert.match(row.note, sourceRe, `${view.id}/${row.model} note doesn't name a source`);
      assert.match(row.note, dateRe, `${view.id}/${row.model} note doesn't name a snapshot period`);
    }
  }
});

test('every model in every view carries a finite numeric score', () => {
  for (const view of LEADERBOARD_VIEWS) {
    for (const row of view.data) {
      assert.equal(typeof row.score, 'number', `${view.id}/${row.model} must carry a numeric score`);
      assert.ok(Number.isFinite(row.score), `${view.id}/${row.model} score must be finite`);
    }
  }
});

test('reasoning and agentic rows are all published current-source values', () => {
  const reasoning = LEADERBOARD_VIEWS.find((v) => v.id === 'reasoning').data;
  const agentic = LEADERBOARD_VIEWS.find((v) => v.id === 'agentic').data;
  for (const row of reasoning) assert.doesNotMatch(row.note, /editorial estimate/i, `${row.model} reasoning value is still estimated`);
  for (const row of agentic) assert.doesNotMatch(row.note, /editorial estimate/i, `${row.model} agentic value is still estimated`);
  assert.equal(agentic[0].model, 'GPT-6 Astra');
    assert.equal(reasoning[0].model, 'Claude Fable 5.1');
    assert.ok(reasoning.some((row) => row.model === 'Gemini 3.1 Pro Preview'));
    assert.ok(agentic.some((row) => row.model === 'Qwen3.8 Max'));
});

test('cost efficiency uses current cost-per-task values, not per-token claims', () => {
  const cost = LEADERBOARD_VIEWS.find((v) => v.id === 'cost').data;
  const preciseDollarRe = /\$\d+(\.\d+)?\s*\/\s*(1?[mk]?\s*)?tokens?/i;
  for (const row of cost) {
    assert.doesNotMatch(row.note, preciseDollarRe, `${row.model} cost note should not invent a per-token rate`);
    assert.match(row.note, /cost-per-task/i);
  }
});

test('no row makes an unscoped stronger-overall claim', () => {
  const bannedRe = /\bstronger model overall\b/i;
  for (const view of LEADERBOARD_VIEWS) {
    for (const row of view.data) {
      assert.doesNotMatch(row.note, bannedRe);
      assert.doesNotMatch(row.stat, bannedRe);
    }
  }
});

test('leaderboardOverall alias still points at the Overall view data', () => {
  assert.equal(leaderboardOverall, LEADERBOARD_VIEWS.find((v) => v.id === 'overall').data);
});

test('every view uses the same refreshed model roster', () => {
  const rosters = LEADERBOARD_VIEWS.map((v) => new Set(v.data.map((r) => r.model)));
  const [first, ...rest] = rosters;
  for (const roster of rest) assert.deepEqual([...roster].sort(), [...first].sort());
});
