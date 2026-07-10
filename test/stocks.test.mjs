#!/usr/bin/env node
// Unit tests for the stock-math library. Run: node --test test/stocks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReturns, pearson, correlationPairs, correlationsForTicker,
  relativeVolume, average, direction, dailyChange, DAILY_CHANGE_REVIEW_PCT,
} from '../scripts/lib/stocks.mjs';

const bars = (...closes) => closes.map((c, i) => ({ date: `2026-07-${String(i + 1).padStart(2, '0')}`, close: c, volume: 1000 }));

test('dailyChange: normal two-day positive move', () => {
  const r = dailyChange(bars(100, 102)); // +2%
  assert.ok(Math.abs(r.changePct - 2) < 1e-9);
  assert.equal(r.review, false);
});

test('dailyChange: negative move', () => {
  const r = dailyChange(bars(200, 190)); // -5%
  assert.ok(Math.abs(r.changePct - (-5)) < 1e-9);
});

test('dailyChange: uses only the LAST two bars, not the 3-month start (the AMD bug)', () => {
  // 3 months ago AMD was ~90, today ~205 — the OLD code did (205-90)/90 = +128%.
  // Correct daily change compares today vs yesterday only.
  const series = bars(90, 95, 110, 150, 180, 204, 205); // yesterday 204 → today 205
  const r = dailyChange(series);
  assert.ok(Math.abs(r.changePct - ((205 - 204) / 204 * 100)) < 1e-9);
  assert.ok(r.changePct < 1, `expected ~0.49%, got ${r.changePct}`);
});

test('dailyChange: missing trading days (weekends/holidays) are just absent bars', () => {
  // Fri close 100, Mon close 103 — no weekend bars exist; change is Mon vs Fri.
  const series = [
    { date: '2026-07-10', close: 100 },
    { date: '2026-07-13', close: 103 },
  ];
  assert.ok(Math.abs(dailyChange(series).changePct - 3) < 1e-9);
});

test('dailyChange: null/invalid closes are dropped before computing', () => {
  const series = [
    { date: '2026-07-09', close: 100 },
    { date: '2026-07-10', close: null },
    { date: '2026-07-11', close: 0 },
    { date: '2026-07-12', close: 101 },
  ];
  assert.ok(Math.abs(dailyChange(series).changePct - 1) < 1e-9); // 101 vs 100
});

test('dailyChange: only one valid close → null (no fabricated change)', () => {
  const r = dailyChange(bars(100));
  assert.equal(r.changePct, null);
  assert.equal(r.reason, 'single valid bar');
});

test('dailyChange: empty/all-null series → null', () => {
  assert.equal(dailyChange([]).changePct, null);
  assert.equal(dailyChange([{ date: 'x', close: null }]).changePct, null);
});

test('dailyChange: live price used as latest vs last completed bar when it differs', () => {
  // today bar hasn't posted; last bar is yesterday(150). Live price 153 → +2%.
  const r = dailyChange(bars(148, 150), 153);
  assert.ok(Math.abs(r.changePct - 2) < 1e-9);
  assert.equal(r.latestClose, 153);
  assert.equal(r.prevClose, 150);
});

test('dailyChange: live price equal to last bar falls back to two-bar diff', () => {
  const r = dailyChange(bars(150, 152), 152); // post-close: live == last close
  assert.ok(Math.abs(r.changePct - ((152 - 150) / 150 * 100)) < 1e-9);
});

test('dailyChange: large real move is flagged for review, not rejected', () => {
  const r = dailyChange(bars(100, 140)); // +40%
  assert.ok(Math.abs(r.changePct - 40) < 1e-9);
  assert.equal(r.review, true);
  assert.ok(40 > DAILY_CHANGE_REVIEW_PCT);
});

test('dailyChange: split-like halving flagged for review', () => {
  const r = dailyChange(bars(200, 100)); // -50% (possible unadjusted split artifact)
  assert.equal(r.review, true);
});

