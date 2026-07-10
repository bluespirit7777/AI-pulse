# Methodology

How AI Pulse turns raw feeds into clustered events, categories, scores,
verification, ranges, and the visual encodings on the page. Everything here is
**deterministic and transparent** — a ranking heuristic, never a claim of
objective truth. The logic lives in
[`scripts/lib/signals.mjs`](../scripts/lib/signals.mjs) and
[`scripts/lib/history.mjs`](../scripts/lib/history.mjs), and is unit-tested in
[`test/signals.test.mjs`](../test/signals.test.mjs) and
[`test/history.test.mjs`](../test/history.test.mjs) against real feed output.

## Pipeline

1. **Fetch** — 9 publisher RSS feeds + Yahoo Finance quotes. No API keys.
2. **Filter** — drop items older than 60 days (some feeds carry years-old
   evergreen posts). Falls back to the unfiltered pool if fewer than 12 recent
   items exist.
3. **Categorize** each raw item (before clustering — category agreement is one
   clustering signal).
4. **Cluster** duplicate reports of the same event (weighted, below).
5. **Score** each cluster: significance, verification, impact, entity IDs.
6. **Derive** the ocean-map activity, three waves, the detailed sections, the
   per-range stats, and the daily category history — all from the same clusters.

## Event clustering (Priority 2)

Plain title-token Jaccard fails on real headlines: differently-worded reports of
the *same* event often share under 0.4 title overlap, while *unrelated*
same-company stories share 0.1–0.15 purely from the company name. The composite
`clusterScore` blends five signals:

- **TF-IDF-weighted title overlap** — a token's weight is inverse to how many
  items in the batch contain it, so "OpenAI" (in dozens of same-day items)
  contributes almost nothing while "copyright" or "simo" dominate.
- **Proper-noun-phrase overlap** — shared multi-word capitalized names
  ("Fidji Simo") survive the case-folding that plain tokenizing destroys.
- **Description overlap** (same TF-IDF weighting).
- **Time proximity** — decays to zero over 48h.
- **Entity overlap** — shared tracked-entity IDs.

**Structural signals only confirm, never substitute for, content overlap.** If
title+phrase+description similarity is below a floor, entity/time/category
agreement is discarded entirely — otherwise ten unrelated same-day OpenAI
stories merge into one cluster (a real failure caught during tuning). Clustering
is **best-match-wins**, not first-match-wins, so processing order can't change
the result. Threshold `0.34`, validated against the real OpenAI/NYT copyright
merge (2 sources), the Fidji Simo departure (3 outlets, 3 different headlines),
and a false-positive guard that keeps 5 distinct same-day OpenAI stories apart.

Each cluster keeps a stable ID, its earliest publication as the canonical
representative, and every distinct source.

## Categorization (Priority 3)

Weighted scoring across 11 categories — Product, Adoption, Research, Open source,
Compute, Capital, Market, Policy, Org/governance, Analysis, General. Every rule
that matches contributes its weight; the highest total wins, and a **confidence**
(the winner's dominance over the runner-up) is returned. Below a minimum score
the result is **General** — it never forces unmatched text into Product the way
the old first-match regex did. **Analysis** (opinion/explainer/question-form
headlines) and **General** are excluded from the three waves.

## Significance score (0–100)

A weighted blend, all four terms in [0,1]:

```
score = 0.35·recency + 0.25·sources + 0.25·entity + 0.15·category
```

- **recency** — linear decay from 1.0 (now) to 0.0 at 72 hours.
- **sources** — `min(sourceCount, 4) / 4`.
- **entity** — highest curated importance among matched entities / 100.
- **category** — a fixed per-category weight.

## Verification vs. impact (Priority 4)

Two **independent** axes — source count alone is a bad proxy for truth:

**Verification** (how reliable the reporting is), in priority order:
1. `analysis` — commentary isn't a fact to verify.
2. `official` — published by the subject's own channel (counts even with one
   source, and even if a third party reported first — all merged sources are
   checked).
3. `uncertain` — hedged/unconfirmed language ("reportedly", "sources say")
   **overrides source count**, so repeating one unsupported claim across outlets
   does not read as well-verified.
4. `corroborated` — 2+ independent sources.
5. `single` — one source so far.

**Impact** (event magnitude, from the significance score): `high` (≥70) ·
`notable` (≥45) · `emerging` (<45). Worded differently from verification so the
two chips never read as one combined "confidence".

## Real per-range stats (Priority 1)

Each build appends today's clusters as compact **events** (id, clusterId, title,
publishedAt, category, family, entityIds, significance, sourceCount,
verification — no article bodies) to `data/history/events/YYYY-MM-DD.json`,
retained 60 days. `data/range.json` then computes, for each of 24H/7D/30D:

- `entityActivity` for the current window,
- `entityDelta` vs. the **equivalent prior window** of the same length (7D
  compares the last 7 days to the 7 days before that — not a single fixed
  point),
- `categoryCounts` and `topEntities`.

**`previousWindowComplete` gates every delta.** When history isn't yet twice the
requested range, the delta is omitted (not zeroed), and the UI says "trend
accumulating". `historyDepthDays` is derived from the **earliest day-file on
disk**, never from article publish dates — a single day of collection can
contain a 45-day-old article, and using article age would falsely claim 45 days
of history.

## Three strongest waves

The highest-significance eligible cluster per family (Product / Market /
Research), never simply the three newest. Market absorbs market/capital/compute/
policy/org-governance; Research is papers/benchmarks; everything else is Product.

## Visual encodings

**Ocean Map** — node **size** = curated importance (an estimate, labelled as
such); inner **glow** = live activity in the selected range; outer **ring** =
change vs. the equivalent prior period (absent entirely, not zero-styled, when
there's no complete prior window); **trend arrow** ▲/▼ = rising/falling; **dashed
node** = no fresh signal this range. Connections are Bézier current paths,
de-emphasized until a node is selected.

**Waveforms** — x = publish time in a 72h window; amplitude = significance;
brightness = freshness; marker size = source count; secondary peaks = other
same-family stories this window; trend arrow = winner vs. the family's other
points.

**Signal River** — chronological (time first); dot size = significance but never
reorders; verification chip per item; category/entity/time filters; expand/
archive for older signals.

**The Tide** — daily category volume, stacked, only over days actually
collected; below 3 days it shows a "still filling" state.

## What we deliberately don't do

- No proportional bars for ordinal rankings presented as scores.
- No trend line, ring, or delta from a single snapshot.
- No claim that a stock move was *caused* by a news event.
- No interpolation of missing history; no history implied before collection began.
- Curated/estimated data is always chip-labelled as such.

## Community pulse

Developer-community feedback for the top models. Two honestly-separated parts:

- **Live (auto):** discussion volume, total engagement, and the top threads per
  model from the **Hacker News Algolia API** (free, no key) over the last 30
  days. Real feedback you can click into and read. Sorted busiest-first.
- **Curated:** a one-line editorial reception summary per model (in
  [`js/curated.js`](../js/curated.js)), chip-labelled "Curated".

Why hybrid: a computed sentiment score has **no reliable free live source** —
Twitter/X and Reddit APIs are now paid/restricted, and sentiment-analysis APIs
cost money. Rather than fabricate a score, the live part is honest discussion
data (developer community) and broader "normal-user" reception is folded into
the hand-written curated line.

## Curated datasets

The leaderboard, image/video rankings, market-share donut, and compute pricing
have no free live source. They live in [`js/curated.js`](../js/curated.js),
render with a "Curated" chip, and are updated by hand. The donut's wedges are
computed from the legend so the two can't disagree.
