// Today's Three Strongest Waves — one representative story per family, chosen
// by the deterministic significance score (see docs/METHODOLOGY.md), NOT just
// the three newest. Each card answers what/why/how-fresh/how-corroborated.
import { esc, timeAgo } from './util.js';
import { confidenceChip, freshnessChip, sourceChip } from './freshness.js';

const FAMILY = {
  product: { label: 'Product wave', mark: '◆', blurb: 'Shipping, adoption & open weights' },
  market: { label: 'Market wave', mark: '▲', blurb: 'Capital, compute & regulation' },
  research: { label: 'Research wave', mark: '✦', blurb: 'New capabilities from the lab' },
};

// Significance magnitude — deliberately worded differently from the confidence
// tier ("… signal") so the two chips never read as contradictory.
function strength(sig) {
  if (sig >= 70) return 'High impact';
  if (sig >= 45) return 'Notable';
  return 'Emerging';
}

export function renderWaves(root, waves = [], now = Date.now()) {
  if (!waves.length) {
    root.innerHTML = `<p class="empty-state">No waves to show yet — the signal feed is empty. This usually clears within a refresh cycle.</p>`;
    return;
  }
  root.innerHTML = waves.map((w) => {
    const f = FAMILY[w.family] || FAMILY.product;
    const srcs = (w.sources || []).slice(0, 3);
    return `
      <article class="wave-card wave-${esc(w.family)}">
        <div class="wave-head">
          <span class="wave-fam"><span class="wave-mark" aria-hidden="true">${f.mark}</span>${esc(f.label)}</span>
          <span class="wave-cat">${esc(w.category)}</span>
        </div>
        <h3 class="wave-title">${esc(w.title)}</h3>
        <p class="wave-sum">${esc(w.summary || '')}</p>
        <div class="wave-meta">
          ${freshnessChip(w.dateISO, now)}
          ${confidenceChip(w.confidence)}
          <span class="wave-strength" title="Significance score ${esc(String(w.significance))}/100">${esc(strength(w.significance))}</span>
        </div>
        <div class="wave-src">
          <span class="wave-srccount">${w.sourceCount} source${w.sourceCount === 1 ? '' : 's'}</span>
          <a href="${esc(w.url)}" target="_blank" rel="noopener" class="src-link">Read original</a>
        </div>
      </article>`;
  }).join('');
}
