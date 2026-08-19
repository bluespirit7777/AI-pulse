# Vocab Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `vocab.html` reference page defining ~24 jargon terms already used on the AI-Pulse dashboard, grouped by dashboard section, each linking back to where the term is used.

**Architecture:** Fully static, no framework, no build step, no live data — follows the same "hand-maintained config, committed by hand" pattern as `js/curated.js`. A new data file (`js/vocab-data.js`) holds the terms; a new page (`vocab.html`) and renderer (`js/vocab.js`) display them; a new test (`test/vocab.test.mjs`) guards the data's shape. Two existing pages (`app.html`, `index.html`) get one small nav link and one small footer link each.

**Tech Stack:** Plain HTML/CSS/JS (ES modules, no bundler), `node --test` for unit tests — matches the rest of the repo exactly. No new dependencies.

## Global Constraints

- No npm dependencies may be added — the project has zero runtime dependencies by design (see `README.md`).
- No inline `<script>` tags — `index.html`/`app.html`'s CSP is `script-src 'self'` with no `'unsafe-inline'`, and `vocab.html` must carry the identical policy.
- `vocab.html` must link `css/tokens.css` + `css/shell.css` + `css/components.css` (design tokens + shared chrome + shared primitives) and may add its own scoped `<style>` block for page-specific rules, matching `index.html`'s existing pattern.
- Data files follow `js/curated.js`'s convention: a plain exported array/object, hand-edited, no fetch, no build step.
- Every new/modified `test/*.test.mjs` file must be added to the `"test"` script's explicit file list in `package.json` — this repo does not glob for test files.
- Term `section` values must be exactly `models` | `ecosystem` | `today` | `markets` — the same four ids as `PANELS` in `js/nav.js`, so the vocab page's grouping can never drift from the dashboard's own four top sections.
- Voice: one or two plain sentences per definition, even and unhyped, matching `js/curated.js`'s existing comments/notes — no hype, no unhedged superlatives.

---

### Task 1: Vocab term data + shape tests

**Files:**
- Create: `test/vocab.test.mjs`
- Create: `js/vocab-data.js`
- Modify: `package.json` (add the new test file to the `"test"` script)

**Interfaces:**
- Produces: `VOCAB_ASOF` (string), `vocabTerms` (array of `{ term: string, definition: string, section: 'models'|'ecosystem'|'today'|'markets', anchor: string }`), `VOCAB_SECTIONS` (array of `{ id: string, label: string }`) — all named exports of `js/vocab-data.js`. Task 2 imports these three names directly.

- [ ] **Step 1: Write the failing test**

Create `test/vocab.test.mjs`:

```js
#!/usr/bin/env node
// Unit tests for the Vocab page's term data. Run: node --test test/vocab.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vocabTerms, VOCAB_SECTIONS } from '../js/vocab-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appHtml = readFileSync(path.join(__dirname, '..', 'app.html'), 'utf-8');
const sectionIds = new Set(VOCAB_SECTIONS.map((s) => s.id));

test('vocabTerms has no duplicate term names', () => {
  const seen = new Set();
  for (const entry of vocabTerms) {
    assert.ok(!seen.has(entry.term), `duplicate term "${entry.term}"`);
    seen.add(entry.term);
  }
});

test('every vocabTerms entry has a non-empty definition', () => {
  for (const entry of vocabTerms) {
    assert.ok(typeof entry.definition === 'string' && entry.definition.length > 0, `${entry.term} has no definition`);
  }
});

test('every vocabTerms entry\'s section is a known VOCAB_SECTIONS id', () => {
  for (const entry of vocabTerms) {
    assert.ok(sectionIds.has(entry.section), `${entry.term} has unknown section "${entry.section}"`);
  }
});

test('every vocabTerms entry\'s anchor exists as a real id in app.html', () => {
  for (const entry of vocabTerms) {
    assert.ok(typeof entry.anchor === 'string' && entry.anchor.length > 0, `${entry.term} has no anchor`);
    assert.ok(appHtml.includes(`id="${entry.anchor}"`), `${entry.term}'s anchor "#${entry.anchor}" is not a real id in app.html`);
  }
});

