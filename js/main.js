// Orchestrator: loads data, renders every section, wires the time-range toggle
// and a silent periodic refresh. The site is fully functional with only
// latest.json; entities.json and history/ enrich it when present.
import { loadLatest, loadEntities, loadSnapshot, entityDelta, RANGE_DAYS } from './data.js';
import { createOceanMap } from './oceanmap.js';
import { renderWaves } from './waves.js';
import { renderRiver } from './river.js';
import { renderCurated, renderLive, animateBars } from './sections.js';
import { timeAgo, fmtSnapshot, $ } from './util.js';

const REFRESH_MS = 10 * 60 * 1000; // silent re-fetch cadence
let data = null;
let map = null;
let range = '24H';

function tickClock() {
  const el = $('#clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}

function paintUpdated() {
  if (!data) return;
  const pill = $('#snapshot-pill');
  if (pill) pill.textContent = 'Updated ' + timeAgo(data.updatedAt);
  const stocksAsof = $('#stocks-asof');
  if (stocksAsof) stocksAsof.textContent = fmtSnapshot(data.updatedAt);
}

async function applyRange(next) {
  range = next;
  document.querySelectorAll('.range-btn').forEach((b) => {
    const on = b.dataset.range === range;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  if (!map || !data) return;
  const snap = await loadSnapshot(RANGE_DAYS[range]);
  map.update({
    activity: data.entityActivity || {},
    delta: entityDelta(data.entityActivity, snap),
    rangeLabel: range,
    historyAvailable: !!snap,
  });
}

function renderDynamic() {
  renderLive(data);
  renderWaves($('#waves'), data.waves || []);
  renderRiver($('#river'), data.signals || []);
  animateBars();
  paintUpdated();
}

async function boot() {
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(paintUpdated, 30000);

  renderCurated(); // curated sections never change between loads

  let entities = null;
  try {
    [data, entities] = await Promise.all([loadLatest(), loadEntities()]);
  } catch (err) {
    console.error('[data] load failed', err);
    const banner = $('#data-note');
    if (banner) {
      banner.textContent = 'Live data failed to load (' + err.message + '). Run "npm run build" to generate data/latest.json, then reload.';
      banner.classList.add('show');
    }
    return;
  }

  renderDynamic();

  if (entities && $('#ocean-map')) {
    map = createOceanMap($('#ocean-map'), entities);
    document.querySelectorAll('.range-btn').forEach((b) =>
      b.addEventListener('click', () => applyRange(b.dataset.range))
    );
    await applyRange('24H');
  }

  // silent refresh — keeps an open tab from going stale without a reload
  setInterval(async () => {
    try {
      const fresh = await loadLatest();
      data = fresh;
      renderDynamic();
      await applyRange(range);
    } catch (err) {
      console.warn('[data] refresh skipped', err.message);
    }
  }, REFRESH_MS);
}

boot();
