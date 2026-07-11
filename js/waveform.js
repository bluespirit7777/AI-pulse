// Strongest Waves as actual SVG waveforms, not decorative cards. Built from
// the FULL signal set per family (not just the single winner), so every
// encoding is real data, not decoration:
//   x position   = when it published, within the visible 72h window
//   amplitude    = significance (0-100)
//   brightness   = freshness (recency-scaled opacity)
//   marker size  = source count (corroboration)
//   secondary peaks = other notable-or-higher stories in the same family
//   trend arrow  = winning story's significance vs. the family's other
//                  points in this window (documented heuristic, not implied
//                  history — see docs/METHODOLOGY.md)
// Entirely readable without animation: every peak has a title on hover/focus,
// and activating the row opens a detail panel with the full story.
import { esc, timeAgo } from './util.js';
import { verificationChip, freshnessChip } from './freshness.js';
import { VERIFICATION_LABEL, IMPACT_LABEL, whyItMatters } from '../scripts/lib/signals.mjs';

const FAMILY = {
  product: { label: 'Product wave', mark: '◆', color: 'var(--sea)' },
  market: { label: 'Market wave', mark: '▲', color: 'var(--coral)' },
  research: { label: 'Research wave', mark: '✦', color: 'var(--sand)' },
};
const WINDOW_HOURS = 72;
const VW = 700, VH = 92, PAD = 14;

function freshnessOpacity(dateISO, now) {
  const h = (now - Date.parse(dateISO)) / 3.6e6;
  return Math.max(0.28, 1 - h / WINDOW_HOURS);
}

