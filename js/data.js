// Data loading. Everything degrades gracefully: the site is fully functional
// with only latest.json; entities.json and range.json enrich it when present.

const BUST = () => '?_=' + Date.now();

export async function loadLatest() {
  const res = await fetch('data/latest.json' + BUST(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function loadEntities() {
  const res = await fetch('data/entities.json' + BUST(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// data/range.json — real per-range (24H/7D/30D) stats built at fetch time
// from compact event history (see scripts/lib/history.mjs). Absent/malformed
// is not an error: the map falls back to "history accumulating" for every
// range rather than failing.
export async function loadRanges() {
  try {
    const res = await fetch('data/range.json' + BUST(), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const RANGE_KEYS = ['24H', '7D', '30D'];
