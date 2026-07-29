// Landing page (index.html) controller.
//
// The landing page is a *preview* of the dashboard, so every figure on it is
// pulled from the same sources app.html uses — data/latest.json for the live
// panels, js/curated.js for the hand-maintained ones. Nothing here hardcodes a
// model name, score or price: if a number appears on this page, it came from
// the pipeline or from the curated tables, and it carries the same provenance
// label ("Live" / "Curated" + snapshot date) that the dashboard shows.
//
// Graceful degradation is the rule (see the site's caveats): a failed
// latest.json fetch leaves the curated sections fully rendered and swaps the
// live ones for an honest unavailable state, never a stale or invented figure.
import { loadLatest } from './data.js';
import {
  leaderboardOverall, LEADERBOARD_SNAPSHOT, LEADERBOARD_OVERALL_DISCLAIMER,
  imageAI, videoAI, localAI, marketShare, CURATED_ASOF,
} from './curated.js';
import { esc, $, $$, timeAgo, fmtSnapshot, prefersReducedMotion } from './util.js';

// Same labels the dashboard's river uses, so a category reads identically on
// both pages.
const CAT_LABEL = {
  product: 'Product', research: 'Research', capital: 'Capital', market: 'Market',
  compute: 'Compute', policy: 'Policy', opensource: 'Open source', adoption: 'Adoption',
  orggov: 'Org/governance', analysis: 'Analysis', general: 'General',
};

const PREVIEW_ROWS = 5; // how many rows each preview list shows before "open the full view"

// ---------------------------------------------------------------- rendering

// One row of a mini list. `value` is rendered as-is into a tabular-nums cell,
// so callers pass an already-formatted string (score, price range, "—").
function row({ lead, name, sub, value }) {
  return `<div class="r">
    <span class="n">${esc(lead)}</span>
    <span class="nm">${esc(name)}${sub ? `<em>${esc(sub)}</em>` : ''}</span>
    <span class="v">${esc(value)}</span>
  </div>`;
}

function paintMini(el, rows, emptyMessage) {
  if (!el) return;
  el.innerHTML = rows.length
    ? rows.map(row).join('')
    : `<p class="empty">${esc(emptyMessage)}</p>`;
}

function paintMeta(el, parts) {
  if (!el) return;
  el.innerHTML = parts.filter(Boolean).map(esc).join('<s></s>');
}

const rank = (i) => String(i + 1).padStart(2, '0');

// ------------------------------------------------------- curated (immediate)
// These come from static imports, so they render on first paint with no fetch
// and can never show an unavailable state.

function renderMarketShare() {
  const el = $('#lp-share');
  if (!el) return;
  // Bars are scaled against the largest share rather than 100% so the smaller
  // assistants stay visible; the number beside each bar is the real figure.
  const max = Math.max(...marketShare.map((r) => r.pct));
  el.innerHTML = marketShare.map((r) => `
    <div class="bar">
      <span>${esc(r.name)}</span>
      <span class="track"><span class="fill" data-w="${((r.pct / max) * 100).toFixed(1)}"></span></span>
      <span class="v">${esc(r.pct.toFixed(1))}%</span>
    </div>`).join('');
  paintMeta($('#lp-share-meta'), ['Curated snapshot · ' + CURATED_ASOF, 'Similarweb', 'Cloudflare Radar']);
}

function renderLeaderboards() {
  // Text: the dashboard's "Overall balance" view — a published 0–100 index,
  // shown with the same editorial-synthesis disclaimer it carries there.
  paintMini($('#lp-lb-text'), leaderboardOverall.slice(0, PREVIEW_ROWS).map((m, i) => ({
    lead: rank(i), name: m.model, sub: m.org, value: m.score + (m.scoreUnit || ''),
  })), 'Rankings unavailable.');

  paintMini($('#lp-lb-image'), imageAI.slice(0, PREVIEW_ROWS).map((m, i) => ({
    lead: rank(i), name: m.model, sub: m.org, value: m.score + (m.scoreUnit || ''),
  })), 'Rankings unavailable.');

  // Video and local have no single published numeric score in the curated
  // tables, so they show their qualitative `stat` instead of a number we'd
  // have to invent to fill the column.
  paintMini($('#lp-lb-video'), videoAI.slice(0, PREVIEW_ROWS).map((m, i) => ({
    lead: rank(i), name: m.model, sub: m.org, value: m.stat || '—',
  })), 'Rankings unavailable.');

  paintMini($('#lp-lb-local'), localAI.slice(0, PREVIEW_ROWS).map((m, i) => ({
    lead: rank(i), name: m.model, sub: m.org, value: m.stat || '—',
  })), 'Rankings unavailable.');

  paintMeta($('#lp-lb-meta'), [
    'Curated · ' + LEADERBOARD_SNAPSHOT,
    'Artificial Analysis · SWE-bench Verified',
    LEADERBOARD_OVERALL_DISCLAIMER,
  ]);
}

