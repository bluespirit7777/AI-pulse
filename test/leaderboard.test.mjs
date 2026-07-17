#!/usr/bin/env node
// Unit tests for leaderboard honesty: 4 use-case-specific views instead of one
// blended "objective" rank, every claim naming a benchmark + snapshot date,
// and the "Overall balance" disclaimer. Run: node --test test/leaderboard.test.mjs
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

test('every row in every view has a non-empty note that names a benchmark or pricing source AND a snapshot date/period', () => {
  // "named benchmark" = cites a recognizable source (Scale Labs / pricing
  // page / model card); "snapshot date" = a month+year or "as of" phrase, not
  // an unqualified absolute claim.
  const sourceRe = /(scale labs|artificial analysis|lmarena|pricing page|model card|public provider pricing)/i;
  const dateRe = /(jul 2026|as of|snapshot)/i;
  for (const view of LEADERBOARD_VIEWS) {
    for (const row of view.data) {
      assert.ok(row.note && row.note.length > 0, `${view.id}/${row.model} has an empty note`);
      assert.ok(sourceRe.test(row.note), `${view.id}/${row.model} note doesn't name a source: "${row.note}"`);
      assert.ok(dateRe.test(row.note), `${view.id}/${row.model} note doesn't name a snapshot period: "${row.note}"`);
    }
  }
});

test('every model in every view carries a numeric score (no model left unscored)', () => {
  for (const view of LEADERBOARD_VIEWS) {
    for (const row of view.data) {
      assert.equal(typeof row.score, 'number', `${view.id}/${row.model} must carry a numeric score`);
      assert.ok(Number.isFinite(row.score), `${view.id}/${row.model} score must be a real number`);
    }
  }
});

test('reasoning/agentic scores are either published figures or notes DISCLOSED as editorial estimates', () => {
  const reasoning = LEADERBOARD_VIEWS.find((v) => v.id === 'reasoning').data;
  const agentic = LEADERBOARD_VIEWS.find((v) => v.id === 'agentic').data;
  // Models Scale Labs publishes a real HLE figure for; every OTHER scored model
  // must say in its note that its number is an editorial estimate.
  const publishedReasoning = new Set(['Claude Fable 5', 'ChatGPT Sol (GPT-5.6)', 'Claude Opus 4.8', 'Gemini 3.1 Pro']);
  for (const row of reasoning) {
    if (!publishedReasoning.has(row.model)) {
      assert.match(row.note, /editorial estimate/i, `${row.model} unpublished reasoning score must be disclosed as an editorial estimate`);
    }
  }
  // Only Claude's two tiers have published SWE Atlas figures.
  const publishedAgentic = new Set(['Claude Fable 5', 'Claude Opus 4.8']);
  for (const row of agentic) {
    if (!publishedAgentic.has(row.model)) {
      assert.match(row.note, /editorial estimate/i, `${row.model} unpublished agentic score must be disclosed as an editorial estimate`);
    }
  }
});

test('ChatGPT Sol ranks at or above Gemini 3.1 Pro on Overall and Reasoning (no Gemini-over-Sol regression)', () => {
  for (const id of ['overall', 'reasoning']) {
    const rows = LEADERBOARD_VIEWS.find((v) => v.id === id).data;
    const sol = rows.find((r) => r.model === 'ChatGPT Sol (GPT-5.6)');
    const gemini = rows.find((r) => r.model === 'Gemini 3.1 Pro');
    assert.ok(sol && gemini, `${id} must include both Sol and Gemini`);
    assert.ok(sol.rank <= gemini.rank, `${id}: ChatGPT Sol (rank ${sol.rank}) must not rank below Gemini (rank ${gemini.rank})`);
    assert.ok(sol.score >= gemini.score, `${id}: ChatGPT Sol (${sol.score}) must score at least as high as Gemini (${gemini.score})`);
  }
});

test('cost efficiency view is qualitative (tier/directional), not fabricated precise $/token figures', () => {
  const cost = LEADERBOARD_VIEWS.find((v) => v.id === 'cost').data;
  const preciseDollarRe = /\$\d+(\.\d+)?\s*\/\s*(1?[mk]?\s*)?tokens?/i; // e.g. "$3.00/M tokens" — the fabrication this guards against
  for (const row of cost) {
    assert.doesNotMatch(row.note, preciseDollarRe, `${row.model} cost note should not invent a precise per-token rate: "${row.note}"`);
  }
});

test('avoids unqualified "stronger model overall" language — comparative claims are scoped to a named task/metric', () => {
  const bannedRe = /\bstronger model overall\b/i;
  for (const view of LEADERBOARD_VIEWS) {
    for (const row of view.data) {
      assert.doesNotMatch(row.note, bannedRe, `${view.id}/${row.model} uses unscoped "stronger overall" language`);
      assert.doesNotMatch(row.stat, bannedRe);
    }
  }
});

test('leaderboardOverall (back-compat alias) still points at the Overall balance view data', () => {
  const overall = LEADERBOARD_VIEWS.find((v) => v.id === 'overall');
  assert.equal(leaderboardOverall, overall.data);
});

test('every view ranks the same 6-model roster (no model silently dropped from a view)', () => {
  const rosters = LEADERBOARD_VIEWS.map((v) => new Set(v.data.map((r) => r.model)));
  const [first, ...rest] = rosters;
  for (const r of rest) assert.deepEqual([...r].sort(), [...first].sort());
});
