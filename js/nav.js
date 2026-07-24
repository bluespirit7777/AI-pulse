// Navigation controller for the 5-item IA (Today/Ecosystem/Models/Markets/
// Research), each with local tabs. Replaces the old single-scroll page with
// deterministic, programmatic section/tab activation — so unlike a scroll-
// spied single page, "what's active" is never inferred from scroll position,
// it's always exactly what was last activated. This also sidesteps the old
// bug where #sec-releases could land ~4600px off after async content above
// it expanded: since only the ACTIVE tabpanel ever has non-zero height
// (inactive ones are [hidden], contributing zero layout), there's no tall
// stack of async siblings left to push the target down.
import { prefersReducedMotion } from './util.js';

// Each top-level panel's local tab ids, in document/DOM order. Panels absent
// here (ecosystem, research) have no local tabs.
const PANEL_TABS = {
  today: ['briefing', 'waves', 'river', 'tide'],
  models: ['releases', 'leaderboard', 'image', 'video', 'local', 'community'],
  markets: ['stocknet', 'compute'],
};
const PANELS = ['today', 'ecosystem', 'models', 'markets', 'research'];

// Legacy hashes from the old single-scroll page → {panel, tab}. Every one of
// these must keep working as a direct link.
const LEGACY_HASH = {
  '#sec-map': { panel: 'ecosystem' },
  '#sec-waves': { panel: 'today', tab: 'waves' },
  '#sec-river': { panel: 'today', tab: 'river' },
  '#sec-tide': { panel: 'today', tab: 'tide' },
  '#sec-releases': { panel: 'models', tab: 'releases' },
  '#sec-leaderboard': { panel: 'models', tab: 'leaderboard' },
  '#sec-media': { panel: 'models', tab: 'image' },
  '#sec-community': { panel: 'models', tab: 'community' },
  '#sec-stocks': { panel: 'markets', tab: 'stocknet' },
  '#sec-compute': { panel: 'markets', tab: 'compute' },
  '#sec-local': { panel: 'research' },
};

const FULL_HASH = '#full';
// Full Page's own visual order — Ecosystem and Models lead, per explicit
// request, with the rest keeping their original relative order after them.
const FULL_PAGE_ORDER = ['ecosystem', 'models', 'today', 'markets', 'research'];

let state = { panel: 'today', tab: 'briefing' };
let dataReady = false;
let pendingScrollTarget = null;
let correctionObserver = null;
let correctionTimer = null;

function panelEl(panel) { return document.getElementById('panel-' + panel); }
function tabEl(tab) { return document.getElementById('tab-' + tab); }
function tabBtn(tab) { return document.getElementById('tabbtn-' + tab); }
function topnavBtn(panel) { return document.querySelector(`.topnav-item[data-panel="${panel}"]`); }

// appendChild on a node already in the document MOVES it rather than
// duplicating it, so calling this in sequence for each panel in `order`
// leaves the panels in exactly that order — no cloning, no duplicate ids,
// no re-rendering. Non-panel siblings (e.g. the top data-note banner) are
// never touched, so they stay wherever they started.
function reorderPanels(order) {
  const main = document.getElementById('main-content');
  if (!main) return;
  order.forEach((p) => { const el = panelEl(p); if (el) main.appendChild(el); });
}

// Resolve a location.hash into {panel, tab}. Accepts legacy hashes, the
// current-scheme ids (#panel-x, #tab-y), or falls back to the last state.
function resolveHash(hash) {
  if (!hash) return null;
  if (LEGACY_HASH[hash]) return { ...LEGACY_HASH[hash] };
  const tabMatch = hash.match(/^#tab-(.+)$/);
  if (tabMatch) {
    const tab = tabMatch[1];
    for (const [panel, tabs] of Object.entries(PANEL_TABS)) {
      if (tabs.includes(tab)) return { panel, tab };
    }
  }
  const panelMatch = hash.match(/^#panel-(.+)$/);
  if (panelMatch && PANELS.includes(panelMatch[1])) return { panel: panelMatch[1] };
  return null;
}

function hashFor(panel, tab) {
  return tab ? '#tab-' + tab : '#panel-' + panel;
}

// Every subsection of a top panel is shown STACKED (not one tab at a time),
// so the local-tab bar is a "jump to a section" nav, not a tablist. This
// strips the tablist/tabpanel ARIA the HTML still carries and unhides every
// tabpanel once (they're gated only by their parent panel's `hidden` from
// here on). Run once at init.
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
    p.hidden = false;
  });
}

