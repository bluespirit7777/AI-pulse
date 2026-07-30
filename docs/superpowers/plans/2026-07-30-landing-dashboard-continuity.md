# Landing ↔ Dashboard Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `index.html` and `app.html` read as one product by extracting three shared stylesheets, restyling the dashboard to the landing's visual language, and resolving the depth-metaphor contradiction between them.

**Architecture:** Three new CSS layers (`tokens` → `shell` → `components`) linked by both pages, with page-specific CSS left in place. The landing's five bands are re-keyed to the dashboard's panel names, and the landing's rail is demoted from navigation to the same depth *readout* the dashboard already has.

**Tech Stack:** Static site. Plain ES modules, no bundler, no framework, **zero npm dependencies**. Tests are `node --test` source-text guards plus pure unit tests.

**Spec:** `docs/superpowers/specs/2026-07-30-landing-dashboard-continuity-design.md`

## Global Constraints

- **Zero npm dependencies.** Do not add any. There is no jsdom; DOM behaviour is verified in a browser, not in tests.
- **No inline `<script>` in `index.html`.** Its CSP is `script-src 'self'` with no `unsafe-inline`. Inline `<style>` **is** allowed (`style-src 'self' 'unsafe-inline'`), as are same-origin stylesheets.
- **New landing ids must not match `/^#(full$|panel-|tab-|sec-)/`.** `js/deeplink.js` forwards anything matching that regex to `app.html`. `#today`, `#ecosystem`, `#research` are safe; `#panel-today` would bounce visitors off the landing page.
- **`npm run check` must pass at the end of every task.** Baseline is 209 tests passing.
- **Do not change the five-panel IA** (`PANELS` / `PANEL_TABS` / `LEGACY_HASH` in `js/nav.js`).
- **Dashboard data components keep their density.** No scroll-reveal, no hero media, no cinematic proportions inside `app.html`.
- **Screenshot every visual milestone** (standing user preference). The in-app Browser pane does not composite; use the `claude-in-chrome` tools against `http://localhost:5500`. Start the server with `preview_start {name: "static-site"}`. Note `serve` strips `.html`, so the dashboard is at `/app`, not `/app.html`.

---

## File Structure

**Create:**
- `css/tokens.css` — the single palette, type and spacing scale. No selectors except `:root`.
- `css/shell.css` — chrome shared by both pages: body background, containment, header, nav pills, focus ring, live/clock, depth rail.
- `css/components.css` — primitives that currently exist twice: `.rank-row`, section heading, buttons.
- `test/continuity.test.mjs` — source-text guards for the contracts this work establishes.

**Modify:**
- `index.html` — link the three stylesheets, delete the duplicated `:root`, rename five band ids, add alias anchors, add `data-depth`, adopt the shared header / heading / button classes.
- `app.html` — link the three stylesheets, delete duplicated `:root` entries, swap the photographic background for the gradient, restyle header, add return pill, convert 11 section ribbons.
- `css/app.css` — remove rules superseded by `shell.css` / `components.css`.
- `js/landing.js` — emit `.rank-row` markup; convert `wireRail` from navigation to depth readout.
- `js/sections.js` — emit `.rank-row` markup; retarget `animateBars()`.
- `js/nav.js` — three `.topnav-item` selectors become `.nav-pill[data-panel]`.
- `test/landing.test.mjs` — update the landing-anchor list for the renamed ids.
- `package.json` — register `test/continuity.test.mjs` in the `test` script.

**Task → deliverable map** (each row is independently reviewable and ends green):

| Task | Deliverable | Milestone screenshot |
|---|---|---|
| 1 | `tokens.css`, both pages linked, `--foam`/`--mist` split | 1 — both pages *unchanged* |
| 2 | `shell.css`: gradient background + one measure | 2 — the big visual shift |
| 3 | Shared header, nav pill, focus ring, return pill | 2b |
| 4 | Unified `.rank-row` | 3 |
| 5 | Landing bands re-keyed + alias anchors | — |
| 6 | Rail becomes a depth readout | 4 — the metaphor fix |
| 7 | Shared section heading + buttons | — |
| 8 | Responsive + cross-page journey | 5 |

---

## Task 1: Extract shared design tokens

Establishes one palette for both pages and removes the hand-copied duplication in `index.html`'s `:root`. Purely mechanical — **both pages must look identical afterwards**, which is the test.

**Files:**
- Create: `css/tokens.css`
- Create: `test/continuity.test.mjs`
- Modify: `index.html` (head + `:root` block, lines ~28–53)
- Modify: `app.html` (head + `:root` block, lines ~33–60)
- Modify: `package.json` (add the new test file)

**Interfaces:**
- Consumes: nothing.
- Produces: `css/tokens.css` defining canonical tokens `--ink --ink-soft --ink-dim --panel --panel-solid --border --border-strong --teal --sea --sand --coral --coral-text --deep --foam --mist --paper --glass --shallow --font-display --font-mono --font-body --maxw --text-outline`, plus landing aliases `--tide --mid --warm --serif --sans --mono`. Later tasks reference these names.

**Critical detail — the `--foam` collision.** `--foam` is `#F4FAFB` on the landing (3 usages, all gradient endpoints) and `#EAF4F6` on the dashboard (18 usages, hover backgrounds). The dashboard's value stays `--foam`; the landing's pale value becomes a new token `--mist`, and the landing's three usages are rewritten. Merging them naively would visibly change one of the two pages.

- [ ] **Step 1: Write the failing test**

Create `test/continuity.test.mjs`:

```javascript
#!/usr/bin/env node
// Guard tests for landing <-> dashboard continuity. This project has zero npm
// dependencies and therefore no jsdom, so these are source-text contracts in
// the same style as test/landing.test.mjs — they pin the structural promises
// the two pages make to each other. Visual correctness is verified by
// screenshot in the browser, not here.
// Run: node --test test/continuity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(__dirname, '..', p), 'utf-8');

const landingHtml = read('index.html');
const appHtml = read('app.html');
const tokensCss = read('css/tokens.css');

test('both pages link the shared token stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/tokens\.css"/, `${name} must link css/tokens.css`);
  }
});

test('neither page redefines a canonical colour token locally', () => {
  // The whole point of tokens.css is that there is ONE definition. A local
  // redefinition is exactly the drift this replaces (index.html used to
  // hand-copy the dashboard's hexes with "/* app.html --ink */" beside them).
  const canonical = ['--ink', '--deep', '--teal', '--sea', '--sand', '--foam'];
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    const styleBlocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const token of canonical) {
      assert.doesNotMatch(
        styleBlocks,
        new RegExp(`${token}\\s*:`),
        `${name} redefines ${token} locally; it belongs in css/tokens.css`
      );
    }
  }
});

test('tokens.css keeps the two pages\' conflicting pale tone separate', () => {
  // --foam was #F4FAFB on the landing and #EAF4F6 on the dashboard. Collapsing
  // them would visibly change one page, so the landing's pale value lives on
  // as --mist.
  assert.match(tokensCss, /--foam:\s*#EAF4F6/i, '--foam keeps the dashboard value (18 usages)');
  assert.match(tokensCss, /--mist:\s*#F4FAFB/i, "--mist carries the landing's pale value");
});

test('the landing keeps its aliases so its existing rules still resolve', () => {
  for (const alias of ['--tide', '--mid', '--warm', '--serif', '--sans', '--mono']) {
    assert.match(tokensCss, new RegExp(`${alias}\\s*:`), `${alias} alias missing from tokens.css`);
  }
});

test('no page still uses var(--foam) where it meant the landing pale tone', () => {
  // The landing's three gradient endpoints must have moved to --mist.
  const landingStyles = [...landingHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const gradientLines = landingStyles.split('\n').filter((l) => /linear-gradient/.test(l) && /var\(--foam\)/.test(l));
  assert.deepEqual(gradientLines, [], `landing gradients must use var(--mist): ${gradientLines.join(' | ')}`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `ENOENT` on `css/tokens.css`, because the file does not exist yet.

- [ ] **Step 3: Create `css/tokens.css`**

```css
/* The single source of truth for colour, type and measure across BOTH pages.
 *
 * index.html used to hand-copy these hexes into its own :root with comments
 * like "/* app.html --ink */" beside them — a duplication that had already
 * started to drift. Both pages now link this file instead.
 *
 * Canonical names are the DASHBOARD's, purely because they have far more call
 * sites (~1,190 lines of dashboard CSS vs ~218 on the landing), so this
 * minimises churn. The landing's names are kept as aliases below, which means
 * the landing's existing rules keep working untouched. This is a naming
 * decision only: the landing's visual language is still the one both pages
 * speak, it just expresses it through these variable names.
 */
