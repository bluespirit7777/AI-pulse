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

YouTube Data API v3 (search + videos.list)
        │  (.github/workflows/update-youtube.yml, its OWN 12-hour cron —
        │   separate from the main pipeline above because it's the only
        │   credentialed source: needs YOUTUBE_API_KEY)
        ▼
scripts/update-youtube.mjs ──uses──> scripts/lib/youtube.mjs (search/videos URL building, response parsing, relevance filter)
                            ├──uses──> scripts/lib/models.mjs (MODEL_REGISTRY.{claude,gpt,gemini}.ytQuery)
        │
        └─► data/youtube-trending.json  (top 5 by view count, trailing 7 days, per model — OPTIONAL: absent until the secret is set)
        │
        ▼  validate.mjs (same CI gate, checks are skipped if the file is absent)
        ▼
   git commit + push  ──►  GitHub Pages redeploys
        │
        ▼
index.html ──module──> js/main.js
        ├─ js/data.js          load latest + entities + range + stock-network + youtube-trending
        ├─ js/nav.js           5-item IA router: panel/tab activation, legacy-hash map, depth rail, anchor correction
        ├─ js/briefing.js      Today's 60-second briefing (compact references into waves/releases, no duplicate cards)
        ├─ js/oceanmap.js      Ecosystem: SVG current-field map + drawer (real per-range data)
        ├─ js/waveform.js      strongest waves as SVG waveforms (consequence "why it matters" + "why selected")
        ├─ js/river.js         signal river (chronological, declutered filters, expand/archive)
        ├─ js/tide.js          stacked-area category volume, top-5 default + "show all" toggle
        ├─ js/stocknetwork.js  AI stock network: ecosystem + market-motion modes, drawer
        ├─ js/community.js     "Community Current": model tablist + themes + representative comments
        ├─ js/sections.js      live + curated detail sections (+ leaderboard view tabs, release-card YouTube flip)
        ├─ js/curated.js       hand-maintained datasets (incl. 4 leaderboard views)
        ├─ js/datahealth.js    Data Health footer chip + drawer
        └─ js/freshness.js     provenance / verification / impact / freshness chips
```
The page uses a 5-item IA — **Today / Ecosystem / Models / Markets /
Research** — each a `.topsection` toggled by `js/nav.js`; Today/Models/Markets
further split into local `.local-tabs` (e.g. Today: Briefing/Waves/River/Tide).
Only the active top panel and active local tab render with non-zero height at
a time — everything else carries the `hidden` attribute — which is also what
fixes the old deep-link bug where async content above `#sec-releases` used to
push it thousands of pixels down the page after loading: there's no longer a
stack of always-visible async siblings above any target to do that.
`js/nav.js` maps every legacy hash (`#sec-waves`, `#sec-stocks`, …) to its
`{panel, tab}` in the new IA, so old links keep working. The section headings
use one reusable component (`.section-ribbon` in `css/app.css`); the top
ticker (visible only under Today) pauses on hover/focus and offers a
play/pause control (reduced-motion → manual scroll).

Each of the 3 Frontier Releases cards is a CSS 3D flip container
(`.release-card` → `.release-card-inner` → front/back `.release-card-face`):
the front is the existing release list, unchanged; a "Top videos this week"
button flips to a back face listing that model's `data/youtube-trending.json`
entry. The inactive face is marked `inert` (removed from focus/AT) rather than
just visually hidden, and focus moves with the flip — the same pattern this
codebase's drawers already use. Reduced-motion drops the rotation transition
so the flip is an instant swap, not a spin.

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
