# Dashboard/landing simplification: wallpaper, Tide, News Wave, Research

**Date:** 2026-07-30
**Status:** Approved, ready for implementation planning

## Problem

Four independent adjustments requested against the shell/IA that shipped in
the landing↔dashboard continuity work (PR #5, merged as `b404b14`):

1. The dashboard's ocean photo background was replaced by a shared gradient
   in that work (an accessibility fix — see below). The owner wants the
   photo back on the dashboard specifically.
2. **Tide** (a multi-day stacked-category chart on the dashboard; a 3-item
   category-count mini-list on the landing) "doesn't offer anything concrete
   and is not easy to understand."
3. **Waves** (curated "strongest signal per family" cards) and **River**
   (the full filterable chronological feed) are "basically both news about
   AI" and should merge into one section named **News Wave**.
4. **Research** (a single "Breakthrough signals" card on the dashboard; a
   standalone editorial passage on the landing) is "duplicated with Waves
   and River."

## Findings from investigation

- **Research is a literal subset, not a thematic overlap.** In
  `scripts/update-data.mjs`, `breakthroughs` are exactly the items already
  tagged `category === 'research'`, capped to the 6 newest. Those same items
  already surface via River's research-category filter and Waves' "research
  wave" family. Confirms the removal is safe and non-lossy.
- **The dashboard's local-tabs aren't real tabs.** `normalizeLocalNav()` in
  `js/nav.js` unhides every subsection at init; the tab bar is a "jump to"
  scroller, not a tablist. Waves and River are already stacked on the same
  scroll today, under two separate headings — merging them is a markup
  change (one heading, both existing mount points kept underneath), not a
  rendering rewrite.
- **The landing's version is a real tablist.** Its `#today` band uses a
  genuine `role="tablist"` (`js/landing.js`'s `wireTabs()`) that shows one
  pane at a time. Achieving the same "merged, stacked" presentation there
  requires removing that tab-switching behavior for this group specifically
  — `wireTabs()` is generic (`$$('.tabs')`) and also drives the leaderboard's
  4-view tabs elsewhere on the landing, which must not be touched.
- **Removing Research doesn't remove the `seabed` depth.** Markets
  (`tab-stocknet`, `tab-compute`) already spans `seabed`, so the depth
  rail's fourth item stays meaningful on both pages after Research is gone.
- **The wallpaper is a shared-file problem.** `body`'s background lives in
  `css/shell.css`, linked by both pages. Restoring it for the dashboard only
  means adding the photo/veil layers back into `app.html`'s own inline
  `<style>` (they visually stack above the shared gradient via `z-index`,
  no shared-file edit needed) — not touching `shell.css`.
- **Breakthrough card styling lives inline.** `.brk-card`/`.brk-top`/
  `.brk-field` are defined in `app.html`'s own `<style>` block (not
  `css/app.css`), so their removal is contained to that file.

## Decisions

Settled with the user before design:

1. **Wallpaper:** restore both the photo (`.ocean-bg`) and the legibility
   scrim (`.ocean-veil`), not a bare photo. This won't match the 5.92:1
   contrast the gradient achieved, but avoids reintroducing the original
   low-contrast complaint that motivated removing it.
2. **Scope:** all three content changes (Tide removal, Waves+River merge,
   Research removal) apply to **both pages**, not the dashboard alone —
   keeping them structurally identical, which was the point of the last
   branch.
3. **Landing's Research band:** removed entirely (nav pill + band), not
   left as a standalone editorial passage. Both pages converge on a
   matching 4-item IA: Today / Ecosystem / Models / Markets.
4. **Backend:** `data.breakthroughs` computation in
   `scripts/update-data.mjs` is left alone — unconsumed but harmless. Not a
   data-pipeline change.

## Architecture

### A. Dashboard wallpaper

Add `.ocean-bg` + `.ocean-veil` markup and CSS back into `app.html`'s own
inline `<style>`/body, including the `prefers-reduced-motion` gate on the
drift animation. Scoped entirely to that file; `css/shell.css`'s shared
gradient is untouched, so the landing is unaffected.

### B. Remove Tide — both pages

- Delete `js/tide.js`, its import and both call sites (`boot()` and the
  silent-refresh interval) in `js/main.js`, its ~19 rules in `css/app.css`.
- Dashboard (`app.html`): delete the `tab-tide`/`sec-tide` block and its
  local-tab button.
- Landing (`index.html`): delete the `tb-tide` button, `pn-tide` pane, and
  `lp-tide` mount point; remove the dead tide-rendering branch in
  `js/landing.js`'s `renderSurface()`.

### C. Merge Waves + River → "News Wave" — both pages

- Dashboard: one `<section>`, one `.section-head` titled "News Wave," both
  `#waves` and `#river` mount points kept stacked underneath — zero changes
  to `js/waveform.js` or `js/river.js`. With Tide also gone, Today's
  local-tabs bar has exactly one target left; remove it (matching Ecosystem,
  which already has none for the same reason).
- Landing: same merged heading; drop the tab-switching between `pn-waves`/
  `pn-river` (stack both `.mini` lists instead), remove the now-empty
  `.tabs`/`data-panes` wiring for this group. The leaderboard's separate
  `.tabs` group is untouched.
- **Depth preservation, both pages.** Today currently spans two depths —
  Waves is `data-depth="surface"`, River is `data-depth="currents"` — and
  `panelDepths()` in `js/nav.js` derives the dashboard's Today rail state as
  the *union* of every `data-depth` under `#panel-today`, which the landing's
  `#today` band already matches by hand-declaring
  `data-depth="surface currents"`. Merging the two into one section must
  **keep both values discoverable** — e.g. by leaving `data-depth="surface"`
  on the Waves-containing element and `data-depth="currents"` on the
  River-containing element inside the merged section, rather than collapsing
  to a single value on the outer wrapper. Losing either would silently break
  the rail (dashboard) or fail the depth-parity guard test (the mismatch
  between the two pages) — the test is the safety net, but the merge should
  be built depth-aware from the start rather than relying on the test to
  catch it after the fact.

### D. Remove Research — both pages

- Dashboard: delete `panel-research` (the "Breakthrough signals" card and
  its inline `.brk-*` styles), its topnav pill, the `research` entries in
  `js/nav.js`'s `PANELS` and `FULL_PAGE_ORDER`, and the dead `#sec-local`
  entry in `LEGACY_HASH`.
- Landing: delete the `#research` band, its `#seabed` alias anchor, and its
  nav pill.
- Backend `breakthroughs` computation: unchanged (Decision 4).

### E. Follow-through

- `test/continuity.test.mjs`'s depth-parity guard test (derives each
  dashboard panel's depth set and asserts the matching landing band
  declares the same set) drops its `research` entry — neither side exists
  anymore.
