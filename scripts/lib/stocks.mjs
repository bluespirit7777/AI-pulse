// Pure, testable stock-math for the AI Stock Network — daily returns, Pearson
// correlation over aligned dates, relative/dollar volume. No I/O. Imported by
// scripts/update-data.mjs (build time) and test/stocks.test.mjs.
//
// Correlations are of PRICE RETURNS, not business relationships — the two are
// kept strictly separate in the data and UI. Correlation ≠ causation.

// Daily simple returns from a date-sorted [{date, close}] series → Map<date, r>.
// Skips days with missing/zero prior close (market holidays / gaps handled by
// simply not emitting a return for that date).
export function computeReturns(rows) {
  const m = new Map();
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].close, b = rows[i].close;
    if (a != null && b != null && a !== 0) m.set(rows[i].date, (b - a) / a);
  }
  return m;
}

// Pearson correlation of two equal-length numeric arrays. null if undefined
// (n < 2 or zero variance).
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  const d = Math.sqrt(vx * vy);
  return d === 0 ? null : cov / d;
}

// Correlation pairs over the last `window` aligned trading days, keeping only
// |r| >= threshold. `returnsByTicker` is { ticker: Map<date, r> }. A pair is
// emitted only if it has a full `window` of dates present in BOTH series, so a
// "30-day" correlation always reflects exactly 30 observations.
export function correlationPairs(returnsByTicker, tickers, window = 30, threshold = 0.5) {
  const pairs = [];
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const A = returnsByTicker[tickers[i]], B = returnsByTicker[tickers[j]];
      if (!A || !B) continue;
      const common = [...A.keys()].filter((d) => B.has(d)).sort();
      const recent = common.slice(-window);
      if (recent.length < window) continue;
      const xs = recent.map((d) => A.get(d));
      const ys = recent.map((d) => B.get(d));
      const r = pearson(xs, ys);
      if (r != null && Math.abs(r) >= threshold) {
        pairs.push({ a: tickers[i], b: tickers[j], r: Math.round(r * 1000) / 1000, n: recent.length });
      }
    }
  }
  return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

// The top-N positive and the single strongest negative correlation for one
// ticker, for its detail drawer. Reads the already-filtered pairs list.
export function correlationsForTicker(pairs, ticker, topN = 3) {
  const rel = pairs
    .filter((p) => p.a === ticker || p.b === ticker)
    .map((p) => ({ other: p.a === ticker ? p.b : p.a, r: p.r }));
  const positives = rel.filter((p) => p.r > 0).sort((a, b) => b.r - a.r).slice(0, topN);
  const negatives = rel.filter((p) => p.r < 0).sort((a, b) => a.r - b.r);
  return { positives, strongestNegative: negatives[0] || null };
}

// Relative volume = latest volume / average of the prior `lookback` days.
// Raw share volume isn't comparable across companies, so this ratio is the
// main visual signal. null if insufficient data.
export function relativeVolume(volumes, lookback = 20) {
  const valid = volumes.filter((v) => v != null && v > 0);
  if (valid.length < 2) return null;
  const latest = valid[valid.length - 1];
  const prior = valid.slice(-(lookback + 1), -1);
  if (!prior.length) return null;
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
  return avg === 0 ? null : latest / avg;
}

export function average(nums) {
  const v = nums.filter((n) => n != null && Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Direction bucket from a percent change, with a small dead-band for "flat".
export function direction(changePct) {
  if (changePct == null) return 'flat';
  if (changePct > 0.15) return 'up';
  if (changePct < -0.15) return 'down';
  return 'flat';
}
