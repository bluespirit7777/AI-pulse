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
correlations appear.

**Per-stock candlestick chart.** Selecting a stock opens a drawer with a
**native SVG candlestick chart** drawn from a compact ~3-month daily OHLC
series carried in `stock-network.json` (`node.chart`). It's built and served
from the site's own domain — deliberately *not* a third-party chart embed,
which an earlier iteration used until it turned out those widget domains are
routinely blocked by ad blockers, VPNs and network filters, leaving some
visitors a silently blank box with no way for the page to even detect the
failure (a cross-origin iframe hides its load errors). The native chart
renders for everyone. Candles are green when they closed at/above the open,
coral when lower; the y-axis is scaled to the series' own high/low range
(`scripts/lib/chart.mjs`, unit-tested). It refreshes each build — near-live
daily bars, not a streaming tick chart — and a "Live interactive chart on
TradingView" link covers the fully-interactive/real-time view for anyone
whose network allows it.

## Frontier Releases: top YouTube videos

Each Frontier Releases card (Claude/ChatGPT/Gemini) flips to show the top 5
YouTube videos **by view count** in the trailing 7 days, searched for that
model **separately** — "Claude AI", "ChatGPT", "Gemini AI" — so one model's
search volume never crowds out another's, and no single combined query tries
to average three different audiences together.

Two deliberate choices worth stating explicitly:
- **View count over recency.** `order=viewCount` (YouTube's own server-side
  ranking) surfaces what actually got watched that week, not whichever
  small channel happened to publish minutes before the fetch ran — the same
  "impact over recency" reasoning behind how the Three Strongest Waves are
  picked.
- **Twice-daily cadence, not live.** This is the only credentialed source in
  the pipeline (`YOUTUBE_API_KEY`, YouTube Data API v3) and `search.list`
  costs 100 quota units/call against a 10,000/day free quota; fetching on the
  main 30-minute cycle would blow through it. It runs on its own 12-hour
  workflow instead — genuinely a **12-hour snapshot**, labelled as such (not
  "Live"), never presented as more current than it is.

**Relevance filter.** "Gemini" collides with the zodiac sign on YouTube.
`scripts/lib/youtube.mjs`'s `isAiRelevant()` rejects a result only when it
carries a zodiac/horoscope/astrology signal AND no AI-context signal — it
does not filter on the model names themselves (every result already contains
the search query in its title, which would make that check trivially true
and defeat its own purpose). Ambiguous-but-unflagged titles are left in
rather than over-filtered.

**Shorts are excluded — on a best-effort basis.** The public YouTube API has
no field that says "this is a Short"; duration is the closest available
proxy, so anything at or under 180 seconds (YouTube's own current Shorts
eligibility window) is treated as one and dropped, via a `videos.list` call
that also carries the view-count lookup — checking `contentDetails` costs no
extra quota. This is a genuine best-effort heuristic, not a guarantee: a
landscape video that happens to run under 3 minutes could still be excluded,
and there's no way to distinguish that case from the public API alone. To
keep the final top-5 full even after this filter runs, the initial
`search.list` call pulls a larger pool (15 results) than it shows (5) —
free, since `search.list`'s 100-unit cost doesn't depend on `maxResults`.

**Graceful absence.** If `YOUTUBE_API_KEY` isn't configured, or a given
run's fetch fails for one model, the card shows an honest "unavailable"
state — never a stale result mislabeled as current, and never a fabricated
one. A failed run for one model keeps that model's previous snapshot rather
than wiping it to empty; a fully missing `data/youtube-trending.json` (e.g.
before the secret is first set) is not treated as a validation error.

## Compute pricing

