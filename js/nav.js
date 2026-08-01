// Navigation controller for the one-page dashboard. Every top section is in
// the DOM and visible at all times, stacked top to bottom; the top-nav pills
// are scroll anchors, not view switches. This module never sets `hidden`.
//
// This replaces a two-mode IA: one .topsection visible at a time, plus an
// opt-in "Full page" mode that unhid everything. That duality is gone --
// Full page IS the page now, and the "Top" pill just scrolls to the top.
//
// Two things previously derived from "which panel did you activate" now come
// from scroll position instead, because every panel is always active:
//   - the depth rail (which depths the section in view spans)
//   - the top-nav's current-pill highlight
// Both are handled by the scroll-spy at the bottom of this file.
import { prefersReducedMotion } from './util.js';

// Panel ids in DOM order. The scroll-spy relies on this being the real
// document order: it walks the list and takes the LAST section whose top has
// passed under the fixed chrome, which is only correct if the array matches
// the page.
const PANELS = ['models', 'ecosystem', 'today', 'markets'];

// Hash -> element id, for hashes whose element does NOT exist in the page.
// Everything else falls through to a direct getElementById on the hash, so
// #panel-x, #tab-x and the many #sec-x ids that are real elements keep working
// with no entry here. Only genuine orphans are listed -- an entry that merely
// restates what the fallback already does is a second source of truth waiting
// to go stale.
//
//   #sec-river  - dissolved when Waves and River merged into "News Wave"
//   #sec-media  - never an element; the old umbrella name for the media pair
//   #tab-image  - wrapper id removed when the two became grid columns
//   #tab-video  -   "
const LEGACY_HASH = {
  '#sec-river': 'panel-today',
  '#sec-media': 'sec-media-image',
  '#tab-image': 'sec-media-image',
  '#tab-video': 'sec-media-video',
};

// '#full' was the old "show everything on one page" mode. That is now simply
// the page, so the hash still resolves -- to the top.
const TOP_HASHES = new Set(['#full', '#top']);

let dataReady = false;
let pendingScrollTarget = null;
let correctionObserver = null;
let correctionTimer = null;

function panelEl(panel) { return document.getElementById('panel-' + panel); }

// Height of the fixed header + topnav + depth rail. Read from the same CSS
// token the sections' scroll-margin-top uses, so the two can never drift.
function chromeH() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--chrome-h');
  return parseInt(raw, 10) || 126;
}

// ---------- scrolling ----------

