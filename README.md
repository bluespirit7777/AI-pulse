# AI Pulse

**A living visual map of where AI energy is moving.** A quiet view of a loud
industry: a calm, ocean-themed intelligence product — not a news dump — that
helps a visitor see momentum, connections, and what changed, with every figure
traceable to its source.

Live at **https://bluespirit7777.github.io/AI-pulse/**

## What it shows

1. **The AI Ocean Map** — a depth map of ~20 entities across five layers
   (applications → frontier models → open source → cloud/compute → chips). Node
   **size** is curated importance; node **glow** is *live* activity computed from
   the signal feed; lines show dependency/partnership/competition. Click any node
   for detail. A 24H/7D/30D toggle shows change over time (and says so honestly
   while history is still accumulating).
2. **Today's Strongest Waves** — the top product, market, and research story by
   a documented significance score. Each has a "why it matters" that explains the
   **consequence** of the event and a separate "why selected" line for the
   scoring; the badge reads *Stands out / Typical / Lower intensity* (an honest
   within-window comparison, not a fake time trend).
3. **Signal River** — a chronological (newest-first) timeline of everything
   crossing the wire, with merged duplicates and category/entity/time filters
   (the entity filter shows readable names — GPT, Nvidia — not ids).
4. **The Tide** — how daily **operational** AI activity changes by category
   (general commentary and analysis excluded); only plots days actually collected.
5. **AI Stock Network** — 10 AI stocks as an ecosystem depth map: node size =
   market cap, glow = relative volume, ring = day change (computed from the last
   two valid trading bars); toggle between curated **business ties** and 30-day
   **price-return correlation** (kept separate). Accessible table fallback.
6. **Community Pulse** ("Community Current") — a horizontal model selector sized
   by relevant discussion volume (contextually matched, with ambiguous
   "grok"/"llama" noise rejected), a two-column panel of stats + theme wave
   bars, and relevance-ranked representative HN comments. Discussion counts are
   exact when the full result set was paginated, and clearly marked "≈
   estimated" with coverage shown otherwise — never presented as an exact count
   they aren't.
7. **Explore the depths** — frontier releases (incl. official-lab YouTube launch
   videos), a 4-view leaderboard (Overall balance / Reasoning / Agentic coding /
   Cost efficiency — Overall labelled as editorial synthesis, the rest citing a
   named benchmark + snapshot date), image/video rankings, market share, compute
   pricing, open-weight feed, and breakthroughs.
8. **Data Health** — a compact footer control showing feed success rate, stock/
   community coverage, history depth, how many datasets are estimates, the
   build SHA, and when data last updated successfully. Full detail in a drawer.

At the top of **Today**, a **Launch Radar** panel surfaces the newest model
releases the moment the machinery moves — Hugging Face model-hub uploads (open
labs) and official SDK/model GitHub releases (closed labs) — the earliest
machine signal of a launch, typically ahead of any blog post. Anything new
since the last scan is flagged, and the pipeline opens a GitHub issue (which
emails the maintainer) so you hear about a launch first.

Every item carries a **freshness / confidence / provenance** chip
(Live · Auto · Curated · Estimated, plus corroboration strength).

## Live vs. curated

- **Live (auto, ~every 30 min):** signals, waves, river, tide, releases,
  open-weight feed, breakthroughs, community pulse, stock prices, compute
  pricing (real $/hr from Vast.ai + RunPod), and the map's activity/glow —
  from publisher RSS feeds, official frontier-lab YouTube channels, Hacker
  News, Yahoo Finance, and public GPU marketplace APIs. Every card links to
  its source, and the footer shows the build commit the live data came from.
- **Curated (by hand):** the leaderboard, image/video rankings, market-share
  donut, and the map's node *importance/size* and relationships. No reliable
  free live API exists for these yet. Edit [`js/curated.js`](js/curated.js)
  and [`data/entities.json`](data/entities.json).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data flow, files, principles.
- [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — scoring, waves, deltas, what we
  deliberately don't do.
- [docs/SCHEMA.md](docs/SCHEMA.md) — the JSON shapes.

## Local development

```
npm run build      # fetch feeds + quotes → data/latest.json + daily snapshot
npm run check      # validate schema + run unit tests
npx serve .        # any static server; open the printed URL
```

No API keys or secrets. The page is fully functional with only `data/latest.json`.

## Automation

[`.github/workflows/update-data.yml`](.github/workflows/update-data.yml) runs at
:07 and :37 each hour: fetch → **validate + test** (bad data never commits) →
commit `data/latest.json` and the day's `data/history/*.json` if changed.
GitHub's built-in `GITHUB_TOKEN` handles the commit — no personal token needed.

## Deploying for free (GitHub Pages)

1. Push to a **public** repo.
2. **Settings → Actions → General → Workflow permissions** → **Read and write**.
3. **Settings → Pages** → Source **Deploy from a branch**, `main`, `/ (root)`.
4. Live at `https://<you>.github.io/<repo>/` within a minute or two.
5. Optionally trigger the first run: **Actions → Update AI Market Pulse data →
   Run workflow**.

GitHub Pages + Actions are free for public repos — no server, no bill.

## Known limitations

- History-based deltas (24H/7D/30D) only become meaningful once snapshots
  accumulate; until then the map shows current activity and labels the gap.
- Yahoo Finance's quote endpoint is unofficial/undocumented — fine for low
  traffic, could rate-limit.
- Categorization and entity matching are keyword heuristics and will
  occasionally misfile a headline.
- The ocean map is dense on very small screens; the always-present text summary
  is the accessible fallback.

## Phase 2 ideas

Visitor lenses (Builder/Investor/Researcher/Creator over the same data), spike
detection surfaced as "storms," per-entity history sparklines once enough
snapshots exist, and richer connection provenance.
