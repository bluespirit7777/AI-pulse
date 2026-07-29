# Landing ↔ dashboard continuity

**Date:** 2026-07-30
**Status:** Approved, ready for implementation planning

## Problem

`index.html` (landing) and `app.html` (dashboard) read as two separate
products. The cause is not missing links — it is a **contradiction in a shared
metaphor**.

The two pages already share the brand, the tagline, the five nav labels
(Today / Ecosystem / Models / Markets / Research), the four-level depth
vocabulary (Surface / Currents / Midwater / Seabed), working deep links in both
directions, and even the same colour values (hand-copied into `index.html`'s
`:root` with `/* app.html --ink */` comments beside them).

What breaks is that **depth means two different things**:

| | Landing | Dashboard |
|---|---|---|
| Surface/Currents/Midwater/Seabed | the **scroll order** — you descend through them | a **property of content**, cross-cutting the panels |
| Today/Ecosystem/Models/Markets | scroll anchors on the same page | panel switches |
| "Today" in the header | scrolls to `#surface` | swaps the entire view |

The landing teaches a linear descent; the dashboard then presents a grid where
Today spans both `surface` and `currents` content and Models is mostly
`midwater`. The mental model stops predicting anything at the moment of
transition. Same words, different physics.

Two secondary contributors:

1. **Duplicated components.** The landing's preview row (`row()` in
   `js/landing.js`) and the dashboard's leaderboard row (`rankRows()` in
   `js/sections.js`) render the same data in visually different components.
2. **The landing's header competes with the handoff.** Its nav links point
   *inward* at its own anchors; only the CTA and the four per-band "more" links
   point outward.

## Decisions

Settled with the user before design:

1. **Relationship:** the landing is the *front door of one product*, not a
   separate marketing site.
2. **Depth model:** the **dashboard's** model wins. Depth is a property of
   content on both pages, never a navigation spine. Chosen because the
   dashboard's five-panel IA is load-bearing in `js/nav.js`, the legacy-hash
   map, `js/deeplink.js` and the test suite.
3. **Visual language:** the **landing's** design wins. The dashboard is
   restyled up to it, not the reverse.
4. **Restyle scope:** shell + design system. Data components keep their
   density and inherit the new tokens and type. No cinematic proportions,
   hero media, or scroll-reveal inside the dashboard.

Decisions 2 and 3 are complementary, not contradictory: the dashboard keeps its
*information architecture*, the landing supplies the *visual language*.

## Architecture

### Three shared stylesheets

Both pages link all three. Page-specific CSS (the landing's hero/bands, the
dashboard's data components) stays where it currently lives.

**`css/tokens.css`** — one palette, type scale and spacing scale. Resolves the
hand-copied duplication.

The two naming schemes unify on **the dashboard's names as canonical**
(`--sea`, `--teal`, `--sand`, `--ink`, `--deep`) — not because they are better
but because they have far more call sites (~1,190 lines of dashboard CSS versus
~218 on the landing), so this minimises churn. The landing's names (`--tide`,
`--mid`, `--warm`, `--paper`, `--glass`, `--shallow`) are kept as aliases
pointing at the canonical ones, so the landing's existing rules keep working
untouched and the change lands in one commit.

Note this is a *naming* decision only, and does not contradict decision 3: the
landing's visual language still wins, it simply expresses it through the
dashboard's variable names.

**`css/shell.css`** — the chrome both pages wear, in the landing's language:

- fixed translucent `backdrop-filter` header, 64px tall, compact serif wordmark
  plus mono kicker (replaces the dashboard's static 26px-padded, 34px-wordmark
  header)
- pill nav: `border-radius: 999px`, glass hover, deep fill when current (the
  dashboard is already at `22px`, so this is a nudge, not a rebuild)
- the ocean depth gradient as body background, replacing the dashboard's flat
  fill; the dashboard's existing animated wave footer is retained
- sand focus ring and teal→warm link hover (the dashboard is teal-only today)
- the live/clock cluster
- the depth rail

**`css/components.css`** — primitives that currently exist twice:

- `.rank-row`, replacing the landing's `.r` and the dashboard's `.lb-row`
- the section heading (the landing's mono eyebrow + serif `h2` becomes the
  shared `.section-ribbon`)
- buttons: the landing's `.btn.p` / `.btn.s` and the dashboard's assorted
  button styles resolve to one primary/secondary pair
