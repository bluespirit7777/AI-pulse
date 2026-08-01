// Signal River — the dashboard's chronological stream, newest first.
//
// Deliberately minimal. This used to carry a full filter rig (category chips,
// a "More filters" disclosure, time windows, an entity dropdown, a combined
// quick-pick, an active-filter count and a clear button) plus per-row
// significance scores, source counts and verification chips. All of it is
// gone by request: the stream's job is to be the honest, scannable record of
// what crossed the wire, and the AI Summary Wave above it now carries the
// interpretation. What survives is the sort order, the category tag, the
// freshness chip, the headline, its description, and the archive control.
//
// The timeline dot survives too, but is now UNIFORM. It used to be sized by
// significance (12/16/20px), which only meant anything alongside the "dot size
// reflects significance" note that went with the filter rig — an unexplained
// three-size encoding would be worse than none.
//
// Merged duplicates are already collapsed upstream, so one row is one event.
import { esc } from './util.js';
import { freshnessChip } from './freshness.js';

const CAT_LABEL = {
  product: 'Product', research: 'Research', capital: 'Capital', market: 'Market',
  compute: 'Compute', policy: 'Policy', opensource: 'Open source', adoption: 'Adoption',
  orggov: 'Org/governance', analysis: 'Analysis', general: 'General',
};
const DEFAULT_VISIBLE = 16;
const EXPAND_STEP = 24;

export function renderRiver(root, signals = [], now = Date.now()) {
  if (!root) return;
  const sorted = signals.slice().sort((a, b) => Date.parse(b.dateISO) - Date.parse(a.dateISO));

  // `visible` is the only state left, and it deliberately resets on new data:
  // the list has changed length, so an old "show 40" offset means nothing.
  const state = { visible: DEFAULT_VISIBLE };

  root.innerHTML = `
    <div class="river-empty empty-state" hidden>No signals in the feed right now.</div>
    <ol class="river-list"></ol>
    <div class="river-more" hidden><button class="river-more-btn"></button></div>
  `;
  const list = root.querySelector('.river-list');
  const empty = root.querySelector('.river-empty');
  const moreWrap = root.querySelector('.river-more');
  const moreBtn = root.querySelector('.river-more-btn');

  function draw() {
    empty.hidden = sorted.length > 0;
    const shown = sorted.slice(0, state.visible);

    list.innerHTML = shown.map((s) => `
        <li class="river-item">
          <span class="river-dot" aria-hidden="true"></span>
          <div class="river-body">
            <div class="river-top">
              <span class="river-cat river-cat-${esc(s.category)}">${esc(CAT_LABEL[s.category] || s.category)}</span>
              ${freshnessChip(s.dateISO, now)}
            </div>
            <a class="river-title" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>
            ${s.desc ? `<p class="river-desc">${esc(s.desc)}</p>` : ''}
          </div>
        </li>`).join('');

    const remaining = sorted.length - shown.length;
    if (remaining > 0) {
      moreWrap.hidden = false;
      moreBtn.textContent = `Show ${Math.min(remaining, EXPAND_STEP)} more (${remaining} older signal${remaining === 1 ? '' : 's'} archived)`;
    } else if (state.visible > DEFAULT_VISIBLE && sorted.length > DEFAULT_VISIBLE) {
      moreWrap.hidden = false;
      moreBtn.textContent = 'Show fewer';
    } else {
      moreWrap.hidden = true;
    }
  }

  moreBtn.addEventListener('click', () => {
    state.visible = state.visible < sorted.length ? state.visible + EXPAND_STEP : DEFAULT_VISIBLE;
    draw();
  });

  draw();
}
