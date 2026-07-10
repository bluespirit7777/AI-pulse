# Methodology

How AI Pulse turns raw feeds into the signals, waves, rankings, and the ocean
map. Everything here is **deterministic and transparent** — a ranking heuristic,
never a claim of objective truth. The logic lives in
[`scripts/lib/signals.mjs`](../scripts/lib/signals.mjs) and is unit-tested in
[`test/signals.test.mjs`](../test/signals.test.mjs).

## Pipeline

1. **Fetch** — 9 publisher RSS feeds (OpenAI, Google, DeepMind, TechCrunch,
   VentureBeat, The Verge, Ars Technica, Wired, MIT Tech Review) + Yahoo Finance
   quotes. No API keys.
2. **Filter** — drop items older than 60 days (some feeds carry years-old
   evergreen posts). Falls back to the unfiltered pool if fewer than 12 recent
   items exist.
3. **Merge duplicates** — stories whose titles share ≥ 0.5 Jaccard token overlap
   collapse into one event. The earliest publication is canonical; every distinct
   source is retained as corroboration (`sourceCount`).
4. **Categorize** — first matching rule wins, in priority order: policy → capital
   → compute → opensource → research → market → adoption → product (default).
5. **Score significance** (see below).
6. **Derive** the ocean-map activity, three waves, and the existing detailed
   sections from the same scored stream.

## Significance score (0–100)

A weighted blend, all four terms normalized to [0,1]:

```
score = 0.35·recency + 0.25·sources + 0.25·entity + 0.15·category
```

- **recency** — linear decay from 1.0 (now) to 0.0 at 72 hours old.
- **sources** — `min(sourceCount, 4) / 4`. More independent outlets ⇒ higher.
- **entity** — highest curated importance among matched entities / 100.
- **category** — a fixed per-category weight (policy/capital/compute rank highest,
  adoption lowest).

This is intentionally simple so a reader can reconstruct any score. It is **not**
objective importance — it is a documented heuristic for ordering.

## Three Strongest Waves

Signals are bucketed into three families and the **highest-significance** item in
each is chosen (never simply the newest three):

- **Product** — product, adoption, open-source stories.
- **Market** — market, capital, compute, policy (business/regulatory forces).
- **Research** — papers, benchmarks, new capabilities.

Each wave shows two independent quality signals, worded so they never collide:

- **Confidence** (corroboration): Strong (3+ sources) · Moderate (2) · Early (1).
- **Significance magnitude**: High impact (≥70) · Notable (≥45) · Emerging (<45).

## Ocean-map activity (node glow)

For each tracked entity, activity = the number of recent signals whose text
matches that entity's `match` terms (word-boundary aware). This is **live and
real**, recomputed every build. Node **size**, by contrast, is a hand-set
`importance` estimate in [`data/entities.json`](../data/entities.json) — the UI
labels it "curated estimate" and marks quiet nodes (zero activity) with a dashed
outline.

## Historical deltas (24H / 7D / 30D)

Each run writes one compact snapshot to `data/history/YYYY-MM-DD.json` (the day's
last run wins, bounding growth to ~365 files/year). The map compares today's
activity to the snapshot N days ago. **When that snapshot doesn't exist yet, the
UI says so** ("history accumulating") and shows current activity — it never
fabricates a trend from a single data point.

## What we deliberately don't do

- No proportional bars for ordinal rankings presented as scores — bar length is
  explicitly labeled ordinal.
- No trend lines from a single snapshot.
- No claim that a stock move was *caused* by a news event.
- No interpolation of missing history.
- Curated/estimated data is always chip-labeled as such.

## Curated datasets

The leaderboard, image/video rankings, market-share donut, and compute pricing
have no free live source. They live in [`js/curated.js`](../js/curated.js),
render with a "Curated" chip, and are updated by hand — edit the file and commit.
The donut's wedges are computed from the legend array so the two can never
disagree.
