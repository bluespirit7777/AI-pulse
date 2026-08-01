# Dashboard One-Page Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the dashboard into a single continuous scrolling page — no more one-panel-at-a-time view switching — with the nav reordered and relabelled to **Top / Models / Ecosystem / News Wave / Markets**, Image AI and Video AI sharing one row, and the flip-card height bug fixed so Local AI and Frontier releases show their full top-5 without an internal scrollbar.

**Architecture:** The dashboard already contains a working one-page mode — `activateFullPage()` in `js/nav.js` unhides every panel, hides the jump bars and depth rail, and reorders the panels. This plan promotes that mode to being *the* page and deletes the panel-switching path entirely. `js/nav.js` is rewritten around a single idea: **every section is always in the DOM and visible; navigation is scrolling.** Because nothing is ever `hidden` anymore, two behaviours that depended on "which panel is active" need new mechanisms — the depth rail becomes a scroll-spy, and the top-nav's active pill is derived from scroll position rather than from the last click.

**Tech Stack:** Static site, zero npm dependencies, `node --test`, **no jsdom**. DOM behaviour is not unit-testable here — it is verified in a browser via the `mcp__Claude_Browser__*` tools. The test suite can only assert against source text (HTML/JS/CSS read as strings) and pure functions.

**Spec:** No separate spec document — requirements came directly from the owner, with four decisions resolved before planning (recorded under Decisions Already Made below).

## Global Constraints

- **Zero npm dependencies.** Do not add any.
- **`npm run check` must pass at the end of every task.** Baseline is **236 tests**, all passing.
- **Internal ids stay stable.** `#panel-today`, `data-panel="today"`, `#panel-models`, `#tab-*`, `#sec-*` keep their current names even though the visible label for `today` becomes "News Wave". Renaming them would break `LEGACY_HASH`, `js/deeplink.js`'s `/^#(full$|panel-|tab-|sec-)/` allowlist, the test suite, and every link on the landing page. **Only user-visible label text changes.**
- **Every hash the landing page links to must still work as a scroll target.** `index.html` links `app.html#panel-today`, `#panel-ecosystem`, `#panel-models`, `#panel-markets`, `#tab-leaderboard`, `#tab-compute`, and `#full`. All seven must land on the right section after this change.
- **No landing-page behaviour changes.** `index.html` and `js/landing.js` are out of scope except for the single footer link label in Task 6. The landing's own depth rail (`#lp-rail`, driven by `js/landing.js`'s `wireRail()`) is untouched.
- **Nothing under `scripts/` is touched.**
- **The depth-parity contract survives.** `test/continuity.test.mjs`'s "landing bands report the exact same depth set as their dashboard panel" derives each dashboard panel's depth set by scanning `data-depth` attributes between one `id="panel-"` and the next. Reordering panels in the source is safe (it slices per-panel, order-independent), but **the set of `data-depth` values under each panel must not change**. Task 4 merges two `data-depth="midwater"` tabpanels into one — still `{midwater}`, so the set is preserved.
- **`--chrome-h: 126px`** (`css/shell.css:64`) is the header+topnav+rail height that `scroll-margin-top` uses. The depth rail stays **visible** in the new design, so this value remains correct and must not change.

## Decisions Already Made

These were escalated to the owner and answered before this plan was written. Implement them as stated; do not re-litigate.

1. **Depth rail → scroll-spy.** It stays visible and lights up whichever depths the section currently in view spans.
2. **Jump bars (`.local-tabs`) stay**, repurposed as in-section scroll shortcuts. They are already semantically a "jump to subsection" bar, not a tablist (`normalizeLocalNav()` strips the tab ARIA at init today).
3. **Frontier releases / Local AI sizing = fix the clipping bug**, not a fixed taller height and not forcing all three release cards to a shared height.
4. **Nav order exactly as specified: Top, Models, Ecosystem, News Wave, Markets** — in the header and in DOM/visual order.

## The bug being fixed in Task 5 (context)

`js/sections.js:328` `sizeFlipCards()` sizes each `.flip-card-inner` to the taller of its two faces so neither face needs to scroll. It measures `face.scrollHeight`, which is **0 for an element inside a `hidden` ancestor**, and the guard `if (tallest)` then skips setting `min-height`. On the ordinary flow (land on Today → click Models), `#panel-models` was `hidden` when `renderCurated()` ran, so every flip card in it stays at the CSS fallback `min-height:360px` forever — nothing re-runs the sizing when the panel is later revealed (only flip-button clicks and `window.resize` do).

Measured at 1440×900, landing on Today then clicking Models:

| Card | Content needs | Face gets | Clipped |
|---|---|---|---|
| Local AI for your PC | 859px | 356px | **503px hidden** |
| Top 5 local mobile AI | 908px | 356px | **552px hidden** |
| Frontier release card | 462px | 356px | **106px hidden** |

Loading `/app#panel-models` *directly* sizes correctly (2242px / correct heights), because `initNav()` unhides the panel before `renderCurated()` runs — which is why the bug is easy to miss.

The one-page conversion removes `hidden` entirely, so Tasks 1–2 alone will largely mask this. Task 5 still fixes the root cause so it cannot regress (e.g. a future collapsed/`display:none` container would reintroduce it).

---

## File Structure