// Light "you jumped here" cue on the jump bar — not a tablist selection.
function setLocalTabCurrent(panel, tab) {
  const tabs = PANEL_TABS[panel];
  if (!tabs) return;
  tabs.forEach((t) => {
    const btn = tabBtn(t);
    if (btn) btn.setAttribute('aria-current', String(t === tab));
  });
}

// Every distinct data-depth present among a panel's shown subsections — the
// section now spans multiple depths, so the rail highlights all of them
// rather than pretending there's a single "current" one.
function panelDepths(panel) {
  const el = panelEl(panel);
  if (!el) return [];
  return [...new Set([...el.querySelectorAll('[data-depth]')].map((n) => n.dataset.depth))];
}

function updateDepthRailMulti(depths) {
  document.querySelectorAll('.depth-item').forEach((el) => {
    el.dataset.active = String(depths.includes(el.dataset.depth));
  });
}

function activatePanels(panel) {
  PANELS.forEach((p) => {
    const el = panelEl(p);
    if (el) el.hidden = p !== panel;
    const btn = topnavBtn(p);
    if (btn) {
      if (p === panel) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  });
  const fullBtn = topnavBtn('full');
  if (fullBtn) fullBtn.removeAttribute('aria-current');
}

function setLocalTabsVisible(visible) {
  document.querySelectorAll('.local-tabs').forEach((el) => { el.hidden = !visible; });
}

function setDepthRailVisible(visible) {
  const rail = document.getElementById('depth-rail');
  if (rail) rail.hidden = !visible;
}

function scrollToTarget(target, { smooth = true } = {}) {
  if (!target) return;
  target.scrollIntoView({ behavior: smooth && !prefersReducedMotion ? 'smooth' : 'auto', block: 'start' });
}

// Watches for layout shifts for a few seconds after navigating and re-snaps
// to the target if something async still moved it — the ResizeObserver-based
// safety net called for in the redesign brief, in addition to the tab-gating
// above which already removes most of the original cause.
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

function legacyAnchor(panel, tab) {
  // The nested legacy-id elements (#sec-waves etc.) are the precise visual
  // target within a tabpanel; fall back to the tabpanel/panel itself.
  const entry = Object.entries(LEGACY_HASH).find(([, v]) => v.panel === panel && v.tab === tab);
  if (entry) {
    const el = document.querySelector(entry[0]);
    if (el) return el;
  }
  return tab ? tabEl(tab) : panelEl(panel);
}

// Show a top section. `tab` is now just an optional SCROLL TARGET within the
// section (every subsection is shown stacked), not a one-of-many selection.
// Clicking the top-nav header passes no tab → shows the whole section from
// its top; a legacy deep link like #sec-waves or a jump-bar click passes a
// tab → shows the section and scrolls to that subsection.
export function goTo(panel, tab, { push = true, scroll = true } = {}) {
  if (!PANELS.includes(panel)) return;
  state = { panel, tab: tab || null };

  // undo whatever Full Page mode changed, if we're coming from it
  setLocalTabsVisible(true);
  setDepthRailVisible(true);
  const main = document.getElementById('main-content');
  if (main?.dataset.reordered) {
    reorderPanels(PANELS);
    delete main.dataset.reordered;
  }

  activatePanels(panel);            // show this panel, hide the others
  setLocalTabCurrent(panel, tab);   // light cue on the jump bar
  updateDepthRailMulti(panelDepths(panel));

  if (push) {
    const hash = hashFor(panel, tab);
    if (location.hash !== hash) history.pushState({ panel, tab: tab || null }, '', hash);
  }

  if (scroll) {
    // no tab → land at the top of the section; tab → scroll to that subsection
    const target = tab ? legacyAnchor(panel, tab) : panelEl(panel);
    pendingScrollTarget = target;
    if (dataReady) {
      scrollToTarget(target, { smooth: true });
      armAnchorCorrection(target);
    }
    // if data isn't ready yet, the 'app:data-ready' handler below finishes the scroll
  }
}

// "Full page" — shows every section top-to-bottom at once, like the original
// single-scroll page, for anyone who'd rather scroll than switch tabs. An
// explicit opt-in (Today stays the default landing view): all 5 top panels
// and all their local tabs are unhidden simultaneously, the now-redundant
// local-tab bars and the depth rail (which has no single "current" section
// to point at anymore) are hidden, and every widget inside — flip cards,
// river filters, leaderboard tabs, etc. — keeps working exactly as it does
// in the tabbed view, since none of their own logic depends on this.
export function activateFullPage({ push = true } = {}) {
  state = { panel: 'full', tab: null };

  PANELS.forEach((p) => { const el = panelEl(p); if (el) el.hidden = false; });
  Object.values(PANEL_TABS).flat().forEach((tab) => { const el = tabEl(tab); if (el) el.hidden = false; });
  setLocalTabsVisible(false);
  setDepthRailVisible(false);
  reorderPanels(FULL_PAGE_ORDER);
  const main = document.getElementById('main-content');
  if (main) main.dataset.reordered = '1';

  document.querySelectorAll('.topnav-item').forEach((btn) => {
    if (btn.dataset.panel === 'full') btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  if (push && location.hash !== FULL_HASH) history.pushState({ full: true }, '', FULL_HASH);
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
}

function wireTopnav() {
  document.querySelectorAll('.topnav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.panel === 'full') activateFullPage();
      else goTo(btn.dataset.panel, null);
    });
  });
}