:root{
  /* ---- ink ---- */
  --ink:#0E2A37;
  --ink-soft:#2E4B57;
  --ink-dim:#456170;

  /* ---- surfaces ---- */
  --panel:rgba(250,253,254,0.95);
  --panel-solid:#FAFDFE;
  --paper:#FDFEFE;
  --glass:#E3EDEF;
  --shallow:#B9D4D7;
  --border:rgba(18,48,62,0.12);
  --border-strong:rgba(18,48,62,0.22);

  /* ---- water ---- */
  --teal:#2E7D82;
  --sea:#3E8FA3;
  --deep:#1B4B5A;
  --foam:#EAF4F6;   /* dashboard hover/tint — 18 usages */
  --mist:#F4FAFB;   /* the landing's paler tone; NOT the same as --foam */

  /* ---- accents ---- */
  --sand:#B08D52;
  --coral:#C06A5C;
  /* --coral on --panel-solid measures ~3.76:1 — fails WCAG AA for normal-sized
     text (needs 4.5:1). This darker variant is for TEXT only; --coral stays for
     large shapes, borders, chart marks and decorative accents. */
  --coral-text:#9C4739;

  /* ---- type ---- */
  --font-display:'Cormorant Garamond',Georgia,serif;
  --font-mono:'IBM Plex Mono',ui-monospace,monospace;
  --font-body:'Karla',system-ui,sans-serif;

  /* ---- measure ----
     Unified at the dashboard's 1240px rather than the landing's 1200px: the
     40px difference is imperceptible, and the dashboard holds wider content
     (1000-unit SVG viewBoxes) that would otherwise need re-tuning. */
  --maxw:1240px;

  /* thin white outline for text sitting directly on photography with no panel
     behind it — keeps the text's own colour, adds legibility */
  --text-outline:
    -0.5px -0.5px 0 #fff, 0.5px -0.5px 0 #fff,
    -0.5px 0.5px 0 #fff, 0.5px 0.5px 0 #fff;

  /* ---- landing aliases ----
     So index.html's existing rules resolve without being rewritten. */
  --tide:var(--sea);
  --mid:var(--teal);
  --warm:var(--sand);
  --serif:var(--font-display);
  --sans:var(--font-body);
  --mono:var(--font-mono);
}
```

- [ ] **Step 4: Link it from both pages**

In `index.html`, immediately after the Google Fonts `<link>` (currently line 33), add:

```html
<link rel="stylesheet" href="css/tokens.css">
```

In `app.html`, immediately before `<link rel="stylesheet" href="css/app.css">`, add:

```html
<link rel="stylesheet" href="css/tokens.css">
```

Order matters: `tokens.css` must load before any stylesheet or `<style>` block that consumes the variables.

- [ ] **Step 5: Delete the duplicated `:root` blocks**

In `index.html`, delete the entire `:root{ … }` block (currently lines 36–52, from `--foam:#F4FAFB;` through `--maxw:1200px;`) including its `/* Palette is app.html's, not the mockup's … */` comment. Leave the rest of the `<style>` block untouched.

In `app.html`, delete every declaration inside its `:root{ … }` block that `tokens.css` now defines — that is the whole block, including the `--coral-text` and `--text-outline` comments, which moved verbatim into `tokens.css`.

- [ ] **Step 6: Rewrite the landing's three `--foam` gradient usages to `--mist`**

In `index.html`:

```css
body{
  margin:0;
  background:linear-gradient(180deg,var(--mist) 0%,#EFF7F8 16%,#E8F3F4 38%,#E1EFF1 56%,#E8F3F4 74%,var(--mist) 92%);
  background-attachment:fixed;
  color:var(--ink);font-family:var(--sans);font-weight:400;-webkit-font-smoothing:antialiased;
}
```

And the hero overlay:

```css
.hero:after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:linear-gradient(180deg,rgba(244,250,251,.82) 0%,rgba(244,250,251,.34) 34%,rgba(244,250,251,.56) 64%,var(--mist) 100%)}
```

And the third usage (a `linear-gradient(180deg,var(--foam),transparent)`) becomes `linear-gradient(180deg,var(--mist),transparent)`.

- [ ] **Step 7: Register the new test file**

In `package.json`, append `test/continuity.test.mjs` to the `test` script's file list.

- [ ] **Step 8: Run the full gate**

Run: `npm run check`
Expected: validate passes; **214 tests pass, 0 fail** (209 baseline + 5 new).

- [ ] **Step 9: Screenshot both pages and confirm they are UNCHANGED**

This task is a refactor. Any visible difference is a bug.

```
preview_start {name: "static-site"}
```

Then via `claude-in-chrome`: navigate to `http://localhost:5500/` and screenshot; navigate to `http://localhost:5500/app` and screenshot. Compare against the baselines captured before this work. If anything shifted, a token value was transcribed wrong — most likely `--foam` vs `--mist`.

- [ ] **Step 10: Commit**

```bash
git add css/tokens.css test/continuity.test.mjs index.html app.html package.json
git commit -m "Extract shared design tokens into css/tokens.css

index.html hand-copied the dashboard's hex values into its own :root with
'/* app.html --ink */' comments beside them. Both pages now link one file.

Canonical names are the dashboard's (far more call sites); the landing's
names survive as aliases so its existing rules resolve untouched.

--foam was a real collision: #F4FAFB on the landing, #EAF4F6 on the
dashboard. The dashboard's value keeps the name; the landing's paler tone
becomes --mist, so neither page changes appearance."
```

---

## Task 2: Shared shell — background and containment

The largest single visual change. The dashboard's full-bleed ocean photograph is replaced by the landing's gradient, and both pages adopt one measure. This is also an **accessibility fix**: the dashboard's small mono type currently sits on a busy photograph at low contrast.

**Files:**
- Create: `css/shell.css`
- Modify: `app.html` (head; `.ocean-bg` / `.ocean-veil` rules ~lines 77–92; the two markup divs ~lines 655–656; `.wrap` line ~288)
- Modify: `index.html` (head; `body` rule)
- Modify: `test/continuity.test.mjs`

**Interfaces:**
- Consumes: every token from Task 1, especially `--mist`, `--foam`, `--maxw`.
- Produces: `css/shell.css` owning `body` background and `.wrap`. Later tasks add header, nav and rail rules to this same file.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('both pages link the shared shell stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/shell\.css"/, `${name} must link css/shell.css`);
  }
});

