# Architecture

AI Pulse is a **static site** — no backend, no build step for the page itself.
GitHub Actions regenerates a JSON data file on a schedule; GitHub Pages serves
the HTML/CSS/JS. Everything works offline-of-server from plain files.

## Data flow

```
publisher RSS + Yahoo Finance
        │  (GitHub Actions, every ~30 min)
        ▼
scripts/update-data.mjs ──uses──> scripts/lib/signals.mjs (pure, tested)
        │
        ├─► data/latest.json              (current snapshot the page reads)
        └─► data/history/YYYY-MM-DD.json   (one bounded snapshot per day)
        │
        ▼  validate.mjs + node --test  (CI gate — bad data never commits)
        ▼
   git commit + push  ──►  GitHub Pages redeploys
        │
        ▼
index.html ──module──> js/main.js
        ├─ js/data.js        load latest + entities + history, deltas
        ├─ js/sections.js    live + curated section renderers
        ├─ js/curated.js     hand-maintained datasets
        ├─ js/oceanmap.js    hero map (SVG) + drawer
        ├─ js/waves.js       three strongest waves
        ├─ js/river.js       signal river
        └─ js/freshness.js   provenance/confidence/freshness chips
```

## Files

| Path | Role |
|------|------|
| `index.html` | Page shell + base styles (design tokens in `:root`). |
| `css/app.css` | Styles for the Phase-1 components. |
| `js/*.js` | ES modules (no bundler, no framework — served as-is). |
| `data/latest.json` | Current data. The site is fully functional with only this. |
| `data/entities.json` | Curated ecosystem map config (nodes + relationships). |
| `data/history/*.json` | Daily snapshots for deltas. Optional — absence is handled. |
| `scripts/update-data.mjs` | Fetch + score + write. |
| `scripts/lib/signals.mjs` | Pure, deterministic, tested scoring logic. |
| `scripts/validate.mjs` | Schema/sanity gate run in CI. |
| `test/signals.test.mjs` | Unit tests (`node --test`). |
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
npm run build      # fetch fresh data → data/latest.json + history
npm run validate   # schema-check latest.json
npm test           # unit tests
npm run check      # validate + test
npx serve .        # or any static server; open http://localhost:3000
```

See [SCHEMA.md](SCHEMA.md) for the data shape and [METHODOLOGY.md](METHODOLOGY.md)
for the scoring.