**Modify:**
- `js/nav.js` — **rewritten** (Task 1). Panel switching, `activateFullPage()`, `reorderPanels()`, `activatePanels()`, `setLocalTabsVisible()`, `setDepthRailVisible()` all go. Gains a scroll-spy.
- `app.html` — remove `hidden` from the three topsections and reorder them (Tasks 1, 3); relabel nav pills (Task 2); merge the Image/Video tabpanels and add `.media-grid` CSS (Task 4).
- `js/sections.js` — `sizeFlipCards()` gains a visibility-aware re-run (Task 5).
- `index.html` — one footer link label only (Task 6).
- `test/continuity.test.mjs` — new one-page guard tests (Tasks 1, 2, 3, 4).
- `docs/ARCHITECTURE.md`, `README.md`, `Handoverhub/HANDOVER.md` — doc sync (Task 6).

**No files are created or deleted.**

**Task → deliverable map:**

| Task | Deliverable | Test count |
|---|---|---|
| 1 | One continuous page; pills scroll; scroll-spy rail | 236 → 238 |
| 2 | Labels: "Top" and "News Wave" | 238 → 239 |
| 3 | DOM/visual order = Models, Ecosystem, News Wave, Markets | 239 → 240 |
| 4 | Image AI + Video AI share one row | 240 → 241 |
| 5 | Flip-card sizing bug fixed | 241 → 241 |
| 6 | Docs sync + full browser verification | 241 → 241 |

---

## Task 1: Convert the dashboard to one continuous page