// ---------------------------------------------------------- live (from fetch)

function renderTicker(data) {
  const el = $('#lp-ticker');
  if (!el) return;
  const items = (data?.signals || [])
    .slice()
    .sort((a, b) => (b.significance || 0) - (a.significance || 0))
    .slice(0, 12)
    .map((s) => ({ text: s.title, value: String(s.significance ?? '') }));
  if (!items.length) { el.innerHTML = ''; return; }
  // Duplicated once because the marquee translates by -50%: the second copy is
  // what occupies the viewport while the first scrolls out, so the loop has no
  // visible seam.
  el.innerHTML = [...items, ...items].map((it) =>
    `<span class="it"><s></s>${esc(it.text)}${it.value ? ` <b>${esc(it.value)}</b>` : ''}</span>`
  ).join('');
  el.classList.add('go');
}

function renderSurface(data) {
  const signals = data?.signals || [];
  const waves = data?.waves || [];

  paintMini($('#lp-waves'), waves.slice(0, 3).map((w, i) => ({
    lead: rank(i),
    name: w.title,
    sub: CAT_LABEL[w.category] || w.category,
    value: String(w.significance ?? '—'),
  })), 'Today’s wire is still being collected.');

  // River = the newest items by publication time, mirroring the dashboard's
  // chronological stream.
  const newest = signals.slice().sort((a, b) => Date.parse(b.dateISO) - Date.parse(a.dateISO));
  paintMini($('#lp-river'), newest.slice(0, 3).map((s) => ({
    lead: '·',
    name: s.title,
    sub: (CAT_LABEL[s.category] || s.category) + (s.sourceCount > 1 ? ` · ${s.sourceCount} sources` : ''),
    value: timeAgo(s.dateISO) || '—',
  })), 'Today’s wire is still being collected.');

  // Tide = how today's volume splits across categories.
  const counts = new Map();
  signals.forEach((s) => counts.set(s.category, (counts.get(s.category) || 0) + 1));
  const byCount = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  paintMini($('#lp-tide'), byCount.slice(0, 3).map(([cat, n]) => ({
    lead: '·',
    name: CAT_LABEL[cat] || cat,
    sub: `${((n / signals.length) * 100).toFixed(0)}% of today’s signals`,
    value: String(n),
  })), 'Today’s wire is still being collected.');

  paintMeta($('#lp-surface-meta'), [
    signals.length ? `Live · ${signals.length} signals` : 'Live',
    byCount.length ? `${byCount.length} categories today` : null,
    data?.updatedAt ? 'Updated ' + timeAgo(data.updatedAt) : null,
  ]);
}

function renderCompute(data) {
  const rows = data?.compute || [];
  paintMini($('#lp-compute'), rows.slice(0, PREVIEW_ROWS).map((c) => ({
    lead: '·', name: c.chip, sub: c.segment, value: c.rate,
  })), 'Marketplace rates unavailable right now.');
  paintMeta($('#lp-compute-meta'), [
    rows.length ? 'Live' : null,
    'Vast.ai · RunPod',
    data?.updatedAt ? fmtSnapshot(data.updatedAt) : null,
  ]);
}

// When latest.json can't be loaded, say so in each live panel rather than
// leaving three empty boxes that read as "nothing happened today".
function renderLiveUnavailable() {
  const msg = 'Live data is temporarily unavailable — the dashboard has the full picture.';
  ['#lp-waves', '#lp-river', '#lp-tide', '#lp-compute'].forEach((sel) => paintMini($(sel), [], msg));
  paintMeta($('#lp-surface-meta'), ['Live data unavailable']);
  paintMeta($('#lp-compute-meta'), ['Live data unavailable']);
}

// ------------------------------------------------------------- interactions

function wireClock() {
  const el = $('#lp-clock');
  const day = $('#lp-today');
  if (day) {
    day.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }
  if (!el) return;
  const tick = () => { el.textContent = new Date().toISOString().slice(11, 19); };
  tick();
  setInterval(tick, 1000);
}

