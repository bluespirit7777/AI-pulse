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
const PRIMARY_CAT_COUNT = 3; // + "All" — the rest live behind "More filters"

function sizeClass(sig) { return sig >= 70 ? 'big' : sig >= 45 ? 'mid' : 'sm'; }

export function renderRiver(root, signals = [], now = Date.now(), entityNames = {}) {
  // readable label for an entity id (R8): "gpt" → "GPT". Falls back to the id.
  const entityLabel = (id) => entityNames[id] || id;
  const sorted = signals.slice().sort((a, b) => Date.parse(b.dateISO) - Date.parse(a.dateISO));
  const catCounts = new Map();
  for (const s of sorted) catCounts.set(s.category, (catCounts.get(s.category) || 0) + 1);
  const catsByFreq = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const primaryCats = ['all', ...catsByFreq.slice(0, PRIMARY_CAT_COUNT)];
  const secondaryCats = catsByFreq.slice(PRIMARY_CAT_COUNT);
  const entityCounts = new Map();
  for (const s of sorted) for (const id of s.entityIds || []) entityCounts.set(id, (entityCounts.get(id) || 0) + 1);
  const topEntityIds = Array.from(entityCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);

  const state = { cat: 'all', entity: 'all', time: 'all', visible: DEFAULT_VISIBLE };

  // Declutter (Phase 4): only "All" + the 3 most-used categories, plus a
  // single combined time/entity quick-pick, are visible by default. Every
  // other category, plus the full independent time-window and entity
  // controls, live in an accessible "More filters" disclosure — nothing is
  // removed, just relocated, and the full combination (any category AND any
  // time window AND any entity) still works exactly as before.
  root.innerHTML = `
    <div class="river-controls">
      <div class="river-filters river-filters-cat" role="tablist" aria-label="Filter by category"></div>
      <select class="river-quickpick" aria-label="Quick filter by time window or entity">
        <option value="">Time or entity…</option>
        <optgroup label="Time window"></optgroup>
        <optgroup label="Entity"></optgroup>
      </select>
      <button type="button" class="river-more-toggle" aria-expanded="false" aria-controls="river-filter-panel">More filters</button>
      <span class="river-active-count" id="river-active-count" hidden></span>
      <button type="button" class="river-clear" id="river-clear" hidden>Clear filters</button>
    </div>
    <div class="river-filter-panel" id="river-filter-panel" hidden>
      ${secondaryCats.length ? `<div class="river-panel-group"><span class="river-panel-h">More categories</span><div class="river-filters river-filters-cat2" role="tablist" aria-label="More category filters"></div></div>` : ''}
      <div class="river-panel-group">
        <span class="river-panel-h">Time window</span>
        <div class="river-filters river-filters-time" role="tablist" aria-label="Filter by time window"></div>
      </div>
      <div class="river-panel-group">
        <span class="river-panel-h">Entity</span>
        <select class="river-entity-select" aria-label="Filter by entity"><option value="all">All entities</option></select>
      </div>
    </div>
    <p class="river-count" id="river-count" aria-live="polite"></p>
    <div class="river-empty empty-state" hidden>No signals match these filters.</div>
    <ol class="river-list"></ol>
    <div class="river-more" hidden><button class="river-more-btn"></button></div>
  `;
  const catBar = root.querySelector('.river-filters-cat');
  const catBar2 = root.querySelector('.river-filters-cat2');
  const timeBar = root.querySelector('.river-filters-time');
  const entitySelect = root.querySelector('.river-entity-select');
  const quickPick = root.querySelector('.river-quickpick');
  const moreToggle = root.querySelector('.river-more-toggle');
  const filterPanel = root.querySelector('#river-filter-panel');
  const activeCountEl = root.querySelector('#river-active-count');
  const clearBtn = root.querySelector('#river-clear');
  const list = root.querySelector('.river-list');
  const empty = root.querySelector('.river-empty');
  const countEl = root.querySelector('#river-count');
  const moreWrap = root.querySelector('.river-more');
  const moreBtn = root.querySelector('.river-more-btn');

  const renderCatBtns = (bar, cats) => {
    if (!bar) return;
    bar.innerHTML = cats.map((c) =>
      `<button class="river-filter${c === 'all' ? ' active' : ''}" role="tab" aria-selected="${c === 'all'}" data-cat="${esc(c)}">${esc(c === 'all' ? 'All' : CAT_LABEL[c] || c)}</button>`
    ).join('');
  };
  renderCatBtns(catBar, primaryCats);
  renderCatBtns(catBar2, secondaryCats);
  timeBar.innerHTML = Object.keys(TIME_WINDOWS).map((t) =>
    `<button class="river-filter${t === 'all' ? ' active' : ''}" role="tab" aria-selected="${t === 'all'}" data-time="${esc(t)}">${esc(t === 'all' ? 'Any time' : t)}</button>`
  ).join('');
  // option VALUE stays the id (filtering is by id); the visible LABEL is the
  // readable entity name (R8).
  entitySelect.innerHTML += topEntityIds.map((id) => `<option value="${esc(id)}">${esc(entityLabel(id))} (${entityCounts.get(id)})</option>`).join('');
  const [quickTimeGroup, quickEntityGroup] = quickPick.querySelectorAll('optgroup');
  quickTimeGroup.innerHTML = Object.keys(TIME_WINDOWS).filter((t) => t !== 'all').map((t) => `<option value="time:${esc(t)}">${esc(t)}</option>`).join('');
  quickEntityGroup.innerHTML = topEntityIds.map((id) => `<option value="entity:${esc(id)}">${esc(entityLabel(id))}</option>`).join('');

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

  function setActive(bars, attr, value) {
    for (const bar of bars) {
      if (!bar) continue;
      bar.querySelectorAll('.river-filter').forEach((b) => {
        const on = b.dataset[attr] === value;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
    }
  }

  // Active-filter count + "Clear filters" (Phase 4): reflects every filter
  // that's currently narrowing the list, whichever control set it.
  function syncFilterStatus() {
    const active = [state.cat !== 'all', state.entity !== 'all', state.time !== 'all'].filter(Boolean).length;
    if (active > 0) {
      activeCountEl.hidden = false;
      activeCountEl.textContent = `${active} filter${active === 1 ? '' : 's'} active`;
      clearBtn.hidden = false;
    } else {
      activeCountEl.hidden = true;
      clearBtn.hidden = true;
    }
    quickPick.value = state.time !== 'all' ? `time:${state.time}` : state.entity !== 'all' ? `entity:${state.entity}` : '';
  }

  function apply() {
    state.visible = DEFAULT_VISIBLE;
    setActive([catBar, catBar2], 'cat', state.cat);
    setActive([timeBar], 'time', state.time);
    entitySelect.value = state.entity;
    syncFilterStatus();
    draw();
  }

  catBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.river-filter'); if (!btn) return;
    state.cat = btn.dataset.cat; apply();
  });
  catBar2?.addEventListener('click', (e) => {
    const btn = e.target.closest('.river-filter'); if (!btn) return;
    state.cat = btn.dataset.cat; apply();
  });
  timeBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.river-filter'); if (!btn) return;
    state.time = btn.dataset.time; apply();
  });
  entitySelect.addEventListener('change', () => { state.entity = entitySelect.value; apply(); });

  // The single combined quick-pick: one control, but it still just sets the
  // same independent state.time/state.entity fields the full panel controls
  // use — nothing is lost, it's a shortcut, not a separate filtering model.
  quickPick.addEventListener('change', () => {
    const [kind, val] = quickPick.value.split(':');
    if (kind === 'time') { state.time = val; state.entity = 'all'; }
    else if (kind === 'entity') { state.entity = val; state.time = 'all'; }
    else { state.time = 'all'; state.entity = 'all'; }
    apply();
  });

  moreToggle.addEventListener('click', () => {
    const open = filterPanel.hidden;
    filterPanel.hidden = !open;
    moreToggle.setAttribute('aria-expanded', String(open));
    moreToggle.textContent = open ? 'Fewer filters' : 'More filters';
  });

  clearBtn.addEventListener('click', () => {
    state.cat = 'all'; state.entity = 'all'; state.time = 'all';
    apply();
  });

  moreBtn.addEventListener('click', () => {
    const rows = filtered();
    state.visible = state.visible < rows.length ? state.visible + EXPAND_STEP : DEFAULT_VISIBLE;
    draw();
  });

  syncFilterStatus();
  draw();
}
