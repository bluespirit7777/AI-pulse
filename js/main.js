// Orchestrator: loads data, renders every section, wires the time-range toggle
// and a silent periodic refresh. The site is fully functional with only
// latest.json; entities.json and range.json enrich it when present.
import { loadLatest, loadEntities, loadRanges } from './data.js';
import { createOceanMap } from './oceanmap.js';
import { renderWaveforms } from './waveform.js';
import { renderRiver } from './river.js';
import { renderTide } from './tide.js';
import { renderCurated, renderLive, animateBars } from './sections.js';
import { timeAgo, fmtSnapshot, $ } from './util.js';

const REFRESH_MS = 10 * 60 * 1000; // silent re-fetch cadence
let data = null;
let ranges = null;
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

function paintHistoryNote() {
  const el = $('#history-note');
  if (!el) return;
  if (!ranges) { el.textContent = ''; return; }
  const days = ranges.historyDepthDays;
  el.textContent = days < 1
    ? 'Range history just started collecting — comparisons will appear as data accumulates.'
    : `${days} day${days === 1 ? '' : 's'} of range history collected so far.`;
}

function applyRange(next) {
  range = next;
  document.querySelectorAll('.range-btn').forEach((b) => {
    const on = b.dataset.range === range;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  if (!map) return;
  const r = ranges?.ranges?.[range];
  map.update({
    activity: r?.entityActivity || data.entityActivity || {},
    delta: r?.entityDelta || {},
    rangeLabel: range,
    historyAvailable: !!r?.previousWindowComplete,
  });
}

function renderDynamic() {
  renderLive(data);
  renderWaveforms($('#waves'), data.signals || [], data.waves || []);
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
    [data, entities, ranges] = await Promise.all([loadLatest(), loadEntities(), loadRanges()]);
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
  paintHistoryNote();
  renderTide($('#tide'), ranges);

  if (entities && $('#ocean-map')) {
    map = createOceanMap($('#ocean-map'), entities);
    document.querySelectorAll('.range-btn').forEach((b) =>
      b.addEventListener('click', () => applyRange(b.dataset.range))
    );
    applyRange('24H');
  }

  // silent refresh — keeps an open tab from going stale without a reload
  setInterval(async () => {
    try {
      const [fresh, freshRanges] = await Promise.all([loadLatest(), loadRanges()]);
      data = fresh;
      ranges = freshRanges;
      renderDynamic();
      paintHistoryNote();
      renderTide($('#tide'), ranges);
      applyRange(range);
    } catch (err) {
      console.warn('[data] refresh skipped', err.message);
    }
  }, REFRESH_MS);
}

boot();