function scrollToTarget(target, { smooth = true } = {}) {
  if (!target) return;
  target.scrollIntoView({ behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto', block: 'start' });
}

function scrollToTop({ smooth = true } = {}) {
  window.scrollTo({ top: 0, behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto' });
}

// Watches for layout shifts for a few seconds after navigating and re-snaps to
// the target if async content above it still moved it. Kept from the previous
// controller: with every section on one page there is MORE async content above
// any given target than before, not less, so this matters more, not less.
function armAnchorCorrection(target) {
  if (correctionObserver) { correctionObserver.disconnect(); clearTimeout(correctionTimer); }
  if (!target || typeof ResizeObserver === 'undefined') return;
  let corrections = 0;
  correctionObserver = new ResizeObserver(() => {
    if (corrections >= 3) return;
    corrections += 1;
    scrollToTarget(target, { smooth: false });
  });
  correctionObserver.observe(document.body);
  correctionTimer = setTimeout(() => {
    correctionObserver?.disconnect();
    correctionObserver = null;
  }, 3000);
}

// Scroll to an element id, deferring until data is ready if the page is still
// rendering skeletons (otherwise we'd scroll to a target that then grows).
function navigateToId(id, { push = true, smooth = true } = {}) {
  const target = document.getElementById(id);
  if (!target) return false;
  if (push && location.hash !== '#' + id) history.pushState({ id }, '', '#' + id);
  pendingScrollTarget = target;
  if (dataReady) {
    scrollToTarget(target, { smooth });
    armAnchorCorrection(target);
    pendingScrollTarget = null;
  }
  return true;
}

function navigateToTop({ push = true } = {}) {
  if (push && location.hash) history.pushState(null, '', location.pathname + location.search);
  pendingScrollTarget = null;
  scrollToTop();
}

// ---------- depth rail + current pill (scroll-spy) ----------

// Every distinct data-depth present among a panel's subsections. Values can be
// space-separated (e.g. "surface currents"); the landing's wireRail()
// (js/landing.js) splits on /\s+/ the same way, and the two must agree or the
// rail will disagree between pages.
function panelDepths(panel) {
  const el = panelEl(panel);
  if (!el) return [];
  return [...new Set(
    [...el.querySelectorAll('[data-depth]')]
      .flatMap((n) => (n.dataset.depth || '').split(/\s+/).filter(Boolean))
  )];
}

function updateDepthRailMulti(depths) {
  document.querySelectorAll('.depth-item').forEach((el) => {
    el.dataset.active = String(depths.includes(el.dataset.depth));
  });
}

function setTopnavCurrent(panel) {
  document.querySelectorAll('.nav-pill[data-panel]').forEach((btn) => {
    if (btn.dataset.panel === panel) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

// Which section owns the viewport right now: the LAST one whose top has
// scrolled up past the fixed chrome. Deliberately not IntersectionObserver
// ratios -- sections here are routinely taller than the viewport, so their
// intersectionRatio stays near zero and comparing ratios picks the wrong one.
// A single position test is both simpler and correct for tall sections.
function currentPanel() {
  const line = chromeH() + 8;
  let current = PANELS[0];
  for (const p of PANELS) {
    const el = panelEl(p);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= line) current = p;
  }
  return current;
}

let spyScheduled = false;
function syncSpy() {
  spyScheduled = false;
  const panel = currentPanel();
  updateDepthRailMulti(panelDepths(panel));
  setTopnavCurrent(panel);
}

function scheduleSpy() {
  if (spyScheduled) return;
  spyScheduled = true;
  requestAnimationFrame(syncSpy);
}

function initSpy() {
  window.addEventListener('scroll', scheduleSpy, { passive: true });
  window.addEventListener('resize', scheduleSpy);
  syncSpy();
}

// ---------- wiring ----------

// Strips the tablist/tabpanel ARIA the HTML still carries and unhides every
// tabpanel once. The jump bars were never a real tablist -- every subsection
// is shown stacked -- so they are groups of scroll shortcuts, not tabs.
function normalizeLocalNav() {
  document.querySelectorAll('.local-tabs').forEach((group) => {
    group.setAttribute('role', 'group');
    group.querySelectorAll('.local-tab').forEach((btn) => {
      btn.removeAttribute('role');
      btn.removeAttribute('aria-selected');
      btn.removeAttribute('aria-controls');
      btn.removeAttribute('tabindex');
    });
  });
  document.querySelectorAll('.tabpanel').forEach((p) => {
    p.removeAttribute('role');
    p.removeAttribute('aria-labelledby');
    p.removeAttribute('hidden');
  });
}

function wireTopnav() {
  document.querySelectorAll('.nav-pill[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      if (panel === 'full') navigateToTop();
      else navigateToId('panel-' + panel);
    });
  });
}

// Resolve a jump button's data-tab to the element it should scroll to.
// Normally that is #tab-<name>, but where no such wrapper exists (Image and
// Video AI lost theirs when they became grid columns) it reuses the same
// LEGACY_HASH orphan map the hash router uses, rather than keeping a second
// lookup table that could disagree with it.
function tabTargetId(tab) {
  if (document.getElementById('tab-' + tab)) return 'tab-' + tab;
  return LEGACY_HASH['#tab-' + tab] || ('tab-' + tab);
}

// Jump bar: scroll to a subsection within an already-visible section.
function wireLocalTabs() {
  document.querySelectorAll('.local-tabs').forEach((group) => {
    group.querySelectorAll('.local-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigateToId(tabTargetId(btn.dataset.tab));
        group.querySelectorAll('.local-tab').forEach((b) => {
          if (b === btn) b.setAttribute('aria-current', 'true');
          else b.removeAttribute('aria-current');
        });
      });
    });
  });
}

function handleHash({ push = false } = {}) {
  const hash = location.hash;
  if (!hash) return;
  if (TOP_HASHES.has(hash)) { navigateToTop({ push: false }); return; }
  const mapped = LEGACY_HASH[hash];
  if (mapped) { navigateToId(mapped, { push }); return; }
  // #panel-x / #tab-x / #sec-x and anything else: resolve the id directly.
  navigateToId(hash.slice(1), { push });
}

export function initNav() {
  normalizeLocalNav();
  wireTopnav();
  wireLocalTabs();
  initSpy();

  window.addEventListener('popstate', () => handleHash({ push: false }));

  // Initial load: honour the hash if there is one. With no hash the page just
  // starts at the top -- there is no default section to activate anymore.
  if (location.hash) handleHash({ push: false });
}

// Called once from main.js after the initial async render (waves/river/ocean
// map/stock network) has settled -- finishes any scroll that was waiting on
// real content instead of a skeleton, and re-runs the spy now that the page
// has its true height.
export function notifyDataReady() {
  dataReady = true;
  if (pendingScrollTarget) {
    // double rAF: let the browser finish layout for the just-rendered content
    const target = pendingScrollTarget;
    pendingScrollTarget = null;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollToTarget(target, { smooth: true });
      armAnchorCorrection(target);
    }));
  }
  scheduleSpy();
  window.dispatchEvent(new CustomEvent('app:data-ready'));
}