test('the dashboard no longer paints a full-bleed photograph behind every view', () => {
  // The photo put small mono type (depth rail, ticker, section descriptors) on
  // a busy background at low contrast. The landing's gradient replaces it.
  // assets/ocean.jpg is still used as the landing's closing image and as the
  // og:image, so only the dashboard's background usage should be gone.
  assert.doesNotMatch(appHtml, /class="ocean-bg"/, 'the .ocean-bg photo layer must be removed from app.html');
  assert.doesNotMatch(appHtml, /url\(assets\/ocean\.jpg\)/, 'app.html must not paint ocean.jpg as a background');
});

test('the dashboard keeps its animated wave footer (a signature element, not the photo)', () => {
  assert.match(appHtml, /class="waves"/, 'the wave footer stays');
});

test('one measure governs both pages', () => {
  const shellCss = read('css/shell.css');
  assert.match(shellCss, /\.wrap\{[^}]*max-width:\s*var\(--maxw\)/, '.wrap must use the shared --maxw');
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /\.wrap\{[^}]*max-width:\s*\d+px/, 'app.html must not hardcode its own measure');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `ENOENT` on `css/shell.css`.

- [ ] **Step 3: Create `css/shell.css`**

```css
/* Chrome shared by index.html and app.html.
 *
 * Both pages wear the same shell so that moving between them reads as
 * descending further into one product rather than arriving somewhere else.
 * The visual language is the LANDING's — the calmer of the two — which means
 * this file mostly calms the dashboard down.
 *
 * Requires css/tokens.css to be linked first.
 */

/* ---------- body background ----------
 * The landing's depth gradient, now on both pages. It replaces the dashboard's
 * full-bleed photograph of the ocean, which sat behind every view and put the
 * depth rail, the ticker and the section descriptors on a busy backdrop at low
 * contrast. The dashboard's animated wave footer is untouched — that is a
 * signature element, and it sits at the bottom edge where nothing reads over it.
 */
body{
  margin:0;
  color:var(--ink);
  font-family:var(--font-body);
  -webkit-font-smoothing:antialiased;
  min-height:100vh;
  position:relative;
  background:linear-gradient(
    180deg,
    var(--mist) 0%,
    #EFF7F8 16%,
    #E8F3F4 38%,
    #E1EFF1 56%,
    #E8F3F4 74%,
    var(--mist) 92%
  );
  background-attachment:fixed;
}

/* ---------- measure ----------
 * The landing held a visible 1240px column while the dashboard ran to the
 * viewport edge. Side by side that read as "two products" more strongly than
 * the palette did.
 */
.wrap{
  max-width:var(--maxw);
  margin:0 auto;
  padding:0 clamp(16px,4vw,48px);
  position:relative;
  z-index:2;
}
```

- [ ] **Step 4: Link it from both pages**

In both `index.html` and `app.html`, immediately after the `tokens.css` link:

```html
<link rel="stylesheet" href="css/shell.css">
```

- [ ] **Step 5: Remove the dashboard's photographic background**

In `app.html`, delete these two markup lines (currently ~655–656):

```html
  <div class="ocean-bg"></div>
  <div class="ocean-veil"></div>
```

Then delete their CSS — the `.ocean-bg` rule, the `@media (prefers-reduced-motion: no-preference){ .ocean-bg{…} }` block, the `@keyframes drift` block, and the `.ocean-veil` rule (currently ~lines 77–92).

Also delete `app.html`'s now-superseded `body{ … }` rule and its `.wrap{ … }` rule (line ~288); both live in `shell.css` now.

- [ ] **Step 6: Remove the landing's superseded `body` rule**

In `index.html`, delete the `body{ … }` rule you edited in Task 1 — `shell.css` now owns it. Leave `html{scroll-behavior:smooth;overflow-x:clip}` and everything else in place.

- [ ] **Step 7: Run the full gate**

Run: `npm run check`
Expected: validate passes; **218 tests pass, 0 fail**.

- [ ] **Step 8: Screenshot the dashboard — this is milestone 2**

Navigate to `http://localhost:5500/app` and screenshot. Expect: the photograph gone, replaced by the landing's soft gradient; the wave footer still present; content now held in a centred column.

- [ ] **Step 9: Measure the contrast that motivated this change**

Do not assume the accessibility win — measure it. In the browser, run:

```javascript
(() => {
  const el = document.querySelector('.depth-item small');
  const s = getComputedStyle(el);
  return JSON.stringify({ color: s.color, background: getComputedStyle(document.body).backgroundColor });
})()
```

Record the values in the commit message. The target for this small text is WCAG AA (4.5:1). If it still fails, darken `.depth-item small` to `var(--ink-soft)` and re-measure rather than leaving it.

- [ ] **Step 10: Commit**

```bash
git add css/shell.css index.html app.html test/continuity.test.mjs
git commit -m "Share one background and one measure across both pages

Replaces the dashboard's full-bleed ocean photograph with the landing's
gradient. This is an accessibility fix as much as an aesthetic one: the
depth rail, ticker and section descriptors are small mono type that sat
directly on a busy photo at low contrast.

Also unifies the measure. The landing held a centred column while the
dashboard ran edge-to-edge, which side by side read as 'two products'
more strongly than the palette did.

The animated wave footer stays — it is a signature element and sits at
the bottom edge where nothing reads over it."
```

---

## Task 3: Shared shell — header, nav pills and focus ring

**Files:**
- Modify: `css/shell.css` (append)
- Modify: `app.html` (header markup ~lines 669–685; `.header` / `.brand` / `.topnav` / `.topnav-item` rules ~lines 118–222)
- Modify: `index.html` (`header.nav` / `.brand` / `nav.links` / `.navcta` rules ~lines 72–86)
- Modify: `test/continuity.test.mjs`

**Interfaces:**
- Consumes: Task 1 tokens; Task 2's `body` / `.wrap`.
- Produces: shared classes `.site-header`, `.site-brand`, `.nav-pill`, `.nav-pill[aria-current]`, `.live-cluster`. Task 6 adds `.depth-rail` to this file.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('both pages use the shared header and brand classes', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /class="[^"]*site-header/, `${name} must use .site-header`);
    assert.match(html, /class="[^"]*site-brand/, `${name} must use .site-brand`);
  }
});

test('both pages offer a reciprocal control to the other page, in the header', () => {
  // The landing has always had "Open dashboard"; the dashboard's way back was
  // a plain text link in a different position. Both are now pills in the same
  // header slot, so the control does not move as you cross between pages.
  assert.match(landingHtml, /class="[^"]*nav-pill[^"]*"[^>]*href="app\.html"/, 'landing needs its dashboard pill');
  assert.match(appHtml, /class="[^"]*nav-pill[^"]*"[^>]*href="\.\/"/, 'dashboard needs its landing pill');
});

