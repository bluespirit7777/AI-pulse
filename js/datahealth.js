// Data Health control — a compact footer chip that opens a drawer showing
// the pipeline's own completeness: feed success rate, stock/community
// coverage, history depth, how many datasets are estimates rather than exact
// counts, the build SHA, and when data last updated successfully. Separate
// from the content itself so a reader can tell "is this fresh and complete"
// without digging through build logs. Mirrors the stocknetwork.js drawer
// pattern (focus trap, Escape to close, restore focus on close).
import { esc, timeAgo, fmtSnapshot } from './util.js';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

// This module is re-entered every 30s by main.js's paintUpdated(), but the
// chip is wired exactly once. The drawer's contents must therefore come from
// module-level state that each call refreshes — a closure over the `health`
// argument would freeze the drawer at whatever the FIRST call saw, while the
// chip beside it kept updating.
let latest = { health: null, build: null };
let lastFocused = null;

export function renderDataHealth(chipEl, drawerEl, health, build) {
  if (!chipEl || !drawerEl || !health) return;
  latest = { health, build };

  const allFeedsOk = health.feedsSucceeded >= health.feedsConfigured;
  chipEl.hidden = false;
  chipEl.innerHTML = `<span class="dh-dot ${allFeedsOk ? 'dh-dot--ok' : 'dh-dot--warn'}"></span>Data Health · ${health.feedsSucceeded}/${health.feedsConfigured} feeds`;

  function openDrawer() {
    const { health, build } = latest;
    if (!health) return;
    lastFocused = document.activeElement;
    const repo = 'https://github.com/bluespirit7777/AI-pulse';
    drawerEl.innerHTML = `
      <div class="drawer-inner">
        <button class="drawer-close" aria-label="Close details">✕</button>
        <div class="drawer-eyebrow">Pipeline status</div>
        <h3 id="dh-drawer-title">Data Health</h3>
        <dl class="dh-facts">
          <div><dt>RSS/YouTube feeds</dt><dd>${health.feedsSucceeded} / ${health.feedsConfigured} succeeded</dd></div>
          <div><dt>Stock nodes available</dt><dd>${fmt(health.stockNodesAvailable)}</dd></div>
          <div><dt>Community models available</dt><dd>${fmt(health.communityModelsAvailable)}</dd></div>
          <div><dt>History depth</dt><dd>${health.historyDepthDays}d</dd></div>
          <div><dt>Estimated datasets</dt><dd>${fmt(health.estimatedDatasets)} of ${fmt(health.communityModelsAvailable)}</dd></div>
          <div><dt>Last successful update</dt><dd>${esc(timeAgo(health.lastSuccessfulUpdate))}</dd></div>
        </dl>
        <p class="dh-note">
          Build ${build?.sha ? `<a class="src-link" href="${repo}/commit/${esc(build.sha)}" target="_blank" rel="noopener">${esc(health.buildSha)}</a>` : esc(health.buildSha)}
          · data generated ${esc(fmtSnapshot(health.lastSuccessfulUpdate))}<br>
          "Estimated datasets" are Community Pulse models whose discussion count is scaled from a partial sample rather than an exact paginated count — see the coverage figure in each model's panel.
        </p>
      </div>`;
    drawerEl.hidden = false;
    document.body.classList.add('drawer-open');
    // preventScroll — see the same call in js/oceanmap.js.
    drawerEl.querySelector('.drawer-close').focus({ preventScroll: true });
    drawerEl.querySelector('.drawer-close').addEventListener('click', closeDrawer);
  }

  // Backdrop dismiss. Bound once alongside the chip (see below) rather than
  // per-open: the drawer element outlives every open/close cycle, so adding an
  // anonymous listener on each open accumulated one more handler every time.
  function onDrawerBackdrop(e) { if (e.target === drawerEl) closeDrawer(); }

  function onDrawerKey(e) {
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'Tab') {
      const f = drawerEl.querySelectorAll('button, a[href]');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function closeDrawer() {
    drawerEl.hidden = true;
    document.body.classList.remove('drawer-open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  if (!chipEl.dataset.wired) {
    chipEl.dataset.wired = '1';
    chipEl.addEventListener('click', openDrawer);
    drawerEl.addEventListener('keydown', onDrawerKey);
    drawerEl.addEventListener('click', onDrawerBackdrop);
  }
}
