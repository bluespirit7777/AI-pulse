#!/usr/bin/env node
// Unit tests for the native price-chart helpers. Run: node --test test/chart.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandleSeries, candleBounds, priceToY, isUp } from '../scripts/lib/chart.mjs';

test('buildCandleSeries rounds to cents and keeps only the last maxBars', () => {
  const raw = Array.from({ length: 80 }, (_, i) => ({ d: `01-${i}`, o: i + 0.123, h: i + 1.987, l: i - 0.5, c: i + 0.6 }));
  const out = buildCandleSeries(raw, 66);
  assert.equal(out.length, 66);
  assert.equal(out[0].o, Math.round((14 + 0.123) * 100) / 100); // 80 - 66 = 14 dropped from the front
  assert.equal(out[0].o, 14.12);
  assert.equal(out[0].h, 15.99);
});

test('buildCandleSeries drops bars missing any OHLC value or with non-finite numbers', () => {
  const raw = [
    { d: 'a', o: 1, h: 2, l: 0.5, c: 1.5 },
    { d: 'b', o: null, h: 2, l: 0.5, c: 1.5 },      // missing open
    { d: 'c', o: 1, h: 2, l: 0.5, c: NaN },          // NaN close
    null,                                             // whole bar null (holiday)
    { d: 'e', o: 3, h: 4, l: 2.5, c: 3.5 },
  ];
  const out = buildCandleSeries(raw);
  assert.deepEqual(out.map((c) => c.d), ['a', 'e']);
});

test('buildCandleSeries widens high/low to the real extremes when the feed is inconsistent', () => {
  // a bad bar where the "high" is actually below the close — should not produce
  // a candle whose body pokes out of its own wick
  const out = buildCandleSeries([{ d: 'x', o: 10, h: 11, l: 9, c: 12 }]);
  assert.equal(out[0].h, 12); // widened up to the close
  assert.equal(out[0].l, 9);
});

test('candleBounds spans every high and low', () => {
  const b = candleBounds([
    { d: 'a', o: 10, h: 12, l: 9, c: 11 },
    { d: 'b', o: 11, h: 15, l: 8, c: 14 },
  ]);
  assert.equal(b.min, 8);
  assert.equal(b.max, 15);
});

test('candleBounds returns null for an empty series (caller shows empty state)', () => {
  assert.equal(candleBounds([]), null);
  assert.equal(candleBounds(null), null);
});

test('candleBounds pads a dead-flat series so scaling never divides by zero', () => {
  const b = candleBounds([{ d: 'a', o: 50, h: 50, l: 50, c: 50 }]);
  assert.ok(b.min < 50 && b.max > 50);
});

test('priceToY maps max to the top pixel and min to the bottom pixel (SVG y grows down)', () => {
  assert.equal(priceToY(100, 0, 100, 12, 288), 12);   // max → top
  assert.equal(priceToY(0, 0, 100, 12, 288), 288);    // min → bottom
  assert.equal(priceToY(50, 0, 100, 12, 288), 150);   // midpoint → middle
});

test('priceToY never divides by zero on a flat range', () => {
  assert.equal(priceToY(50, 50, 50, 12, 288), 150); // mid of top/bottom
});

test('isUp is true when the candle closed at or above its open', () => {
  assert.equal(isUp({ o: 10, c: 11 }), true);
  assert.equal(isUp({ o: 10, c: 10 }), true);  // doji counts as up (green)
  assert.equal(isUp({ o: 10, c: 9 }), false);
});
