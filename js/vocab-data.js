// Hand-maintained term definitions for vocab.html — the same pattern as
// js/curated.js: a plain exported array, edited and committed by hand, no
// fetch, no build step. Every entry links back to the dashboard section
// (app.html#anchor) where the term is actually used.
//
// `section` MUST be one of VOCAB_SECTIONS' ids below, which are themselves
// the same four ids as PANELS in js/nav.js — test/vocab.test.mjs enforces
// both constraints so this file can't silently drift from the dashboard's
// own four top sections or from a renamed anchor.
//
// Update cadence: edit here, commit. VOCAB_ASOF drives no UI element today —
// kept for the same reason CURATED_ASOF exists in curated.js, in case a
// "last updated" note is added later.

export const VOCAB_ASOF = 'Aug 2026';

export const VOCAB_SECTIONS = [
  { id: 'models', label: 'Models & Leaderboards' },
  { id: 'ecosystem', label: 'Ecosystem' },
  { id: 'today', label: 'News Wave' },
  { id: 'markets', label: 'Markets' },
];

export const vocabTerms = [
  // ---------- Models & Leaderboards ----------
  {
    term: 'AAII',
    definition: "Artificial Analysis Intelligence Index — a published 0–100 score blending agentic, coding, general-capability and science results into one composite. Used for the Leaderboard's \"Overall balance\" view, which is labelled editorial synthesis rather than a single objective ranking.",
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: "Humanity's Last Exam (HLE)",
    definition: "A hard reasoning benchmark, run independently here by Artificial Analysis. The Leaderboard's \"Reasoning\" view uses that independent run rather than higher, tool-assisted vendor-reported figures, so every model sits on the same comparable scale.",
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: 'SWE-bench Verified',
    definition: 'A benchmark measuring whether a model can fix real, verified software issues end to end. Powers the Leaderboard\'s "Agentic coding" view — the site flags it as the top models close in, calling the benchmark near-saturated rather than treating a 1-point lead as a real difference.',
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: 'MoE (Mixture of Experts)',
    definition: "A model architecture where only a subset of the model's total parameters (\"experts\") activate for any given input, so a very large model can run at a fraction of its full-size compute cost. Common among the open-weight releases covered in Frontier Releases.",
    section: 'models',
    anchor: 'sec-releases',
  },
  {
    term: 'Elo (arena score)',
    definition: 'A relative ranking score computed from head-to-head comparisons rather than a fixed test — used here for the Image and Video AI rankings, where models are judged in blind pairs.',
    section: 'models',
    anchor: 'sec-media-image',
  },
  {
    term: 'Open weights',
    definition: "A model whose trained parameters are published for anyone to download and run themselves, instead of being reachable only through a paid API. The Local AI rankings track only models that are actually self-hostable this way.",
    section: 'models',
    anchor: 'sec-media-local',
  },
  {
    term: 'Benchmark saturation',
    definition: 'What happens when the top models on a benchmark all score within a point or two of each other, so the benchmark can no longer meaningfully tell them apart. The Leaderboard calls this out explicitly where it applies instead of treating a narrow lead as a real difference.',
    section: 'models',
    anchor: 'sec-leaderboard',
  },
  {
    term: 'Editorial synthesis',
    definition: 'A ranking built by blending multiple signals and editorial judgment rather than reading straight off one published benchmark. The Leaderboard\'s "Overall balance" view is labelled this way on purpose, so it is never mistaken for a single authoritative score.',
    section: 'models',
    anchor: 'sec-leaderboard',
  },

  // ---------- Ecosystem ----------
  {
    term: 'Node size vs. glow',
    definition: "On the Ecosystem map, a node's size is its curated importance (hand-set, changes rarely); its glow is live activity computed from the current signal feed (updates automatically). The two are deliberately different measurements.",
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Activity score',
    definition: "How much a given entity is showing up in the live signal feed right now, computed automatically and shown as a node's glow on the Ecosystem map — not the same as the node's size, which is curated importance.",
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Depth layer',
    definition: 'The Ecosystem map groups its entities into five layers — applications, frontier models, open source, cloud/compute, and chips — from the surface (fast-moving) down to the seabed (slow, structural). The same surface-to-seabed metaphor labels every section of the dashboard.',
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Entity',
    definition: "Any single tracked player on the Ecosystem map — a company, a model family, a cloud platform, or a chip line. Click any entity's node for its detail drawer and the live signals that mention it.",
    section: 'ecosystem',
    anchor: 'sec-map',
  },
  {
    term: 'Dependency / partnership / competition line',
    definition: 'The lines connecting nodes on the Ecosystem map, showing how entities relate to each other — who depends on whom, who partners, and who competes. Hand-curated, not computed from the live feed.',
    section: 'ecosystem',
    anchor: 'sec-map',
  },

  // ---------- News Wave ----------
  {
    term: 'Signal',
    definition: 'One tracked news item — an article, release note, or post — pulled from a publisher feed, official lab channel, or Hacker News. The News Wave and Ecosystem map are both built from the same underlying set of signals.',
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Clustering / duplicate merge',
    definition: "When multiple outlets cover the same underlying story, the pipeline merges them into a single row instead of showing near-duplicate headlines separately — one entry per real event, not one per article.",
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Significance score',
    definition: 'A 0–100 score the pipeline computes for each signal, used to rank what surfaces first in the News Wave. A higher score is about this cycle, not a permanent claim about importance.',
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Provenance chip (Live / Auto / Curated / Estimated)',
    definition: 'A small label on every figure across the site stating where it came from: Live (fetched automatically right now), Auto (computed from live data), Curated (hand-maintained), or Estimated (no reliable live source exists yet). Meant to be checked before trusting a number, not decoration.',
    section: 'today',
    anchor: 'sec-waves',
  },
  {
    term: 'Corroboration',
    definition: 'Whether a claim or figure is backed by more than one independent source. The site treats a number confirmed across two sources differently from a single self-reported one, and says which situation applies.',
    section: 'today',
    anchor: 'sec-waves',
  },

  // ---------- Markets ----------
  {
    term: 'Market cap',
    definition: "The total market value of a company's shares — share price times shares outstanding. On the AI Stock Network, a node's size is scaled to this figure.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: 'Relative volume',
    definition: "How much a stock is trading today compared to its own recent normal. A spike shows up as extra glow on the AI Stock Network, independent of whether the price moved much.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: 'Day-change ring',
    definition: "The ring around a stock's node on the AI Stock Network, showing that day's price move — computed from the last two valid trading bars, not a live streaming tick.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: 'Price-return correlation (vs. business ties)',
    definition: "How closely two stocks' daily returns have moved together over the past 30 days — a statistical relationship, not a claim about why. The Stock Network keeps this view separate from hand-curated \"business ties\" (partnerships, supply relationships) so the two are never confused.",
    section: 'markets',
    anchor: 'sec-stocks',
  },
  {
    term: '$/hr compute pricing',
    definition: 'What renting one GPU actually costs right now, per hour — merged from real public listings on Vast.ai and RunPod, not a vendor list price. Shown as a range because real marketplace offers vary.',
    section: 'markets',
    anchor: 'sec-compute',
  },
  {
    term: 'H100 / H200 / B200 / B300',
    definition: 'Nvidia GPU generations tracked on the compute panel, roughly oldest/cheapest to newest/most expensive: H100 and H200 (Hopper generation — mainstream training/inference and long-context inference) and B200 and B300 (Blackwell generation — frontier-scale training).',
    section: 'markets',
    anchor: 'sec-compute',
  },
];
