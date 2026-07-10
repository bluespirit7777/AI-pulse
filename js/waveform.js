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
import { confidenceChip, freshnessChip } from './freshness.js';
import { VERIFICATION_LABEL, IMPACT_LABEL } from '../scripts/lib/signals.mjs';

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

function trendFor(winner, familySignals) {
  const others = familySignals.filter((s) => s.id !== winner.id);
  if (!others.length) return 'steady';
  const avg = others.reduce((a, s) => a + s.significance, 0) / others.length;
  if (winner.significance > avg + 8) return 'strengthening';
  if (winner.significance < avg - 8) return 'weakening';
  return 'steady';
}
const TREND_MARK = { strengthening: '↗', weakening: '↘', steady: '→' };

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

    const trend = trendFor(w, points);
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
      <article class="wf-row" data-idx="${i}">
        <div class="wf-head">
          <span class="wf-fam"><span class="wf-mark" aria-hidden="true">${f.mark}</span>${esc(f.label)}</span>
          <span class="wf-trend wf-trend-${trend}" title="${esc(trend)} vs. other ${esc(w.family)} stories in this window">${TREND_MARK[trend]} ${esc(trend)}</span>
        </div>
        <svg class="wf-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${esc(f.label)}: ${esc(w.title)}, significance ${w.significance} of 100">
          <polygon class="wf-area" points="${areaPts}" fill="${f.color}" opacity="0.12"></polygon>
          <polyline class="wf-line" points="${linePts}" fill="none" stroke="${f.color}" stroke-width="1.6" opacity="0.55"></polyline>
          ${markers}
        </svg>
        <button class="wf-summary" aria-expanded="false">
          <span class="wf-title">${esc(w.title)}</span>
          <span class="wf-meta">${freshnessChip(w.dateISO, now)} ${confidenceChip(w.verification === 'analysis' ? 'early' : w.sourceCount >= 3 ? 'strong' : w.sourceCount === 2 ? 'moderate' : 'early')} <span class="wf-impact">${esc(IMPACT_LABEL[w.impact] || w.impact)}</span></span>
        </button>
        <div class="wf-detail" hidden></div>
      </article>`;
  }).join('');

  root.querySelectorAll('.wf-row').forEach((rowEl, i) => {
    const w = waves[i];
    const btn = rowEl.querySelector('.wf-summary');
    const detail = rowEl.querySelector('.wf-detail');
    btn.addEventListener('click', () => {
      const open = detail.hidden;
      detail.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
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
      <p class="wf-why"><b>Why it matters:</b> ${esc(w.summary || w.title)}</p>
      <div class="wf-facts">
        <span><b>Verification:</b> ${esc(VERIFICATION_LABEL[w.verification] || w.verification)}</span>
        <span><b>Impact:</b> ${esc(IMPACT_LABEL[w.impact] || w.impact)}</span>
        <span><b>Published:</b> ${esc(new Date(w.dateISO).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }))} UTC (${esc(timeAgo(w.dateISO, now))})</span>
        <span><b>Follow-ups:</b> ${esc(followUps)}</span>
      </div>
      ${(w.sources || []).length ? `<div class="wf-sources"><b>Sources:</b> ${w.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" class="src-link">${esc(s.name)}</a>`).join(' · ')}</div>` : ''}
      <a class="src-link wf-read" href="${esc(w.url)}" target="_blank" rel="noopener">Read original →</a>
    </div>`;
}