- `test/landing.test.mjs`'s empty-container list and anchor lists lose
  their Tide/Research entries.
- Footer disclaimer text, `docs/ARCHITECTURE.md` (5-item IA → 4-item),
  `README.md` (Tide entry removed, Waves+River entries merged), and
  `Handoverhub/HANDOVER.md` updated to match.

## Out of scope

- The backend `dailyCategoryHistory` computation in `scripts/lib/history.mjs`
  that fed Tide — left running; `range.json` keeps shipping the field,
  simply unconsumed by the frontend now.
- The backend `breakthroughs` computation (Decision 4).
- Any change to `PANEL_TABS.models` or `PANEL_TABS.markets` — unaffected by
  this work.
- Any change to the Ecosystem panel's own structure.

## Constraints

1. **Zero npm dependencies.** No jsdom; DOM behaviour verified in a browser.
2. **`npm run check` must pass** at every step. Baseline before this work:
   233 tests.
3. **No landing id may match** `js/deeplink.js`'s
   `/^#(full$|panel-|tab-|sec-)/` allowlist (removing `#research` and its
   `#seabed` alias satisfies this trivially — nothing new is added).
4. **`--header-h`/`--chrome-h` and the shared shell/tokens/components
   stylesheets stay as they are** — this work only adds dashboard-scoped
   wallpaper layers on top, it does not touch the shared CSS architecture
   from the last branch.

## Test impact

- `test/continuity.test.mjs`: the depth-parity test's panel↔band map loses
  its `research` entry. No other continuity test targets Tide, Waves, River,
  or Research directly, so the rest should be unaffected — must verify.
- `test/landing.test.mjs`: the empty-container list (`lp-tide` removed) and
  both anchor lists (`#research`/`#panel-research`/`#tab-tide`/`#sec-tide`/
  `#sec-local` entries removed or pruned) need updating.
- `test/render-state.test.mjs`: contains `reconcileFilter` (river) tests and
  a `tide.js` `persistedShowAll` — the tide-specific test(s) must be removed
  alongside the file.
- No expected impact to `test/signals.test.mjs` (tests the pure
  `scripts/lib/signals.mjs` scoring logic, unrelated to frontend rendering
  and to the untouched `breakthroughs` backend field).

## Verification

`npm run check` at every task, plus screenshots at each visual milestone
(wallpaper restored; Tide gone on both pages; News Wave merged on both
pages; Research gone on both pages; final responsive pass) — per the
existing standing preference for visual verification on this project.
