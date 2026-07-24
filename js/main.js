// Orchestrator: loads data, renders every section, wires the time-range toggle
// and a silent periodic refresh. The site is fully functional with only
// latest.json; entities.json and range.json enrich it when present.
import { loadLatest, loadEntities, loadRanges, loadStockNetwork, loadYouTubeTrending, loadLaunchRadar } from './data.js';
import { createOceanMap } from './oceanmap.js';
import { renderWaveforms } from './waveform.js';
import { renderRiver } from './river.js';
import { renderTide } from './tide.js';
import { renderCommunity } from './community.js';
import { createStockNetwork } from './stocknetwork.js';
import { renderCurated, renderLive, animateBars, renderYouTubeTrending } from './sections.js';
import { renderDataHealth } from './datahealth.js';
import { renderLaunchRadar } from './launchradar.js';
import { initNav, notifyDataReady } from './nav.js';
import { timeAgo, fmtSnapshot, $ } from './util.js';

const REFRESH_MS = 10 * 60 * 1000; // silent re-fetch cadence
let data = null;
let ranges = null;
let map = null;
let range = '24H';
let entityNameById = {}; // id → readable name for the river entity filter (R8)

function tickClock() {
  const el = $('#clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}

// Ticker pause/play toggle for keyboard + touch users. Hover/focus pausing is
// pure CSS; this button gives an explicit control. Toggling .is-paused only
// pauses animation-play-state, so position is preserved (never restarts).
function wireTickerToggle() {
  const wrap = $('.ticker-wrap');
  const btn = $('#ticker-toggle');
  if (!wrap || !btn) return;
  btn.addEventListener('click', () => {
    const paused = wrap.classList.toggle('is-paused');
    btn.textContent = paused ? '▶' : '❚❚';
    btn.setAttribute('aria-pressed', String(paused));
    btn.setAttribute('aria-label', paused ? 'Play the headline ticker' : 'Pause the headline ticker');
  });
}

function paintUpdated() {
  if (!data) return;
  const pill = $('#snapshot-pill');
  if (pill) pill.textContent = 'Updated ' + timeAgo(data.updatedAt);
  const stocksAsof = $('#stocks-asof');
  if (stocksAsof) stocksAsof.textContent = fmtSnapshot(data.updatedAt);
  // build provenance (R10): which commit produced the live data
  const build = $('#footer-build');
  if (build && data.build) {
    const b = data.build;
    const repo = 'https://github.com/bluespirit7777/AI-pulse';
    build.innerHTML = b.sha
      ? `Build <a class="src-link" href="${repo}/commit/${b.sha}" target="_blank" rel="noopener">${b.shortSha}</a> · data generated ${fmtSnapshot(b.builtAt)}`
      : `Build ${b.shortSha} · data generated ${fmtSnapshot(b.builtAt)}`;
  }
  renderDataHealth($('#dh-chip'), $('#dh-drawer'), data.dataHealth, data.build);
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
    signals: data.signals || [],
  });
}

function renderDynamic() {
  renderLive(data);
  renderWaveforms($('#waves'), data.signals || [], data.waves || []);
  renderRiver($('#river'), data.signals || [], Date.now(), entityNameById);
  renderCommunity($('#community'), data.community || {});
  animateBars();
  paintUpdated();
}

async function boot() {
  tickClock();
  setInterval(tickClock, 1000);
  wireTickerToggle();
  initNav();
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
    notifyDataReady(); // don't leave a pending deep-link scroll waiting forever
    return;
  }

  if (entities?.nodes) entityNameById = Object.fromEntries(entities.nodes.map((n) => [n.id, n.name]));

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

  notifyDataReady(); // finishes any deep-link scroll that was waiting on real content

  // AI stock network (independent load — a failure here doesn't block the rest of the page)
  loadStockNetwork().then((net) => {
    if ($('#stock-network')) createStockNetwork($('#stock-network'), net);
  }).catch((err) => console.warn('[stocknet] load skipped', err.message));

  // YouTube trending videos for the release-card flip side (independent load,
  // refreshed twice daily). renderYouTubeTrending handles a null/missing
  // result itself — swaps the initial "Loading…" state for an honest
  // "unavailable" one rather than leaving it stuck on "Loading" forever.
  loadYouTubeTrending().then(renderYouTubeTrending)
    .catch((err) => { console.warn('[youtube] load skipped', err.message); renderYouTubeTrending(null); });

  // Launch Radar — newest model-hub uploads + SDK releases (independent load,
  // refreshed on its own fast cron). renderLaunchRadar hides the panel itself
  // if the data is missing, so a failure here is silent, not a broken block.
  loadLaunchRadar().then((radar) => renderLaunchRadar($('#launch-radar'), radar))
    .catch((err) => console.warn('[radar] load skipped', err.message));

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
      loadLaunchRadar().then((radar) => renderLaunchRadar($('#launch-radar'), radar)).catch(() => {});
    } catch (err) {
      console.warn('[data] refresh skipped', err.message);
    }
  }, REFRESH_MS);
}

boot();
