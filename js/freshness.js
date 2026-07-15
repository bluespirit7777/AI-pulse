// Freshness / confidence / provenance chips. Status is never communicated by
// colour alone — every chip carries a text label and a shape/icon, and a
// title attribute for the full explanation. See docs/METHODOLOGY.md.
import { esc, timeAgo } from './util.js';

// Provenance of a data item.
export const SOURCE = {
  live: { label: 'Live', cls: 'fr-live', mark: '●', desc: 'Fetched automatically from source APIs/feeds' },
  auto: { label: 'Auto', cls: 'fr-auto', mark: '●', desc: 'Refreshed automatically from publisher RSS feeds' },
  snapshot: { label: 'Daily snapshot', cls: 'fr-snap', mark: '◐', desc: 'A once-per-day saved snapshot' },
  snapshot12h: { label: '12-hour snapshot', cls: 'fr-snap', mark: '◐', desc: 'Refreshed twice a day, not continuously' },
  curated: { label: 'Curated', cls: 'fr-curated', mark: '✎', desc: 'Maintained by hand — an editorial estimate, not a live feed' },
  estimated: { label: 'Estimated', cls: 'fr-est', mark: '⋯', desc: 'A derived or approximate figure' },
  stale: { label: 'Stale', cls: 'fr-stale', mark: '○', desc: 'Older than the usual refresh window' },
};

// Verification (source reliability) and impact (event magnitude) are
// deliberately separate axes — see classifyVerification/classifyImpact in
// scripts/lib/signals.mjs for the full rule set. Never derive one from the
// other here; always pass the real field the backend computed.
export const VERIFICATION = {
  official: { label: 'Official', cls: 'vf-official', desc: 'Reported by the subject’s own channel' },
  corroborated: { label: 'Corroborated', cls: 'vf-corroborated', desc: '2+ independent sources agree' },
  single: { label: 'Single report', cls: 'vf-single', desc: 'One source so far, not yet corroborated' },
  uncertain: { label: 'Uncertain', cls: 'vf-uncertain', desc: 'Hedged or unconfirmed language in the reporting' },
  analysis: { label: 'Analysis', cls: 'vf-analysis', desc: 'Commentary or opinion, not a reported fact' },
};
export const IMPACT = {
  high: { label: 'High impact', cls: 'im-high' },
  notable: { label: 'Notable', cls: 'im-notable' },
  emerging: { label: 'Emerging', cls: 'im-emerging' },
};

// A provenance chip. `type` is a SOURCE key.
export function sourceChip(type, extra = '') {
  const s = SOURCE[type] || SOURCE.auto;
  const title = extra ? `${s.desc} · ${extra}` : s.desc;
  return `<span class="fr-chip ${s.cls}" title="${esc(title)}"><span class="fr-mark" aria-hidden="true">${s.mark}</span>${esc(s.label)}</span>`;
}

// A verification chip. `tier` is a VERIFICATION key.
export function verificationChip(tier) {
  const v = VERIFICATION[tier] || VERIFICATION.single;
  return `<span class="fr-chip ${v.cls}" title="${esc(v.desc)}">${esc(v.label)}</span>`;
}

// An impact chip. `tier` is an IMPACT key.
export function impactChip(tier) {
  const i = IMPACT[tier] || IMPACT.emerging;
  return `<span class="fr-chip ${i.cls}">${esc(i.label)}</span>`;
}

// "Updated 4 min ago" chip whose halo brightness reflects age (bright < 1h,
// soft < 24h, grey older). Age is encoded by the class AND stated in text.
export function freshnessChip(iso, now = Date.now()) {
  const ageH = (now - Date.parse(iso)) / 3.6e6;
  const cls = isNaN(ageH) ? 'fr-snap' : ageH < 1 ? 'fr-fresh' : ageH < 24 ? 'fr-recent' : 'fr-old';
  return `<span class="fr-chip ${cls}" title="Last updated ${esc(new Date(iso).toISOString())}"><span class="fr-mark" aria-hidden="true">◷</span>${esc(timeAgo(iso, now))}</span>`;
}
