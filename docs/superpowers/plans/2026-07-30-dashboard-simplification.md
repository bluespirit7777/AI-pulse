# Dashboard Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the dashboard's ocean wallpaper, remove Tide, merge Waves+River into one "News Wave" section, and remove Research — all applied to both `index.html` and `app.html` so the two pages converge on a matching 4-item IA (Today / Ecosystem / Models / Markets).

**Architecture:** Pure removal/restructuring of existing markup, CSS and the small amount of JS that wires it — no new files, no data-pipeline changes. The dashboard's local-tabs bar is not a real tablist (`normalizeLocalNav()` already unhides every subsection), so most of this is markup surgery, not rendering logic. The landing's tab groups (its Today band specifically) ARE real tablists (`js/landing.js`'s `wireTabs()`), so removing tab-switching there is a genuine behavioural change, contained to that one function's target set.

**Tech Stack:** Static site, zero npm dependencies, `node --test`, no jsdom. DOM behaviour is verified in a browser via `mcp__claude-in-chrome__*`/`mcp__Claude_Browser__*` tools, not in the test suite.

**Spec:** `docs/superpowers/specs/2026-07-30-dashboard-simplification-design.md`

## Global Constraints

- **Zero npm dependencies.** Do not add any.
- **`npm run check` must pass at the end of every task.** Baseline is 233 tests, all passing.
- **Wallpaper restore is dashboard-only.** `css/shell.css`'s shared gradient must not change — the landing keeps it. The photo/veil layers go into `app.html`'s own inline `<style>`/markup only.
- **Content changes (Tide removal, Waves+River merge, Research removal) apply to both pages**, per the owner's explicit scope decision — converging both on a matching 4-item IA.
- **The backend `data.breakthroughs` computation in `scripts/update-data.mjs` is untouched** — out of scope per the owner's decision. Only the frontend stops rendering it.
- **The merged dashboard "News Wave" section must keep `data-depth="surface"` and `data-depth="currents"` independently discoverable** as descendant attributes under `#panel-today` — `js/nav.js`'s `panelDepths()` computes the depth-rail state as the union of every descendant `[data-depth]`, and the landing's `#today` band already hand-declares `data-depth="surface currents"` to match. Collapsing to one value would silently break the rail. (The landing side needs no equivalent care — its `data-depth` is a single static attribute on the band's own opening tag, independent of its inner markup.)
- **No landing id may match** `js/deeplink.js`'s `/^#(full$|panel-|tab-|sec-)/` allowlist. None of this work adds new landing ids, so this is inherited, not newly at risk.
- **Screenshot every visual milestone** (standing user preference). Start the dev server with `preview_start {name: "static-site"}` and use the `claude-in-chrome` tools against `http://localhost:5500` — the static server strips `.html`, so the dashboard is `/app` and the landing is `/`. If the in-app Browser pane won't composite frames, route through the Chrome extension tools instead (`mcp__claude-in-chrome__*`); a background/hidden tab freezes JS-driven `scrollTo`, so use real input scroll (`computer{action:"scroll"}`) rather than `element.scrollIntoView()` when a check depends on scroll position.

---

## File Structure

**Delete:**
- `js/tide.js` — the dashboard's Tide chart renderer. No other module imports from it except `js/main.js` (removed in Task 2).

**Modify:**
- `app.html` — wallpaper markup+CSS (Task 1); Today panel's Tide tabpanel (Task 2), then its Waves/River merge (Task 3); Research panel, its topnav pill, and the footer disclaimer (Task 5).
- `index.html` — Today band's Tide pane (Task 2), then its Waves/River merge (Task 4); Research band, its `#seabed` alias, its nav pill, and its footer link (Task 5).
- `js/nav.js` — `PANEL_TABS`/`LEGACY_HASH` (Tasks 2, 3, 5); `PANELS`/`FULL_PAGE_ORDER` (Task 5); header comments.
- `js/main.js` — remove the `tide.js` import and both `renderTide()` call sites (Task 2).
- `js/landing.js` — remove the Tide branch in `renderSurface()` and the `'#lp-tide'` entry in `renderLiveUnavailable()` (Task 2).
- `js/sections.js` — remove the dead `breakthroughs` render block (Task 5).
- `js/deeplink.js` — update the protected-anchors comment (Task 5).
- `css/app.css` — remove the Tide rule block (Task 2).
- `test/continuity.test.mjs` — replace the wallpaper-absence test (Task 1); add the News Wave tests (Tasks 3, 4); prune/add Research entries (Task 5).
- `test/landing.test.mjs` — remove `lp-tide` from the empty-container list (Task 2); prune Research/seabed entries (Task 5).
- `docs/ARCHITECTURE.md`, `README.md`, `Handoverhub/HANDOVER.md` — doc sync (Task 6).

**Task → deliverable map:**

| Task | Deliverable | Test count |
|---|---|---|
| 1 | Dashboard wallpaper restored (photo + veil), landing untouched | 233 → 233 (one test's body replaced; net 0) |
| 2 | Tide removed from both pages | 233 → 233 (one array entry pruned inside an existing test; no whole test added or removed) |
| 3 | Waves+River merged into "News Wave" — dashboard | 233 → 234 |
| 4 | Waves+River merged into "News Wave" — landing | 234 → 235 |
| 5 | Research removed from both pages | 235 → 236 (array entries pruned inside 3 existing tests; one new test added) |
| 6 | Docs sync + responsive/visual verification pass | 236 → 236 |

---

## Task 1: Restore the dashboard's ocean wallpaper

**Files:**
- Modify: `app.html` (inline `<style>` ~line 40-45; body markup ~line 511-513)
- Modify: `test/continuity.test.mjs` (replace the test at line 71-78)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `.ocean-bg`/`.ocean-veil` classes and markup in `app.html`, restored exactly as they existed before the landing/dashboard continuity branch removed them, scoped to that file only.

- [ ] **Step 1: Update the guard test to assert the wallpaper is present**

In `test/continuity.test.mjs`, replace the test currently at lines 71-78:

```javascript
test('the dashboard no longer paints a full-bleed photograph behind every view', () => {
  // The photo put small mono type (depth rail, ticker, section descriptors) on
  // a busy background at low contrast. The landing's gradient replaces it.
  // assets/ocean.jpg is still used as the landing's closing image and as the
  // og:image, so only the dashboard's background usage should be gone.
  assert.doesNotMatch(appHtml, /class="ocean-bg"/, 'the .ocean-bg photo layer must be removed from app.html');
  assert.doesNotMatch(appHtml, /url\(assets\/ocean\.jpg\)/, 'app.html must not paint ocean.jpg as a background');
});
```

with:

```javascript
test('the dashboard restores its ocean wallpaper, with a legibility veil', () => {
  // Reversed by explicit owner request after the continuity branch shipped.
  // The photo was originally removed because small mono type (depth rail,
  // ticker, section descriptors) read poorly directly on it -- see
  // docs/superpowers/specs/2026-07-30-landing-dashboard-continuity-design.md.
  // Restoring it WITH a legibility veil (rather than bare) keeps that fix
  // intact -- the same two-layer pattern the site used before the photo was
  // ever removed.
  assert.match(appHtml, /class="ocean-bg"/, 'app.html must paint the ocean photo again');
  assert.match(appHtml, /url\(assets\/ocean\.jpg\)/, 'the .ocean-bg layer must reference assets/ocean.jpg');
  assert.match(appHtml, /class="ocean-veil"/, 'the photo must be paired with a legibility veil, not left bare');
  // This is a dashboard-only reversal -- the shared gradient in css/shell.css,
  // and the landing that reads from it, must not change.
  assert.doesNotMatch(landingHtml, /class="ocean-bg"/, 'the landing must NOT gain a photo background');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `app.html must paint the ocean photo again` (no `.ocean-bg` exists yet).

- [ ] **Step 3: Add the wallpaper markup**

In `app.html`, find:

```html
  <a class="skip-link" href="#main-content">Skip to content</a>

  <div class="waves" aria-hidden="true">
```

Replace with:

```html
  <a class="skip-link" href="#main-content">Skip to content</a>

  <div class="ocean-bg"></div>
  <div class="ocean-veil"></div>

  <div class="waves" aria-hidden="true">
```

- [ ] **Step 4: Add the wallpaper CSS**

In `app.html`'s inline `<style>`, find:

```html
  body{
    font-size:16px;
    line-height:1.62;
  }

  /* ---------- gentle animated waves (signature element) ---------- */
  .waves{
```

Replace with:

```html
  body{
    font-size:16px;
    line-height:1.62;
  }

  /* ---------- ocean wallpaper (dashboard only; restored by owner request) ----------
   * Sits above the shared gradient from css/shell.css via z-index, so that
   * file needs no changes and the landing is unaffected. The veil is a
   * deliberate keep, not a leftover: the photo was originally removed
   * because small mono type read poorly directly on it (see
   * docs/superpowers/specs/2026-07-30-landing-dashboard-continuity-design.md).
   * Bringing the photo back without the veil would reintroduce that.
   */
  .ocean-bg{
    position:fixed;inset:-4%;z-index:-2;
    background:url(assets/ocean.jpg) center/cover no-repeat;
  }
  @media (prefers-reduced-motion: no-preference){
    .ocean-bg{animation:drift 60s ease-in-out infinite alternate;}
  }
  @keyframes drift{
    0%{transform:scale(1) translate(0,0);}
    100%{transform:scale(1.06) translate(-1%,1%);}
  }
  .ocean-veil{
    position:fixed;inset:0;z-index:-1;
    background:linear-gradient(180deg, rgba(234,244,246,0.6) 0%, rgba(234,244,246,0.7) 40%, rgba(234,244,246,0.8) 100%);
  }

  /* ---------- gentle animated waves (signature element) ---------- */
  .waves{
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/continuity.test.mjs`
Expected: PASS.

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: validate passes; **233 tests pass, 0 fail** (one test replaced, count unchanged).

- [ ] **Step 7: Screenshot and measure contrast — this is milestone 1**

Start the server (`preview_start {name: "static-site"}`), open `/app` in a fresh tab, and screenshot it. The photo should be visible behind every panel, softened by the veil.

Then measure the contrast this change affects, rather than assuming it — the whole reason the photo was removed last time was a measured failure:

```javascript
(() => {
  const el = document.querySelector('.depth-item small');
  const s = getComputedStyle(el);
  return JSON.stringify({ color: s.color, background: getComputedStyle(document.body).backgroundColor });
})()
```

Record the actual values in your report. This won't match the 5.92:1 the gradient achieved (expected — the owner explicitly chose the wallpaper over that), but confirm it's not catastrophically worse (i.e., text is still legible, not solid-color-on-solid-color).

- [ ] **Step 8: Commit**

```bash
git add app.html test/continuity.test.mjs
git commit -m "Restore the dashboard's ocean wallpaper

Reversed by explicit request: the photo (plus its legibility veil) is back
behind every dashboard view, scoped entirely to app.html's own inline
<style> and markup. css/shell.css's shared gradient -- and the landing that
reads from it -- are untouched.

The veil is a deliberate keep, not a leftover: the photo was originally
removed because small mono type read poorly directly on it. Restoring it
bare would have reintroduced that regression."
```

---

## Task 2: Remove Tide — both pages

**Files:**
- Delete: `js/tide.js`
- Modify: `app.html` (Today panel's local-tabs bar and `#tab-tide` block, ~lines 569, 594-603)
- Modify: `index.html` (Today band's tab button and pane, ~lines 269, 274)
- Modify: `js/main.js` (import at line 8; calls at lines 128, 176; comment at line 166)
- Modify: `js/landing.js` (`renderSurface()`'s Tide block, `renderLiveUnavailable()`'s `'#lp-tide'` entry)
- Modify: `css/app.css` (remove lines 283-309, the Tide rule block)
- Modify: `test/landing.test.mjs` (remove `'lp-tide'` from the containers list at line 53)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing later tasks depend on — this is a pure removal. Task 3/4 (the merge) touch the SAME region of `app.html`/`index.html` immediately after this task, so do this one first.

There is no dedicated guard test for Tide's presence to invert (nothing in `test/continuity.test.mjs` asserts Tide exists), so this task's TDD cycle is: implement the removal, then run the full suite and confirm zero regressions — the meaningful "test" is that nothing else depended on it.

- [ ] **Step 1: Delete the Tide module**

```bash
git rm js/tide.js
```

- [ ] **Step 2: Remove Tide from the dashboard's Today panel**

In `app.html`, remove the Tide button from the local-tabs bar. Find:

```html
      <div class="local-tabs" role="tablist" aria-label="Today views" data-tabgroup="today">
        <button type="button" role="tab" class="local-tab" id="tabbtn-waves" data-tab="waves" aria-selected="true" aria-controls="tab-waves" tabindex="0">Waves</button>
        <button type="button" role="tab" class="local-tab" id="tabbtn-river" data-tab="river" aria-selected="false" aria-controls="tab-river" tabindex="-1">River</button>
        <button type="button" role="tab" class="local-tab" id="tabbtn-tide" data-tab="tide" aria-selected="false" aria-controls="tab-tide" tabindex="-1">Tide</button>
      </div>
```

Replace with:

```html
      <div class="local-tabs" role="tablist" aria-label="Today views" data-tabgroup="today">
        <button type="button" role="tab" class="local-tab" id="tabbtn-waves" data-tab="waves" aria-selected="true" aria-controls="tab-waves" tabindex="0">Waves</button>
        <button type="button" role="tab" class="local-tab" id="tabbtn-river" data-tab="river" aria-selected="false" aria-controls="tab-river" tabindex="-1">River</button>
      </div>
```

Then delete the entire `#tab-tide` block that follows the `#tab-river` block:

```html
      <div class="tabpanel" id="tab-tide" role="tabpanel" aria-labelledby="tabbtn-tide" data-depth="currents" hidden>
        <section id="sec-tide">
          <div class="section-head">
            <h2 class="section-head__title">The Tide</h2>
            <span class="section-head__descriptor">How operational AI activity changes each day<s></s></span>
          </div>
          <p class="panel-note intro-note one-line-note">Daily activity by category — <b>operational only</b>, commentary excluded. <span class="fr-chip fr-live" title="Built from live daily signal counts"><span class="fr-mark" aria-hidden="true">●</span>Live</span> <details class="how-it-works"><summary>How it works</summary>A stacked view of how much moved in each operational category per day — product, research, compute, capital, policy, adoption, open source, market and org/governance. General commentary and opinion/analysis are deliberately excluded, so this tracks activity, not chatter. It only plots days actually collected and shows its real available range — it never implies history that wasn't recorded.</details></p>
          <div id="tide"></div>
        </section>
      </div>
```

(Delete this block entirely — nothing replaces it. The `</section>` immediately after it, closing `#panel-today`, stays.)

- [ ] **Step 3: Remove Tide from the landing's Today band**

In `index.html`, remove the Tide tab button. Find:

```html
      <div class="tabs" role="tablist" aria-label="Surface views">
        <button type="button" role="tab" id="tb-waves" aria-controls="pn-waves" aria-selected="true" data-tab="waves">Waves</button>
        <button type="button" role="tab" id="tb-river" aria-controls="pn-river" aria-selected="false" data-tab="river">River</button>
        <button type="button" role="tab" id="tb-tide" aria-controls="pn-tide" aria-selected="false" data-tab="tide">Tide</button>
      </div>
      <div data-panes="surface">
        <div class="pane" role="tabpanel" id="pn-waves" aria-labelledby="tb-waves" data-pane="waves"><div class="mini" id="lp-waves"></div></div>
        <div class="pane" role="tabpanel" id="pn-river" aria-labelledby="tb-river" data-pane="river" hidden><div class="mini" id="lp-river"></div></div>
        <div class="pane" role="tabpanel" id="pn-tide" aria-labelledby="tb-tide" data-pane="tide" hidden><div class="mini" id="lp-tide"></div></div>
      </div>
```

Replace with:

```html
      <div class="tabs" role="tablist" aria-label="Surface views">
        <button type="button" role="tab" id="tb-waves" aria-controls="pn-waves" aria-selected="true" data-tab="waves">Waves</button>
        <button type="button" role="tab" id="tb-river" aria-controls="pn-river" aria-selected="false" data-tab="river">River</button>
      </div>
      <div data-panes="surface">
        <div class="pane" role="tabpanel" id="pn-waves" aria-labelledby="tb-waves" data-pane="waves"><div class="mini" id="lp-waves"></div></div>
        <div class="pane" role="tabpanel" id="pn-river" aria-labelledby="tb-river" data-pane="river" hidden><div class="mini" id="lp-river"></div></div>
      </div>
```

(This intermediate 2-tab state is temporary — Task 4 removes the tab structure entirely.)

- [ ] **Step 4: Remove Tide from `js/main.js`**

Remove the import (line 8):

```javascript
import { renderTide } from './tide.js';
```

Remove both call sites. In `boot()`:

```javascript
  renderDynamic();
  paintHistoryNote();
  renderTide($('#tide'), ranges);
```

becomes:

```javascript
  renderDynamic();
  paintHistoryNote();
```

In the silent-refresh interval:

```javascript
      renderDynamic();
      paintHistoryNote();
      renderTide($('#tide'), ranges);
      applyRange(range);
```

becomes:

```javascript
      renderDynamic();
      paintHistoryNote();
      applyRange(range);
```

Update the comment above the refresh interval that lists which components restore their own filter state — find:

```javascript
  // the components restore their own filter state
  // themselves (see river.js / community.js / tide.js).
```

Replace with:

```javascript
  // the components restore their own filter state
  // themselves (see river.js / community.js).
```

- [ ] **Step 5: Remove Tide from `js/landing.js`**

In `renderSurface()`, remove the Tide computation block. Find:

```javascript
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
```

Replace with:

```javascript
  paintMeta($('#lp-surface-meta'), [
    signals.length ? `Live · ${signals.length} signals` : 'Live',
    data?.updatedAt ? 'Updated ' + timeAgo(data.updatedAt) : null,
  ]);
```

(The `byCount.length ? ... : null` line is dropped along with the category-count computation it depended on — `byCount` no longer exists. The meta line loses the "N categories today" fragment; the other two survive unchanged.)

In `renderLiveUnavailable()`, find:

```javascript
  ['#lp-waves', '#lp-river', '#lp-tide', '#lp-compute'].forEach((sel) => paintMini($(sel), [], msg));
```

Replace with:

```javascript
  ['#lp-waves', '#lp-river', '#lp-compute'].forEach((sel) => paintMini($(sel), [], msg));
```

- [ ] **Step 6: Remove the Tide CSS block**

In `css/app.css`, delete lines 283-309 in full — from the `/* ---------- the Tide (30-day stacked area) ---------- */` comment through the `.tide-note` rule:

```css
/* ---------- the Tide (30-day stacked area) ---------- */
#sec-tide .tide-collecting { line-height: 1.65; }
.tide-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.tide-range { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-dim); }
.tide-caution { font-family: var(--font-mono); font-size: 10.5px; color: var(--coral-text); }
.tide-toggle {
  font-family: var(--font-mono); font-size: 10.5px; color: var(--deep);
  background: var(--panel-solid); border: 1px solid var(--border-strong); border-radius: 8px;
  padding: 5px 12px; margin-top: 10px; cursor: pointer;
}
.tide-toggle:hover { background: var(--foam); }
.tide-toggle:focus-visible { outline: 2px solid var(--deep); outline-offset: 2px; }
.tide-band:focus-visible { outline: 2px solid var(--deep); outline-offset: -2px; opacity: 0.92; }
.tide-svg {
  width: 100%; height: auto; margin-top: 8px;
}
.tide-grid { stroke: var(--border); stroke-width: 1; }
.tide-ytick, .tide-xtick { font-family: var(--font-mono); font-size: 9px; fill: var(--ink-dim); }
.tide-ytick { text-anchor: end; }
.tide-band { transition: opacity .2s; }
.tide-band:hover { opacity: 0.92; }
.tide-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-soft); }
.tide-key { display: inline-flex; align-items: center; gap: 6px; }
.tide-swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.tide-summary { font-family: var(--font-mono); font-size: 11.5px; color: var(--ink-soft); margin: 12px 0 0; line-height: 1.6; }
.tide-note { color: var(--ink-dim); }
```

Delete this whole block, including the blank line immediately before the next rule (check the file after deleting — there should be exactly one blank line separating the previous rule block from whatever follows, not two).

**Note:** the `.tide-toggle` rule's exact middle lines above are reproduced from the current file for deletion — do not retype them from memory if they differ; delete whatever the actual file contains between the two comment/selector boundaries named in this step.

- [ ] **Step 7: Remove `lp-tide` from the landing's empty-container test**

In `test/landing.test.mjs`, find:

```javascript
  const containers = [
    'lp-ticker', 'lp-waves', 'lp-river', 'lp-tide',
    'lp-share', 'lp-lb-text', 'lp-lb-image', 'lp-lb-video', 'lp-lb-local',
    'lp-compute',
  ];
```

Replace with:

```javascript
  const containers = [
    'lp-ticker', 'lp-waves', 'lp-river',
    'lp-share', 'lp-lb-text', 'lp-lb-image', 'lp-lb-video', 'lp-lb-local',
    'lp-compute',
  ];
```

- [ ] **Step 8: Run the full gate**

Run: `npm run check`
Expected: validate passes; **233 tests pass, 0 fail** (no whole test added or removed — Step 7 pruned one array entry inside an existing test, which doesn't change the count).

- [ ] **Step 9: Screenshot both pages — this is milestone 2**

Navigate to `/app`, scroll to Today, confirm only "Waves" and "River" jump buttons remain and no Tide chart renders. Navigate to `/`, scroll to the Today band, confirm only two tabs (Waves/River) remain.

Check the console on both pages for errors — a stray reference to a removed function would throw here, not fail a test (no jsdom).

- [ ] **Step 10: Commit**

```bash
git add -A js/tide.js app.html index.html js/main.js js/landing.js css/app.css test/landing.test.mjs
git commit -m "Remove Tide from both pages

Deletes js/tide.js and every call site: the dashboard's local-tab/tabpanel,
the landing's preview tab/pane, both renderTide() calls in main.js, and the
category-count computation in landing.js's renderSurface() that fed the
landing's own separate mini-list implementation.

No dedicated test asserted Tide's presence to invert; verified instead by
running the full suite after removal and confirming zero regressions."
```

---

## Task 3: Merge Waves + River into "News Wave" — dashboard

**Files:**
- Modify: `app.html` (Today panel, ~lines 566-592 after Task 2's edits)
- Modify: `js/nav.js` (`PANEL_TABS`, `LEGACY_HASH`, header comment)
- Modify: `test/continuity.test.mjs` (add a new test)

**Interfaces:**
- Consumes: Task 2's already-Tide-free Today panel.
- Produces: a merged `#sec-waves` section containing two `data-depth`-bearing wrapper divs, which Task 5's docs and Task 6's verification reference by the same structure.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('the dashboard merges Waves and River into one "News Wave" section', () => {
  assert.match(appHtml, />News Wave</, 'app.html must show the merged "News Wave" heading');
  // Both original render mount points must survive underneath it unchanged --
  // js/waveform.js and js/river.js were not touched by this merge.
  assert.match(appHtml, /id="waves"/, 'the waves mount point must still exist');
  assert.match(appHtml, /id="river"/, 'the river mount point must still exist');
  // The old two-heading split is gone.
  assert.doesNotMatch(appHtml, /Today's strongest waves/, 'the old separate Waves heading must be gone');
  assert.doesNotMatch(appHtml, /Signal river/, 'the old separate River heading must be gone');
  // The depth union this section feeds the rail with must survive the merge:
  // panelDepths() in js/nav.js scans every descendant [data-depth], so both
  // values must still appear somewhere under #panel-today.
  const panelToday = appHtml.match(/id="panel-today"[\s\S]*?<\/section>\s*<!-- ECOSYSTEM/)?.[0];
  assert.ok(panelToday, 'could not isolate #panel-today for the depth check');
  assert.match(panelToday, /data-depth="surface"/, 'the waves portion must keep data-depth="surface"');
  assert.match(panelToday, /data-depth="currents"/, 'the river portion must keep data-depth="currents"');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `app.html must show the merged "News Wave" heading`.

- [ ] **Step 3: Merge the markup**

In `app.html`, find the local-tabs bar and both tabpanel blocks (the state Task 2 left behind):

```html
      <div class="local-tabs" role="tablist" aria-label="Today views" data-tabgroup="today">
        <button type="button" role="tab" class="local-tab" id="tabbtn-waves" data-tab="waves" aria-selected="true" aria-controls="tab-waves" tabindex="0">Waves</button>
        <button type="button" role="tab" class="local-tab" id="tabbtn-river" data-tab="river" aria-selected="false" aria-controls="tab-river" tabindex="-1">River</button>
      </div>

      <div class="tabpanel" id="tab-waves" role="tabpanel" aria-labelledby="tabbtn-waves" data-depth="surface">
        <section id="sec-waves">
          <div class="section-head">
            <h2 class="section-head__title">Today's strongest waves</h2>
            <span class="section-head__descriptor">The biggest product, market &amp; research moves<s></s></span>
          </div>
          <p class="waves-explain">One major development from each area, chosen by <b>impact — not just recency</b>. <a class="src-link how-selected" href="docs/METHODOLOGY.md#three-strongest-waves" target="_blank" rel="noopener">How selected</a></p>
          <div class="waves-grid" id="waves"></div>
        </section>
      </div>

      <div class="tabpanel" id="tab-river" role="tabpanel" aria-labelledby="tabbtn-river" data-depth="currents" hidden>
        <section id="sec-river">
          <div class="section-head">
            <h2 class="section-head__title">Signal river</h2>
            <span class="section-head__descriptor">Every story crossing the wire, newest first<s></s></span>
          </div>
          <p class="panel-note intro-note one-line-note">The full chronological stream, newest first. <span class="fr-chip fr-live" title="Duplicate reports of one event are merged into a single signal"><span class="fr-mark" aria-hidden="true">●</span>Live</span> <details class="how-it-works"><summary>How it works</summary>Duplicate reports of one event are merged into a single signal before it reaches this list. Dot size reflects significance (0–100); filter by category, entity, or time window below.</details></p>
          <div id="river"></div>
        </section>
      </div>
```

Replace with:

```html
      <section id="sec-waves">
        <div class="section-head">
          <h2 class="section-head__title">News Wave</h2>
          <span class="section-head__descriptor">The strongest signals and the full chronological stream, together<s></s></span>
        </div>
        <div class="tabpanel" data-depth="surface">
          <p class="waves-explain">One major development from each area, chosen by <b>impact — not just recency</b>. <a class="src-link how-selected" href="docs/METHODOLOGY.md#three-strongest-waves" target="_blank" rel="noopener">How selected</a></p>
          <div class="waves-grid" id="waves"></div>
        </div>
        <div class="tabpanel" data-depth="currents">
          <p class="panel-note intro-note one-line-note">The full chronological stream, newest first. <span class="fr-chip fr-live" title="Duplicate reports of one event are merged into a single signal"><span class="fr-mark" aria-hidden="true">●</span>Live</span> <details class="how-it-works"><summary>How it works</summary>Duplicate reports of one event are merged into a single signal before it reaches this list. Dot size reflects significance (0–100); filter by category, entity, or time window below.</details></p>
          <div id="river"></div>
        </div>
      </section>
```

Note: `.tabpanel` is kept as a CSS-only class here (no `role`/`aria-labelledby`/`hidden` — those were tab-switching semantics that no longer apply). It's reused purely for its existing `scroll-margin-top:var(--chrome-h)` and `.tabpanel + .tabpanel{margin-top:34px;padding-top:30px;border-top:1px solid var(--border)}` rules, which give the two stacked blocks the same visual divider they already have today — no new CSS needed.

The local-tabs bar (the `role="tablist"` div with the Waves/River buttons) is removed entirely, matching how the Ecosystem panel already has none — Today now has exactly one thing to jump to, itself.

- [ ] **Step 4: Update `js/nav.js`**

Remove the `today` key from `PANEL_TABS` entirely (matching Ecosystem's absence). Find:

```javascript
const PANEL_TABS = {
  today: ['waves', 'river', 'tide'],
  models: ['releases', 'leaderboard', 'image', 'video', 'local', 'community'],
  markets: ['stocknet', 'compute'],
};
```

Replace with:

```javascript
const PANEL_TABS = {
  models: ['releases', 'leaderboard', 'image', 'video', 'local', 'community'],
  markets: ['stocknet', 'compute'],
};
```

(This already reflects Task 2's Tide removal from the array too — there is no intermediate two-item state to write out separately, since this is the first time `PANEL_TABS.today` is touched.)

Update `LEGACY_HASH`'s Waves/River entries — Today no longer has distinct scroll targets within it, so both now resolve to the panel itself. Find:

```javascript
const LEGACY_HASH = {
  '#sec-map': { panel: 'ecosystem' },
  '#sec-waves': { panel: 'today', tab: 'waves' },
  '#sec-river': { panel: 'today', tab: 'river' },
  '#sec-releases': { panel: 'models', tab: 'releases' },
```

(Note: `#sec-tide` was already removed by Task 2.)

Replace with:

```javascript
const LEGACY_HASH = {
  '#sec-map': { panel: 'ecosystem' },
  '#sec-waves': { panel: 'today' },
  '#sec-river': { panel: 'today' },
  '#sec-releases': { panel: 'models', tab: 'releases' },
```

Update the comment describing which panels have no local tabs. Find:

```javascript
// Each top-level panel's local tab ids, in document/DOM order. Panels absent
// here (ecosystem, research) have no local tabs.
```

Replace with:

```javascript
// Each top-level panel's local tab ids, in document/DOM order. Panels absent
// here (ecosystem, today, research) have no local tabs -- today merged its
// three subsections (waves/river/tide) into one "News Wave" section with
// nothing left to jump between.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/continuity.test.mjs`
Expected: PASS.

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: validate passes; **234 tests pass, 0 fail** (Step 1 added one new test to the 233 baseline).

- [ ] **Step 7: Verify panel navigation and the depth rail still work**

Start the server, open `/app` in a fresh tab, and check:

```javascript
(() => {
  document.querySelector('.nav-pill[data-panel="markets"]').click();
  document.querySelector('.nav-pill[data-panel="today"]').click();
  const rail = [...document.querySelectorAll('#depth-rail .depth-item')].map(el => el.dataset.depth + '=' + el.dataset.active);
  return JSON.stringify({ panelVisible: !document.getElementById('panel-today').hidden, rail });
})()
```

Expected: `panelVisible: true`, and the rail shows `surface=true` and `currents=true` (both, since News Wave spans both), `midwater=false`, `seabed=false`.

- [ ] **Step 8: Screenshot — this is milestone 3**

Screenshot `/app`'s Today panel. Confirm one heading "News Wave", no jump-bar above it, waves cards followed by the river list, divided by the existing `.tabpanel + .tabpanel` border.

- [ ] **Step 9: Commit**

```bash
git add app.html js/nav.js test/continuity.test.mjs
git commit -m "Merge Waves and River into one 'News Wave' section on the dashboard

The dashboard's local-tabs were never real tabs -- normalizeLocalNav()
already unhides every subsection at init, so Waves and River were already
stacked on the same scroll under two separate headings. This collapses
them to one section, one heading, both existing #waves/#river mount points
kept underneath unchanged (zero changes to waveform.js or river.js).

Today's local-tabs bar had exactly one target left after this merge (and
after Tide's removal), so it's gone entirely -- matching Ecosystem, which
already has none for the same reason.

The merge keeps data-depth=\"surface\" and data-depth=\"currents\" as two
separate descendant attributes, not collapsed to one value on the outer
wrapper -- js/nav.js's panelDepths() unions every descendant [data-depth]
under a panel, and losing either would silently drop a depth from the rail."
```

---

## Task 4: Merge Waves + River into "News Wave" — landing

**Files:**
- Modify: `index.html` (Today band's `.copy` div, ~lines 260-278 after Task 2's edits)
- Modify: `test/continuity.test.mjs` (add a new test)

**Interfaces:**
- Consumes: Task 2's already-Tide-free Today band. Independent of Task 3 — the landing's `#today` band declares `data-depth="surface currents"` as a single static attribute on its own opening tag, not derived from its children, so this task carries no depth-preservation risk analogous to Task 3's.
- Produces: nothing later tasks depend on structurally, but Task 6's docs describe the resulting state.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('the landing merges its Waves and River previews under "News Wave"', () => {
  const todayBand = landingHtml.match(/<section class="band" id="today"[\s\S]*?<\/section>/)?.[0];
  assert.ok(todayBand, 'landing must have a #today band');
  assert.match(todayBand, />News Wave</, 'the landing must label the merged preview "News Wave"');
  assert.match(todayBand, /id="lp-waves"/, 'the waves preview mount point must still exist');
  assert.match(todayBand, /id="lp-river"/, 'the river preview mount point must still exist');
  // The tab-switching UI is gone -- both previews are stacked, not chosen between.
  assert.doesNotMatch(todayBand, /role="tablist"/, 'the Surface-views tablist must be removed');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `the landing must label the merged preview "News Wave"`.

- [ ] **Step 3: Merge the markup**

In `index.html`, find the `.copy` div's tab structure (the state Task 2 left behind):

```html
      <div class="tabs" role="tablist" aria-label="Surface views">
        <button type="button" role="tab" id="tb-waves" aria-controls="pn-waves" aria-selected="true" data-tab="waves">Waves</button>
        <button type="button" role="tab" id="tb-river" aria-controls="pn-river" aria-selected="false" data-tab="river">River</button>
      </div>
      <div data-panes="surface">
        <div class="pane" role="tabpanel" id="pn-waves" aria-labelledby="tb-waves" data-pane="waves"><div class="mini" id="lp-waves"></div></div>
        <div class="pane" role="tabpanel" id="pn-river" aria-labelledby="tb-river" data-pane="river" hidden><div class="mini" id="lp-river"></div></div>
      </div>
```

Replace with:

```html
      <span class="section-head__eyebrow" style="margin-top:18px;">News Wave<s></s></span>
      <div class="mini" id="lp-waves"></div>
      <div class="mini" id="lp-river"></div>
```

`.section-head__eyebrow` is a standalone BEM class (`css/components.css`), safe to use outside a `.section-head` wrapper — it does not depend on that ancestor. `.mini` (`{display:flex;flex-direction:column;min-height:132px}`) does not depend on its old `.pane` wrapper either; the only `.pane`-specific rule (`.pane[hidden]{display:none}`) governed tab-switching visibility, which no longer applies.

`js/landing.js`'s `paintMini($('#lp-waves'), ...)` and `paintMini($('#lp-river'), ...)` calls need no changes — both ids still exist, unmoved.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/continuity.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `npm run check`
Expected: validate passes; **235 tests pass, 0 fail** (Step 1 added one new test to Task 3's 234).

- [ ] **Step 6: Verify `wireTabs()` still works for the leaderboard's tabs**

`js/landing.js`'s `wireTabs()` is generic (`$$('.tabs')`) and also drives the leaderboard's 4-view tabs elsewhere on the landing — confirm removing the Today band's tab group didn't collaterally break that one:

```javascript
(() => {
  const tabs = document.querySelectorAll('.tabs');
  const leaderboardTab = document.querySelector('.tabs [data-tab]');
  return JSON.stringify({ tabGroupCount: tabs.length, sampleTabExists: !!leaderboardTab });
})()
```

Expected: `tabGroupCount: 1` (only the leaderboard's group remains), `sampleTabExists: true`.

- [ ] **Step 7: Screenshot — this is milestone 4**

Screenshot the landing's `#today` band. Confirm "News Wave" appears as a small label above two stacked mini-lists, no tab buttons, no interaction needed to see both.

- [ ] **Step 8: Commit**

```bash
git add index.html test/continuity.test.mjs
git commit -m "Merge Waves and River into one 'News Wave' preview on the landing

Unlike the dashboard's fake tabs, the landing's Today band used a REAL
tablist (js/landing.js's wireTabs()) that showed one preview at a time.
Removing that tab-switching -- stacking both .mini lists under one 'News
Wave' label instead -- required no JS changes: both #lp-waves/#lp-river
mount points are unmoved, and wireTabs() is generic enough that it simply
has one fewer group to wire (the leaderboard's separate tablist, verified
untouched).

No depth-preservation concern here, unlike the dashboard's version: the
landing's #today data-depth is a single static attribute on the band's own
tag, not derived from its children."
```

---

## Task 5: Remove Research — both pages

This task is not split by page: `test/continuity.test.mjs`'s depth-parity test compares the dashboard's `#panel-research` against the landing's `#research` band in a single assertion, and removing one side without the other would fail that test on whichever side still has (or lacks) matching markup. Both pages, and the shared test, land together.

**Files:**
- Modify: `app.html` (topnav pill ~line 545; Research panel ~lines 855-867; footer text ~line 872)
- Modify: `index.html` (nav pill ~line 218; `#seabed` alias + Research band ~lines 363-374; footer link ~line 393)
- Modify: `js/nav.js` (`PANELS`, `FULL_PAGE_ORDER`, `LEGACY_HASH`, header comment)
- Modify: `js/sections.js` (remove the dead `breakthroughs` render block)
- Modify: `js/deeplink.js` (update the protected-anchors comment)
- Modify: `test/continuity.test.mjs` (prune Research from 2 tests, prune the depth-parity `panelMap` entry, add a new test)
- Modify: `test/landing.test.mjs` (prune Research/seabed from 2 tests)

**Interfaces:**
- Consumes: nothing structural from Tasks 3/4 (Research is independent of Today's content), but must land after them in this plan's ordering since the depth-parity test's `today` entry (added implicitly by Tasks 3/4 passing) must stay green throughout.
- Produces: `js/nav.js`'s `PANELS` becomes `['today', 'ecosystem', 'models', 'markets']` — Task 6's docs describe this as the final 4-item IA.

- [ ] **Step 1: Write the failing test and prune the stale ones**

In `test/continuity.test.mjs`, find:

```javascript
test('the landing bands carry the dashboard\'s panel names', () => {
  for (const id of ['today', 'ecosystem', 'models', 'markets', 'research']) {
    assert.match(landingHtml, new RegExp(`id="${id}"`), `landing must have a #${id} band`);
  }
});

test('the old landing anchors still resolve, so existing links do not break', () => {
  for (const id of ['surface', 'currents', 'seabed']) {
    assert.match(landingHtml, new RegExp(`id="${id}"`), `legacy anchor #${id} must survive as an alias`);
  }
});
```

Replace with:

```javascript
test('the landing bands carry the dashboard\'s panel names', () => {
  for (const id of ['today', 'ecosystem', 'models', 'markets']) {
    assert.match(landingHtml, new RegExp(`id="${id}"`), `landing must have a #${id} band`);
  }
});

test('the old landing anchors still resolve, so existing links do not break', () => {
  for (const id of ['surface', 'currents']) {
    assert.match(landingHtml, new RegExp(`id="${id}"`), `legacy anchor #${id} must survive as an alias`);
  }
});
```

In the same file, find the depth-parity test's `panelMap`:

```javascript
  const panelMap = {
    today: 'panel-today',
    ecosystem: 'panel-ecosystem',
    models: 'panel-models',
    markets: 'panel-markets',
    research: 'panel-research',
  };
```

Replace with:

```javascript
  const panelMap = {
    today: 'panel-today',
    ecosystem: 'panel-ecosystem',
    models: 'panel-models',
    markets: 'panel-markets',
  };
```

Also find the depth-span test just above it:

```javascript
test('the landing bands declare which depths they span', () => {
  for (const id of ['today', 'ecosystem', 'models', 'markets', 'research']) {
```

Replace with:

```javascript
test('the landing bands declare which depths they span', () => {
  for (const id of ['today', 'ecosystem', 'models', 'markets']) {
```

Then append a new test asserting Research is genuinely gone from both pages:

```javascript
test('Research is removed from both pages', () => {
  assert.doesNotMatch(appHtml, /id="panel-research"/, 'app.html must not have a Research panel');
  assert.doesNotMatch(appHtml, /data-panel="research"/, 'app.html must not have a Research nav pill');
  assert.doesNotMatch(landingHtml, /id="research"/, 'index.html must not have a Research band');
  assert.doesNotMatch(landingHtml, /href="#research"/, 'index.html must not link to a Research anchor');
});
```

In `test/landing.test.mjs`, find the deeplink-forwarder test's two id lists:

```javascript
  const dashboard = [
    '#full',
    '#panel-today', '#panel-ecosystem', '#panel-models', '#panel-markets', '#panel-research',
    '#tab-waves', '#tab-river', '#tab-tide', '#tab-releases',
    '#tab-leaderboard', '#tab-image', '#tab-video', '#tab-local', '#tab-community',
    '#tab-stocknet', '#tab-compute',
    '#sec-map', '#sec-waves', '#sec-river', '#sec-tide', '#sec-releases',
    '#sec-leaderboard', '#sec-media', '#sec-community', '#sec-stocks', '#sec-compute', '#sec-local',
  ];
  for (const h of dashboard) assert.ok(re.test(h), `${h} must be forwarded to app.html`);

  // The landing's own anchors must never be captured.
  for (const h of ['#today', '#ecosystem', '#models', '#markets', '#research',
                   '#surface', '#currents', '#seabed']) {
```

Replace with:

```javascript
  const dashboard = [
    '#full',
    '#panel-today', '#panel-ecosystem', '#panel-models', '#panel-markets',
    '#tab-waves', '#tab-river', '#tab-releases',
    '#tab-leaderboard', '#tab-image', '#tab-video', '#tab-local', '#tab-community',
    '#tab-stocknet', '#tab-compute',
    '#sec-map', '#sec-waves', '#sec-river', '#sec-releases',
    '#sec-leaderboard', '#sec-media', '#sec-community', '#sec-stocks', '#sec-compute',
  ];
  for (const h of dashboard) assert.ok(re.test(h), `${h} must be forwarded to app.html`);

  // The landing's own anchors must never be captured.
  for (const h of ['#today', '#ecosystem', '#models', '#markets',
                   '#surface', '#currents']) {
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `app.html must not have a Research panel` (markup still exists).

- [ ] **Step 3: Remove Research from the dashboard**

In `app.html`, remove the topnav pill. Find:

```html
    <button type="button" class="nav-pill" data-panel="markets">Markets</button>
    <button type="button" class="nav-pill" data-panel="research">Research</button>
```

Replace with:

```html
    <button type="button" class="nav-pill" data-panel="markets">Markets</button>
```

Remove the entire Research panel. Find:

```html
    <!-- RESEARCH -->
    <section id="panel-research" class="topsection" data-panel="research" hidden>
      <section id="sec-local" data-depth="seabed">
        <div class="panel" id="sec-breakthrough">
          <div class="panel-top">
            <h3>Breakthrough signals</h3>
            <span class="asof">Rolling</span>
          </div>
          <div class="panel-note" style="margin-bottom:6px;">Research moving from lab to headline, newest first</div>
          <div id="breakthroughs" style="display:flex;flex-direction:column;gap:14px;margin-top:10px;"></div>
        </div>
      </section>
    </section>

  </main>
```

Replace with:

```html
  </main>
```

Update the footer disclaimer text. Find:

```html
    <div><b>Waves, river, tide, releases, breakthroughs &amp; stock prices</b> refresh automatically throughout the day from publisher RSS feeds, official lab YouTube channels and Yahoo Finance — every item links to its original source. <b>Leaderboard, image/video/local AI rankings, market share &amp; compute pricing</b> are curated snapshots updated by hand (see source links on each panel), not live feeds.</div>
```

Replace with:

```html
    <div><b>News Wave, releases &amp; stock prices</b> refresh automatically throughout the day from publisher RSS feeds, official lab YouTube channels and Yahoo Finance — every item links to its original source. <b>Leaderboard, image/video/local AI rankings, market share &amp; compute pricing</b> are curated snapshots updated by hand (see source links on each panel), not live feeds.</div>
```

- [ ] **Step 4: Remove Research from the landing**

In `index.html`, remove the nav pill. Find:

```html
    <a class="nav-pill" href="#markets">Markets</a>
    <a class="nav-pill" href="#research">Research</a>
```

Replace with:

```html
    <a class="nav-pill" href="#markets">Markets</a>
```

Remove the `#seabed` alias and the Research band. Find:

```html
<!-- RESEARCH -->
<span id="seabed" class="anchor-alias" aria-hidden="true"></span>
<div class="deepband" id="research" data-depth="seabed">
<div class="caust" aria-hidden="true"></div>
<div class="wrap">
  <div class="section-head rv">
    <span class="section-head__eyebrow">Slow &amp; structural<s></s></span>
    <h2 class="section-head__title">Some things only make sense at a slower frame rate.</h2>
  </div>
  <p class="lede rv">Research that hasn't landed, capital measured in years, policy still being drafted. Nothing here changes today — which is why it gets its own layer.</p>
  <div class="chips rv"><span>Impact over recency</span><span>Duplicates merged</span><span>Commentary excluded</span><span>Sources always linked</span><span>Estimates labelled as estimates</span></div>
</div>
</div>

<div class="close">
```

Replace with:

```html
<div class="close">
```

**Note:** the `<h2>`/`<p>` copy inside the deleted block ("Some things only make sense at a slower frame rate…") is editorial content specific to the Research band and is intentionally lost with it — do not try to relocate it elsewhere. Separately, the closing section's own heading a few lines below ("Read the whole tide, once a day.") uses "tide" as an ocean metaphor for "everything," not a reference to the removed Tide feature — leave it as-is, it was found during investigation and deliberately not touched.

Remove the footer's Research link. Find:

```html
    <a href="app.html#panel-markets">Markets</a>
    <a href="app.html#panel-research">Research</a>
    <a href="app.html#full">Full page</a>
```

Replace with:

```html
    <a href="app.html#panel-markets">Markets</a>
    <a href="app.html#full">Full page</a>
```

- [ ] **Step 5: Update `js/nav.js`**

Find:

```javascript
const PANELS = ['today', 'ecosystem', 'models', 'markets', 'research'];
```

Replace with:

```javascript
const PANELS = ['today', 'ecosystem', 'models', 'markets'];
```

Find:

```javascript
const FULL_PAGE_ORDER = ['ecosystem', 'models', 'today', 'markets', 'research'];
```

Replace with:

```javascript
const FULL_PAGE_ORDER = ['ecosystem', 'models', 'today', 'markets'];
```

Find, inside `LEGACY_HASH`:

```javascript
  '#sec-stocks': { panel: 'markets', tab: 'stocknet' },
  '#sec-compute': { panel: 'markets', tab: 'compute' },
  '#sec-local': { panel: 'research' },
};
```

Replace with:

```javascript
  '#sec-stocks': { panel: 'markets', tab: 'stocknet' },
  '#sec-compute': { panel: 'markets', tab: 'compute' },
};
```

Find the file's top-of-file comment:

```javascript
// Navigation controller for the 5-item IA (Today/Ecosystem/Models/Markets/
// Research), each with local tabs. Replaces the old single-scroll page with
```

Replace with:

```javascript
// Navigation controller for the 4-item IA (Today/Ecosystem/Models/Markets),
// each with local tabs where it has more than one subsection. Replaces the
// old single-scroll page with
```

Find the local-tabs comment Task 3 already updated:

```javascript
// Each top-level panel's local tab ids, in document/DOM order. Panels absent
// here (ecosystem, today, research) have no local tabs -- today merged its
// three subsections (waves/river/tide) into one "News Wave" section with
// nothing left to jump between.
```

Replace with:

```javascript
// Each top-level panel's local tab ids, in document/DOM order. Panels absent
// here (ecosystem, today) have no local tabs -- today merged its three
// subsections (waves/river/tide) into one "News Wave" section with nothing
// left to jump between.
```

- [ ] **Step 6: Remove the dead breakthroughs render in `js/sections.js`**

Find:

```javascript
  // breakthroughs
  const brk = data.breakthroughs || [];
  setHTML('breakthroughs', brk.length ? brk.map((b) => `
    <div class="brk-card">
      <div class="brk-top"><span class="brk-field">${esc(b.field)}</span><span class="asof">${esc(b.date)}</span></div>
      <h4>${esc(b.h)}</h4>
      <p>${esc(b.p)}</p>
      ${b.url ? `<div class="card-src"><span>${sourceChip('auto')} ${esc(b.sourceName || '')}</span><a class="src-link" href="${esc(b.url)}" target="_blank" rel="noopener">Read original</a></div>` : ''}
    </div>`).join('') : `<p class="empty-state">No research signals in the current window.</p>`);

  // compute pricing — live from Vast.ai + RunPod public marketplace APIs
```

Replace with:

```javascript
  // compute pricing — live from Vast.ai + RunPod public marketplace APIs
```

`data.breakthroughs` itself is still computed by `scripts/update-data.mjs` and still shipped in `latest.json` — per the owner's explicit decision, that backend computation is untouched. This only removes the frontend's now-target-less render call (`setHTML('breakthroughs', ...)` already no-ops safely if the element is missing, per `setHTML`'s own `if (el)` guard — but leaving a render call with no target is dead code, not a safety net worth keeping).

Also remove the dashboard's `.brk-card`/`.brk-top`/`.brk-field` CSS, which lived in `app.html`'s own inline `<style>` (not `css/app.css`). Find:

```html
  /* ---------- breakthrough cards ---------- */
  .brk-card{
    background:var(--panel-solid);
    border:1px solid var(--border);border-left:3px solid var(--sand);
    border-radius:12px;padding:18px 20px;
    box-shadow:0 4px 16px rgba(18,48,62,0.05);
    transition:transform .22s cubic-bezier(.16,.84,.44,1), box-shadow .22s ease, border-left-width .22s ease;
  }
  .brk-card:hover{transform:translateX(4px);box-shadow:0 10px 26px rgba(18,48,62,0.12);border-left-width:5px;}
  .brk-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}
  .brk-card h4{font-family:var(--font-display);font-size:19px;font-weight:600;margin:0 0 6px;color:var(--deep);}
  .brk-card p{font-size:13.5px;color:var(--ink-soft);margin:0;line-height:1.62;}
  .brk-field{font-family:var(--font-mono);font-size:10.5px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--sand);}

  /* ---------- footer ---------- */
```

Replace with:

```html
  /* ---------- footer ---------- */
```

- [ ] **Step 7: Update `js/deeplink.js`'s comment**

Find:

```javascript
// The match is an explicit allowlist of the dashboard's four hash shapes (see
// resolveHash + LEGACY_HASH in js/nav.js) rather than "anything the landing
// doesn't recognise", so the landing's own anchors — #today, #ecosystem,
// #models, #markets, #research — can never be captured by accident. Older
// #surface, #currents, #seabed aliases are equally protected.
```

Replace with:

```javascript
// The match is an explicit allowlist of the dashboard's four hash shapes (see
// resolveHash + LEGACY_HASH in js/nav.js) rather than "anything the landing
// doesn't recognise", so the landing's own anchors — #today, #ecosystem,
// #models, #markets — can never be captured by accident. Older #surface,
// #currents aliases are equally protected.
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test test/continuity.test.mjs test/landing.test.mjs`
Expected: PASS.

- [ ] **Step 9: Run the full gate**

Run: `npm run check`
Expected: validate passes; **236 tests pass, 0 fail** (Step 1 added one new test — "Research is removed from both pages" — to Task 4's 235; the array-entry prunes across 3 existing tests in this same step don't change the count, only what each test checks).

- [ ] **Step 10: Verify the dashboard's IA and the depth rail**

```javascript
(() => {
  const pills = [...document.querySelectorAll('.nav-pill[data-panel]')].map(b => b.dataset.panel);
  return JSON.stringify({ pills, hasResearchPanel: !!document.getElementById('panel-research') });
})()
```

Expected: `pills` is `["full","today","ecosystem","models","markets"]` (no `"research"`), `hasResearchPanel: false`.

Then confirm Markets still lights Seabed on the rail (proving its removal didn't strand that depth):

```javascript
(() => {
  document.querySelector('.nav-pill[data-panel="markets"]').click();
  return [...document.querySelectorAll('#depth-rail .depth-item')].map(el => el.dataset.depth + '=' + el.dataset.active).join(' ');
})()
```

Expected: `surface=false currents=false midwater=false seabed=true`.

- [ ] **Step 11: Screenshot both pages — this is milestone 5**

Screenshot `/app`'s topnav (4 pills, no Research) and `/`'s header nav (4 pills, no Research), plus the landing's page bottom (confirming the "Some things only make sense…" passage and its dark band are gone, transitioning straight from Markets into the closing CTA).

- [ ] **Step 12: Commit**

```bash
git add app.html index.html js/nav.js js/sections.js js/deeplink.js test/continuity.test.mjs test/landing.test.mjs
git commit -m "Remove Research from both pages

The dashboard's Research panel was exactly one thing: a 'Breakthrough
signals' card built from data.breakthroughs, which scripts/update-data.mjs
populates from items already tagged category=='research' -- the same items
already reachable via River's category filter and Waves' research family.
Not thematically similar, a literal subset.

Both pages converge on a matching 4-item IA (Today/Ecosystem/Models/
Markets). The landing's Research band was already a standalone editorial
passage with no dashboard link (a documented asymmetry from the prior
branch); it's removed rather than left orphaned, per explicit request.

Landed as one task rather than split by page: the depth-parity test
compares the dashboard panel against the landing band in a single
assertion, so a partial removal would fail on whichever side lagged.

Backend data.breakthroughs computation is untouched, per explicit decision
-- unconsumed but harmless, easy to resume if that changes. Markets keeps
the dashboard's only other 'seabed' depth source alive, verified live."
```

---

## Task 6: Docs sync + final verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `Handoverhub/HANDOVER.md`

**Interfaces:**
- Consumes: the final state of all prior tasks.
- Produces: nothing — this is the terminal task.

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`**

Find:

```
        ├─ js/nav.js           5-item IA router: panel/tab activation, legacy-hash map, depth rail, anchor correction
        ├─ js/oceanmap.js      Ecosystem: SVG current-field map + drawer (real per-range data; drawer lists the live signals that mention the node)
        ├─ js/waveform.js      strongest waves as SVG waveforms (consequence "why it matters" + "why selected")
        ├─ js/river.js         signal river (chronological, declutered filters, expand/archive)
        ├─ js/tide.js          stacked-area category volume, top-5 default + "show all" toggle
        ├─ js/stocknetwork.js  AI stock network: ecosystem + market-motion modes, drawer
```

Replace with:

```
        ├─ js/nav.js           4-item IA router: panel/tab activation, legacy-hash map, depth rail, anchor correction
        ├─ js/oceanmap.js      Ecosystem: SVG current-field map + drawer (real per-range data; drawer lists the live signals that mention the node)
        ├─ js/waveform.js      strongest waves as SVG waveforms (consequence "why it matters" + "why selected") -- presented with river.js under one "News Wave" heading
        ├─ js/river.js         signal river (chronological, declutered filters, expand/archive) -- see waveform.js
        ├─ js/stocknetwork.js  AI stock network: ecosystem + market-motion modes, drawer
```

Find:

```
The page uses a 5-item IA — **Today / Ecosystem / Models / Markets /
Research** — each a `.topsection` toggled by `js/nav.js`. Only ONE top panel
is shown at a time (the others carry `hidden`); within the shown panel, ALL
of its subsections render stacked (Today shows Waves + River + Tide together,
Models shows all six, etc.). The `.local-tabs` bar under a
```

Replace with:

```
The page uses a 4-item IA — **Today / Ecosystem / Models / Markets** — each
a `.topsection` toggled by `js/nav.js`. Only ONE top panel is shown at a time
(the others carry `hidden`); within the shown panel, ALL of its subsections
render stacked (Today shows one merged "News Wave" section — waves and river
together — Models shows all six, etc.). The `.local-tabs` bar under a
```

- [ ] **Step 2: Update `README.md`**

Find:

```
2. **Today's Strongest Waves** — the top product, market, and research story by
   a documented significance score. Each has a "why it matters" that explains the
   **consequence** of the event and a separate "why selected" line for the
   scoring; the badge reads *Stands out / Typical / Lower intensity* (an honest
   within-window comparison, not a fake time trend).
3. **Signal River** — a chronological (newest-first) timeline of everything
   crossing the wire, with merged duplicates and category/entity/time filters
   (the entity filter shows readable names — GPT, Nvidia — not ids).
4. **The Tide** — how daily **operational** AI activity changes by category
   (general commentary and analysis excluded); only plots days actually collected.
5. **AI Stock Network** — 10 AI stocks as an ecosystem depth map: node size =
   market cap, glow = relative volume, ring = day change (computed from the last
   two valid trading bars); toggle between curated **business ties** and 30-day
   **price-return correlation** (kept separate). Accessible table fallback.
6. **Community Pulse** ("Community Current") — a horizontal model selector sized
```

Replace with:

```
2. **News Wave** — the strongest product/market/research stories by a
   documented significance score, each with a "why it matters" that explains
   the **consequence** of the event and a separate "why selected" line for the
   scoring, together with the full chronological (newest-first) stream of
   everything crossing the wire, merged duplicates and category/entity/time
   filters included (the entity filter shows readable names — GPT, Nvidia —
   not ids).
3. **AI Stock Network** — 10 AI stocks as an ecosystem depth map: node size =
   market cap, glow = relative volume, ring = day change (computed from the last
   two valid trading bars); toggle between curated **business ties** and 30-day
   **price-return correlation** (kept separate). Accessible table fallback.
4. **Community Pulse** ("Community Current") — a horizontal model selector sized
```

Then renumber the remaining items in this list — find:

```
7. **Explore the depths** — frontier releases (incl. official-lab YouTube launch
```

Replace with:

```
6. **Explore the depths** — frontier releases (incl. official-lab YouTube launch
```

Find:

```
8. **Data Health** — a compact footer control showing feed success rate, stock/
```

Replace with:

```
7. **Data Health** — a compact footer control showing feed success rate, stock/
```

Check the paragraph between items 4 and 6 (formerly 6 and 7) for any reference to item numbers or to "Community Pulse" as "6" — read the surrounding text before making this edit, since item 5 (Community Pulse's own continuation text, if multi-paragraph) may also need its lead-in number checked. Renumber whatever intervening numbered references exist so the sequence reads 1 through 7 with no gaps or repeats.

- [ ] **Step 3: Update `Handoverhub/HANDOVER.md`**

Find:

```
| `js/nav.js` | 5-item IA router (Today/Ecosystem/Models/Markets/Research) + Full Page |
```

Replace with:

```
| `js/nav.js` | 4-item IA router (Today/Ecosystem/Models/Markets) + Full Page |
```

Find the features-shipped changelog entry:

```
- **Removed:** Briefing section. **Launch Radar retired entirely** — the panel
  came out first (mostly noise: internal dev-repo names from the HuggingFace
  scan, not notable releases), then the whole backend (workflow, both scripts,
  test, `data/launch-radar.json`) on the judgment that it was information bloat
  for a normal reader. Recoverable from git history if that call ever changes;
  **do not rebuild it without a fresh decision** — the former "Launch Radar is
  starving, fix its cron" known-issue and the next-step that referenced it are
  moot, not pending, and were removed with it.
```

Replace with:

```
- **Removed:** Briefing section. **Launch Radar retired entirely** — the panel
  came out first (mostly noise: internal dev-repo names from the HuggingFace
  scan, not notable releases), then the whole backend (workflow, both scripts,
  test, `data/launch-radar.json`) on the judgment that it was information bloat
  for a normal reader. Recoverable from git history if that call ever changes;
  **do not rebuild it without a fresh decision** — the former "Launch Radar is
  starving, fix its cron" known-issue and the next-step that referenced it are
  moot, not pending, and were removed with it.
- **Simplified the IA to 4 items.** Tide removed (both pages — "didn't offer
  anything concrete"); Waves and River merged into one "News Wave" section
  (both pages — they were "basically both news about AI"); Research removed
  (both pages — its one card, Breakthrough signals, was a literal subset of
  items already in River/Waves via the research category, not merely
  thematically similar). Backend `data.breakthroughs` computation and
  `dailyCategoryHistory`/`range.json` generation are both untouched —
  unconsumed but harmless, easy to resume either if that changes. The
  dashboard's ocean photo (removed for contrast in the prior continuity
  branch) came back by explicit request, paired with its original legibility
  veil, scoped to `app.html` only — the shared gradient in `css/shell.css`
  and the landing are unaffected.
```

- [ ] **Step 4: Run the full gate**

Run: `npm run check`
Expected: validate passes; **236 tests pass, 0 fail** (docs-only task, count unchanged from Task 5).

- [ ] **Step 5: Full responsive + cross-page verification pass**

Resize to 375×812 and screenshot both `/` and `/app`. Check specifically:
- no horizontal overflow on either page (`document.documentElement.scrollWidth > innerWidth` must be `false`)
- the dashboard's 4 topnav pills fit or scroll (`.topnav{overflow-x:auto}`), don't clip
- the landing's 4 header nav pills behave the same as they did before this work (unrelated to these changes, but worth a glance since the pill count changed)

Then walk the full journey once at desktop width: landing → click "Open dashboard" → dashboard's Today panel shows "News Wave" with no photo-legibility surprises → click each of the 4 topnav pills → confirm none is blank or broken → click "Landing page" → back on the landing, click through its 4 nav pills → confirm the page that used to be "Research" no longer exists in the flow.

Check the console for errors on both pages at both viewport widths.

- [ ] **Step 6: Commit**

```bash
git add docs/ARCHITECTURE.md README.md Handoverhub/HANDOVER.md
git commit -m "Sync docs to the 4-item IA

ARCHITECTURE.md's module list and IA description, README's numbered
feature list, and HANDOVER.md's IA reference and changelog all updated to
match: Tide gone, Waves+River merged into News Wave, Research gone, the
dashboard's wallpaper restored."
```

---

## Deferred (explicitly out of scope)

Recorded here so they are not silently lost:

1. **Backend `breakthroughs` computation** in `scripts/update-data.mjs` — left running by explicit decision. If ever revisited, the field is unconsumed but harmless in `latest.json`.
2. **Backend `dailyCategoryHistory` computation** in `scripts/lib/history.mjs` that fed Tide — left running; `range.json` keeps shipping the field, simply unconsumed by the frontend now.
3. **The landing's "Read the whole tide, once a day" closing headline** — found during investigation, deliberately left alone. It's an ocean-metaphor phrase for "everything," not a reference to the removed Tide chart.
