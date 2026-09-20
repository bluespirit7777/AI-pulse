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
                          ├──uses──> scripts/lib/discourse.mjs (official-forum search URL + response parsing for Community Pulse)
                          ├──uses──> scripts/lib/github-discussions.mjs (official GitHub Discussions GraphQL body + response parsing for Community Pulse; needs GITHUB_TOKEN)
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

YouTube Data API v3 (search + videos.list)
        │  (.github/workflows/update-youtube.yml, its OWN 12-hour cron —
        │   separate from the main pipeline above because it's the only
        │   credentialed source: needs YOUTUBE_API_KEY)
        ▼
scripts/update-youtube.mjs ──uses──> scripts/lib/youtube.mjs (search/videos URL building, response parsing, relevance + English-only + Shorts filters)
                            ├──uses──> scripts/lib/models.mjs (MODEL_REGISTRY.{claude,gpt,gemini}.ytQuery)
        │
        └─► data/youtube-trending.json  (top 5 by view count, trailing 7 days, per model — OPTIONAL: absent until the secret is set)
        │
        ▼  validate.mjs (same CI gate, checks are skipped if the file is absent)
        ▼
   git commit + push  ──►  GitHub Pages redeploys

index.html ──> js/landing.js ──> shared briefing + curated model previews
app.html   ──> js/main.js
  ├─ data.js             independently loads each JSON snapshot
  ├─ nav.js/view-state.js query routes, focused views, legacy aliases, history
  ├─ ui.js               shared menu, glossary help, native detail dialog
  ├─ briefing.js         fully cited current AI brief or source headlines
  ├─ river.js/news-state.js searchable chronological news and URL filters
  ├─ models-ui.js        evaluation choice, details, comparison, hardware fit
  ├─ ecosystem-ui.js     searchable list, ranges, lazy SVG map
  ├─ data-ui.js          adoption, releases, stocks table, compute, videos
  ├─ oceanmap.js         ecosystem visualization and entity drawer
  ├─ stocknetwork.js     business ties vs. price correlations and stock drawer
  ├─ community.js        existing sampled discussion explorer
  ├─ metric-meta.js      shared metric definitions and snapshot labels
  └─ datahealth.js       pipeline completeness and provenance drawer
```

The data page shows one top-level destination at a time: Today (default),
Models, Ecosystem or Markets. Learn AI opens the glossary. The route is
`app.html?view=today|models|ecosystem|markets`; Models accepts `category`,
Ecosystem and Markets accept `mode`. `view-state.js` normalizes invalid values
and maps old hashes to the appropriate visible view. Hidden views are removed
from layout and keyboard navigation. Back/Forward restore the URL state.
Mobile Ecosystem defaults to List; desktop defaults to Map. Maps initialize
when their view is opened, with scrollable SVG canvases on small screens.

News uses `q`, `filter`, `entity`, and `days` URL parameters, combined with AND.
It renders twelve stories initially and reveals twelve more per action. The
controller preserves the search input and filter disclosure while data refreshes.
Every ten minutes the app checks for updates; changed news is staged behind
an explicit Apply update action so a reader is not interrupted. Optional
requests fail independently with section-specific empty states and retries.

The landing and Today brief share `briefing.js`. A brief requires valid dates,
a generation time no more than 36 hours old, and resolvable citations for each
nonempty family. Embedded citation records survive feed rollover. Otherwise,
the three newest source headlines are shown. No synthesis is invented in-browser.

Native dialogs handle model details, comparisons, definitions and list entities.
The existing map, stock and Data Health drawers use synchronous background
inertness, focus traps, Escape close and focus return. The shared stylesheet
respects reduced motion. Photos are confined to the landing hero.

## Files

| Path | Role |
|------|------|
| `index.html` | Landing page; shared shell/components and a dedicated landing stylesheet. |
| `app.html` | Focused data views; shared design tokens are in `css/tokens.css`. |
| `js/landing.js` | Landing controller — renders every landing figure from `curated.js` + `data/latest.json`. |
| `js/deeplink.js` | Forwards legacy root deep links to `app.html` (blocking, runs pre-paint). |
| `css/app.css` | Data-view styles, importing preserved chart styles from `css/visualizations.css`. |
| `js/*.js` | ES modules (no bundler, no framework — served as-is). |
| `data/latest.json` | News, releases, community, compute and fallback stock data. Models remain available without it. |
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
| `scripts/lib/discourse.mjs` | Pure, tested: Discourse forum search URL building + response parsing for Community Pulse's first-party source (OpenAI & Google official forums). |
| `scripts/lib/github-discussions.mjs` | Pure, tested: GitHub Discussions GraphQL request-body building + response parsing for Community Pulse's first-party source on labs with no public forum (Claude, Grok, Qwen, plus Gemini). |
| `scripts/lib/chart.mjs` | Pure, tested: shapes/rounds the daily OHLC candle series and the price→pixel scaling for the stock drawer's native SVG candlestick chart. |
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