test('the focus ring is one colour across both pages', () => {
  const shellCss = read('css/shell.css');
  assert.match(shellCss, /:focus-visible\{[^}]*outline:[^;]*var\(--sand\)/, 'shared sand focus ring');
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /focus-visible\{[^}]*outline:\s*2px solid var\(--teal\)/, 'app.html must not keep its own teal focus ring');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `index.html must use .site-header`.

- [ ] **Step 3: Append the shared header to `css/shell.css`**

```css
/* ---------- header ----------
 * The landing's treatment: fixed, translucent, compact. The dashboard's was
 * static, 26px-padded, with a 34px wordmark sitting directly on photography.
 */
.site-header{
  position:fixed;top:0;left:0;right:0;z-index:60;
  backdrop-filter:blur(14px) saturate(1.3);
  background:rgba(253,254,254,.88);
  border-bottom:1px solid rgba(185,212,215,.55);
}
.site-header .wrap{display:flex;align-items:center;gap:24px;height:64px;}

.site-brand{display:flex;align-items:baseline;gap:10px;margin-right:auto;}
.site-brand b,.site-brand h1{
  font-family:var(--font-display);font-weight:700;font-size:22px;
  color:var(--deep);margin:0;letter-spacing:.01em;
}
.site-brand a{color:inherit;text-decoration:none;}
.site-brand a:hover,.site-brand a:focus-visible{color:var(--teal);}
.site-brand span{
  font-family:var(--font-mono);font-size:9.5px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--sea);
}

/* ---------- nav pills ----------
 * One pill for both pages' navigation and for the reciprocal cross-page
 * control, so the chrome does not change shape as you move between them.
 */
.nav-pill{
  font-family:var(--font-body);font-size:13px;font-weight:500;letter-spacing:.03em;
  white-space:nowrap;padding:7px 13px;border-radius:999px;
  color:var(--teal);background:transparent;border:1px solid transparent;
  cursor:pointer;text-decoration:none;transition:background .25s,color .25s,transform .15s;
}
.nav-pill:hover{background:var(--glass);color:var(--deep);transform:translateY(-1px);}
.nav-pill[aria-current="page"],.nav-pill.is-current{
  background:var(--deep);border-color:var(--deep);color:var(--paper);
}
.nav-pill--cta{background:var(--deep);color:var(--paper);padding:9px 17px;}
.nav-pill--cta:hover{background:var(--ink);color:var(--paper);}
/* "Full page" is a view-mode toggle, not a destination — a dashed border marks
   that distinction without relying on colour alone. */
.nav-pill--mode{border-style:dashed;border-color:var(--border-strong);color:var(--ink-soft);}
.nav-pill--mode[aria-current="page"]{border-style:solid;}

/* ---------- live / clock ---------- */
.live-cluster{
  display:flex;align-items:center;gap:8px;
  font-family:var(--font-mono);font-size:11px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--teal);font-variant-numeric:tabular-nums;
}
.live-cluster .dot{width:6px;height:6px;border-radius:50%;background:var(--sand);}
@media (prefers-reduced-motion:no-preference){
  .live-cluster .dot{animation:pulse 2.6s ease-in-out infinite;}
}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.75)}}

/* ---------- focus ----------
 * One ring colour across both pages. The dashboard used teal, the landing sand.
 */
:focus-visible{outline:2px solid var(--sand);outline-offset:3px;border-radius:4px;}
```

- [ ] **Step 4: Convert the landing's header markup**

In `index.html`, replace the header block:

```html
<header class="site-header">
<div class="wrap">
  <div class="site-brand"><b>AI Market Pulse</b><span>Quiet view</span></div>
  <nav class="links" aria-label="Sections of this page">
    <a class="nav-pill" href="#surface">Today</a>
    <a class="nav-pill" href="#currents">Ecosystem</a>
    <a class="nav-pill" href="#models">Models</a>
    <a class="nav-pill" href="#markets">Markets</a>
    <a class="nav-pill" href="#seabed">Research</a>
  </nav>
  <div class="live-cluster"><span class="dot" aria-hidden="true"></span><span id="lp-clock">--:--:--</span> UTC</div>
  <a class="nav-pill nav-pill--cta" href="app.html">Open dashboard</a>
</div>
</header>
```

**Keep the existing `href` values (`#surface`, `#currents`, `#seabed`) in this
task.** This task changes CSS classes only. `test/landing.test.mjs` asserts that
every `href="#…"` in `index.html` resolves to a real `id` on the page, so
pointing these at `#today`/`#ecosystem`/`#research` before Task 5 creates those
ids would fail the suite mid-plan. Task 5 flips the ids and these hrefs together
in one commit.

Then delete the superseded `header.nav`, `.nav .wrap`, `.brand`, `.brand b`, `.brand span`, `nav.links a`, `.navcta`, `.live`, `.dot`, `@keyframes pulse` and `:focus-visible` rules from `index.html`'s `<style>`. Keep `nav.links{display:flex;gap:2px}`.

- [ ] **Step 5: Convert the dashboard's header markup**

In `app.html`, replace the `.header` block and wrap the topnav:

```html
  <header class="site-header">
    <div class="wrap">
      <div class="site-brand">
        <h1><a href="./" title="Back to the landing page">AI Market Pulse</a></h1>
        <span>A quiet view of a loud industry</span>
      </div>
      <div class="live-cluster">
        <span class="dot" aria-hidden="true"></span>
        <span class="clock" id="clock">--:--:--</span>
        <span class="snapshot-pill" id="snapshot-pill">Loading latest snapshot…</span>
      </div>
      <a class="nav-pill nav-pill--cta" href="./" title="Back to the landing page">Landing page</a>
    </div>
  </header>
```

Then, in the existing `<nav class="topnav">`, change every `class="topnav-item"` to `class="nav-pill"`, and the Full page button to `class="nav-pill nav-pill--mode"`. Leave all `data-panel` attributes exactly as they are — `js/nav.js` selects on `.topnav-item`, so also update its selectors:

In `js/nav.js`, `topnavBtn()` and `wireTopnav()` and `activateFullPage()` each query `.topnav-item`. Change those three selectors to `.nav-pill[data-panel]` so only nav pills carrying a panel are matched (the cross-page CTA pill has no `data-panel` and must not be captured).

Delete the superseded `.header`, `.brand`, `.brand h1`, `.brand .sub`, `.header-right`, `.header-right-top`, `.landing-link`, `.topnav-item*` and `.skip-link` focus rules from `app.html`'s `<style>` that `shell.css` now owns.

The header is now `position:fixed` and 64px tall, so it no longer occupies flow
space and would overlap the content beneath it. Offset the page body — not an
individual element, so nothing depends on which section happens to come first.
Append to `css/shell.css`:

```css
/* .site-header is fixed and 64px tall, so it contributes no flow height.
   Offset the document once, here, rather than per-page. */
body{padding-top:64px;}
```

Then confirm the dashboard's `.topnav`, which is `position:sticky; top:0`, still
sticks *below* the fixed header rather than under it — set its offset explicitly:

```css
.topnav{top:64px;}
```

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: validate passes; **221 tests pass, 0 fail**.

- [ ] **Step 7: Screenshot both pages**

Navigate to `/` and `/app`, screenshot each. Expect near-identical headers. Verify by clicking a topnav pill on the dashboard that panel switching still works — this task changed `js/nav.js` selectors, so a broken selector would silently disable navigation.

- [ ] **Step 8: Commit**

```bash
git add css/shell.css index.html app.html js/nav.js test/continuity.test.mjs
git commit -m "Share one header, nav pill and focus ring across both pages

The dashboard adopts the landing's header treatment: fixed, translucent,
compact, with a 22px wordmark instead of 34px sitting on photography.

Both pages now carry a reciprocal pill in the same header slot — the
landing's 'Open dashboard' and the dashboard's 'Landing page' — so the
cross-page control does not move as you traverse.

nav.js's three .topnav-item selectors become .nav-pill[data-panel] so the
cross-page CTA pill, which has no data-panel, is not captured by panel
activation."
```

---

## Task 4: Unify the leaderboard row component

The landing's `.r` and the dashboard's `.lb-row` render the same leaderboard data in different clothes. They collapse into one `.rank-row`.

**Files:**
- Create: `css/components.css`
- Modify: `index.html`, `app.html` (link the stylesheet)
- Modify: `js/landing.js` (`row()`, ~line 34)
- Modify: `js/sections.js` (`rankRows()`, ~line 66)
- Modify: `css/app.css` (remove superseded `.lb-*` rules)
- Modify: `test/continuity.test.mjs`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: `.rank-row`, `.rank-row__rank`, `.rank-row__model`, `.rank-row__org`, `.rank-row__value`, `.rank-row__bar`, `.rank-row__note`. Both renderers emit this markup.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('both renderers emit the same shared row component', () => {
  const landingJs = read('js/landing.js');
  const sectionsJs = read('js/sections.js');
  assert.match(landingJs, /rank-row/, 'js/landing.js must render .rank-row');
  assert.match(sectionsJs, /rank-row/, 'js/sections.js must render .rank-row');
});

test('the superseded per-page row classes are gone', () => {
  const appCss = read('css/app.css');
  const landingStyles = [...landingHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appCss, /\.lb-row\{/, 'css/app.css must not define .lb-row any more');
  assert.doesNotMatch(landingStyles, /\.mini\s+\.r\{/, 'index.html must not define its own row');
});

test('both pages link the shared component stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/components\.css"/, `${name} must link css/components.css`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `js/landing.js must render .rank-row`.

- [ ] **Step 3: Create `css/components.css`**

```css
/* Primitives shared by both pages.
 *
 * The landing's preview row and the dashboard's leaderboard row rendered the
 * same data in visibly different components — the single clearest signal that
 * these were two designs rather than one. They are now one component.
 *
 * Requires css/tokens.css.
 */

/* ---------- rank row ----------
 * Used by js/landing.js (preview, 5 rows) and js/sections.js (full leaderboard
 * and every ranked list). The landing variant hides the note; that is the only
 * difference between the two contexts.
 */
.rank-row{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:baseline;
  gap:10px 12px;
  padding:10px 0;
  border-bottom:1px solid var(--border);
}
.rank-row:last-child{border-bottom:0;}

.rank-row__rank{
  font-family:var(--font-mono);font-size:11px;color:var(--ink-dim);
  font-variant-numeric:tabular-nums;
}
.rank-row__model{font-weight:600;color:var(--ink);}
.rank-row__org{
  display:block;font-style:normal;
  font-family:var(--font-mono);font-size:10.5px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-dim);
}
.rank-row__value{
  font-family:var(--font-mono);font-variant-numeric:tabular-nums;
  color:var(--deep);font-weight:500;white-space:nowrap;
}
.rank-row__unit{font-size:.8em;color:var(--ink-dim);}

.rank-row__bar{
  grid-column:1 / -1;
  height:3px;border-radius:2px;background:var(--glass);overflow:hidden;
}
.rank-row__bar > i{
  display:block;height:100%;width:0;border-radius:2px;background:var(--sea);
  transition:width .8s cubic-bezier(.22,.61,.36,1);
}
.rank-row__note{
  grid-column:1 / -1;
  font-size:12.5px;line-height:1.5;color:var(--ink-soft);
}
/* An ordinal row carries no measured score, so it gets no bar and says so. */
.rank-row--ordinal .rank-row__tag{
  grid-column:1 / -1;
  font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-dim);
}
/* The landing shows previews only — no notes, no bars. */
.rank-row--preview .rank-row__note,
.rank-row--preview .rank-row__bar{display:none;}
```

- [ ] **Step 4: Link it from both pages**

In both `index.html` and `app.html`, after the `shell.css` link:

```html
<link rel="stylesheet" href="css/components.css">
```

- [ ] **Step 5: Update the landing renderer**

In `js/landing.js`, replace `row()`:

```javascript
// One row of a mini list. `value` is rendered as-is into a tabular-nums cell,
// so callers pass an already-formatted string (score, price range, "—").
// Uses the SHARED .rank-row component (css/components.css) — the same one the
// dashboard's leaderboard renders — so the two pages cannot drift apart
// visually the way .r and .lb-row did.
function row({ lead, name, sub, value }) {
  return `<div class="rank-row rank-row--preview">
    <span class="rank-row__rank">${esc(lead)}</span>
    <span class="rank-row__model">${esc(name)}${sub ? `<em class="rank-row__org">${esc(sub)}</em>` : ''}</span>
    <span class="rank-row__value">${esc(value)}</span>
  </div>`;
}
```

- [ ] **Step 6: Update the dashboard renderer**

In `js/sections.js`'s `rankRows()`, replace the returned template literal's class names — keep every piece of logic (`tied`, `rankLabel`, `hasScore`, `hasIndex`, `showBar`, `barPct`, `rating`) exactly as it is, changing only the markup:

```javascript
    return `
    <div class="rank-row${showBar ? '' : ' rank-row--ordinal'}">
      <span class="rank-row__rank">${esc(rankLabel)}</span>
      <span class="rank-row__model">${esc(r.model)}<em class="rank-row__org">${esc(r.org)}</em></span>
      ${rating
        ? `<span class="rank-row__value"${hasIndex ? ' title="Composite index (0–100), editorial weighting — not a single measured benchmark"' : ''}>${rating}</span>`
        : `<span class="rank-row__value">${esc(r.stat)}</span>`}
      ${showBar
        ? `<span class="rank-row__bar"><i style="--w:${barPct}%"></i></span>`
        : `<span class="rank-row__tag">Editorial ranking · no measured score for this view</span>`}
      <div class="rank-row__note">${hasIndex && r.stat ? `<span class="lb-note-lead">${esc(r.stat)}</span> — ` : ''}${esc(r.note)}</div>
    </div>`;
```

The `rating` value is built a few lines above, and both its branches emit the old
unit class. Replace them:

```javascript
    const rating = hasScore
      ? `${esc(String(r.score))}<span class="rank-row__unit">${esc(r.scoreUnit || '')}</span>`
      : (hasIndex ? `${esc(String(r.w))}<span class="rank-row__unit">/100</span>` : '');
```

The `.lb-note-lead` span inside `.rank-row__note` keeps its class — it is styled
in `css/app.css` and is unrelated to the row's own layout.

Then update `animateBars()` to select `.rank-row__bar > i` instead of `.bar-fill`:

```javascript
// animate ordinal bars once rows exist
export function animateBars() {
  document.querySelectorAll('.rank-row__bar > i').forEach((el, i) => {
    el.style.width = '0';
    setTimeout(() => { el.style.width = el.style.getPropertyValue('--w'); }, 150 + i * 35);
  });
}
```

- [ ] **Step 7: Remove the superseded rules**

Delete `.lb-row`, `.lb-top`, `.lb-name`, `.lb-rank`, `.lb-model`, `.lb-org`, `.lb-score`, `.lb-score-unit`, `.lb-stat`, `.lb-note`, `.lb-editorial-tag`, `.lb-row--ordinal`, `.bar-track` and `.bar-fill` from `css/app.css`. Keep `.lb-note-lead` and every `.lb-tab*` rule — the view tabs are unrelated to the row.

Delete the `.mini .r`, `.mini .n`, `.mini .nm`, `.mini .nm em`, `.mini .v` rules from `index.html`'s `<style>`.

- [ ] **Step 8: Run the full gate**

Run: `npm run check`
Expected: validate passes; **224 tests pass, 0 fail**.

- [ ] **Step 9: Screenshot both leaderboards — this is milestone 3**

Navigate to `http://localhost:5500/app`, click the Models panel, screenshot the leaderboard. Then navigate to `http://localhost:5500/` and screenshot the leaderboard preview. The rows must look like the same component.

Confirm the bars still animate:

```javascript
[...document.querySelectorAll('.rank-row__bar > i')].map((el) => el.style.width)
```

Expected: non-zero widths (not all `"0"` or `""`).

- [ ] **Step 10: Commit**

```bash
git add css/components.css index.html app.html js/landing.js js/sections.js css/app.css test/continuity.test.mjs
git commit -m "Unify the landing and dashboard leaderboard rows

The landing's .r and the dashboard's .lb-row rendered identical data in
visibly different components — the clearest single signal that these were
two designs rather than one product. Both renderers now emit .rank-row.

rankRows() keeps every piece of its honesty logic untouched (ties, the
published-vs-estimate split, the ordinal fallback for rows with no measured
score); only the class names changed. animateBars() follows the bar to its
new selector."
```

---

## Task 5: Re-key the landing's bands to the dashboard's panel names

**Files:**
- Modify: `index.html` (five section ids **and** the five header `href`s together, plus the skip link and alias anchors)
- Modify: `test/landing.test.mjs` (the landing-anchor list, ~line 141)
- Modify: `test/continuity.test.mjs`

**Interfaces:**
- Consumes: the header markup from Task 3, which still points at the OLD ids (`#surface`, `#currents`, `#seabed`).
- Produces: landing section ids `today`, `ecosystem`, `models`, `markets`, `research`, plus alias anchors `surface`, `currents`, `seabed`.

**Ordering requirement:** ids and `href`s must change in the SAME commit.
`test/landing.test.mjs` asserts every `href="#…"` in `index.html` resolves to a
real `id`, so changing one side alone breaks the suite. Task 3 deliberately left
the hrefs untouched for this reason.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

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

test('no landing id collides with the deeplink forwarder allowlist', () => {
  // js/deeplink.js forwards /^#(full$|panel-|tab-|sec-)/ to app.html. A landing
  // id matching that pattern would bounce visitors off the landing page the
  // moment they clicked its own nav.
  const deeplinkJs = read('js/deeplink.js');
  const src = deeplinkJs.match(/if \(!(\/\^#\([^/]+\)\/)\.test\(hash\)\) return;/)?.[1];
  assert.ok(src, 'could not locate the hash predicate in js/deeplink.js');
  const re = new RegExp(src.slice(1, -1));
  const ids = [...landingHtml.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    assert.ok(!re.test('#' + id), `landing id #${id} would be forwarded to app.html by deeplink.js`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `landing must have a #today band`.

- [ ] **Step 3: Rename the five bands**

In `index.html`:

| Line (approx) | From | To |
|---|---|---|
| 300 | `<section class="band" id="surface"` | `<section class="band" id="today"` |
| 329 | `<section class="band" id="currents"` | `<section class="band" id="ecosystem"` |
| 349 | `<section class="band" id="models"` | unchanged |
| 381 | `<section class="band" id="markets"` | unchanged |
| 401 | `<div class="deepband" id="seabed">` | `<div class="deepband" id="research">` |

Also update the skip link at the top of the file from `href="#surface"` to `href="#today"`.

Then update the five header `href`s that Task 3 deliberately left alone, in the
same commit:

```html
    <a class="nav-pill" href="#today">Today</a>
    <a class="nav-pill" href="#ecosystem">Ecosystem</a>
    <a class="nav-pill" href="#models">Models</a>
    <a class="nav-pill" href="#markets">Markets</a>
    <a class="nav-pill" href="#research">Research</a>
```

The per-band "more" links already point at `app.html#panel-*` / `app.html#tab-*`
and must NOT change — those are dashboard deep links, not landing anchors.

- [ ] **Step 4: Add alias anchors for the old ids**

Immediately before each renamed section, add a zero-height alias target so existing external links keep resolving:

```html
<span id="surface" class="anchor-alias" aria-hidden="true"></span>
```

before `#today`, and likewise `id="currents"` before `#ecosystem` and `id="seabed"` before `#research`.

Add to `index.html`'s `<style>`:

```css
/* Legacy anchor targets. The landing's bands were renamed to match the
   dashboard's panel names; these keep older shared links resolving. */
.anchor-alias{display:block;height:0;scroll-margin-top:64px;}
```

- [ ] **Step 5: Update the landing-anchor list in the existing test**

In `test/landing.test.mjs`, the deeplink test asserts the landing's own anchors are never forwarded. Update that list:

```javascript
  // The landing's own anchors must never be captured.
  for (const h of ['#today', '#ecosystem', '#models', '#markets', '#research',
                   '#surface', '#currents', '#seabed']) {
    assert.ok(!re.test(h), `${h} is a landing anchor and must not be forwarded`);
  }
```

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: validate passes; **227 tests pass, 0 fail**. In particular `test/landing.test.mjs`'s "every landing nav anchor resolves to a real section" must still pass — it derives anchors from the markup, so the Task 3 header hrefs now resolve.

- [ ] **Step 7: Screenshot and verify navigation**

Navigate to `http://localhost:5500/`, click each of the five header pills, screenshot after each. Then verify the aliases:

```javascript
['surface','currents','seabed','today','ecosystem','research']
  .map((id) => id + ':' + !!document.getElementById(id)).join(' ')
```

Expected: all `true`. Then load `http://localhost:5500/#surface` directly and confirm you land on the Today band and are **not** redirected to `app.html`.

- [ ] **Step 8: Commit**

```bash
git add index.html test/landing.test.mjs test/continuity.test.mjs
git commit -m "Re-key the landing's bands to the dashboard's panel names

#surface -> #today, #currents -> #ecosystem, #seabed -> #research; models
and markets already matched. These are the names the landing's own header
nav has always used, and they are the dashboard's real IA.

The old ids survive as zero-height alias anchors so shared links keep
resolving. A guard test asserts no landing id can ever match deeplink.js's
/^#(full$|panel-|tab-|sec-)/ allowlist, which would bounce a visitor off
the landing page the moment they clicked its own navigation."
```

---

## Task 6: Convert the landing's rail into a depth readout

The change that actually repairs the metaphor. The rail stops being a second navigation and becomes the same readout the dashboard has.

**Files:**
- Modify: `index.html` (rail markup ~line 273; add `data-depth` to bands)
- Modify: `js/landing.js` (`wireRail`, ~line 300)
- Modify: `css/shell.css` (append `.depth-rail`)
- Modify: `test/continuity.test.mjs`

**Interfaces:**
- Consumes: Task 5's renamed band ids.
- Produces: `.depth-rail` / `.depth-item[data-depth][data-active]` markup, matching the dashboard's existing structure in `app.html`.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('the landing rail is a depth READOUT, not a second navigation', () => {
  // This is the fix for the core problem: depth was the scroll spine on the
  // landing and a property of content on the dashboard, so the mental model a
  // visitor had just learned stopped predicting anything at the transition.
  const railMatch = landingHtml.match(/<div class="depth-rail"[\s\S]*?<\/div>/);
  assert.ok(railMatch, 'landing must carry a .depth-rail');
  assert.doesNotMatch(railMatch[0], /<a\b/, 'the rail must contain no links — it reports, it does not navigate');
  assert.match(railMatch[0], /data-depth="surface"/, 'rail must report depths');
});

test('both pages use the same depth-rail markup contract', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    for (const d of ['surface', 'currents', 'midwater', 'seabed']) {
      assert.match(html, new RegExp(`data-depth="${d}"`), `${name} must report the ${d} depth`);
    }
  }
});

test('the landing bands declare which depths they span', () => {
  for (const id of ['today', 'ecosystem', 'models', 'markets', 'research']) {
    const band = landingHtml.match(new RegExp(`<[^>]+id="${id}"[^>]*>`));
    assert.ok(band, `#${id} not found`);
    assert.match(band[0], /data-depth="/, `#${id} must declare its depth span`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `landing must carry a .depth-rail`.

- [ ] **Step 3: Replace the rail markup**

In `index.html`, replace the `<div class="rail" id="lp-rail">` block with the dashboard's contract:

```html
<div class="depth-rail" id="lp-rail" role="status" aria-label="Evidence depth of the section in view">
  <span class="depth-item" data-depth="surface"><i aria-hidden="true"></i>Surface<small>fast &amp; recent</small></span>
  <span class="depth-item" data-depth="currents"><i aria-hidden="true"></i>Currents<small>actively moving</small></span>
  <span class="depth-item" data-depth="midwater"><i aria-hidden="true"></i>Midwater<small>gaining evidence</small></span>
  <span class="depth-item" data-depth="seabed"><i aria-hidden="true"></i>Seabed<small>slow &amp; structural</small></span>
</div>
```

- [ ] **Step 4: Declare each band's depth span**

Add `data-depth` to the five bands, mirroring how the dashboard's panels span depths (`app.html`'s tabpanels: Today spans surface+currents, Models is midwater, Markets is seabed):

```html
<section class="band" id="today" data-depth="surface currents" aria-labelledby="lp-h-today">
<section class="band" id="ecosystem" data-depth="currents" aria-labelledby="lp-h-ecosystem">
<section class="band" id="models" data-depth="midwater" aria-labelledby="lp-h-models">
<section class="band" id="markets" data-depth="seabed" aria-labelledby="lp-h-markets">
<div class="deepband" id="research" data-depth="seabed">
```

Update the `aria-labelledby` targets and their heading ids to match (`lp-h-surface` → `lp-h-today`, `lp-h-currents` → `lp-h-ecosystem`).

- [ ] **Step 5: Rewrite `wireRail` as a readout**

In `js/landing.js`, replace `wireRail()`:

```javascript
// Depth rail. This REPORTS which evidence depths the section in view spans —
// it is not a second navigation.
//
// That distinction is the whole point: depth used to be the landing's scroll
// spine while being a property of content on the dashboard, so the model a
// visitor had just learned stopped predicting anything the moment they
// crossed over. Both pages now say the same thing with the same component
// (compare updateDepthRailMulti() in js/nav.js).
//
// Reads are batched into a rAF so the scroll handler does not force layout on
// every event; the setTimeout backstop follows the same reasoning as
// wireReveal — rAF is not guaranteed to fire in this project's test browser.
function wireRail() {
  const rail = $('#lp-rail');
  const hero = $('#lp-hero-media');
  if (!rail) return;
  const items = $$('.depth-item', rail);
  const bands = $$('[data-depth]').filter((el) => el !== rail && !rail.contains(el));

  const paint = () => {
    const y = scrollY;
    rail.classList.toggle('show', y > innerHeight * 0.7);
    if (hero && y < innerHeight && !prefersReducedMotion) {
      hero.style.transform = `translate3d(0,${y * 0.18}px,0)`;
    }
    // the band whose top has most recently passed the 45% line is "in view"
    let current = bands[0];
    for (const b of bands) {
      if (b.getBoundingClientRect().top < innerHeight * 0.45) current = b;
    }
    const active = new Set((current?.dataset.depth || '').split(/\s+/).filter(Boolean));
    items.forEach((el) => { el.dataset.active = String(active.has(el.dataset.depth)); });
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { paint(); ticking = false; });
  };
  addEventListener('scroll', onScroll, { passive: true });
  paint();
  setTimeout(paint, 1400);
}
```

- [ ] **Step 6: Append the shared rail styling to `css/shell.css`**

```css
/* ---------- depth rail ----------
 * A READOUT on both pages: it reports which evidence depths the current view
 * spans. It is never navigation. The landing fades it in past the hero; the
 * dashboard shows it always.
 */
.depth-rail{display:flex;gap:18px;align-items:center;justify-content:center;flex-wrap:wrap;padding:8px 16px;}
.depth-item{
  display:flex;align-items:center;gap:6px;opacity:.45;
  font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-soft);transition:opacity .3s,color .3s;
}
.depth-item i{
  width:8px;height:8px;border-radius:50%;background:var(--ink-dim);
  border:2px solid transparent;display:block;flex-shrink:0;
}
.depth-item small{font-size:8.5px;color:var(--ink-dim);line-height:1.2;text-transform:none;letter-spacing:0;}
.depth-item[data-active="true"]{opacity:1;color:var(--deep);}
.depth-item[data-active="true"] i{
  background:var(--teal);border-color:var(--sea);box-shadow:0 0 0 3px rgba(62,143,163,0.18);
}
@media (max-width:640px){
  .depth-item{flex-direction:column;gap:2px;}
  .depth-item small{display:none;}
}

/* The landing floats its rail and reveals it past the hero. */
#lp-rail{
  position:fixed;left:22px;top:50%;transform:translateY(-50%);z-index:50;
  flex-direction:column;align-items:flex-start;gap:2px;
  padding:12px 14px;border-radius:14px;
  background:rgba(253,254,254,.94);border:1px solid rgba(185,212,215,.6);
  box-shadow:0 14px 34px -20px rgba(27,75,90,.55);
  opacity:0;transition:opacity .5s;pointer-events:none;
}
#lp-rail.show{opacity:1;}
@media (max-width:900px){ #lp-rail{display:none;} }
```

Then delete the old `.rail*` rules from `index.html`'s `<style>` and the old `.depth-rail` / `.depth-item` rules from `app.html`'s `<style>`.

- [ ] **Step 7: Run the full gate**

Run: `npm run check`
Expected: validate passes; **230 tests pass, 0 fail**.

- [ ] **Step 8: Screenshot the metaphor fix — this is milestone 4**

Navigate to `http://localhost:5500/`, scroll to each band, screenshot the rail state at each. Then verify programmatically:

```javascript
(() => {
  document.getElementById('models').scrollIntoView();
  return new Promise((r) => setTimeout(() => r(
    [...document.querySelectorAll('#lp-rail .depth-item')]
      .map((el) => el.dataset.depth + '=' + el.dataset.active).join(' ')
  ), 400));
})()
```

Expected at the Models band: `surface=false currents=false midwater=true seabed=false`.

- [ ] **Step 9: Commit**

```bash
git add index.html js/landing.js css/shell.css test/continuity.test.mjs
git commit -m "Make the landing's rail a depth readout, not a second navigation

This is the fix for the actual problem. Depth was the SCROLL SPINE on the
landing and a PROPERTY OF CONTENT on the dashboard, so the mental model a
visitor had just finished learning stopped predicting anything the moment
they crossed over.

The rail now reports which depths the band in view spans, exactly as
updateDepthRailMulti() does in js/nav.js, and each band declares its span
via data-depth. Same component, same semantics, both pages.

Scroll reads are batched into a rAF instead of calling
getBoundingClientRect per link on every scroll event, with the same
setTimeout backstop wireReveal uses."
```

---

## Task 7: Unify section headings and buttons

Every section on both pages carries a heading, so this is the most-repeated
visual element in the product — and currently the two pages render it
differently. The landing uses a mono eyebrow above a serif `h2`; the dashboard
uses `.section-ribbon`.

**Files:**
- Modify: `css/components.css` (append)
- Modify: `app.html` (`.section-ribbon*` rules; 11 ribbon markup blocks)
- Modify: `index.html` (`.eyebrow` rule, `.btn` rules)
- Modify: `css/app.css` (remove superseded ribbon rules if any live there)
- Modify: `test/continuity.test.mjs`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: `.section-head`, `.section-head__eyebrow`, `.section-head__title`, `.section-head__descriptor`; `.btn`, `.btn--primary`, `.btn--secondary`.

- [ ] **Step 1: Write the failing test**

Append to `test/continuity.test.mjs`:

```javascript
test('both pages use the shared section heading component', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /class="[^"]*section-head/, `${name} must use .section-head`);
  }
});

test('the superseded per-page heading and button classes are gone', () => {
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /\.section-ribbon\{/, 'app.html must not define its own section heading');
  const componentsCss = read('css/components.css');
  assert.match(componentsCss, /\.btn--primary/, 'one primary button for both pages');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/continuity.test.mjs`
Expected: FAIL — `index.html must use .section-head`.

- [ ] **Step 3: Append to `css/components.css`**

```css
/* ---------- section heading ----------
 * The most-repeated element in the product: every band on the landing and
 * every section on the dashboard carries one. The landing's treatment (a mono
 * eyebrow over a serif title) becomes the shared one.
 */
.section-head{margin:0 0 18px;}
.section-head__eyebrow{
  display:block;
  font-family:var(--font-mono);font-size:11px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--sea);font-weight:500;margin-bottom:8px;
}
.section-head__title{
  font-family:var(--font-display);font-weight:500;letter-spacing:.005em;
  color:var(--deep);margin:0;font-size:clamp(24px,3.2vw,34px);line-height:1.15;
}
.section-head__descriptor{
  display:block;margin-top:6px;
  font-family:var(--font-mono);font-size:11.5px;letter-spacing:.06em;
  color:var(--ink-dim);text-transform:uppercase;
}

/* ---------- buttons ---------- */
.btn{
  display:inline-flex;align-items:center;gap:8px;
  font-family:var(--font-body);font-size:14px;font-weight:600;letter-spacing:.02em;
  padding:12px 22px;border-radius:999px;border:1px solid transparent;
  cursor:pointer;text-decoration:none;transition:background .25s,color .25s,transform .15s;
}
.btn--primary{background:var(--deep);color:var(--paper);}
.btn--primary:hover{background:var(--ink);color:var(--paper);transform:translateY(-1px);}
.btn--secondary{background:transparent;color:var(--deep);border-color:var(--border-strong);}
.btn--secondary:hover{background:var(--glass);transform:translateY(-1px);}
```

- [ ] **Step 4: Convert the dashboard's ribbons**

In `app.html`, each of the 11 blocks currently shaped like:

```html
<div class="section-ribbon section-ribbon--market">
  <h2 class="section-ribbon__title">AI stock network</h2>
  <p class="section-ribbon__descriptor">How the AI market is connected</p>
</div>
```

becomes:

```html
<div class="section-head">
  <h2 class="section-head__title">AI stock network</h2>
  <span class="section-head__descriptor">How the AI market is connected</span>
</div>
```

Then delete every `.section-ribbon*` rule from `app.html`'s `<style>` and from `css/app.css`.

- [ ] **Step 5: Convert the landing's headings**

In `index.html`, each band's `<p class="eyebrow rv">…</p>` + `<h2>…</h2>` pair becomes:

```html
<div class="section-head rv">
  <span class="section-head__eyebrow">Surface · fast &amp; recent</span>
  <h2 class="section-head__title" id="lp-h-today">What just moved</h2>
</div>
```

Keep the `rv` class on the wrapper so the scroll-reveal still applies, and keep each `id` where the band's `aria-labelledby` points at it.

Replace `.btn.p` with `.btn.btn--primary` and `.btn.s` with `.btn.btn--secondary` at all four call sites, then delete the `.eyebrow`, `.btn`, `.btn.p` and `.btn.s` rules from `index.html`'s `<style>`.

- [ ] **Step 6: Run the full gate**

Run: `npm run check`
Expected: validate passes; **232 tests pass, 0 fail**.

- [ ] **Step 7: Screenshot both pages**

Section headings must look like the same component on both. Confirm the landing's reveal animation still fires:

```javascript
[...document.querySelectorAll('.section-head.rv')].map((el) => el.classList.contains('in')).join(',')
```

Expected: `true` for headings above the fold.

- [ ] **Step 8: Commit**

```bash
git add css/components.css index.html app.html css/app.css test/continuity.test.mjs
git commit -m "Unify section headings and buttons across both pages

Section headings are the most-repeated element in the product — every
landing band and every dashboard section has one — and the two pages
rendered them differently. The landing's treatment (mono eyebrow over a
serif title) becomes the shared .section-head.

Buttons collapse to one primary/secondary pair."
```

---

## Task 8: Responsive and cross-page verification

No new features. Proves the restyled shell survives a narrow viewport and that both pages still work end to end.

**Files:**
- Modify: `css/shell.css` (only if the screenshots reveal a break)

- [ ] **Step 1: Screenshot both pages at mobile width — this is milestone 5**

Resize to 375×812 and screenshot `/` and `/app`. Check specifically:
- the fixed header does not overlap content (it is `position:fixed` as of Task 3)
- the topnav pills scroll horizontally rather than wrapping into a tall stack
- `#lp-rail` is hidden below 900px
- no horizontal page scroll

- [ ] **Step 2: Verify no horizontal overflow on either page**

```javascript
JSON.stringify({
  docWidth: document.documentElement.scrollWidth,
  viewport: innerWidth,
  overflows: document.documentElement.scrollWidth > innerWidth
})
```

Expected: `overflows: false` on both pages. If true, find the offending element:

```javascript
[...document.querySelectorAll('*')]
  .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
  .slice(0, 5).map((el) => el.tagName + '.' + el.className)
```

- [ ] **Step 3: Walk the cross-page journey and screenshot each hop**

Landing → click "Open dashboard" → dashboard → click "Landing page" → landing. Screenshot each hop. The header must not visibly change shape across the transition; that stability is the entire point of the work.

- [ ] **Step 4: Check the console on both pages**

Expected: no errors. Tasks 3, 4 and 6 changed selectors in `js/nav.js`, `js/sections.js` and `js/landing.js`, and a stale selector fails silently rather than throwing.

- [ ] **Step 5: Run the full gate one final time**

Run: `npm run check`
Expected: validate passes; **232 tests pass, 0 fail**.

- [ ] **Step 6: Commit any responsive fixes**

```bash
git add css/shell.css
git commit -m "Fix responsive regressions in the shared shell

Found by screenshotting both pages at 375px after the header restyle."
```

If no fixes were needed, skip the commit and note that in the handoff.

---

## Deferred (explicitly out of scope)

Recorded here so they are not silently lost:

1. **The landing's Research band is not a preview.** `#research` (formerly `#seabed`) is an editorial `.deepband` with no data and no link into the dashboard, unlike the four bands above it. So the landing's "Research" nav item does not preview the dashboard's Research panel. The rename makes this more visible; fixing it means either building a real preview or relabelling the nav item.
2. **Full CSS consolidation.** This plan extracts the three shared layers but leaves `app.html`'s remaining inline `<style>` and `css/app.css` as they are.
3. **`MODEL_REGISTRY` drift.** `scripts/lib/models.mjs` still names Claude Opus 4.8 as Anthropic's flagship while the leaderboard now leads with Claude Opus 5. Unrelated to this work, but adjacent and outstanding.
