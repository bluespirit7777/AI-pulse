// Data loading + historical comparison. Everything degrades gracefully: the
// site is fully functional with only latest.json, and history that doesn't
// exist yet is reported honestly ("accumulating"), never fabricated.

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

// UTC date string N days before `from` (default now), e.g. "2026-07-03".
export function dayKey(daysAgo, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Returns the snapshot for N days ago, or null if that file doesn't exist yet.
// A 404 is expected and NOT an error — it just means history hasn't reached
// back that far.
export async function loadSnapshot(daysAgo) {
  try {
    const res = await fetch(`data/history/${dayKey(daysAgo)}.json` + BUST(), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Per-entity activity delta between now and a snapshot. Returns {} if no
// snapshot (caller shows "history accumulating").
export function entityDelta(latestActivity, snapshot) {
  if (!snapshot || !snapshot.entityActivity) return {};
  const out = {};
  for (const id of Object.keys(latestActivity || {})) {
    out[id] = (latestActivity[id] || 0) - (snapshot.entityActivity[id] || 0);
  }
  return out;
}

// Maps a UI range key to a snapshot offset in days.
export const RANGE_DAYS = { '24H': 1, '7D': 7, '30D': 30 };
