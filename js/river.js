// Signal River — a significance-weighted chronological stream. Merged duplicates
// already collapsed upstream (sourceCount reflects corroboration). Larger dots =
// more significant. Filterable by category. On mobile it reads as a clean
// vertical timeline. Fully readable without any animation.
import { esc } from './util.js';
import { confidenceChip, freshnessChip } from './freshness.js';

const CAT_LABEL = {
  product: 'Product', research: 'Research', capital: 'Capital', market: 'Market',
  compute: 'Compute', policy: 'Policy', opensource: 'Open source', adoption: 'Adoption',
};

export function renderRiver(root, signals = [], now = Date.now()) {
  const cats = ['all', ...Array.from(new Set(signals.map((s) => s.category)))];
  const state = { cat: 'all' };

  root.innerHTML = `
    <div class="river-filters" role="tablist" aria-label="Filter signals by category"></div>
    <div class="river-empty empty-state" hidden>No signals in this category right now.</div>
    <ol class="river-list"></ol>
  `;
  const filterBar = root.querySelector('.river-filters');
  const list = root.querySelector('.river-list');
  const empty = root.querySelector('.river-empty');

  filterBar.innerHTML = cats.map((c) =>
    `<button class="river-filter${c === 'all' ? ' active' : ''}" role="tab" aria-selected="${c === 'all'}" data-cat="${esc(c)}">${esc(c === 'all' ? 'All' : CAT_LABEL[c] || c)}</button>`
  ).join('');

  function sizeClass(sig) { return sig >= 70 ? 'big' : sig >= 45 ? 'mid' : 'sm'; }

  function draw() {
    const rows = signals.filter((s) => state.cat === 'all' || s.category === state.cat);
    empty.hidden = rows.length > 0;
    list.innerHTML = rows.map((s) => {
      const srcExtra = s.sourceCount > 1 ? `<span class="river-src">${s.sourceCount} sources</span>` : '';
      return `
        <li class="river-item">
          <span class="river-dot river-${sizeClass(s.significance)}" aria-hidden="true"></span>
          <div class="river-body">
            <div class="river-top">
              <span class="river-cat river-cat-${esc(s.category)}">${esc(CAT_LABEL[s.category] || s.category)}</span>
              ${freshnessChip(s.dateISO, now)}
              ${s.sourceCount >= 2 ? confidenceChip(s.confidence) : ''}
            </div>
            <a class="river-title" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
            ${s.desc ? `<p class="river-desc">${esc(s.desc)}</p>` : ''}
            <div class="river-foot">${srcExtra}<span class="river-sig" title="Significance ${esc(String(s.significance))}/100">significance ${esc(String(s.significance))}</span></div>
          </div>
        </li>`;
    }).join('');
  }

  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.river-filter');
    if (!btn) return;
    state.cat = btn.dataset.cat;
    filterBar.querySelectorAll('.river-filter').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    draw();
  });

  draw();
}