Live $/hr GPU rental rates from two public, no-key marketplace APIs —
[Vast.ai](https://vast.ai/) (peer-to-peer, `console.vast.ai/api/v0/bundles`)
and [RunPod](https://runpod.io/) (managed, GraphQL `gpuTypes`) — replacing the
previous hand-typed, unverifiable ranges. `scripts/lib/compute.mjs` matches
live offers against a small tracked-chip catalog and merges them into a real
low/high range; `segment` (what a chip is typically used for) stays a small
curated classification, since that's domain knowledge that doesn't go stale
the way a dollar figure does.

**Placeholder-price filtering (correctness pass).** Both marketplaces report
a price of exactly `$0` or `$0.50` for GPU types with no current live
inventory — confirmed live: RunPod returned `$0.50` identically across 13
otherwise-unrelated GPU types (a GTX 1050 and an H200 NVL do not really rent
for the same rate). Both sentinel values are excluded before computing a
range, not treated as real prices.

**Trend** is a real day-over-day comparison against a small rolling snapshot
history (`data/compute-history.json`, last 30 days), in the same spirit as
range.json's `previousWindowComplete` gating: with fewer than two snapshots
there's no comparison point yet, so the trend honestly reads "New — building
history" rather than synthesizing a "vs 2023 peak" narrative that can't be
verified or refreshed. The dead-band (±3%) mirrors `stocks.mjs`'s
`direction()`. If both marketplace fetches fail, the panel shows an honest
"unavailable" empty state — never a stale curated fallback dressed up as live.

## Community pulse ("Community Current")

A horizontal model selector + a two-column info/themes panel + a short list of
representative comments — **not** a comment feed and **not** a sentiment score.
Built entirely at fetch time from the free, no-key **Hacker News Algolia API**.
The frontend (`js/community.js`) is plain document flow: real `role="tab"`
buttons (not interactive elements nested inside an SVG), a CSS grid panel, no
absolute positioning, no runtime measurement, no connector lines.

- **Contextual matching, not raw keyword hits (correctness pass).** Every story
  and comment is validated by `matchModelMention`/`isValidatedMention`: per-model
  aliases (ChatGPT→GPT, "Claude Code"→Claude), a required nearby-AI-context test,
  and **ambiguity rejection** for family names that are ordinary words — "grok"
  as a verb ("finally grok monads") and "llama" the animal are rejected unless a
  strong alias ("Grok 4", "xAI Grok", "llama.cpp") or AI context is present. Each
  match returns a 0–1 confidence with a 0.5 threshold.
- **Exact counts vs. explicit estimates.** HN Algolia results are paginated up
  to a documented safe maximum (`HN_MAX_PAGES` × `HN_PAGE_SIZE` = 300 raw hits
  per query per model). When every raw story hit was fetched and validated
  (`storyCoverage >= 1`), `estimatedRelevantDiscussions` is an **exact** count
  (`isEstimated: false`). Otherwise it's the validated fraction of the fetched
  sample scaled up to the full raw-hit total, explicitly flagged
  (`isEstimated: true`, shown with an "≈" and an "Estimated" badge in the UI).
  An extrapolated number is never presented as an exact one — see
  `communityStoryCoverage` in `scripts/lib/signals.mjs`. Coverage (stories AND
  comments) is exposed in the model panel's "Data coverage" row. A model whose
  discussion count is small gets a **dashed selector ring** ("Limited sample").
- **Up to 2 themes per comment**, classified from *validated* HN comments
  across 10 plain-language topics (coding, reasoning, writing, speed, price,
  reliability, context, image/video, local, safety) — see `classifyTopics`. The
  model panel shows its top 4 themes as compact horizontal wave bars (bar
  length = sampled theme count), labelled "Themes in sampled comments". Topic/
  volume grouping is used instead of a made-up positive/negative score.
- **Representative comments are relevance-ranked, not length-ranked.** Each
  candidate gets a composite score (`commentRelevanceScore` in
  `scripts/lib/signals.mjs`): 0.40 model-match confidence + 0.25 theme
  specificity (rarer themes score higher than "coding", which nearly everyone
  mentions) + 0.20 contextual completeness (reads as a full thought, not a bare
  quote-reply — structural, not primarily length) + 0.15 recency. Non-
  duplication is enforced as a selection-time filter: a candidate is skipped if
  it's near-identical (Jaccard similarity > 0.6) to one already picked, both
  within a model's own list and globally (`usedCommentIds`, so an excerpt never
  repeats under a different model). 3 comments show by default; a 4th is behind
  "Show one more" — no auto-scroll. Excerpts are **sanitised** (HTML stripped,
  entities decoded) and truncated to ~180 chars centred on the model keyword.

Why not a sentiment score: automated sentiment isn't objective truth, and the
sources that would improve breadth (X, Reddit) are paid/restricted. The result
is labelled a **sample** of public developer discussion, not the whole
community. On partial source failure each model is independent (per-model
try/catch), so one failure never blanks the section.

## Signal correctness: integrity caps

A single thinly-sourced story can otherwise still reach High impact purely
from recency + a heavily-weighted entity mention — routine personnel news or
an unconfirmed rumor dressed up as a confirmed major event. `scoreSignificance`
applies a **meaningful penalty (×0.8)**, not a rounding nudge, when
`categorize()`'s own winner-vs-runner-up confidence is below `0.45`
(`LOW_CATEGORY_CONFIDENCE`) — the category call itself wasn't confident, so
recency/entity weight alone shouldn't be able to push the story to the top.

After verification is known, `applyIntegrityCaps` (in `scripts/lib/signals.mjs`)
applies three more rules, in order:
1. Single-source, non-official **General/Analysis** stories have their
   significance capped at `GENERAL_SIGNIFICANCE_CAP` (55).
2. General/Analysis **cannot reach High impact** without an official primary
   source or independent corroboration (2+ sources), regardless of the raw
   score.
3. **Job postings** and **speculative/rumoured plans** ("plans to…",
   "reportedly considering…") default to Emerging or Notable, never High —
   detected via `JOB_POSTING_RE`/`SPECULATIVE_RE`, independent of category.

Regression-tested against a synthetic "OpenAI hires a family product manager"
job posting: fresh, mentions a heavily-weighted entity, would otherwise score
High — capped to Notable (significance 55) and correctly outranked by a
confirmed, corroborated launch (significance 74, High).

## Date consistency

All persisted display dates are generated with **explicit UTC**
(`scripts/lib/dates.mjs`'s `shortDateUTC`/`dayKeyUTC`, using `getUTCMonth()`
etc. directly rather than `toLocaleDateString`, which silently uses the host
machine's local timezone). `dateISO` is the stored authority; display strings
are derived from it, never the other way around. Tested for TZ-independence by
switching `process.env.TZ` across Pacific/Kiritimati, Etc/GMT+12 and
America/Los_Angeles and confirming the same ISO instant always formats to the
same calendar day (`test/dates.test.mjs`) — the same class of bug that (before
this pass) made `fmtSnapshot()` label local time "UTC" without actually
formatting in UTC.

## Leaderboard: 4 use-case-specific views

One blended ranking reads as more objective than the evidence supports —
different benchmarks disagree about which model is "best" depending on the
task. `js/curated.js`'s `LEADERBOARD_VIEWS` offers 4 views instead:
**Overall balance**, **Reasoning**, **Agentic coding**, **Cost efficiency**.
Only Overall balance carries a disclaimer — *"Editorial synthesis—not a
universal benchmark ranking."* — because it's a hand-weighted blend; the other
three are direct benchmark or pricing-tier readouts. Every row's note names
its source and snapshot date (Scale Labs' Humanity's Last Exam/EnigmaEval for
Reasoning, SWE Atlas/Remote Labor Index for Agentic coding, public pricing
pages for Cost). Where a model has no tracked score for a view's specific
benchmark, the note says so honestly ("Not among Scale Labs' published
scorers…") rather than assigning an invented number. Cost efficiency is
deliberately **qualitative** (budget/mid/premium tier + self-hostability), not
fabricated precise $/token figures, since exact provider pricing changes too
often for a hand-maintained number to stay honest for long.

**Bar honesty**: `js/sections.js`'s `rankRows()` only draws a proportional bar
where a row carries a real published `score` (e.g. Reasoning's Humanity's Last
Exam %, Image AI's Elo) — its width is a genuine linear scale against the
strongest score in that view. Rows without one (Overall balance, Agentic
coding, Cost efficiency, Local/Video AI, and any model not tracked on a given
benchmark) render no bar at all: a numbered rank, an "Editorial ranking · no
measured score" tag, and a "T-" prefix when two rows tie. This replaced an
earlier version where every row got a bar sized from an internal ordinal `w`
weight regardless of whether a real score existed — a decorative bar length
that could be mistaken for a measurement.

## Local AI hardware specs

Both Local AI cards (PC and Mobile) flip to a specs table via a deliberately
prominent button (solid fill, icon, gentle pulse — distinct from the quieter
"Top videos this week" flip on Frontier Releases, since this one is easy to
miss otherwise). The **size and hardware tier are calculated, not measured**:
each model's published parameter count × ~0.6GB per billion (the typical
4-bit GGUF/AWQ quantization ballpark), stated in the panel's note and in
`curated.js`'s `LOCAL_AI_SPECS_METHODOLOGY`.

The **PC list is scoped to real personal computers**, one solid open-weight
pick per consumer RAM tier from an 8GB laptop (Llama 3.2 3B) up to a 64GB
desktop (Llama 3.3 70B), via Llama 3.1 8B / Qwen 2.5 14B / Gemma 2 27B in
between. These are all dense models that run on ordinary hardware — system
RAM for CPU inference, or a consumer GPU's VRAM. It deliberately does NOT list
the genuinely "biggest/best" open models (Qwen 235B, DeepSeek 671B, etc.);
those need workstations or servers, which isn't what "run it on my PC" means.
The Mobile table is a separate curated list (Gemma 3n, MiniCPM-V, Phi-3.5-mini,
Llama 3.2 3B, Qwen 2.5 1.5B) picked for on-device (phone/tablet) fit.

Both flip-card backs (and Frontier Releases') share the same auto-sizing
mechanism: `js/sections.js`'s `sizeFlipCards()` measures each face's real
`scrollHeight` (still accurate even while `overflow-y:auto` is actively
clipping it) and sets the shared container to the tallest, so neither face
needs its own internal scrollbar.

## Data Health

A compact footer control (`js/datahealth.js`) summarizing the pipeline's own
completeness, separate from the content itself: successful/configured feed
count (HTTP-ok fetches, not "had ≥1 item" — `fetchFeed` returns `{items, ok}`
so a feed that's fine but has 0 new items is distinguishable from a feed that
actually failed), stock nodes available, community models available, history
depth, how many community datasets are estimates rather than exact counts,
build SHA, and when data last updated successfully. Full detail is in a
drawer (click the chip), mirroring the AI Stock Network's existing drawer
pattern (focus trap, Escape to close, focus restored on close).

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
