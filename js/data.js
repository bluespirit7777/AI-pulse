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

// data/stock-network.json — pre-built ecosystem nodes + correlations. Absent/
// malformed is not fatal: the network shows an unavailable state and the table
// fallback (from latest.json) still works.
export async function loadStockNetwork() {
  try {
    const res = await fetch('data/stock-network.json' + BUST(), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// data/youtube-trending.json — top-5-by-view-count-in-7-days videos per
// model, refreshed twice daily by its own workflow (see
// scripts/update-youtube.mjs). Absent/malformed is not an error: the release
// cards' flip side just shows an honest "unavailable" state instead of a
// stale or fabricated list — this is genuinely likely on a fresh checkout
// before the YOUTUBE_API_KEY secret is configured.
export async function loadYouTubeTrending() {
  try {
    const res = await fetch('data/youtube-trending.json' + BUST(), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const RANGE_KEYS = ['24H', '7D', '30D'];
