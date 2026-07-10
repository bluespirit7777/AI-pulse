// Signal River — time first, significance second (Priority 7). Sorted
// chronologically; dot size encodes significance but never reorders the
// list. Merged duplicates already collapsed upstream (sourceCount reflects
// corroboration — shown via a real verification chip, not a source-count
// proxy). Filterable by category, entity, and time window. Capped to the
// most recent items by default with an expand/archive control for the rest.
// Fully readable without any animation; on mobile it's just this same
// vertical list, no separate layout needed.
import { esc } from './util.js';
import { verificationChip, freshnessChip } from './freshness.js';

const CAT_LABEL = {
  product: 'Product', research: 'Research', capital: 'Capital', market: 'Market',
  compute: 'Compute', policy: 'Policy', opensource: 'Open source', adoption: 'Adoption',
  orggov: 'Org/governance', analysis: 'Analysis', general: 'General',
};
const TIME_WINDOWS = { all: null, '24H': 24, '7D': 24 * 7, '30D': 24 * 30 };
const DEFAULT_VISIBLE = 16;
const EXPAND_STEP = 24;

function sizeClass(sig) { return sig >= 70 ? 'big' : sig >= 45 ? 'mid' : 'sm'; }

export function renderRiver(root, signals = [], now = Date.now()) {
  const sorted = signals.slice().sort((a, b) => Date.parse(b.dateISO) - Date.parse(a.dateISO));
  const cats = ['all', ...Array.from(new Set(sorted.map((s) => s.category)))];
  const entityCounts = new Map();
  for (const s of sorted) for (const id of s.entityIds || []) entityCounts.set(id, (entityCounts.get(id) || 0) + 1);
  const topEntityIds = Array.from(entityCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);

  const state = { cat: 'all', entity: 'all', time: 'all', visible: DEFAULT_VISIBLE };

  root.innerHTML = `
    <div class="river-controls">
      <div class="river-filters river-filters-cat" role="tablist" aria-label="Filter by category"></div>
      <div class="river-filters river-filters-time" role="tablist" aria-label="Filter by time window"></div>
      <select class="river-entity-select" aria-label="Filter by entity"><option value="all">All entities</option></select>
    </div>
    <p class="river-count" id="river-count" aria-live="polite"></p>
    <div class="river-empty empty-state" hidden>No signals match these filters.</div>
    <ol class="river-list"></ol>
    <div class="river-more" hidden><button class="river-more-btn"></button></div>
  `;
  const catBar = root.querySelector('.river-filters-cat');
  const timeBar = root.querySelector('.river-filters-time');
  const entitySelect = root.querySelector('.river-entity-select');
  const list = root.querySelector('.river-list');
  const empty = root.querySelector('.river-empty');
  const countEl = root.querySelector('#river-count');
  const moreWrap = root.querySelector('.river-more');
  const moreBtn = root.querySelector('.river-more-btn');

  catBar.innerHTML = cats.map((c) =>
    `<button class="river-filter${c === 'all' ? ' active' : ''}" role="tab" aria-selected="${c === 'all'}" data-cat="${esc(c)}">${esc(c === 'all' ? 'All' : CAT_LABEL[c] || c)}</button>`
  ).join('');
  timeBar.innerHTML = Object.keys(TIME_WINDOWS).map((t) =>
    `<button class="river-filter${t === 'all' ? ' active' : ''}" role="tab" aria-selected="${t === 'all'}" data-time="${esc(t)}">${esc(t === 'all' ? 'Any time' : t)}</button>`
  ).join('');
  entitySelect.innerHTML += topEntityIds.map((id) => `<option value="${esc(id)}">${esc(id)} (${entityCounts.get(id)})</option>`).join('');

  function filtered() {
    return sorted.filter((s) => {
      if (state.cat !== 'all' && s.category !== state.cat) return false;
      if (state.entity !== 'all' && !(s.entityIds || []).includes(state.entity)) return false;
      const winHours = TIME_WINDOWS[state.time];
      if (winHours != null && (now - Date.parse(s.dateISO)) / 3.6e6 > winHours) return false;
      return true;
    });
  }

  function draw() {
    const rows = filtered();
    empty.hidden = rows.length > 0;
    const shown = rows.slice(0, state.visible);
    countEl.textContent = rows.length
      ? `Showing ${shown.length} of ${rows.length} signal${rows.length === 1 ? '' : 's'}, newest first.`
      : '';

    list.innerHTML = shown.map((s) => {
      const srcExtra = s.sourceCount > 1 ? `<span class="river-src">${s.sourceCount} sources</span>` : '';
      return `
        <li class="river-item">
          <span class="river-dot river-${sizeClass(s.significance)}" aria-hidden="true"></span>
          <div class="river-body">
            <div class="river-top">
              <span class="river-cat river-cat-${esc(s.category)}">${esc(CAT_LABEL[s.category] || s.category)}</span>
              ${freshnessChip(s.dateISO, now)}
              ${verificationChip(s.verification)}
            </div>
            <a class="river-title" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
            ${s.desc ? `<p class="river-desc">${esc(s.desc)}</p>` : ''}
            <div class="river-foot">${srcExtra}<span class="river-sig" title="Significance ${esc(String(s.significance))}/100">significance ${esc(String(s.significance))}</span></div>
          </div>
        </li>`;
    }).join('');

    const remaining = rows.length - shown.length;
    if (remaining > 0) {
      moreWrap.hidden = false;
      moreBtn.textContent = `Show ${Math.min(remaining, EXPAND_STEP)} more (${remaining} older signal${remaining === 1 ? '' : 's'} archived)`;
    } else if (state.visible > DEFAULT_VISIBLE && rows.length > DEFAULT_VISIBLE) {
      moreWrap.hidden = false;
      moreBtn.textContent = 'Show fewer';
    } else {
      moreWrap.hidden = true;
    }
  }

  function setActive(bar, attr, value) {
    bar.querySelectorAll('.river-filter').forEach((b) => {
      const on = b.dataset[attr] === value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
  }

  catBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.river-filter'); if (!btn) return;
    state.cat = btn.dataset.cat; state.visible = DEFAULT_VISIBLE;
    setActive(catBar, 'cat', state.cat); draw();
  });
  timeBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.river-filter'); if (!btn) return;
    state.time = btn.dataset.time; state.visible = DEFAULT_VISIBLE;
    setActive(timeBar, 'time', state.time); draw();
  });
  entitySelect.addEventListener('change', () => { state.entity = entitySelect.value; state.visible = DEFAULT_VISIBLE; draw(); });
  moreBtn.addEventListener('click', () => {
    const rows = filtered();
    state.visible = state.visible < rows.length ? state.visible + EXPAND_STEP : DEFAULT_VISIBLE;
    draw();
  });

  draw();
}
