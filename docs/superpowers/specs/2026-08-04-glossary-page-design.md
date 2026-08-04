# Glossary page

**Date:** 2026-08-04
**Status:** Approved, ready for implementation planning

## Problem

The dashboard uses domain jargon throughout (AAII, HLE, SWE-bench Verified,
MoE, relative volume, correlation vs. business ties, etc.) with no
in-product explanation of what any of it means. A visitor who isn't already
fluent in AI-market vocabulary has no way to look a term up without leaving
the site. This came out of a competitive read of learn.trainiac.ai, whose
~150-term Dictionary is one of its clearer advantages over AI-Pulse for
non-expert readers — but that site's full glossary-as-evergreen-content-asset
approach is a different (and much heavier, LLM/DB-backed) product bet than
AI-Pulse's static, zero-API-key architecture, so this spec adopts the
underlying idea at a much smaller, purely-static scope: a dedicated page
defining only the terms AI-Pulse itself actually uses today.

## Decisions

Settled with the user during brainstorming:

1. **Placement:** a new dedicated page (`glossary.html`), not inline
   tooltips and not a broader general-AI dictionary. Tooltips and a bigger
   glossary were both considered and explicitly deferred — see Out of scope.
2. **Scope:** ~20-30 terms, limited to jargon that already appears somewhere
   on the dashboard today. Not an exhaustive AI-education glossary.
3. **Cross-linking:** every entry links back to the dashboard section where
   the term is actually used (e.g. "AAII" → `app.html#sec-leaderboard`),
   matching the site's existing provenance-first ethos (every figure already
   links to its source).
4. **Layout:** entries grouped under the same four section names the
   dashboard nav already uses (Models, Ecosystem, News Wave, Markets), not a
   flat A-Z list — mirrors how a reader actually encounters each term.

## Findings from investigation

- **`js/curated.js` is the right pattern to copy.** It's the site's existing
  convention for hand-maintained, config-driven content with no live source:
  a plain exported array/object, edited and committed by hand, no build step.
  The glossary data file follows the same shape.
- **Every dashboard section is always in the DOM and visible.** `js/nav.js`'s
  `normalizeLocalNav()` strips the `hidden` attribute off every `.tabpanel`
  at init — the tab bars are "jump to subsection" shortcuts, not real tabs
  that hide content. This means a `app.html#sec-x` deep link always lands on
  genuinely rendered, visible content; there's no hidden-tab edge case to
  handle.
