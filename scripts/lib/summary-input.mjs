// Groups recent signals into the three wave families the AI Summary Wave
// covers (Product / Market / Research).
//
// Pure and DOM-free so it can be unit-tested — scripts/prep-ai-summary.mjs is
// only a formatter around this. Mirrors buildWaves()'s eligibility rules on
// purpose: the summary should describe the same universe of events the rest of
// the site treats as news, not a second, quietly different one.
import { waveFamily } from './signals.mjs';

export const SUMMARY_FAMILIES = ['product', 'market', 'research'];
export const WINDOW_HOURS = 24;

// Excluded for the same reason buildWaves() excludes them: these are
// commentary ABOUT events rather than events. Summarising them would describe
// the discourse instead of what actually happened.
const EXCLUDED_CATEGORIES = new Set(['analysis', 'general']);

// Note this deliberately re-derives the family from `category` via waveFamily()
// rather than trusting each signal's own `family` field. That field is assigned
// without the analysis/general exclusion, so it buckets commentary into
// `product` — reading it here would silently pull that commentary back in.
export function groupByFamily(signals = [], now = Date.now(), windowHours = WINDOW_HOURS) {
  const cutoff = now - windowHours * 3.6e6;
  const out = { product: [], market: [], research: [] };

  for (const s of signals) {
    if (!s || EXCLUDED_CATEGORIES.has(s.category)) continue;
    const t = Date.parse(s.dateISO);
    if (!Number.isFinite(t) || t < cutoff || t > now) continue;
    const fam = waveFamily(s.category);
    if (out[fam]) out[fam].push(s);
  }

  // Most significant first: the summary should lead with what mattered most,
  // and a writer scanning this list should hit that first.
  for (const fam of SUMMARY_FAMILIES) {
    out[fam].sort((a, b) => (b.significance || 0) - (a.significance || 0));
  }
  return out;
}
