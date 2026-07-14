// Shared, pure, deterministic price-chart helpers — imported by
// scripts/update-data.mjs (build time, to shape the compact candle series
// written into stock-network.json) and test/chart.test.mjs. No I/O.
//
// The stock drawer draws a native SVG candlestick chart from this data
// instead of a third-party embed, so it renders for every visitor regardless
// of what their network blocks — see js/stocknetwork.js.

// Turn raw daily OHLC bars into a clean, bounded, rounded candle series.
// Drops any bar missing a value (weekends/holidays/bad data), keeps only the
// most recent `maxBars`, and rounds to cents so the JSON stays small.
export function buildCandleSeries(rawBars, maxBars = 66) {
  const clean = [];
  for (const b of rawBars || []) {
    if (b == null) continue;
    const { d, o, h, l, c } = b;
    if ([o, h, l, c].some((v) => v == null || !Number.isFinite(v))) continue;
    // a valid candle always satisfies low <= (open, close) <= high; if the
    // feed violates that, widen to the real extremes rather than drop the bar
    const lo = Math.min(o, h, l, c);
    const hi = Math.max(o, h, l, c);
    clean.push({ d, o: round2(o), h: round2(hi), l: round2(lo), c: round2(c) });
  }
  return clean.slice(-maxBars);
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// Price extremes across every high and low in the series — the y-axis range.
// Returns null for an empty series (the caller shows an empty state).
export function candleBounds(candles) {
  if (!candles || !candles.length) return null;
  let min = Infinity, max = -Infinity;
  for (const c of candles) {
    if (c.l < min) min = c.l;
    if (c.h > max) max = c.h;
  }
  // a dead-flat series (min === max) would divide-by-zero when scaling; give
  // it a tiny symmetric pad so the single line sits mid-chart
  if (min === max) { const pad = Math.abs(min) * 0.01 || 1; return { min: min - pad, max: max + pad }; }
  return { min, max };
}

// Map a price to a y pixel: `max` sits at `top`, `min` at `bottom` (SVG y
// grows downward, so higher prices get smaller y). Pure and total.
export function priceToY(price, min, max, top, bottom) {
  if (max === min) return (top + bottom) / 2;
  const frac = (price - min) / (max - min);
  return bottom - frac * (bottom - top);
}

// A candle is "up" when it closed at or above its open — drives the
// green/red colour, the one convention every stock chart shares.
export function isUp(candle) {
  return candle.c >= candle.o;
}