test('VOCAB_SECTIONS ids match js/nav.js\'s PANELS exactly', () => {
  // Keeps the vocab page's four groups from drifting into different names
  // than the dashboard's own four top sections.
  const navJs = readFileSync(path.join(__dirname, '..', 'js', 'nav.js'), 'utf-8');
  const match = navJs.match(/const PANELS = (\[[^\]]*\]);/);
  assert.ok(match, 'could not find PANELS array in js/nav.js');
  const panels = JSON.parse(match[1].replace(/'/g, '"'));
  assert.deepEqual(VOCAB_SECTIONS.map((s) => s.id), panels);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/vocab.test.mjs`
Expected: FAIL — `Cannot find module '../js/vocab-data.js'` (the file doesn't exist yet).

- [ ] **Step 3: Write the vocab data file**

Create `js/vocab-data.js`:

```js
// Hand-maintained term definitions for vocab.html — the same pattern as
// js/curated.js: a plain exported array, edited and committed by hand, no
// fetch, no build step. Every entry links back to the dashboard section
// (app.html#anchor) where the term is actually used.
//
// `section` MUST be one of VOCAB_SECTIONS' ids below, which are themselves
// the same four ids as PANELS in js/nav.js — test/vocab.test.mjs enforces
// both constraints so this file can't silently drift from the dashboard's
// own four top sections or from a renamed anchor.
//
// Update cadence: edit here, commit. VOCAB_ASOF drives no UI element today —
// kept for the same reason CURATED_ASOF exists in curated.js, in case a
// "last updated" note is added later.

export const VOCAB_ASOF = 'Aug 2026';

export const VOCAB_SECTIONS = [
  { id: 'models', label: 'Models & Leaderboards' },
  { id: 'ecosystem', label: 'Ecosystem' },
  { id: 'today', label: 'News Wave' },
  { id: 'markets', label: 'Markets' },
];

export const vocabTerms = [
  // ---------- Models & Leaderboards ----------
  {
    term: 'AAII',
    definition: "Artificial Analysis Intelligence Index — a published 0–100 score blending agentic, coding, general-capability and science results into one composite. Used for the Leaderboard's \"Overall balance\" view, which is labelled editorial synthesis rather than a single objective ranking.",
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: "Humanity's Last Exam (HLE)",
    definition: "A hard reasoning benchmark, run independently here by Artificial Analysis. The Leaderboard's \"Reasoning\" view uses that independent run rather than higher, tool-assisted vendor-reported figures, so every model sits on the same comparable scale.",
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: 'SWE-bench Verified',
    definition: 'A benchmark measuring whether a model can fix real, verified software issues end to end. Powers the Leaderboard\'s "Agentic coding" view — the site flags it as the top models close in, calling the benchmark near-saturated rather than treating a 1-point lead as a real difference.',
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: 'MoE (Mixture of Experts)',
    definition: "A model architecture where only a subset of the model's total parameters (\"experts\") activate for any given input, so a very large model can run at a fraction of its full-size compute cost. Common among the open-weight releases covered in Frontier Releases.",
    section: 'models',
    anchor: 'sec-releases',
  },
  {
    term: 'Elo (arena score)',
    definition: 'A relative ranking score computed from head-to-head comparisons rather than a fixed test — used here for the Image and Video AI rankings, where models are judged in blind pairs.',
    section: 'models',
    anchor: 'sec-media-image',
  },
  {
    term: 'Open weights',
    definition: "A model whose trained parameters are published for anyone to download and run themselves, instead of being reachable only through a paid API. The Local AI rankings track only models that are actually self-hostable this way.",
    section: 'models',
    anchor: 'sec-media-local',
  },
  {
    term: 'Benchmark saturation',
    definition: 'What happens when the top models on a benchmark all score within a point or two of each other, so the benchmark can no longer meaningfully tell them apart. The Leaderboard calls this out explicitly where it applies instead of treating a narrow lead as a real difference.',
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: 'Editorial synthesis',
    definition: 'A ranking built by blending multiple signals and editorial judgment rather than reading straight off one published benchmark. The Leaderboard\'s "Overall balance" view is labelled this way on purpose, so it is never mistaken for a single authoritative score.',
    section: 'models',
    anchor: 'sec-leaderboard',
  },

  // ---------- Ecosystem ----------
  {
    term: 'Node size vs. glow',
    definition: "On the Ecosystem map, a node's size is its curated importance (hand-set, changes rarely); its glow is live activity computed from the current signal feed (updates automatically). The two are deliberately different measurements.",
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Activity score',
    definition: "How much a given entity is showing up in the live signal feed right now, computed automatically and shown as a node's glow on the Ecosystem map — not the same as the node's size, which is curated importance.",
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Depth layer',
    definition: 'The Ecosystem map groups its entities into five layers — applications, frontier models, open source, cloud/compute, and chips — from the surface (fast-moving) down to the seabed (slow, structural). The same surface-to-seabed metaphor labels every section of the dashboard.',
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Entity',
    definition: "Any single tracked player on the Ecosystem map — a company, a model family, a cloud platform, or a chip line. Click any entity's node for its detail drawer and the live signals that mention it.",
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Dependency / partnership / competition line',
    definition: 'The lines connecting nodes on the Ecosystem map, showing how entities relate to each other — who depends on whom, who partners, and who competes. Hand-curated, not computed from the live feed.',
    section: 'ecosystem',
    anchor: 'sec-map',
  },

  // ---------- News Wave ----------
  {
    term: 'Signal',
    definition: 'One tracked news item — an article, release note, or post — pulled from a publisher feed, official lab channel, or Hacker News. The News Wave and Ecosystem map are both built from the same underlying set of signals.',
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Clustering / duplicate merge',
    definition: "When multiple outlets cover the same underlying story, the pipeline merges them into a single row instead of showing near-duplicate headlines separately — one entry per real event, not one per article.",
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Significance score',
    definition: 'A 0–100 score the pipeline computes for each signal, used to rank what surfaces first in the News Wave. A higher score is about this cycle, not a permanent claim about importance.',
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Provenance chip (Live / Auto / Curated / Estimated)',
    definition: 'A small label on every figure across the site stating where it came from: Live (fetched automatically right now), Auto (computed from live data), Curated (hand-maintained), or Estimated (no reliable live source exists yet). Meant to be checked before trusting a number, not decoration.',
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Corroboration',
    definition: 'Whether a claim or figure is backed by more than one independent source. The site treats a number confirmed across two sources differently from a single self-reported one, and says which situation applies.',
    section: 'today',
    anchor: 'sec-waves',
  },

  // ---------- Markets ----------
  {
    term: 'Market cap',
    definition: "The total market value of a company's shares — share price times shares outstanding. On the AI Stock Network, a node's size is scaled to this figure.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: 'Relative volume',
    definition: "How much a stock is trading today compared to its own recent normal. A spike shows up as extra glow on the AI Stock Network, independent of whether the price moved much.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: 'Day-change ring',
    definition: "The ring around a stock's node on the AI Stock Network, showing that day's price move — computed from the last two valid trading bars, not a live streaming tick.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: 'Price-return correlation (vs. business ties)',
    definition: "How closely two stocks' daily returns have moved together over the past 30 days — a statistical relationship, not a claim about why. The Stock Network keeps this view separate from hand-curated \"business ties\" (partnerships, supply relationships) so the two are never confused.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: '$/hr compute pricing',
    definition: 'What renting one GPU actually costs right now, per hour — merged from real public listings on Vast.ai and RunPod, not a vendor list price. Shown as a range because real marketplace offers vary.',
    section: 'markets',
    anchor: 'sec-compute',
  },
  {
    term: 'H100 / H200 / B200 / B300',
    definition: 'Nvidia GPU generations tracked on the compute panel, roughly oldest/cheapest to newest/most expensive: H100 and H200 (Hopper generation — mainstream training/inference and long-context inference) and B200 and B300 (Blackwell generation — frontier-scale training).',
    section: 'markets',
    anchor: 'sec-compute',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/vocab.test.mjs`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Wire the new test file into `npm test`**

In `package.json`, the `"test"` script is one long explicit list of test files (there is no glob). Open `package.json` and find the `"test"` line, which currently ends with:

```
...test/continuity.test.mjs test/summary-input.test.mjs
```

Add `test/vocab.test.mjs` to the end of that space-separated list, so the line ends with:

```
...test/continuity.test.mjs test/summary-input.test.mjs test/vocab.test.mjs
```

- [ ] **Step 6: Run the full suite to verify nothing else broke**

Run: `npm run check`
Expected: PASS — `npm run validate` succeeds and every test file listed in `package.json`, including `test/vocab.test.mjs`, passes.

- [ ] **Step 7: Commit**

```bash
git add test/vocab.test.mjs js/vocab-data.js package.json
git commit -m "Add vocab term data + shape tests"
```

---

### Task 2: Vocab page markup + renderer

**Files:**
- Create: `vocab.html`
- Create: `js/vocab.js`

**Interfaces:**
- Consumes: `vocabTerms`, `VOCAB_SECTIONS` from `js/vocab-data.js` (Task 1) — exact names and shapes as produced above.
- Produces: a rendered `#vocab-sections` DOM tree inside `vocab.html`, mounted by `js/vocab.js` on module load. No exports — this is a page entry-point script, same role as `js/main.js` for `app.html` and `js/landing.js` for `index.html`.

- [ ] **Step 1: Create the renderer**

Create `js/vocab.js`:

```js
// Entry-point script for vocab.html — the same role js/main.js plays for
// app.html and js/landing.js plays for index.html. Pure synchronous render
// from the hand-maintained js/vocab-data.js; no fetch, no async data.
import { vocabTerms, VOCAB_SECTIONS } from './vocab-data.js';

function termsFor(sectionId) {
  return vocabTerms
    .filter((entry) => entry.section === sectionId)
    .slice()
    .sort((a, b) => a.term.localeCompare(b.term));
}

function renderGroup(section) {
  const terms = termsFor(section.id);
  if (!terms.length) return null;

  const group = document.createElement('section');
  group.className = 'vocab-group';

  const title = document.createElement('h2');
  title.className = 'section-head__title';
  title.textContent = section.label;
  group.appendChild(title);

  const list = document.createElement('div');
  list.className = 'vocab-list';

  for (const entry of terms) {
    const item = document.createElement('div');
    item.className = 'vocab-entry';

    const term = document.createElement('div');
    term.className = 'vocab-term';
    term.textContent = entry.term;

    const def = document.createElement('div');
    def.className = 'vocab-def';
    def.textContent = entry.definition + ' ';

    const link = document.createElement('a');
    link.className = 'vocab-see';
    link.href = `app.html#${entry.anchor}`;
    link.textContent = 'See it on the dashboard →';
    def.appendChild(link);

    item.appendChild(term);
    item.appendChild(def);
    list.appendChild(item);
  }

  group.appendChild(list);
  return group;
}

function renderVocab() {
  const mount = document.getElementById('vocab-sections');
  if (!mount) return;
  for (const section of VOCAB_SECTIONS) {
    const group = renderGroup(section);
    if (group) mount.appendChild(group);
  }
}

renderVocab();
```

- [ ] **Step 2: Create the page**

Create `vocab.html`:

```html
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Same defense-in-depth policy as index.html/app.html: script-src has no
     'unsafe-inline', so this page carries NO inline <script> — all behaviour
     lives in js/vocab.js. -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'">
<title>Vocab · AI Market Pulse</title>
<meta name="description" content="Plain-language definitions for the shorthand used across AI Market Pulse — AAII, SWE-bench, MoE, relative volume and the rest — each linking back to where it's used.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230E2A37'/%3E%3Cg stroke='%23EAF4F6' stroke-width='5' stroke-linecap='round'%3E%3Cline x1='32' y1='11' x2='32' y2='45'/%3E%3Cline x1='15' y1='28' x2='49' y2='28'/%3E%3Cline x1='20' y1='16' x2='44' y2='40'/%3E%3Cline x1='44' y1='16' x2='20' y2='40'/%3E%3C/g%3E%3Cpath d='M0 48 Q16 42 32 48 T64 48 V64 H0 Z' fill='%233E8FA3' opacity='.7'/%3E%3C/svg%3E">
<link rel="canonical" href="https://bluespirit7777.github.io/AI-pulse/vocab.html">
<meta property="og:type" content="website">
<meta property="og:title" content="Vocab · AI Market Pulse">
<meta property="og:description" content="Plain-language definitions for the shorthand used across AI Market Pulse, each linking back to where it's used.">
<meta property="og:url" content="https://bluespirit7777.github.io/AI-pulse/vocab.html">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Vocab · AI Market Pulse">
<meta name="twitter:description" content="Plain-language definitions for the shorthand used across AI Market Pulse.">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Karla:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/shell.css">
<link rel="stylesheet" href="css/components.css">

<style>
*{box-sizing:border-box}
html{scroll-behavior:smooth}
a{color:var(--mid);text-decoration:none}
a:hover{color:var(--warm)}
h1,h2{font-family:var(--serif);font-weight:500;letter-spacing:.005em;margin:0;text-wrap:pretty}
p{margin:0;text-wrap:pretty}
.skip-link{position:absolute;left:-9999px;top:0;z-index:200;background:var(--paper);color:var(--deep);padding:10px 16px;border-radius:0 0 10px 0}
.skip-link:focus{left:0}

main.wrap{padding-top:56px;padding-bottom:80px}

.vocab-intro{max-width:64ch;margin-bottom:40px}
.vocab-lede{margin-top:14px;font-family:var(--serif);font-size:17px;line-height:1.6;color:var(--mid);max-width:60ch}

.vocab-group{margin-bottom:44px}
.vocab-group:last-child{margin-bottom:0}
.vocab-group .section-head__title{margin-bottom:18px}

.vocab-list{display:flex;flex-direction:column;gap:22px}
.vocab-entry{padding-bottom:22px;border-bottom:1px solid var(--glass)}
.vocab-entry:last-child{border-bottom:none;padding-bottom:0}
.vocab-term{font-family:var(--serif);font-weight:600;font-size:17px;color:var(--deep)}
.vocab-def{margin-top:4px;font-size:14.5px;line-height:1.6;color:var(--ink-soft);max-width:68ch}
.vocab-see{display:inline-block;margin-left:2px;font-family:var(--font-mono);font-size:11.5px;letter-spacing:.03em;color:var(--teal);white-space:nowrap}
.vocab-see:hover{color:var(--deep)}

footer{border-top:1px solid var(--glass);background:rgba(253,254,254,.7);padding:38px 0 48px}
footer .wrap{display:flex;flex-wrap:wrap;gap:18px 40px;align-items:center;justify-content:space-between}
footer p{font-size:12px;color:var(--tide);max-width:62ch;line-height:1.6;margin:0}
footer .fl{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:12.5px}

@media(max-width:900px){
  footer .wrap{flex-direction:column;align-items:flex-start}
}
</style>
</head>
<body>

<a class="skip-link" href="#main-content">Skip to content</a>

<header class="site-header">
  <div class="wrap">
    <div class="site-brand">
      <h1><a href="./" title="Back to the landing page">AI Market Pulse</a></h1>
      <span>Vocab</span>
    </div>
    <a class="nav-pill nav-pill--cta" href="app.html" title="Back to the dashboard">Dashboard</a>
  </div>
</header>

<main class="wrap" id="main-content">
  <div class="vocab-intro">
    <div class="section-head">
      <span class="section-head__eyebrow">Reference<s></s></span>
      <h2 class="section-head__title">Vocab</h2>
    </div>
    <p class="vocab-lede">Plain-language definitions for the shorthand used across the dashboard — each term links back to where it's actually used.</p>
  </div>

  <div id="vocab-sections"></div>
</main>

<footer>
  <div class="wrap">
    <p>Public trackers disagree with each other by a few points on any given day — treat every figure here as directionally right, not exact. Nothing here is investment advice.</p>
    <div class="fl">
      <a href="app.html#panel-models">Models</a>
      <a href="app.html#panel-ecosystem">Ecosystem</a>
      <a href="app.html#panel-today">News Wave</a>
      <a href="app.html#panel-markets">Markets</a>
      <a href="./">Landing page</a>
    </div>
  </div>
</footer>

<script type="module" src="js/vocab.js"></script>

</body></html>
```

- [ ] **Step 3: Verify by serving locally**

Run: `npx serve .` (or reuse the `static-site` config in `.claude/launch.json`, which runs the same command on port 5500).
Open `http://localhost:5500/vocab.html` (adjust port to whatever `serve` printed).

Expected, checked visually or via the page's rendered text:
- Four group headings in order: "Models & Leaderboards", "Ecosystem", "News Wave", "Markets".
- 8 terms under Models & Leaderboards, 5 under Ecosystem, 5 under News Wave, 6 under Markets — 24 total.
- Terms within each group are alphabetical.
- Every entry ends with a "See it on the dashboard →" link.
- Clicking a "See it on the dashboard →" link navigates to `app.html` and lands on the right section (e.g. "AAII"'s link opens the Leaderboard).
- No console errors (open browser dev tools / check for a 404 on `js/vocab.js` or `js/vocab-data.js`).

- [ ] **Step 4: Commit**

```bash
git add vocab.html js/vocab.js
git commit -m "Add vocab page markup and renderer"
```

---

### Task 3: Nav + footer integration on existing pages

**Files:**
- Modify: `app.html:637` (header CTA area)
- Modify: `app.html:945-946` (footer)
- Modify: `index.html:204` (header CTA area)
- Modify: `index.html` footer `.fl` links (near end of file)

**Interfaces:**
- Consumes: `vocab.html` (Task 2) as a link target. No JS/data interfaces — this task is markup-only.

- [ ] **Step 1: Add the header link on `app.html`**

In `app.html`, find:

```html
      <a class="nav-pill nav-pill--cta" href="./" title="Back to the landing page">Landing page</a>
    </div>
  </header>
```

Replace with:

```html
      <a class="nav-pill nav-pill--cta" href="./" title="Back to the landing page">Landing page</a>
      <a class="nav-pill" href="vocab.html" title="Term definitions">Vocab</a>
    </div>
  </header>
```

- [ ] **Step 2: Add the footer link on `app.html`**

In `app.html`, find:

```html
    <div style="margin-top:8px;" id="footer-updated">Public trackers disagree with each other by a few points on any given day — treat every figure here as directionally right, not exact. Nothing here is investment advice.</div>
    <div style="margin-top:8px;" id="footer-build" class="footer-build"></div>
```

Replace with:

```html
    <div style="margin-top:8px;" id="footer-updated">Public trackers disagree with each other by a few points on any given day — treat every figure here as directionally right, not exact. Nothing here is investment advice.</div>
    <div style="margin-top:8px;">Term definitions: <a class="src-link" href="vocab.html">Vocab</a></div>
    <div style="margin-top:8px;" id="footer-build" class="footer-build"></div>
```

`.src-link` is already defined in `app.html`'s own `<style>` block (teal, monospace, small "↗" suffix) — this needs no new CSS.

- [ ] **Step 3: Add the header link on `index.html`**

In `index.html`, find:

```html
  <a class="nav-pill nav-pill--cta" href="app.html">Open dashboard</a>
</div>
</header>
```

Replace with:

```html
  <a class="nav-pill nav-pill--cta" href="app.html">Open dashboard</a>
  <a class="nav-pill" href="vocab.html" title="Term definitions">Vocab</a>
</div>
</header>
```

- [ ] **Step 4: Add the footer link on `index.html`**

In `index.html`, find:

```html
    <a href="app.html#full">Dashboard top</a>
  </div>
```

Replace with:

```html
    <a href="app.html#full">Dashboard top</a>
    <a href="vocab.html">Vocab</a>
  </div>
```

- [ ] **Step 5: Verify by serving locally**

Run: `npx serve .` (or the `static-site` launch config).

Check, on both `index.html` and `app.html`:
- The new "Vocab" pill appears in the header next to the existing cross-page CTA and navigates to `vocab.html`.
- The new footer "Vocab" link navigates to `vocab.html`.
- On `vocab.html`, the header's "Dashboard" pill returns to `app.html`, and the footer's "Landing page" link returns to `index.html`.
- No layout shift or overflow at a 375px-wide viewport (mobile) on either header — both `nav-pill--cta` and the new plain `nav-pill` fit without wrapping awkwardly; if they don't, this is the one place a small CSS tweak may be needed (e.g. shrinking the new pill's `font-size` at the existing `@media (max-width:900px)` breakpoint in `css/shell.css`) — check before committing.

- [ ] **Step 6: Run the full suite one last time**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app.html index.html
git commit -m "Link the vocab page from the dashboard and landing page"
```