- the provenance chip family (`.fr-chip` and the landing's `.chips span`),
  which already share intent but not styling

### Landing structural change

The five bands are re-keyed to the dashboard's panel names — which the
landing's own header nav already uses:

| Current id | New id | Band content |
|---|---|---|
| `#surface` | `#today` | What just moved |
| `#currents` | `#ecosystem` | Where attention goes |
| `#models` | `#models` | Leaderboards (unchanged) |
| `#markets` | `#markets` | What an hour costs (unchanged) |
| `#seabed` | `#research` | "Slow & structural" ethos statement |

The old ids remain in the document as hidden alias anchors so existing links
keep resolving.

**The landing's rail stops being navigation and becomes the dashboard's depth
readout.** As a band scrolls into view, the rail lights the depths that band's
content actually spans — the same behaviour as `updateDepthRailMulti()` in
`js/nav.js`. Same component, same semantics, both pages. This is the change
that makes the metaphor survive the transition.

### Handoff and return

The per-band deep links already resolve correctly and need no change. Continuity
comes from the shell **not changing** across the navigation: same header, same
rail, same row component, so entering the dashboard reads as descending further
rather than arriving somewhere else.

The dashboard's plain "Landing page" text link becomes a pill occupying the same
header slot as the landing's "Open dashboard" CTA — a reciprocal control in a
stable position.

## Known asymmetry (documented, not fixed here)

`#seabed` → `#research` is honest to the nav label but the band is **not a
preview**: it is an editorial `.deepband` ("Some things only make sense at a
slower frame rate") with no data and no link into the dashboard, unlike the
four bands above it. So the landing's "Research" nav item does not preview the
dashboard's Research panel (local AI, open-weight feed, breakthroughs).

The rename makes this asymmetry more visible rather than creating it. Resolving
it — either by giving the band a real Research preview or by relabelling the nav
item — is deliberately out of scope and left as a follow-up.

## Out of scope

- Scroll-reveal, hero media or cinematic proportions inside the dashboard
- Any change to the five-panel IA
- Merging the two pages into one document
- The full CSS consolidation flagged by the earlier component audit (moving
  *all* inline `<style>` out of both pages); this design only extracts the
  shared layers, though it shrinks `app.html`'s 615-line inline block as a
  side effect

## Constraints

1. **`js/deeplink.js` allowlist.** It forwards `#(full$|panel-|tab-|sec-)` to
   `app.html`. New landing ids must avoid those four prefixes. `#today`,
   `#ecosystem` and `#research` are safe; `#panel-today` would silently bounce
   visitors off the landing page.
2. **Landing CSP.** `style-src 'self' 'unsafe-inline'` permits external
   stylesheets. `script-src 'self'` with no `unsafe-inline` — no inline script
   may be added.
3. **The dashboard header sits under every view**, so restyling it needs
   verification at both desktop and mobile widths.

## Test impact

- `test/landing.test.mjs` asserts every landing nav anchor resolves to a real
  element; it updates with the rename.
- The same file asserts dashboard deep links target `app.html#…` and that the
  landing ships no inline script. Both must continue to hold.
- `test/landing.test.mjs`'s deeplink-forwarder test enumerates landing anchors
  that must *not* be forwarded; the new ids join that list.
- No change expected to `test/leaderboard.test.mjs` — `.rank-row` is a styling
  and markup unification, not a data change.

## Verification

`npm run check` must pass at every step. Beyond that, per an explicit standing
user preference, **each visual milestone gets a screenshot** rather than only
DOM assertions:

| # | Milestone | Evidence |
|---|---|---|
| 1 | Shared tokens + shell live on the landing | Landing visually unchanged — proves the extraction was lossless |
| 2 | Dashboard adopts the landing header + gradient | The largest single visual shift |
| 3 | Unified `.rank-row` | Leaderboard rows identical across both pages |
| 4 | Landing bands renamed + depth readout | The metaphor fix, in both nav states |
| 5 | Both pages at mobile width | Regression check on the restyled header |

**Environment blocker:** screenshots currently fail with *"the Browser pane is
not displayed, so the page is not compositing frames"*, and no Chrome extension
is connected as a fallback. The Browser pane must be visible before
implementation begins, or milestones 1–5 cannot be evidenced.
