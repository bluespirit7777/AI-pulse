# Architecture

AI Pulse is a **static site** — no backend, no build step for the page itself.
GitHub Actions regenerates a JSON data file on a schedule; GitHub Pages serves
the HTML/CSS/JS. Everything works offline-of-server from plain files.

## Data flow

```
publisher RSS + Yahoo Finance
        │  (GitHub Actions, :07 & :37 each hour)
        ▼
scripts/update-data.mjs ──uses──> scripts/lib/signals.mjs  (clustering, scoring, verification)
                          └──uses──> scripts/lib/history.mjs (ranges, event history)
        │
        ├─► data/latest.json                     (current data the page reads)
        ├─► data/range.json                      (real 24H/7D/30D stats + daily category history)
        └─► data/history/events/YYYY-MM-DD.json   (compact events, 60-day retention)
        │
        ▼  validate.mjs + node --test  (CI gate — bad data never commits)
        ▼
   git commit + push  ──►  GitHub Pages redeploys
        │
        ▼
index.html ──module──> js/main.js
        ├─ js/data.js        load latest + entities + range.json
        ├─ js/oceanmap.js    hero: SVG current-field map + drawer (real per-range data)
        ├─ js/waveform.js    three strongest waves as SVG waveforms
        ├─ js/river.js       signal river (chronological, filters, expand/archive)
        ├─ js/tide.js        30-day stacked-area category volume
        ├─ js/sections.js    live + curated detail sections
        ├─ js/curated.js     hand-maintained datasets
        └─ js/freshness.js   provenance / verification / impact / freshness chips
```

## Files

| Path | Role |
|------|------|
| `index.html` | Page shell + base styles (design tokens in `:root`). |
| `css/app.css` | Component styles. |
| `js/*.js` | ES modules (no bundler, no framework — served as-is). |
| `data/latest.json` | Current data. The site is fully functional with only this. |
| `data/range.json` | Real per-range stats + daily category history. Optional — absence falls back to "accumulating". |
| `data/entities.json` | Curated ecosystem map config (nodes + relationships). |
| `data/history/events/*.json` | Compact daily event files (60-day retention) feeding range.json. |
| `scripts/update-data.mjs` | Fetch → categorize → cluster → score → write. |
| `scripts/lib/signals.mjs` | Pure, tested: clustering, categorization, scoring, verification/impact. |
| `scripts/lib/history.mjs` | Pure, tested: event compaction + real per-range calculations. |
| `scripts/validate.mjs` | Schema/sanity gate run in CI (latest.json + range.json). |
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
