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

1. **Fetch** — 9 publisher RSS feeds, 5 official frontier-lab **YouTube** channel
   Atom feeds (OpenAI, Anthropic, Google DeepMind, AI at Meta, NVIDIA), and Yahoo
   Finance quotes. No API keys. Video uploads are gated to release-like items
   (must name a lab **and** read as a product release) so keynotes and tutorials
   never enter the general stream — a launch video simply corroborates the blog
   release.
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

**Explicit event relation (correctness pass).** On top of the similarity blend,
each pair is checked for an extracted **action** (shutdown / resign / acquire /
raise / invest / sue / regulate / partner / launch / research) and a set of
**salient objects** (domain nouns + proper-noun phrases). Two reports with the
same action and a shared object are merged even when their wording barely
overlaps (the two "ChatGPT Atlas browser is dead" reports); two reports with
**conflicting** actions and weak object overlap are blocked from merging even
when they share a company and a day (a GPT-5.6 *launch* vs a Codex/ChatGPT-Work
story). This is unit-tested against both cases.

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
same-family stories this window. The badge reads **Stands out / Typical / Lower
intensity** — an honest *within-window* comparison of the winner against its
family's other stories, **not** a time-series trend (we don't yet have the
multi-day per-family history a real rising/falling trend would need).

**"Why it matters"** is a deterministic editorial line about the **consequence**
of the event — keyed by the extracted action, then category, and hedged when the
signal is emerging or thinly sourced (`whyItMatters` in `signals.mjs`, computed at
build time). The scoring rationale ("day's strongest product move …") is kept as
a separate, clearly-labelled **"Why selected"** line so consequence and selection
are never conflated.

**Signal River** — chronological (time first); dot size = significance but never
reorders; verification chip per item; category/entity/time filters; expand/
archive for older signals.

**The Tide** — *how operational AI activity changes each day*: stacked daily
volume across the nine operational categories only. **General commentary and
opinion/analysis are excluded** (stated in the UI), so it tracks activity, not
chatter. Plotted only over days actually collected; below 3 days it shows a
"still filling" state and never implies history that wasn't recorded.

## What we deliberately don't do

- No proportional bars for ordinal rankings presented as scores.
- No trend line, ring, or delta from a single snapshot.
- No claim that a stock move was *caused* by a news event.
- No interpolation of missing history; no history implied before collection began.
- Curated/estimated data is always chip-labelled as such.

## AI stock network

Ten AI stocks as a deterministic ecosystem depth map (no force simulation).
Node **size** = market cap, inner **glow** = relative volume, outer **ring** =
day change. Two clearly-separated modes:

- **Ecosystem** — curated business ties (depends / partners / competes).
- **Market motion** — 30-day **price-return correlation**. All heavy math runs
  in GitHub Actions (`scripts/lib/stocks.mjs`): daily simple returns from 3
  months of closes, Pearson correlation over the last 30 trading days **present
  in both series** (so a "30-day" number always means 30 observations),
  filtered to |r| ≥ 0.5. Positive vs. negative is shown by solid vs. dashed
  lines (not colour alone) and thickness = |r|.

**Daily % change (correctness pass)** is computed from the **last two valid
trading bars**, not Yahoo's `chartPreviousClose` (which is the close from the
*start* of the 3-month range and produced absurd "daily" moves like AMD +128%).
Null/zero closes are dropped first, so weekends, holidays and missing bars are
handled naturally; the live `regularMarketPrice` is used as the latest point only
when it is genuinely newer than the last posted bar. A move over ±25% is
**flagged for review** (`changeReview`), not silently dropped — real large moves
happen, but so do unadjusted-split artifacts — and the same field is shared by
the network, table and drawer so they can never disagree. `dailyChange` has 12
regression tests including the exact AMD bug.

**Market cap** = curated shares outstanding × live price — a real, price-updating
figure (shares change only quarterly), never fabricated; the endpoint that
serves live market cap is auth-gated, so this is the honest alternative.
**Relative volume** = latest volume / 20-day average (raw share volume isn't
comparable across companies). Business relationships and price correlations are
kept strictly separate, and *correlation ≠ causation* is stated wherever
correlations appear. The accessible table remains behind "View as table".

## Community pulse

A model conversation map + representative public comments — **not** a comment
feed and **not** a sentiment score. Built entirely at fetch time from the free,
no-key **Hacker News Algolia API**:

- **Contextual matching, not raw keyword hits (correctness pass).** Every story
  and comment is validated by `matchModelMention`/`isValidatedMention`: per-model
  aliases (ChatGPT→GPT, "Claude Code"→Claude), a required nearby-AI-context test,
  and **ambiguity rejection** for family names that are ordinary words — "grok"
  as a verb ("finally grok monads") and "llama" the animal are rejected unless a
  strong alias ("Grok 4", "xAI Grok", "llama.cpp") or AI context is present. Each
  match returns a 0–1 confidence with a 0.5 threshold.
- **Bubble size = validated public discussions** — raw HN story hits scaled by
  the validated fraction of the sample, never the raw hit count. `rawHits`,
  `validatedMentions` and `validatedDiscussions` are stored separately; a
  **"Limited discussion sample"** badge appears when validated discussions are
  sparse. (In one live build this cut grok's 11,120 raw comment hits to ~6,255
  validated mentions — the verb noise removed.)
- **Topic themes** classified from *validated* HN comments across 10
  plain-language topics (coding, reasoning, writing, speed, price, reliability,
  context, image/video, local, safety) — see `classifyTopics`. Topic/volume
  grouping is used instead of a made-up positive/negative score.
- **Representative comments**: real, validated HN excerpts, one per distinct
  theme (so they don't repeat a point) and **globally de-duplicated** so an
  excerpt never reappears under a different model; **sanitised** (HTML stripped,
  entities decoded) and truncated to ~180 chars centred on the model keyword so
  they stay on-topic; each shows author, source, time and a direct link.

Why not a sentiment score: automated sentiment isn't objective truth, and the
sources that would improve breadth (X, Reddit) are paid/restricted. The result
is labelled a **sample** of public developer discussion, not the whole
community. On partial source failure each model is independent (per-model
try/catch), so one failure never blanks the section.

## Build provenance

Each build stamps `latest.json` with a `build` block — `sha`, `shortSha`, `ref`,
`builtAt` — from `GITHUB_SHA` in CI or `git rev-parse` locally. The footer renders
**"Build &lt;shortSha&gt; · data generated &lt;time&gt;"** linking to the exact commit, so the
live GitHub Pages deployment can be verified against the repo at a glance.
`validate.mjs` enforces the block's presence before any commit.

## Curated datasets

The leaderboard, image/video rankings, market-share donut, and compute pricing
have no free live source. They live in [`js/curated.js`](../js/curated.js),
render with a "Curated" chip, and are updated by hand. The donut's wedges are
computed from the legend so the two can't disagree.
