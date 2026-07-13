# Architecture

AI Pulse is a **static site** — no backend, no build step for the page itself.
GitHub Actions regenerates a JSON data file on a schedule; GitHub Pages serves
the HTML/CSS/JS. Everything works offline-of-server from plain files.

## Data flow

```
publisher RSS + official lab YouTube (Atom) + Yahoo Finance
        │  (GitHub Actions, :07 & :37 each hour)
        ▼
scripts/update-data.mjs ──uses──> scripts/lib/signals.mjs  (clustering, scoring, verification, topics, community ranking)
                          ├──uses──> scripts/lib/history.mjs (ranges, event history)
                          ├──uses──> scripts/lib/stocks.mjs  (returns, correlations, volumes)
                          ├──uses──> scripts/lib/models.mjs  (canonical model registry — one source of truth)
                          ├──uses──> scripts/lib/dates.mjs   (explicit-UTC date formatting)
                          └──uses──> scripts/lib/compute.mjs (GPU pricing merge + trend, from Vast.ai + RunPod)
        │
        ├─► data/latest.json                     (current data the page reads, incl. community)
        ├─► data/range.json                      (real 24H/7D/30D stats + daily category history)
        ├─► data/stock-network.json              (ecosystem nodes + 30-day return correlations)
        └─► data/history/events/YYYY-MM-DD.json   (compact events, 60-day retention)
        │
        ▼  validate.mjs + node --test  (CI gate — bad data never commits)
        ▼
   git commit + push  ──►  GitHub Pages redeploys
        │
        ▼
index.html ──module──> js/main.js
        ├─ js/data.js          load latest + entities + range + stock-network
        ├─ js/oceanmap.js      hero: SVG current-field map + drawer (real per-range data)
        ├─ js/waveform.js      strongest waves as SVG waveforms (consequence "why it matters" + "why selected")
        ├─ js/river.js         signal river (chronological, filters, expand/archive)
        ├─ js/tide.js          30-day stacked-area category volume
        ├─ js/stocknetwork.js  AI stock network: ecosystem + market-motion modes, drawer
        ├─ js/community.js     "Community Current": model tablist + themes + representative comments
        ├─ js/sections.js      live + curated detail sections (+ leaderboard view tabs, stock table fallback)
        ├─ js/curated.js       hand-maintained datasets (incl. 4 leaderboard views)
        ├─ js/datahealth.js    Data Health footer chip + drawer
        └─ js/freshness.js     provenance / verification / impact / freshness chips
```
The section headings use one reusable component (`.section-ribbon` in
`css/app.css`); the top ticker pauses on hover/focus and offers a play/pause
control (reduced-motion → manual scroll).

## Files

| Path | Role |
|------|------|
| `index.html` | Page shell + base styles (design tokens in `:root`). |
| `css/app.css` | Component styles. |
| `js/*.js` | ES modules (no bundler, no framework — served as-is). |
| `data/latest.json` | Current data. The site is fully functional with only this. |
| `data/range.json` | Real per-range stats + daily category history. Optional — absence falls back to "accumulating". |
| `data/stock-network.json` | Ecosystem nodes + 30-day return correlations. Optional — absence keeps the table fallback. |
| `data/entities.json` | Curated ecosystem map config (nodes + relationships). |
| `data/history/events/*.json` | Compact daily event files (60-day retention) feeding range.json. |
| `data/compute-history.json` | Rolling ≤30-day GPU price snapshots (one entry/chip/day), feeding the compute panel's real trend. |
| `scripts/update-data.mjs` | Fetch → categorize → cluster → score → correlate → write. |
| `scripts/lib/signals.mjs` | Pure, tested: clustering, categorization, scoring, verification/impact, topics. |
| `scripts/lib/history.mjs` | Pure, tested: event compaction + real per-range calculations. |
| `scripts/lib/stocks.mjs` | Pure, tested: daily returns, Pearson correlation, relative/dollar volume. |
| `scripts/lib/models.mjs` | Canonical model registry (name/org/version/HN query) — the one source every section reads, so versions can't drift between Ocean Map, Community Pulse, Frontier Releases and the Leaderboard. |
| `scripts/lib/dates.mjs` | Explicit-UTC date formatting (`shortDateUTC`/`dayKeyUTC`) — timezone-stable regardless of the build/browser machine's local clock. |
| `scripts/lib/compute.mjs` | Pure, tested: merges live Vast.ai + RunPod GPU offers into a real price range, filters marketplace placeholder prices, computes a real trend from rolling history. |
| `scripts/lib/text.mjs` | Pure, tested: HTML entity decoding + tag stripping shared by feed parsing and HN comment sanitizing (entities MUST decode before tags strip, or entity-encoded tags survive). |
| `scripts/validate.mjs` | Schema/sanity gate run in CI (latest.json incl. dataHealth + community + range.json + stock-network.json). |
| `test/*.test.mjs` | Unit tests (`node --test`). |
| `.github/workflows/update-data.yml` | Scheduled fetch → validate → test → commit. |

## Design principles

- **No framework.** The page is small and the DOM is regenerated from JSON on
  load; a framework would add weight without buying much.
- **Separation of concerns.** Fetching, scoring, rendering, and styling are
  distinct. Scoring is pure and lives in one file used by both the build and the
  tests.
- **Config-driven.** Ecosystem layers, entities, relationships, categories, and
  statuses are data, not hard-coded markup.
- **Graceful degradation.** Missing history, empty feeds, and failed fetches all
  have defined fallbacks; one failing visualization never blanks the page.
- **Resilience.** Every section renders independently from its slice of the data.

## Local development

```
npm run build      # fetch fresh data → latest.json + range.json + event history
npm run validate   # schema-check latest.json + range.json
npm test           # unit tests (signals + history)
npm run check      # validate + test
npx serve .        # or any static server; open http://localhost:3000
```

See [SCHEMA.md](SCHEMA.md) for the data shape and [METHODOLOGY.md](METHODOLOGY.md)
for the scoring.