// Jump bar: each button scrolls to its subsection within the (already fully
// shown) section. Plain buttons — Tab moves between them naturally, so no
// tablist arrow-key roving is needed anymore.
function wireLocalTabs() {
  document.querySelectorAll('.local-tabs').forEach((group) => {
    const panel = group.dataset.tabgroup;
    group.querySelectorAll('.local-tab').forEach((btn) => {
      btn.addEventListener('click', () => goTo(panel, btn.dataset.tab));
    });
  });
}

function handleHash({ push } = { push: false }) {
  if (location.hash === FULL_HASH) { activateFullPage({ push: false }); return; }
  const resolved = resolveHash(location.hash);
  if (!resolved) return;
  goTo(resolved.panel, resolved.tab, { push, scroll: true });
}

export function initNav() {
  normalizeLocalNav();
  wireTopnav();
  wireLocalTabs();

  window.addEventListener('popstate', () => handleHash({ push: false }));

  // Initial load: resolve the hash if present, else show Today (all of its
  // subsections stacked — the default landing view).
  if (location.hash) {
    handleHash({ push: false });
  } else {
    goTo('today', null, { push: false, scroll: false });
  }
}

// Called once from main.js after the initial async render (waves/river/tide/
// ocean map/stock network) has settled — finishes any scroll that was
// waiting on real content instead of a skeleton.
export function notifyDataReady() {
  dataReady = true;
  if (pendingScrollTarget) {
    // double rAF: let the browser finish layout for the just-rendered content
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollToTarget(pendingScrollTarget, { smooth: true });
      armAnchorCorrection(pendingScrollTarget);
      pendingScrollTarget = null;
    }));
  }
  window.dispatchEvent(new CustomEvent('app:data-ready'));
}