**Files:**
- Modify: `js/nav.js` (full rewrite)
- Modify: `app.html` (remove `hidden` from three `.topsection` elements)
- Modify: `test/continuity.test.mjs` (add 2 tests)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `js/nav.js` exports **`initNav()`** and **`notifyDataReady()`** only. `goTo()` and `activateFullPage()` are **removed** — `js/main.js` must not import them (verify it doesn't; see Step 4). Later tasks rely on `PANELS` being in DOM order and on the `data-panel` attribute remaining on each `.topsection`.

- [ ] **Step 1: Write the failing tests**

Append to `test/continuity.test.mjs`:

```javascript
test('the dashboard is one continuous page, with no hidden top sections', () => {
  // Every .topsection used to be hidden except the active one; navigation
  // switched which was visible. The dashboard is now a single scroll, so a
  // `hidden` attribute on a topsection would silently remove a whole section
  // from the page with no way to get it back -- the nav no longer unhides.
  const topsections = [...appHtml.matchAll(/<section[^>]*class="topsection"[^>]*>/g)].map((m) => m[0]);
  assert.equal(topsections.length, 4, 'app.html must have exactly 4 top sections');
  for (const tag of topsections) {
    assert.doesNotMatch(tag, /\shidden(\s|>|=)/, `a topsection must not be hidden: ${tag}`);
  }
});

test('js/nav.js drives one page by scrolling, not by switching panels', () => {
  // The panel-switching API is gone. If any of these come back, the module
  // has regressed to the two-mode (tabbed + "Full page") IA this replaced.
  assert.doesNotMatch(navSrc, /export function goTo\b/, 'goTo() must be gone -- pills scroll now');
  assert.doesNotMatch(navSrc, /export function activateFullPage\b/, 'activateFullPage() must be gone -- the page IS full page now');
  assert.doesNotMatch(navSrc, /\.hidden\s*=/, 'nav.js must never set .hidden -- every section is always visible');
  // And the replacement must actually exist.
  assert.match(navSrc, /scrollIntoView|scrollTo/, 'nav.js must scroll to navigate');
  assert.match(navSrc, /addEventListener\('scroll'/, 'the depth rail must be driven by scroll position (scroll-spy)');
});
```

This needs `navSrc`. At the top of `test/continuity.test.mjs`, next to the existing `appHtml`/`landingHtml` reads, add:

```javascript
const navSrc = readFileSync(new URL('../js/nav.js', import.meta.url), 'utf8');
```

(Match the exact style of the existing reads in that file — if they use a different helper or path form, follow it rather than this literal line.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `a topsection must not be hidden` and `goTo() must be gone`.

- [ ] **Step 3: Remove `hidden` from the three topsections**

In `app.html`, three of the four `.topsection` opening tags carry `hidden`. Change each:

```html
    <section id="panel-ecosystem" class="topsection" data-panel="ecosystem" hidden>
```
becomes
```html
    <section id="panel-ecosystem" class="topsection" data-panel="ecosystem">
```

```html
    <section id="panel-models" class="topsection" data-panel="models" hidden>
```
becomes
```html
    <section id="panel-models" class="topsection" data-panel="models">
```

```html
    <section id="panel-markets" class="topsection" data-panel="markets" hidden>
```
becomes
```html
    <section id="panel-markets" class="topsection" data-panel="markets">
```

`#panel-today` already has no `hidden` — leave it as-is.

**Do not** remove `hidden` from anything else. The `.tabpanel` elements still carry `hidden` in the source and are unhidden at init by `normalizeLocalNav()`; the flip-card backs use `inert`; drawers and notes have their own `hidden`. Only the four `class="topsection"` tags are in scope here.

- [ ] **Step 4: Confirm `js/main.js` does not import the removed functions**

Run: `grep -n "from './nav.js'" -A 2 js/main.js`

The import must only pull `initNav` and `notifyDataReady`. If it also imports `goTo` or `activateFullPage`, report this — the plan assumes it does not, and a stale import would be a hard runtime error (`SyntaxError`, blank page).

- [ ] **Step 5: Rewrite `js/nav.js`**

Replace the **entire contents** of `js/nav.js` with:

```javascript
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
function topnavBtn(panel) { return document.querySelector(`.nav-pill[data-panel="${panel}"]`); }

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
    p.hidden = false;
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
      btn.addEventListener('click', () => navigateToId(tabTargetId(btn.dataset.tab)));
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/continuity.test.mjs`
Expected: PASS.

- [ ] **Step 7: Run the full gate**

Run: `npm run check`
Expected: validate passes; **238 tests pass, 0 fail** (236 + 2 new).

- [ ] **Step 8: Commit**

```bash
git add js/nav.js app.html test/continuity.test.mjs
git commit -m "Make the dashboard one continuous page

The old controller had two modes: one .topsection visible at a time, plus an
opt-in 'Full page' that unhid everything. Full page is now simply the page --
every section is always in the DOM and visible, and the top-nav pills are
scroll anchors rather than view switches. nav.js never sets .hidden again.

Two behaviours that read 'which panel did you activate' had to be rebuilt on
scroll position instead, since every panel is now active: the depth rail and
the current-pill highlight. Both come from one scroll-spy that picks the last
section whose top has passed under the fixed chrome -- a position test, not
IntersectionObserver ratios, because these sections are routinely taller than
the viewport and their intersection ratios stay near zero.

Every hash the landing links to (#panel-*, #tab-*, #full) still resolves; the
legacy map now points at element ids and unknown hashes fall through to a
direct getElementById, so #sec-* keeps working without an entry each."
```

---

## Task 2: Relabel "Today" → "News Wave" and "Full page" → "Top"

**Files:**
- Modify: `app.html` (topnav, ~lines 552-558)
- Modify: `test/continuity.test.mjs` (add 1 test)

**Interfaces:**
- Consumes: Task 1's rewritten nav (the `full` pill now scrolls to top rather than activating a mode).
- Produces: nav pill label text that Task 3's ordering test also reads.

**Only visible text changes.** `data-panel="today"` and `data-panel="full"` stay exactly as they are — see Global Constraints.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('the dashboard top nav is labelled Top / Models / Ecosystem / News Wave / Markets', () => {
  const nav = appHtml.match(/<nav class="topnav"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav, 'app.html must have a .topnav');
  const labels = [...nav.matchAll(/<button[^>]*data-panel="[^"]*"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1].trim());
  assert.deepEqual(labels, ['Top', 'Models', 'Ecosystem', 'News Wave', 'Markets']);
  // The internal ids must NOT have been renamed along with the labels --
  // js/deeplink.js's allowlist, LEGACY_HASH and every landing link depend on
  // them. "News Wave" is the label for data-panel="today".
  assert.match(nav, /data-panel="today"[^>]*>News Wave</, 'News Wave must still be data-panel="today"');
  assert.match(nav, /data-panel="full"[^>]*>Top</, 'Top must still be data-panel="full"');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — the labels are currently `['Full page', 'Today', 'Ecosystem', 'Models', 'Markets']`.

- [ ] **Step 3: Relabel the pills**

In `app.html`, find:

```html
  <nav class="topnav" aria-label="Main navigation" id="topnav">
    <button type="button" class="nav-pill nav-pill--mode" data-panel="full" title="Show every section on one page, top to bottom">Full page</button>
    <button type="button" class="nav-pill" data-panel="today" aria-current="page">Today</button>
    <button type="button" class="nav-pill" data-panel="ecosystem">Ecosystem</button>
    <button type="button" class="nav-pill" data-panel="models">Models</button>
    <button type="button" class="nav-pill" data-panel="markets">Markets</button>
  </nav>
```

Replace with (note: this also applies Task 3's ordering, since both are edits to the same five lines — the ordering test in Task 3 will confirm it):

```html
  <nav class="topnav" aria-label="Main navigation" id="topnav">
    <button type="button" class="nav-pill nav-pill--mode" data-panel="full" title="Back to the top of the page">Top</button>
    <button type="button" class="nav-pill" data-panel="models">Models</button>
    <button type="button" class="nav-pill" data-panel="ecosystem">Ecosystem</button>
    <button type="button" class="nav-pill" data-panel="today">News Wave</button>
    <button type="button" class="nav-pill" data-panel="markets">Markets</button>
  </nav>
```

Three things changed beyond the two labels, all deliberate:
- The `title` on the Top pill described the old mode ("Show every section on one page") — that is now just what the page is, so it describes scrolling to the top instead.
- `aria-current="page"` is removed from the Today pill. The scroll-spy sets `aria-current` now; a hard-coded one in the markup would be wrong the moment the user scrolls.
- The pills are reordered to Top, Models, Ecosystem, News Wave, Markets.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/continuity.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: validate passes; **239 tests pass, 0 fail**.

- [ ] **Step 6: Commit**

```bash
git add app.html test/continuity.test.mjs
git commit -m "Relabel dashboard nav: Today -> News Wave, Full page -> Top

Labels only -- data-panel=\"today\" and data-panel=\"full\" keep their ids,
because js/deeplink.js's hash allowlist, nav.js's LEGACY_HASH, the test suite
and every landing-page link are all keyed on them.

'News Wave' now matches the heading of the section it points at, which has
been called News Wave since Waves and River were merged. The Top pill's title
no longer advertises a 'Full page' mode that no longer exists, and the
hard-coded aria-current is dropped -- the scroll-spy owns that now, and a
static one would be wrong as soon as the user scrolled."
```

---

## Task 3: Reorder the sections to match the nav

**Files:**
- Modify: `app.html` (move the `<!-- MODELS -->` section block)
- Modify: `test/continuity.test.mjs` (add 1 test)

**Interfaces:**
- Consumes: Task 2's reordered nav pills.
- Produces: source order `models, ecosystem, today, markets`, which Task 1's `PANELS` array already assumes (`const PANELS = ['models', 'ecosystem', 'today', 'markets']`). **The scroll-spy is incorrect until this task lands** — it walks `PANELS` in order and takes the last section past the chrome line, which only works if the array matches document order. Tasks 1–3 must all be merged together; do not ship Task 1 without Task 3.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('the dashboard sections appear in the same order as the nav pills', () => {
  // js/nav.js's scroll-spy walks its PANELS array in order and takes the last
  // section whose top has passed the chrome line. That is only correct if the
  // array, the nav pills and the DOM all agree, so pin the DOM order here.
  const domOrder = [...appHtml.matchAll(/<section[^>]*class="topsection"[^>]*data-panel="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(domOrder, ['models', 'ecosystem', 'today', 'markets']);

  const nav = appHtml.match(/<nav class="topnav"[\s\S]*?<\/nav>/)?.[0];
  const navOrder = [...nav.matchAll(/<button[^>]*data-panel="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== 'full');
  assert.deepEqual(navOrder, domOrder, 'nav pill order must match DOM section order');

  const navSrcOrder = navSrc.match(/const PANELS = \[([^\]]+)\]/)?.[1];
  assert.ok(navSrcOrder, 'js/nav.js must declare a PANELS array');
  assert.deepEqual(
    navSrcOrder.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean),
    domOrder,
    "js/nav.js's PANELS must be in DOM order -- the scroll-spy depends on it"
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — DOM order is currently `['today', 'ecosystem', 'models', 'markets']`.

- [ ] **Step 3: Move the MODELS block above ECOSYSTEM**

`app.html`'s `<main>` currently contains, in order: `<!-- TODAY -->`, `<!-- ECOSYSTEM -->`, `<!-- MODELS -->`, `<!-- MARKETS -->`.

Target order: `<!-- MODELS -->`, `<!-- ECOSYSTEM -->`, `<!-- TODAY -->`, `<!-- MARKETS -->`.

This is a pure block move — **do not edit a single character inside any of the blocks**. Each block runs from its `<!-- NAME -->` comment line through the `</section>` that closes its `<section class="topsection">`, inclusive.

Do it as two moves:
1. Cut the whole `<!-- MODELS -->` block and paste it immediately **before** the `<!-- ECOSYSTEM -->` comment.
2. Cut the whole `<!-- TODAY -->` block and paste it immediately **after** the `</section>` that closes `#panel-ecosystem` (i.e. between the ECOSYSTEM and MARKETS blocks).

Verify the result before moving on:

```bash
grep -n 'class="topsection"\|<!-- MODELS\|<!-- ECOSYSTEM\|<!-- TODAY\|<!-- MARKETS' app.html
```

Expected: the four comments and their four `<section class="topsection" ...>` tags interleave in the order MODELS, ECOSYSTEM, TODAY, MARKETS, with each comment immediately preceding its own section tag.

Also confirm nothing was lost in the move:

```bash
node --test test/continuity.test.mjs
```

The pre-existing depth-parity test ("the landing bands report the exact same depth set as their dashboard panel") is the safety net here — it slices each panel's markup independently of order and will fail loudly if a block was truncated or a `data-depth` went missing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/continuity.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: validate passes; **240 tests pass, 0 fail**.

- [ ] **Step 6: Commit**

```bash
git add app.html test/continuity.test.mjs
git commit -m "Reorder dashboard sections to Models, Ecosystem, News Wave, Markets

Matches the new nav order. This is a source reorder, not a runtime one: the
previous controller reordered the DOM in JS for its 'Full page' mode, which
meant source order and visual order disagreed. With one page there is no
reason for that indirection -- the document now reads in the order it renders,
which also keeps it correct with JS disabled.

The new guard test pins DOM order, nav-pill order and nav.js's PANELS array to
each other, because the scroll-spy walks PANELS positionally and silently
picks the wrong section if any of the three drift apart."
```

---

## Task 4: Put Image AI and Video AI side by side

**Files:**
- Modify: `app.html` (merge `#tab-image` + `#tab-video`; add `.media-grid` CSS)
- Modify: `test/continuity.test.mjs` (add 1 test)

**Interfaces:**
- Consumes: nothing structural from Tasks 1-3.
- Produces: `#sec-media-image` and `#sec-media-video` as siblings in one `.media-grid`. Task 1's `LEGACY_HASH` already maps `#tab-image`/`#tab-video` to these two ids, and `tabTargetId()` falls back to that map when no `#tab-<name>` wrapper exists — **those entries are inert until this task removes the wrappers, and are what keeps both jump buttons and both legacy hashes working afterwards.**

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('Image AI and Video AI share one row', () => {
  // They were two full-width stacked tabpanels; they are now two columns of
  // one grid, so the pair reads as a comparison rather than a sequence.
  const grid = appHtml.match(/<div class="media-grid">[\s\S]*?<\/div>\s*<\/div>/)?.[0];
  assert.ok(grid, 'app.html must have a .media-grid');
  assert.match(grid, /id="sec-media-image"/, 'the image panel must be in the media grid');
  assert.match(grid, /id="sec-media-video"/, 'the video panel must be in the media grid');
  assert.ok(
    grid.indexOf('sec-media-image') < grid.indexOf('sec-media-video'),
    'image must be the left column, video the right'
  );
  // The grid must actually be a two-column grid that collapses on narrow
  // screens -- side-by-side at 580px each is fine, side-by-side at 180px each
  // is not.
  assert.match(appHtml, /\.media-grid\{[^}]*grid-template-columns:repeat\(2,1fr\)/, '.media-grid must be 2 columns');
  assert.match(appHtml, /@media \(max-width:820px\)\{\.media-grid\{grid-template-columns:1fr;\}\}/, '.media-grid must stack below 820px');
  // Both jump-bar buttons survive the merge.
  assert.match(appHtml, /data-tab="image"/, 'the Image AI jump button must remain');
  assert.match(appHtml, /data-tab="video"/, 'the Video AI jump button must remain');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `app.html must have a .media-grid`.

- [ ] **Step 3: Merge the two tabpanels**

In `app.html`, find the two consecutive tabpanels:

```html
      <div class="tabpanel" id="tab-image" role="tabpanel" aria-labelledby="tabbtn-image" data-depth="midwater" hidden>
        <section id="sec-media-image">
          <div class="panel">
            <div class="panel-top">
              <h3>Top 5 image AI</h3>
              <span class="asof curated-asof">Curated</span>
            </div>
            <div class="panel-note" style="margin-bottom:14px;">Text-to-image leaders by human preference &amp; adoption · updated by hand, not live — <a class="src-link" href="https://artificialanalysis.ai/text-to-image/arena" target="_blank" rel="noopener">Artificial Analysis Image Arena</a></div>
            <div id="image-ai"></div>
          </div>
        </section>
      </div>

      <div class="tabpanel" id="tab-video" role="tabpanel" aria-labelledby="tabbtn-video" data-depth="midwater" hidden>
        <section id="sec-media-video">
          <div class="panel">
            <div class="panel-top">
              <h3>Top 5 video AI</h3>
              <span class="asof curated-asof">Curated</span>
            </div>
            <div class="panel-note" style="margin-bottom:14px;">Text/image-to-video leaders by human preference &amp; adoption · updated by hand, not live — <a class="src-link" href="https://artificialanalysis.ai/text-to-video/arena" target="_blank" rel="noopener">Artificial Analysis Video Arena</a></div>
            <div id="video-ai"></div>
          </div>
        </section>
      </div>
```

Replace with a single tabpanel containing both, as grid columns:

```html
      <div class="tabpanel" id="tab-media" data-depth="midwater">
        <div class="media-grid">
          <section id="sec-media-image">
            <div class="panel">
              <div class="panel-top">
                <h3>Top 5 image AI</h3>
                <span class="asof curated-asof">Curated</span>
              </div>
              <div class="panel-note" style="margin-bottom:14px;">Text-to-image leaders by human preference &amp; adoption · updated by hand, not live — <a class="src-link" href="https://artificialanalysis.ai/text-to-image/arena" target="_blank" rel="noopener">Artificial Analysis Image Arena</a></div>
              <div id="image-ai"></div>
            </div>
          </section>
          <section id="sec-media-video">
            <div class="panel">
              <div class="panel-top">
                <h3>Top 5 video AI</h3>
                <span class="asof curated-asof">Curated</span>
              </div>
              <div class="panel-note" style="margin-bottom:14px;">Text/image-to-video leaders by human preference &amp; adoption · updated by hand, not live — <a class="src-link" href="https://artificialanalysis.ai/text-to-video/arena" target="_blank" rel="noopener">Artificial Analysis Video Arena</a></div>
              <div id="video-ai"></div>
            </div>
          </section>
        </div>
      </div>
```

Notes on what changed and why:
- One `data-depth="midwater"` instead of two. The panel's depth **set** is unchanged (`{midwater}` either way), so the depth-parity test still passes — see Global Constraints.
- `role`/`aria-labelledby`/`hidden` are dropped, matching what `normalizeLocalNav()` strips at runtime anyway.
- `#tab-image` and `#tab-video` as *wrapper* ids are gone; the jump buttons and legacy hashes both now resolve to `#sec-media-image` / `#sec-media-video` through Task 1's `LEGACY_HASH` (via `tabTargetId()` for the buttons, directly for the hashes).
- The two `<section>` elements are the grid items directly, so each column is a `.panel` at full column width.

- [ ] **Step 4: Add the `.media-grid` CSS**

In `app.html`'s inline `<style>`, find the `.spec-grid` rules:

```css
  .spec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}
  .spec-grid>*{min-width:0;} /* same CSS Grid min-width:auto fix as .grid-2 — lets contents wrap/shrink instead of overflowing the column */
  @media (max-width:820px){.spec-grid{grid-template-columns:1fr;}}
```

Add immediately after them:

```css
  /* Image AI / Video AI: one row, two equal columns — the two lists are a
     comparison, not a sequence, so they read better beside each other than
     stacked. Same breakpoint and min-width:0 fix as .spec-grid above; the
     sections' own `section{padding:36px 0}` is zeroed here so the two panels
     align on their top edges instead of each carrying a stray band of space. */
  .media-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;align-items:start;}
  .media-grid>*{min-width:0;padding:0;}
  @media (max-width:820px){.media-grid{grid-template-columns:1fr;}}
```

- [ ] **Step 5: Update the jump-bar buttons**

The Models jump bar still has separate Image AI and Video AI buttons — keep both, they now scroll to the two columns. In `app.html` find:

```html
        <button type="button" role="tab" class="local-tab" id="tabbtn-image" data-tab="image" aria-selected="false" aria-controls="tab-image" tabindex="-1">Image AI</button>
        <button type="button" role="tab" class="local-tab" id="tabbtn-video" data-tab="video" aria-selected="false" aria-controls="tab-video" tabindex="-1">Video AI</button>
```

Replace with (dropping the now-dangling `aria-controls`, which pointed at the removed wrapper ids):

```html
        <button type="button" class="local-tab" id="tabbtn-image" data-tab="image">Image AI</button>
        <button type="button" class="local-tab" id="tabbtn-video" data-tab="video">Video AI</button>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test test/continuity.test.mjs`
Expected: PASS.

- [ ] **Step 7: Run the full gate**

Run: `npm run check`
Expected: validate passes; **241 tests pass, 0 fail**.

- [ ] **Step 8: Commit**

```bash
git add app.html test/continuity.test.mjs
git commit -m "Put Image AI and Video AI side by side

Two full-width stacked panels become two columns of one .media-grid, so the
pair reads as a comparison rather than a sequence. Stacks again below 820px,
the same breakpoint .spec-grid already uses for the Local AI cards.

The two wrapper ids (#tab-image, #tab-video) are gone, but both jump-bar
buttons and both legacy hashes still work -- nav.js resolves them to the
surviving #sec-media-image / #sec-media-video section ids. The merged panel
carries one data-depth=\"midwater\" instead of two, which leaves the Models
depth SET unchanged, so the landing/dashboard depth-parity test still holds."
```

---

## Task 5: Fix the flip-card height bug

**Files:**
- Modify: `js/sections.js` (`sizeFlipCards` / `sizeFlipCardsNow`, ~lines 320-350)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks depend on.

There is no jsdom, so this cannot be unit-tested — `scrollHeight` is a layout property that only exists in a real browser. The verification is **in-browser measurement**, specified in Step 4 with exact numbers to beat. Do not invent a fake unit test that asserts nothing.

- [ ] **Step 1: Understand the current code**

Read `js/sections.js` around lines 320-350. `sizeFlipCardsNow()` measures each `.flip-card-face`'s `scrollHeight` and sets the shared `.flip-card-inner`'s `min-height` to the tallest. The guard `if (tallest)` exists so a measurement of 0 doesn't collapse the card — but that is exactly what silently leaves it at the CSS fallback of `360px` when the card was hidden at measure time, with nothing scheduled to try again.

- [ ] **Step 2: Make sizing re-run when a card becomes measurable**

In `js/sections.js`, find:

```javascript
function sizeFlipCardsNow() {
  document.querySelectorAll('.flip-card').forEach((card) => {
    const inner = card.querySelector('.flip-card-inner');
    if (!inner) return;
    let tallest = 0;
    card.querySelectorAll('.flip-card-face').forEach((f) => { tallest = Math.max(tallest, f.scrollHeight); });
    if (tallest) inner.style.minHeight = tallest + 'px';
  });
}
```

Replace with:

```javascript
// Cards that could not be measured yet (zero-height because they, or an
// ancestor, were not rendered at the time) are retried once they are. An
// unmeasurable card silently keeps the CSS fallback min-height:360px, which
// clips a 5-row list by ~500px -- and nothing else would ever re-run this,
// since the only other triggers are a flip click and a window resize.
let pendingCards = null;

function sizeFlipCardsNow() {
  let deferred = 0;
  document.querySelectorAll('.flip-card').forEach((card) => {
    const inner = card.querySelector('.flip-card-inner');
    if (!inner) return;
    let tallest = 0;
    card.querySelectorAll('.flip-card-face').forEach((f) => { tallest = Math.max(tallest, f.scrollHeight); });
    if (tallest) inner.style.minHeight = tallest + 'px';
    else deferred += 1;
  });
  if (deferred) watchForMeasurableCards();
}

// A card reports scrollHeight 0 while it is display:none or inside a `hidden`
// ancestor. ResizeObserver fires as soon as that changes and the element gets
// a real box, which is the reliable signal that measuring will now work --
// more reliable than guessing a timeout, and it costs nothing while idle.
function watchForMeasurableCards() {
  if (pendingCards || typeof ResizeObserver === 'undefined') return;
  pendingCards = new ResizeObserver((entries) => {
    if (!entries.some((e) => e.contentRect.height > 0)) return;
    pendingCards.disconnect();
    pendingCards = null;
    sizeFlipCardsNow();
  });
  document.querySelectorAll('.flip-card').forEach((card) => pendingCards.observe(card));
}
```

- [ ] **Step 3: Run the full gate**

Run: `npm run check`
Expected: validate passes; **241 tests pass, 0 fail** (unchanged — this task adds no tests, for the reason given above).

- [ ] **Step 4: Verify in the browser — this is the real test**

Start the server (`preview_start {name: "static-site"}`), open `/app`, set the viewport to 1440×900, and run:

```javascript
(async () => { await new Promise(r=>setTimeout(r,3000));
  const probe = (sel,label) => {
    const face = document.querySelector(sel + ' .flip-card-front');
    return { label, clientH: face.clientHeight, scrollH: face.scrollHeight,
             CLIPPED_PX: Math.max(0, face.scrollHeight - face.clientHeight) };
  };
  return JSON.stringify([
    probe('#local-ai-card', 'Local AI for your PC'),
    probe('#local-mobile-card', 'Top 5 local mobile AI'),
    probe('#releases .flip-card:first-child', 'Frontier release card'),
  ], null, 1);
})()
```

Expected: **`CLIPPED_PX: 0` for all three.** Before this fix, on the land-then-click flow they were 503 / 552 / 106.

Then scroll to the Local AI cards and confirm by eye that all five rows are visible in each card with no internal scrollbar, and that flipping to the specs side still shows the full table.

- [ ] **Step 5: Commit**

```bash
git add js/sections.js
git commit -m "Fix flip cards staying at their 360px fallback height

sizeFlipCards() measures face.scrollHeight, which is 0 while the card is
inside a hidden ancestor, and the `if (tallest)` guard then skipped setting
min-height -- leaving the CSS fallback of 360px in place with nothing
scheduled to retry. On the ordinary flow (land on the page, then reveal the
Models section) that clipped Local AI for PC by 503px, local mobile AI by
552px and the release cards by 106px: the top-5 lists these cards exist to
show were cut off behind an internal scrollbar.

Unmeasurable cards are now retried via a ResizeObserver, which fires exactly
when the element first gets a real box. Measured after: 0px clipped on all
three.

Not unit-tested: scrollHeight is a layout property with no meaning outside a
real browser, and this repo has no jsdom. Verified by in-browser measurement."
```

---

## Task 6: Docs sync + full verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `Handoverhub/HANDOVER.md`
- Modify: `index.html` (one footer link label)

**Interfaces:**
- Consumes: the final state of all prior tasks.
- Produces: nothing — terminal task.

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`**

Find the `js/nav.js` module-list row:

```
        ├─ js/nav.js           4-item IA router: panel/tab activation, legacy-hash map, depth rail, anchor correction
```

Replace with:

```
        ├─ js/nav.js           one-page scroll navigation: hash/jump-bar scroll targets, scroll-spy depth rail + current pill, anchor correction
```

Then find the IA paragraph, which currently describes the panel-switching model (it begins "The page uses a 4-item IA — **Today / Ecosystem / Models / Markets** —" and goes on to say only ONE top panel is shown at a time, with the others carrying `hidden`). Replace that whole paragraph with:

```
The dashboard is a single continuous page. All four top sections — **Models /
Ecosystem / News Wave / Markets** — are `.topsection`s that are always in the
DOM and always visible, in that order; the top nav's pills (**Top, Models,
Ecosystem, News Wave, Markets**) are scroll anchors, not view switches, and
`js/nav.js` never sets `hidden`. Each long section keeps a `.local-tabs` bar,
which is a jump-to-subsection shortcut rather than a tablist. Because every
panel is always active, the depth rail and the nav's current-pill highlight
are driven by a scroll-spy that picks the last section whose top has passed
under the fixed chrome.
```

Check the surrounding lines for any remaining claim that a panel is hidden, that there is a "Full page" mode, or that `nav.js` activates panels — and correct what you find. Read before editing; do not pattern-match blindly.

- [ ] **Step 2: Update `README.md`**

Search for any description of the dashboard's navigation, "Full page", or one-panel-at-a-time behaviour:

```bash
grep -n -i "full page\|one panel\|panel at a time\|tabbed" README.md
```

Update whatever that surfaces to describe the single scrolling page. If nothing surfaces, make no change and say so in your report — do not invent an edit.

- [ ] **Step 3: Update `Handoverhub/HANDOVER.md`**

Find the `js/nav.js` row:

```
| `js/nav.js` | 4-item IA router (Today/Ecosystem/Models/Markets) + Full Page |
```

Replace with:

```
| `js/nav.js` | one-page scroll nav (Top/Models/Ecosystem/News Wave/Markets) + scroll-spy depth rail |
```

Then append to the features-shipped changelog, after the existing "Simplified the IA to 4 items" entry:

```
- **Dashboard is now one continuous page.** The panel-switching IA (one
  `.topsection` visible at a time, plus an opt-in "Full page" mode) is gone —
  Full page *is* the page, the pills are scroll anchors, and `js/nav.js` never
  sets `hidden`. Order and labels are **Top / Models / Ecosystem / News Wave /
  Markets** (`data-panel` ids are unchanged — `today` is still `today`, only
  its label reads "News Wave"). The depth rail became a scroll-spy, since
  there is no longer a single "activated" panel to read a depth from. Image AI
  and Video AI now share one row. Also fixed a long-standing bug where flip
  cards measured while hidden kept a 360px fallback height, clipping the Local
  AI top-5 lists by ~500px.
```

- [ ] **Step 4: Update the landing's footer link label**

`index.html`'s footer links to the dashboard's old full-page mode:

```html
    <a href="app.html#full">Full page</a>
```

The hash still works (Task 1 maps `#full` to the top of the page), but the label now names a mode that no longer exists. Replace with:

```html
    <a href="app.html#full">Dashboard top</a>
```

**Label only** — keep the `#full` href, since it is a published link and Task 1 deliberately keeps it resolving.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: validate passes; **241 tests pass, 0 fail**.

- [ ] **Step 6: Full browser verification pass**

Start the server and verify all of the following at 1440×900, then repeat the responsive checks at 375×812.

**Structure and order:**
```javascript
(async () => { await new Promise(r=>setTimeout(r,3000));
  return JSON.stringify({
    pills: [...document.querySelectorAll('.nav-pill[data-panel]')].map(b=>b.textContent.trim()),
    domOrder: [...document.querySelectorAll('.topsection')].map(s=>s.dataset.panel),
    anyHidden: [...document.querySelectorAll('.topsection')].filter(s=>s.hidden).map(s=>s.dataset.panel),
    jumpBars: document.querySelectorAll('.local-tabs:not([hidden])').length,
    railVisible: !document.getElementById('depth-rail').hidden,
  }, null, 1); })()
```
Expected: pills `["Top","Models","Ecosystem","News Wave","Markets"]`; `domOrder` `["models","ecosystem","today","markets"]`; `anyHidden` empty; `jumpBars` 2; `railVisible` true.

**Scroll-spy:** scroll to each section in turn (use real input scroll — `computer{action:"scroll"}` — not `scrollIntoView()`, since a background tab freezes JS-driven scrolling) and confirm at each stop that the lit depth-rail items match that section and the matching nav pill has `aria-current="page"`. Expected depth sets: Models `{surface, midwater}`, Ecosystem `{currents}`, News Wave `{surface, currents}`, Markets `{seabed}`.

**Every published hash still lands correctly** — load each and confirm the right section is at the top of the viewport:
`#full`, `#panel-today`, `#panel-ecosystem`, `#panel-models`, `#panel-markets`, `#tab-leaderboard`, `#tab-compute`, `#sec-waves`, `#sec-media`, `#sec-stocks`.

**Jump bars:** click every button in both bars; each must scroll to its subsection. Image AI and Video AI must scroll to the left and right columns respectively.

**Layout:** Image AI and Video AI side by side at 1440px, stacked at 375px. No horizontal overflow on either page at 375px (`document.documentElement.scrollWidth > innerWidth` must be `false`). Note that the landing already overflows at *desktop* width — that is pre-existing and out of scope.

**Console:** zero errors on both pages at both widths.

- [ ] **Step 7: Commit**

```bash
git add docs/ARCHITECTURE.md README.md Handoverhub/HANDOVER.md index.html
git commit -m "Sync docs to the one-page dashboard

ARCHITECTURE's module row and IA paragraph, HANDOVER's module row and
changelog, and README's nav description all updated: no more panel switching
or 'Full page' mode, new order and labels, scroll-spy depth rail.

The landing's footer link keeps its #full href -- it is a published link and
still resolves, to the top of the page -- but no longer calls it 'Full page',
a mode that no longer exists."
```

---

## Risks and Notes

1. **Tasks 1–3 are a single shippable unit.** Task 1's `PANELS` array is in the *target* order, which the DOM only matches after Task 3. Between them the scroll-spy will highlight the wrong section. Every task still passes its own tests and `npm run check`, so this is safe to commit incrementally, but do not deploy a partial sequence.

2. **Everything renders at once now.** This is not a new cost — the previous build already rendered every panel and merely hid the inactive ones — but it does mean more layout work in a single pass, and more async content above any given scroll anchor. `armAnchorCorrection()` is retained specifically for that; watch for anchors landing short during the Task 6 verification.

3. **The depth rail is now the only thing distinguishing sections at a glance**, since there is no active-panel chrome. If the scroll-spy feels noisy in practice (rapid flicker between adjacent sections at a boundary), the fix is to add hysteresis to `currentPanel()` rather than to fall back to IntersectionObserver ratios — ratios are wrong here for the reason documented in the code comment.

4. **`PANEL_TABS` is deliberately deleted, not retained.** The old controller needed it to know which tabs to unhide and which pill to mark current. The rewritten `wireLocalTabs()` reads the jump buttons straight from the DOM, so keeping the array would leave a second, unread list of subsection names to drift out of sync with the markup. Same reasoning trimmed `LEGACY_HASH` from nine entries to four — the five removed ones named elements that actually exist (`#sec-map`, `#sec-waves`, `#sec-releases`, `#sec-leaderboard`, `#sec-community`, `#sec-stocks`, `#sec-compute`), so the plain `getElementById` fallback already handled them identically.

5. **Verify the four `LEGACY_HASH` orphans really are orphans** before trusting the trimmed map. Run `grep -o 'id="sec-[a-z-]*"' app.html | sort -u` — `sec-river` and `sec-media` must be absent from the output (they were confirmed absent when this plan was written), and after Task 4 `tab-image`/`tab-video` must be gone too. If any of them turns out to exist, its entry is redundant and should be dropped rather than kept "just in case".