function xForTime(dateISO, now) {
  const h = clamp((now - Date.parse(dateISO)) / 3.6e6, 0, WINDOW_HOURS);
  return VW - PAD - (h / WINDOW_HOURS) * (VW - PAD * 2); // most recent on the right
}
function yForSig(sig) {
  return VH - PAD - (clamp(sig, 0, 100) / 100) * (VH - PAD * 2);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Intensity of the winning story RELATIVE TO its family's other stories in the
// same visible window. This is NOT a time-series trend (we don't yet have the
// multi-day per-family history that would need), so the labels are honest about
// being a within-window intensity comparison, not "rising/falling over time".
function intensityFor(winner, familySignals) {
  const others = familySignals.filter((s) => s.id !== winner.id);
  if (!others.length) return 'typical';
  const avg = others.reduce((a, s) => a + s.significance, 0) / others.length;
  if (winner.significance > avg + 8) return 'standout';
  if (winner.significance < avg - 8) return 'lower';
  return 'typical';
}
const INTENSITY = {
  standout: { mark: '▲', label: 'Stands out' },
  typical: { mark: '▬', label: 'Typical' },
  lower: { mark: '▽', label: 'Lower intensity' },
};
const AREA_WORD = { product: 'product', market: 'market', research: 'research' };

// "Why it matters" — the CONSEQUENCE (from the shared editorial templates), not
// the scoring. Prefer the value computed at build time; fall back for old data.
function whyText(w) {
  return w.whyItMatters || whyItMatters(w);
}
// Separate, clearly-labelled "why the algorithm surfaced this" line.
function whySelected(w) {
  return `Day's strongest ${AREA_WORD[w.family] || w.family} move by our impact score — ${(IMPACT_LABEL[w.impact] || w.impact).toLowerCase()}, ${(VERIFICATION_LABEL[w.verification] || w.verification).toLowerCase()}, ${w.sourceCount} source${w.sourceCount === 1 ? '' : 's'}.`;
}

export function renderWaveforms(root, allSignals = [], waves = [], now = Date.now()) {
  if (!waves.length) {
    root.innerHTML = `<p class="empty-state">No waves to show yet — the signal feed is empty. This usually clears within a refresh cycle.</p>`;
    return;
  }

  const byFamily = { product: [], market: [], research: [] };
  for (const s of allSignals) {
    if (s.category === 'analysis' || s.category === 'general') continue;
    const fam = waves.find((w) => w.category === s.category)?.family
      || (s.category === 'research' ? 'research' : ['market', 'capital', 'compute', 'policy', 'orggov'].includes(s.category) ? 'market' : 'product');
    (byFamily[fam] ||= []).push(s);
  }

  root.innerHTML = waves.map((w, i) => {
    const f = FAMILY[w.family] || FAMILY.product;
    const points = (byFamily[w.family] || []).filter((s) => (now - Date.parse(s.dateISO)) / 3.6e6 <= WINDOW_HOURS);
    if (!points.some((p) => p.id === w.id)) points.push(w); // winner is always plotted even if outside the default window
    points.sort((a, b) => Date.parse(a.dateISO) - Date.parse(b.dateISO));

    const intensity = intensityFor(w, points);
    const iMeta = INTENSITY[intensity];
    const linePts = points.map((p) => `${xForTime(p.dateISO, now).toFixed(1)},${yForSig(p.significance).toFixed(1)}`).join(' ');
    const areaPts = `${PAD},${VH - PAD} ${linePts} ${VW - PAD},${VH - PAD}`;

    const markers = points.map((p) => {
      const isWinner = p.id === w.id;
      const x = xForTime(p.dateISO, now), y = yForSig(p.significance);
      const r = isWinner ? 6 : 3 + Math.min(p.sourceCount, 4) * 0.8;
      const op = freshnessOpacity(p.dateISO, now);
      return `<circle class="wf-point${isWinner ? ' wf-point-main' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${f.color}" opacity="${(isWinner ? 1 : op * 0.75).toFixed(2)}" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.title)}, significance ${p.significance}"><title>${esc(p.title)} — significance ${p.significance}, ${p.sourceCount} source${p.sourceCount === 1 ? '' : 's'}</title></circle>`;
    }).join('');

    return `
      <article class="wf-row wf-${esc(w.family)}" data-idx="${i}">
        <div class="wf-head">
          <span class="wf-fam"><span class="wf-mark" aria-hidden="true">${f.mark}</span>${esc(f.label)}</span>
          <span class="wf-trend wf-trend-${intensity}" title="Intensity vs. the other ${esc(w.family)} stories in this ${WINDOW_HOURS}h window — not a change over time">${iMeta.mark} ${esc(iMeta.label)}</span>
        </div>
        <svg class="wf-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${esc(f.label)}: ${esc(w.title)}, significance ${w.significance} of 100">
          <polygon class="wf-area" points="${areaPts}" fill="${f.color}" opacity="0.12"></polygon>
          <polyline class="wf-line" points="${linePts}" fill="none" stroke="${f.color}" stroke-width="1.6" opacity="0.55"></polyline>
          ${markers}
        </svg>
        <h3 class="wf-title">${esc(w.title)}</h3>
        ${w.summary ? `<p class="wf-summary-text">${esc(w.summary)}</p>` : ''}
        <p class="wf-why"><span class="wf-why-label">Why it matters</span> ${esc(whyText(w))}</p>
        <p class="wf-selected"><span class="wf-selected-label">Why selected</span> ${esc(whySelected(w))}</p>
        <div class="wf-meta">
          ${freshnessChip(w.dateISO, now)}
          ${verificationChip(w.verification)}
          <span class="wf-impact">${esc(IMPACT_LABEL[w.impact] || w.impact)}</span>
          <span class="wf-src">${w.sourceCount} source${w.sourceCount === 1 ? '' : 's'}</span>
          <a class="src-link" href="${esc(w.url)}" target="_blank" rel="noopener">Read original</a>
        </div>
        <button class="wf-more" aria-expanded="false">Sources &amp; follow-ups</button>
        <div class="wf-detail" hidden></div>
      </article>`;
  }).join('');

  root.querySelectorAll('.wf-row').forEach((rowEl, i) => {
    const w = waves[i];
    const btn = rowEl.querySelector('.wf-more');
    const detail = rowEl.querySelector('.wf-detail');
    btn.addEventListener('click', () => {
      const open = detail.hidden;
      detail.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Hide sources & follow-ups' : 'Sources & follow-ups';
      if (open && !detail.dataset.filled) {
        detail.dataset.filled = '1';
        detail.innerHTML = detailMarkup(w, now);
      }
    });
    rowEl.querySelectorAll('.wf-point').forEach((pt) => {
      pt.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!detail.hidden) return;
        btn.click();
      });
      pt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pt.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    });
  });
}

function detailMarkup(w, now) {
  const followUps = w.sourceCount > 1 ? `${w.sourceCount - 1} follow-up report${w.sourceCount - 1 === 1 ? '' : 's'}` : 'no follow-up reports yet';
  return `
    <div class="wf-detail-inner">
      <div class="wf-facts">
        <span><b>Published:</b> ${esc(new Date(w.dateISO).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }))} UTC (${esc(timeAgo(w.dateISO, now))})</span>
        <span><b>Follow-ups:</b> ${esc(followUps)}</span>
      </div>
      ${(w.sources || []).length ? `<div class="wf-sources"><b>All sources:</b> ${w.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="src-link">${esc(s.name)}</a>`).join(' · ')}</div>` : ''}
    </div>`;
}