test('computeReturns: simple daily returns, skips gaps', () => {
  const rows = [
    { date: '2026-01-01', close: 100 },
    { date: '2026-01-02', close: 110 },   // +10%
    { date: '2026-01-03', close: 99 },    // -10%
    { date: '2026-01-04', close: null },  // holiday/missing → no return
    { date: '2026-01-05', close: 99 },    // prev is null → skipped
  ];
  const m = computeReturns(rows);
  assert.ok(Math.abs(m.get('2026-01-02') - 0.1) < 1e-9);
  assert.ok(Math.abs(m.get('2026-01-03') - (-0.1)) < 1e-9);
  assert.equal(m.has('2026-01-04'), false);
  assert.equal(m.has('2026-01-05'), false);
});

test('pearson: perfect positive, perfect negative, and zero-variance', () => {
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [8, 6, 4, 2]) - (-1)) < 1e-9);
  assert.equal(pearson([5, 5, 5], [1, 2, 3]), null); // zero variance in x
  assert.equal(pearson([1], [1]), null); // n < 2
});

test('correlationPairs: threshold filtering and full-window requirement', () => {
  // build two perfectly-correlated series and one anti-correlated, 30 days
  const dates = Array.from({ length: 31 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`);
  const A = new Map(), B = new Map(), C = new Map();
  for (let i = 1; i < dates.length; i++) {
    const r = Math.sin(i); // deterministic varied returns
    A.set(dates[i], r);
    B.set(dates[i], r);      // identical → corr 1
    C.set(dates[i], -r);     // opposite → corr -1
  }
  const pairs = correlationPairs({ A, B, C }, ['A', 'B', 'C'], 30, 0.5);
  const ab = pairs.find((p) => (p.a === 'A' && p.b === 'B'));
  const ac = pairs.find((p) => (p.a === 'A' && p.b === 'C'));
  assert.ok(ab && ab.r >= 0.99, 'A~B should be ~+1');
  assert.ok(ac && ac.r <= -0.99, 'A~C should be ~-1');
  assert.equal(ab.n, 30);
});

test('correlationPairs: drops pairs without a full window', () => {
  const A = new Map(), B = new Map();
  for (let i = 0; i < 10; i++) { A.set('d' + i, i * 0.1); B.set('d' + i, i * 0.1); } // only 10 obs
  const pairs = correlationPairs({ A, B }, ['A', 'B'], 30, 0.5);
  assert.equal(pairs.length, 0);
});

test('correlationPairs: only aligned (common) dates are used', () => {
  const A = new Map(), B = new Map();
  for (let i = 0; i < 40; i++) A.set('d' + i, Math.cos(i));
  for (let i = 10; i < 50; i++) B.set('d' + i, Math.cos(i)); // overlap d10..d39 = 30 dates
  const pairs = correlationPairs({ A, B }, ['A', 'B'], 30, 0.5);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].n, 30);
});

test('correlationsForTicker: top positives and strongest negative', () => {
  const pairs = [
    { a: 'X', b: 'Y', r: 0.9 }, { a: 'X', b: 'Z', r: 0.7 },
    { a: 'X', b: 'W', r: -0.8 }, { a: 'X', b: 'V', r: 0.6 }, { a: 'Y', b: 'Z', r: 0.55 },
  ];
  const { positives, strongestNegative } = correlationsForTicker(pairs, 'X', 3);
  assert.deepEqual(positives.map((p) => p.other), ['Y', 'Z', 'V']);
  assert.equal(strongestNegative.other, 'W');
});

test('relativeVolume: latest vs prior average', () => {
  const vols = [...Array(20).fill(1000), 2000]; // 20 days at 1000, latest 2000
  assert.ok(Math.abs(relativeVolume(vols, 20) - 2) < 1e-9);
  assert.equal(relativeVolume([1000], 20), null); // insufficient
});

test('average ignores nulls; direction has a flat dead-band', () => {
  assert.equal(average([2, null, 4]), 3);
  assert.equal(average([null]), null);
  assert.equal(direction(1.2), 'up');
  assert.equal(direction(-1.2), 'down');
  assert.equal(direction(0.05), 'flat');
  assert.equal(direction(null), 'flat');
});