// Tab groups. Panes use the `hidden` attribute (not a class) so a pane that is
// off-screen is genuinely removed from the accessibility tree.
function wireTabs() {
  $$('.tabs').forEach((group) => {
    const panes = group.parentElement.querySelector('[data-panes]');
    if (!panes) return;
    const buttons = $$('button[data-tab]', group);
    const select = (btn) => {
      buttons.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      $$('.pane', panes).forEach((p) => { p.hidden = p.dataset.pane !== btn.dataset.tab; });
    };
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (btn) select(btn);
    });
    // Arrow-key navigation, as expected of a real tablist.
    group.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = buttons.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      next.focus();
      select(next);
    });
  });
}

// Reveal-on-scroll. Note the setTimeout backstop: requestAnimationFrame never
// fires in this project's automated test browser, and an IntersectionObserver
// that somehow never delivers would otherwise leave the page invisible. The
// backstop guarantees content is shown either way.
function wireReveal() {
  document.documentElement.classList.add('js');
  const targets = $$('.rv');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  targets.forEach((el) => {
    io.observe(el);
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in');
  });
  setTimeout(() => targets.forEach((el) => el.classList.add('in')), 1400);
}

// Bar fills animate in on scroll; same setTimeout backstop as above so the
// real percentages are always applied even if the observer never fires.
function wireBars() {
  const apply = () => $$('.fill').forEach((f, i) => {
    setTimeout(() => { f.style.width = f.dataset.w + '%'; }, i * 90);
  });
  const bars = $('#lp-share');
  if (bars) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { apply(); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(bars);
  }
  setTimeout(() => $$('.fill').forEach((f) => {
    if (!f.style.width) f.style.width = f.dataset.w + '%';
  }), 1600);
}

// Hero video. preload="none" in the markup plus this opt-in means the 1.4MB
// file is never fetched for reduced-motion users or on a metered/slow
// connection — the poster still is already in place and is a complete
// fallback, so skipping the video costs nothing but the motion.
function wireHeroVideo() {
  const v = $('#lp-hero-video');
  if (!v) return;
  if (prefersReducedMotion) return;
  const conn = navigator.connection;
  if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;
  v.addEventListener('loadeddata', () => {
    v.classList.add('ok');
    v.play().catch(() => {}); // autoplay refusal is fine: the poster stays
  }, { once: true });
  v.preload = 'auto';
  v.src = 'assets/hero-ocean.mp4';
}

// Ambient blurred bleed behind the Midwater section, sampled from that
// section's own image so the glow always matches what's on screen. Drawn once
// on load rather than per-frame (the source is a still, not a video).
function wireGlow() {
  const canvas = $('#lp-glow');
  const img = $('#lp-glow-src');
  if (!canvas || !img || prefersReducedMotion) return;
  const draw = () => {
    try {
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch { /* a failed decode just leaves the glow layer empty */ }
  };
  if (img.complete && img.naturalWidth) draw();
  else img.addEventListener('load', draw, { once: true });
}

// Depth rail: fades in past the hero and tracks the section in view.
function wireRail() {
  const rail = $('#lp-rail');
  const hero = $('#lp-hero-media');
  if (!rail) return;
  const links = $$('a[data-r]', rail);
  const onScroll = () => {
    const y = scrollY;
    rail.classList.toggle('show', y > innerHeight * 0.7);
    if (hero && y < innerHeight && !prefersReducedMotion) {
      hero.style.transform = `translate3d(0,${y * 0.18}px,0)`;
    }
    let current = links[0];
    links.forEach((a) => {
      const target = document.getElementById(a.dataset.r);
      if (target && target.getBoundingClientRect().top < innerHeight * 0.45) current = a;
    });
    links.forEach((a) => a.classList.toggle('on', a === current));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---------------------------------------------------------------- boot

async function boot() {
  wireClock();
  wireTabs();
  wireReveal();
  wireHeroVideo();
  wireGlow();
  wireRail();

  // Curated content first: it needs no network and should never be gated on
  // the live fetch succeeding.
  renderMarketShare();
  renderLeaderboards();
  wireBars();

  try {
    const data = await loadLatest();
    renderTicker(data);
    renderSurface(data);
    renderCompute(data);
  } catch (err) {
    console.warn('[landing] live data unavailable', err.message);
    renderLiveUnavailable();
  }
}

boot();