- **A precedent for a plain (non-scroll-spy) nav link already exists.** The
  corner nav's "Landing page" pill is `<a class="nav-pill nav-pill--cta"
  href="./">`, a real link, not a `data-panel` scroll button that
  `js/nav.js`'s `wireTopnav()` intercepts (it only wires elements matching
  `.nav-pill[data-panel]`). Adding a "Glossary" pill in the same style needs
  zero changes to `nav.js`.
- **`index.html` and `app.html` share a strict CSP** (`script-src 'self'`,
  no `unsafe-inline`) — confirmed in `index.html`'s head comment. The new
  page must follow the same policy: external `<script src>` files only, no
  inline `<script>`.
- **The project has an established `node --test` convention** for pure-logic
  files (`test/*.test.mjs`, run via `npm test` / `npm run check`), including
  files with no runtime data dependency (e.g. `test/models.test.mjs`). A
  glossary-data shape check fits this convention directly.

## Architecture

### Files

| Path | Role |
|------|------|
| `glossary.html` | New standalone page. Same head/CSP/font pattern as `index.html`; links `css/tokens.css` + `css/shell.css` + `css/components.css` for a native look. |
| `js/glossary-data.js` | New. Hand-maintained array of term entries, `curated.js`-style. |
| `js/glossary.js` | New. ES module: groups entries by section, renders grouped lists into the page. |
| `test/glossary.test.mjs` | New. Validates `glossary-data.js`'s shape. |
| `app.html`, `index.html` | Edited. Add one "Glossary" nav-pill link (corner nav) and one footer link on each page. No JS behavior changes. |

### Data shape (`js/glossary-data.js`)

```js
export const GLOSSARY_ASOF = 'Aug 2026';

export const glossaryTerms = [
  {
    term: 'AAII',
    definition: "Artificial Analysis Intelligence Index — a 0–100 composite …",
    section: 'models',   // one of: models | ecosystem | today | markets
    anchor: 'sec-leaderboard', // id on app.html this term is explained/used at
  },
  // ...
];

export const GLOSSARY_SECTIONS = [
  { id: 'models', label: 'Models & Leaderboards' },
  { id: 'ecosystem', label: 'Ecosystem' },
  { id: 'today', label: 'News Wave' },
  { id: 'markets', label: 'Markets' },
];
```

`section` values intentionally reuse the exact same ids as `PANELS` in
`js/nav.js` (`models`, `ecosystem`, `today`, `markets`) so the two never
drift into different vocabularies for the same four areas.

### Rendering (`js/glossary.js`)

- Reads `glossaryTerms` + `GLOSSARY_SECTIONS`.
- For each section in `GLOSSARY_SECTIONS` order, renders a heading + a list
  of its terms (alphabetical within the section).
- Each entry: **term** (bold), definition, and a "See it on the dashboard →"
  link to `` `app.html#${entry.anchor}` ``.
- No fetch, no async data — pure synchronous render from the imported array,
  consistent with how `curated.js`-backed sections render today.

### Term list (draft content, ~24 entries)

- **Models & Leaderboards:** AAII, Humanity's Last Exam (HLE), SWE-bench
  Verified, MoE (Mixture of Experts), Elo (arena score), open weights,
  benchmark saturation, editorial synthesis
- **Ecosystem:** node size vs. glow, activity score, depth layer, entity,
  dependency / partnership / competition line
- **News Wave:** signal, clustering / duplicate merge, significance score,
  provenance chip (Live / Auto / Curated / Estimated), corroboration
- **Markets:** market cap, relative volume, day-change ring, price-return
  correlation (vs. business ties), $/hr compute pricing, H100 / H200 / B200 / B300

Final wording is written during implementation, not fixed by this spec —
each definition should be one or two plain sentences, in the site's existing
even, unhyped voice (see `curated.js`'s comments and note fields for tone).

### Integration points

- **Corner nav** (`app.html`, `index.html`): one additional plain link pill
  after the existing "Landing page" pill —
  `<a class="nav-pill" href="glossary.html">Glossary</a>` (on `glossary.html`
  itself, this becomes a link back, e.g. `href="app.html"` / `href="./"`).
- **Footer** (`app.html`, `index.html`): one additional link next to the
  existing footer text.
- No changes to `js/nav.js`, `js/main.js`, `js/landing.js`, or any existing
  panel markup.

### Testing

`test/glossary.test.mjs` (`node --test`, wired into `npm test` /
`npm run check` alongside the existing suite) checks:

- No duplicate `term` values.
- Every entry has a non-empty `definition`.
- Every `section` value is one of `GLOSSARY_SECTIONS`' ids.
- Every `anchor` value is a non-empty string (existence-in-`app.html` is
  checked by grepping `app.html`'s source for `id="${anchor}"`, so a future
  rename of a section id fails this test instead of silently breaking the
  "See it on the dashboard" link).

## Out of scope

- Inline hover tooltips on dashboard terms (considered, deferred — the data
  file this spec introduces would make that a natural, small follow-up).
- A broader general-AI glossary (LLM, token, context window, etc.) beyond
  what AI-Pulse itself already uses — considered and explicitly rejected in
  favor of the smaller, site-specific scope.
- Search/filter UI on the glossary page — a flat grouped list is enough at
  ~24 entries.
- Any change to the live data pipeline, `scripts/update-data.mjs`, or CI —
  this is entirely static, hand-maintained content, same as `curated.js`.
