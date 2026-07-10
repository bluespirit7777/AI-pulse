// Freshness / confidence / provenance chips. Status is never communicated by
// colour alone — every chip carries a text label and a shape/icon, and a
// title attribute for the full explanation. See docs/METHODOLOGY.md.
import { esc, timeAgo } from './util.js';

// Provenance of a data item.
export const SOURCE = {
  live: { label: 'Live', cls: 'fr-live', mark: '●', desc: 'Fetched automatically from source APIs/feeds' },
  auto: { label: 'Auto', cls: 'fr-auto', mark: '●', desc: 'Refreshed automatically from publisher RSS feeds' },
  snapshot: { label: 'Daily snapshot', cls: 'fr-snap', mark: '◐', desc: 'A once-per-day saved snapshot' },
  curated: { label: 'Curated', cls: 'fr-curated', mark: '✎', desc: 'Maintained by hand — an editorial estimate, not a live feed' },
  estimated: { label: 'Estimated', cls: 'fr-est', mark: '⋯', desc: 'A derived or approximate figure' },
  stale: { label: 'Stale', cls: 'fr-stale', mark: '○', desc: 'Older than the usual refresh window' },
};

// Corroboration tier from how many independent sources carried a story.
export const CONFIDENCE = {
  strong: { label: 'Strong signal', cls: 'cf-strong', desc: '3+ independent sources' },
  moderate: { label: 'Moderate signal', cls: 'cf-moderate', desc: '2 independent sources' },
  early: { label: 'Early signal', cls: 'cf-early', desc: 'Single source so far' },
};

// A provenance chip. `type` is a SOURCE key.
export function sourceChip(type, extra = '') {
  const s = SOURCE[type] || SOURCE.auto;
  const title = extra ? `${s.desc} · ${extra}` : s.desc;
  return `<span class="fr-chip ${s.cls}" title="${esc(title)}"><span class="fr-mark" aria-hidden="true">${s.mark}</span>${esc(s.label)}</span>`;
}

// A confidence chip. `tier` is a CONFIDENCE key.
export function confidenceChip(tier) {
  const c = CONFIDENCE[tier] || CONFIDENCE.early;
  return `<span class="fr-chip ${c.cls}" title="${esc(c.desc)}">${esc(c.label)}</span>`;
}

// "Updated 4 min ago" chip whose halo brightness reflects age (bright < 1h,
// soft < 24h, grey older). Age is encoded by the class AND stated in text.
export function freshnessChip(iso, now = Date.now()) {
  const ageH = (now - Date.parse(iso)) / 3.6e6;
  const cls = isNaN(ageH) ? 'fr-snap' : ageH < 1 ? 'fr-fresh' : ageH < 24 ? 'fr-recent' : 'fr-old';
  return `<span class="fr-chip ${cls}" title="Last updated ${esc(new Date(iso).toISOString())}"><span class="fr-mark" aria-hidden="true">◷</span>${esc(timeAgo(iso, now))}</span>`;
}
