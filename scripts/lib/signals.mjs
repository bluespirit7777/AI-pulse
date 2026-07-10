// Shared, pure, deterministic signal logic — imported by scripts/update-data.mjs
// (build time) and test/signals.test.mjs. No I/O, no randomness, no Date.now():
// callers pass an explicit `now` so output is reproducible and testable.
//
// Everything here is documented and deterministic on purpose: the site claims a
// scoring system, not an oracle, so a reader can follow exactly why a story
// scored the way it did. See docs/METHODOLOGY.md.

// ---------- text normalization ----------
const STOPWORDS = new Set(
  'the a an and or of to in on for with at by from as is are be new now this that its it s ai'.split(' ')
);

export function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenSet(s) {
  return new Set(
    normalizeTitle(s)
      .split(' ')
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

// Jaccard overlap of significant tokens — 1.0 identical, 0.0 disjoint.
export function similarity(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---------- weighted event clustering ----------
// Plain token-Jaccard on titles fails on real headlines: differently-worded
// reports of the SAME event ("Fidji Simo steps down from OpenAI's no. 2 role"
// vs "OpenAI's CEO of AGI Deployment, Fidji Simo, Is Stepping Down") often
// share under 0.4 title overlap, while UNRELATED same-company stories share
// 0.1-0.15 purely from common words like "OpenAI". Two fixes:
//
// 1. TF-IDF-weighted token overlap instead of plain Jaccard: a token's weight
//    is inverse to how many items in the current batch contain it, computed
//    once per build from the actual batch. "OpenAI" appears in dozens of
//    same-day items so it contributes almost nothing; "copyright" or "simo"
//    appear in a handful and dominate the score. This is what actually
//    discriminates "same event, different wording" from "same company,
//    different event" — entity/company overlap alone cannot.
// 2. A proper-noun-phrase bonus: shared multi-word capitalized phrases (e.g.
//    "Fidji Simo") are a strong, cheap signal plain tokenizing throws away
//    (lowercasing erases the capitalization that marks a name).
//
// The final score blends five signals; none alone is reliable, together they
// are. Threshold and weights were tuned against real feed output — see
// test/signals.test.mjs for the exact headlines this was validated against.

function idf(token, docFreq, totalDocs) {
  const d = docFreq.get(token) || 1;
  return Math.log((totalDocs + 1) / (d + 0.5)) + 1; // smoothed, always positive
}

// Build a token → document-frequency map across the whole batch being
// clustered. Must be recomputed per batch (frequencies are batch-relative).
export function buildDocFreq(texts) {
  const df = new Map();
  for (const t of texts) {
    for (const tok of tokenSet(t)) df.set(tok, (df.get(tok) || 0) + 1);
  }
  return df;
}

export function weightedSimilarity(a, b, docFreq, totalDocs) {
  const A = tokenSet(a), B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  const union = new Set([...A, ...B]);
  let interW = 0, unionW = 0;
  for (const tok of union) {
    const w = idf(tok, docFreq, totalDocs);
    unionW += w;
    if (A.has(tok) && B.has(tok)) interW += w;
  }
  return unionW ? interW / unionW : 0;
}

// Multi-word capitalized phrases from the ORIGINAL (un-lowercased) text, e.g.
// "Fidji Simo", "New York Times" — a cheap stand-in for named-entity
// extraction that survives exactly the case-folding that destroys it in
// token-based similarity.
export function properNounPhrases(title) {
  const matches = String(title || '').match(/\b[A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+)+\b/g) || [];
  return new Set(matches.map((m) => m.toLowerCase()));
}

export function phraseOverlap(a, b) {
  const A = properNounPhrases(a), B = properNounPhrases(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const p of A) if (B.has(p)) inter++;
  return inter / Math.min(A.size, B.size); // overlap coefficient, not Jaccard — one shared name is already meaningful even if titles differ in length
}

// Hours between two dates, always >= 0.
function hoursBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3.6e6;
}

// Composite same-event score in [0,1]. `nodes` is the entities list (for
// entity-overlap); pass [] to skip that term. `x.category`/`y.category`, if
// present, add a same-category bonus.
//
// IMPORTANT: structural agreement (same entity, same category, published
// close together) is only ever used to CONFIRM real textual overlap, never to
// substitute for it. Verified against real feed output: without this gate,
// ten completely unrelated same-day OpenAI stories (a model launch, a browser
// shutdown, a bug bounty, a newsletter piece, a departure...) merged into one
// cluster purely because they shared entity+day+category — near-zero actual
// topical overlap. `contentSim` (title/phrase/description) is computed first;
// if it's below MIN_CONTENT, structural signals are discarded entirely.
const MIN_CONTENT = 0.02;

export function clusterScore(x, y, docFreq, totalDocs, nodes = []) {
  const titleSim = weightedSimilarity(x.title, y.title, docFreq, totalDocs);
  const descSim = weightedSimilarity(x.desc || '', y.desc || '', docFreq, totalDocs);
  const phraseSim = phraseOverlap(x.title, y.title);
  const contentSim = 0.5 * titleSim + 0.3 * phraseSim + 0.2 * descSim;
  if (contentSim < MIN_CONTENT) return contentSim;

  const timeProx = clamp(1 - hoursBetween(x.date, y.date) / 48, 0, 1); // decays to 0 over 48h
  let entSim = 0;
  if (nodes.length) {
    const ex = matchEntities(`${x.title} ${x.desc || ''}`, nodes).ids;
    const ey = matchEntities(`${y.title} ${y.desc || ''}`, nodes).ids;
    if (ex.length && ey.length) {
      const union = new Set([...ex, ...ey]);
      const inter = ex.filter((id) => ey.includes(id)).length;
      entSim = inter / union.size;
    }
  }
  const catMatch = x.category && y.category && x.category === y.category ? 1 : 0;
  const structural = 0.4 * entSim + 0.35 * timeProx + 0.25 * catMatch;
  return contentSim * 0.65 + structural * 0.35;
}

// Groups items covering the same event using clusterScore. The earliest
// publication becomes the canonical representative; every distinct source URL
// is preserved so the UI can show "3 sources" and verification can reflect
// real corroboration (see verification.mjs-equivalent section below).
export function dedupeMerge(items, opts = {}) {
  const { threshold = 0.30, nodes = [] } = opts;
  if (!items.length) return [];
  const docFreq = buildDocFreq(items.flatMap((it) => [it.title, it.desc || '']));
  const totalDocs = items.length;

  const groups = [];
  for (const it of items) {
    // best-match-wins, not first-match-wins: comparing only the first group
    // that clears the threshold let an earlier, worse-matching group "steal"
    // an item away from its true best match — verified against real feed
    // output where this made merging non-deterministic-looking (see
    // test/signals.test.mjs for the exact case this was tuned against).
    let bestGroup = null, bestScore = -1;
    for (const g of groups) {
      const s = clusterScore(g.rep, it, docFreq, totalDocs, nodes);
      if (s > bestScore) { bestScore = s; bestGroup = g; }
    }
    if (bestGroup && bestScore >= threshold) {
      if (!bestGroup.sources.some((s) => s.link === it.link)) {
        bestGroup.sources.push({ sourceName: it.sourceName, link: it.link });
      }
      if (it.date < bestGroup.rep.date) bestGroup.rep = it; // earliest publication is canonical
    } else {
      groups.push({ rep: it, sources: [{ sourceName: it.sourceName, link: it.link }] });
    }
  }
  return groups.map((g) => ({
    ...g.rep,
    sources: g.sources,
    sourceCount: g.sources.length,
  }));
}

// ---------- entity matching ----------
// Builds a case-insensitive regex per node from its `match` terms (which may be
// plain words or regex fragments). Returns matched node ids + the highest
// importance among them (used as the entity component of significance).
export function matchEntities(text, nodes) {
  const t = String(text || '');
  const ids = [];
  let maxImportance = 0;
  for (const n of nodes) {
    const re = new RegExp('(?:' + n.match.map(toBoundaryPattern).join('|') + ')', 'i');
    if (re.test(t)) {
      ids.push(n.id);
      if (n.importance > maxImportance) maxImportance = n.importance;
    }
  }
  return { ids, maxImportance };
}

// Every match term is word-boundary-anchored so short terms can't false-match
// inside a longer word ("aws" inside "lawsuit", "tpu" inside "outputs" were
// real false positives found while tuning clustering — see test/signals.test.mjs).
// Terms that already carry their own \b markers (e.g. "\\bh100\\b") pass through.
function toBoundaryPattern(term) {
  if (/\\b/.test(term)) return term;
  const escaped = /\\d|\[|\]/.test(term) ? term : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `\\b${escaped}\\b`;
}

// ---------- categorization ----------
// Weighted scoring across all categories, not first-match regex: every rule
// that matches the text contributes its weight to that category's score, and
// the category with the highest TOTAL wins. This is what allows "General" and
// "Analysis" to exist as real outcomes — under first-match-wins, unmatched
// text always fell through to a hardcoded 'product' default, which is why
// pieces like "How did the government decide OpenAI's frontier model was
// safe to release?" or pure market commentary were mislabeled Product.
export const CATEGORIES = [
  'policy', 'capital', 'compute', 'opensource', 'research', 'market',
  'adoption', 'orggov', 'analysis', 'product', 'general',
];

const CATEGORY_KEYWORDS = {
  policy: [
    [/\bregulat\w*\b/i, 2], [/\beu ai act\b/i, 3], [/\blawsuit\b/i, 2.5], [/\bsued?\b/i, 2],
    [/\bcourt\b/i, 1.5], [/\bantitrust\b/i, 2.5], [/\bban(ned|s)?\b/i, 1.5], [/\bexecutive order\b/i, 2.5],
    [/\bsenate\b/i, 2], [/\bcongress\b/i, 2], [/\bcopyright\b/i, 2.5], [/\bsafety institute\b/i, 2],
    [/\blegislat\w*\b/i, 2.5], [/\bsanction(ed|s)?\b/i, 2],
  ],
  orggov: [
    [/\bceo\b/i, 2], [/\bresigns?\b/i, 2.5], [/\bsteps? down\b/i, 2.5], [/\bappoint(s|ed)?\b/i, 1.5],
    [/\bboard\b/i, 1], [/\bhires?\b/i, 1], [/\breorg\w*\b/i, 2], [/\blayoffs?\b/i, 2.5],
    [/\bfires?\b/i, 1], [/\bstepping down\b/i, 2.5], [/\bpromot(es|ed|ion)\b/i, 1.5], [/\badvisor\b/i, 1],
  ],
  capital: [
    [/\braise[sd]?\b/i, 1.5], [/\bfunding\b/i, 2], [/\bvaluation\b/i, 2.5], [/\bvalued\b/i, 1.5],
    [/\bseed round\b/i, 2], [/\bseries [a-e]\b/i, 3], [/\binvestment\b/i, 1.5], [/\binvests?\b/i, 1.5],
    [/\bipo\b/i, 3], [/\bacqui\w*\b/i, 2.5], [/\$\d+ ?(m|b|bn|billion|million)\b/i, 2],
  ],
  compute: [
    [/\bgpu\b/i, 2], [/\bh100\b/i, 2.5], [/\bh200\b/i, 2.5], [/\bb200\b/i, 2.5], [/\bb300\b/i, 2.5],
    [/\bblackwell\b/i, 2.5], [/\bhopper\b/i, 2], [/\btsmc\b/i, 2], [/\bfoundry\b/i, 2],
    [/\bdata ?cent(er|re)\b/i, 2], [/\bcluster\b/i, 1.5], [/\bwafer\b/i, 2], [/\bhbm\b/i, 2],
    [/\bchip\b/i, 1.5], [/\bsilicon\b/i, 1], [/\baccelerator\b/i, 1.5], [/\btrainium\b/i, 2], [/\btpu\b/i, 2],
  ],
  opensource: [
    [/\bopen.?source\b/i, 2.5], [/\bopen.?weight\b/i, 2.5], [/\bapache 2\b/i, 2], [/\bmit licen[cs]e\b/i, 2],
    [/\bhugging ?face\b/i, 2], [/\bweights (are|now)? ?(public|available|released)\b/i, 2],
  ],
  research: [
    [/\bpaper\b/i, 1.5], [/\bpreprint\b/i, 2.5], [/\barxiv\b/i, 3], [/\bstudy\b/i, 1.5], [/\bstudies\b/i, 1.5],
    [/\bbenchmark\b/i, 1.5], [/\bbreakthrough\b/i, 1.5], [/\bresearchers?\b/i, 1.5], [/\bfindings\b/i, 1.5],
    [/\bstate.of.the.art\b/i, 2], [/\bsota\b/i, 2],
  ],
  market: [
    [/\bstock\b/i, 2], [/\bshares\b/i, 2], [/\bmarket cap\b/i, 2.5], [/\brevenue\b/i, 2], [/\bearnings\b/i, 2.5],
    [/\bquarter(ly)?\b/i, 1.5], [/\bsales\b/i, 1.5], [/\bprofit\b/i, 1.5], [/\bguidance\b/i, 1.5], [/\bnasdaq\b/i, 2.5],
  ],
  adoption: [
    [/\busers?\b/i, 1], [/\badoption\b/i, 2.5], [/\benterprise\b/i, 1.5], [/\bcustomers?\b/i, 1.5],
    [/\bdeploy(ed|ment)?\b/i, 1.5], [/\brolls? out\b/i, 1.5], [/\bmillion (users|people)\b/i, 2],
    [/\bintegrat(e|es|ed|ion)\b/i, 1],
  ],
  analysis: [
    [/\bopinion\b/i, 3], [/\banalysis\b/i, 2.5], [/\bexplain(ed|er)?\b/i, 1.5], [/\bcolumn\b/i, 2.5],
    [/\bcommentary\b/i, 2.5], [/\bhere.s why\b/i, 2], [/\bwhat (it|this) means\b/i, 2],
    [/^\s*(how|why|what|when|who|is|are|does|did|should|could|would|will|can|has|have)\b/i, 1.5],
  ],
  product: [
    [/\blaunch\w*\b/i, 1.5], [/\brelease[sd]?\b/i, 1], [/\bunveil\w*\b/i, 2], [/\bintroduc\w*\b/i, 1.5],
    [/\bnow available\b/i, 2], [/\bdebuts?\b/i, 2], [/\bships?\b/i, 1.5], [/\bfeature\b/i, 1],
    [/\bupdate\b/i, 1], [/\bpreview\b/i, 1], [/\bbeta\b/i, 1],
    [/\bshut(s|ting)? down\b/i, 2], [/\bshutting down\b/i, 2], [/\bdiscontinu\w*\b/i, 2],
    [/\bsunset(s|ting)?\b/i, 2], [/\bdeprecat\w*\b/i, 2], [/\bretir(es|ed|ing)\b/i, 1.5], [/\brebrand\w*\b/i, 1.5],
  ],
};

// Score too low or too close to call → 'general' rather than forcing a guess.
const MIN_CATEGORY_SCORE = 1.5;

// Returns { category, confidence } — confidence is the winning category's
// dominance over the runner-up, in [0,1]. Never defaults unmatched text to
// 'product': below MIN_CATEGORY_SCORE it returns 'general' honestly.
export function categorize(title, desc = '') {
  const text = `${title} ${desc}`;
  const scores = {};
  for (const [cat, rules] of Object.entries(CATEGORY_KEYWORDS)) {
    let s = 0;
    for (const [re, w] of rules) if (re.test(text)) s += w;
    scores[cat] = s;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = ranked[0];
  const secondScore = ranked[1] ? ranked[1][1] : 0;

  if (topScore < MIN_CATEGORY_SCORE) return { category: 'general', confidence: 0.3 };
  const confidence = Math.round(clamp(topScore / (topScore + secondScore + 1), 0, 1) * 100) / 100;
  return { category: topCat, confidence };
}

// Which of the three "wave" families a category belongs to.
// Business/regulatory forces (market, capital, compute, policy, orggov) sit in
// the market family; shipping/adoption/open-weights in product; papers in
// research. Analysis/general are excluded upstream — they're commentary or
// unclassifiable, not a "development" a wave should represent.
export function waveFamily(category) {
  if (category === 'research') return 'research';
  if (['market', 'capital', 'compute', 'policy', 'orggov'].includes(category)) return 'market';
  return 'product';
}

// ---------- product release detection (Frontier releases section) ----------
// Deliberately narrow: a bare "release" as a verb catches far too much (op-eds,
// policy pieces, "safe to release" debates). We require shipping-specific
// phrasing, AND reject question/analysis-style headlines outright — a real
// launch announcement is declarative, not "How did X decide...?".
const RELEASE_SHIP_RE = /\b(launch(es|ed)?|unveil(s|ed)?|introduc(es|ed|ing)|now available|debuts?|ships?|rolls? out|releases? (a|its|the|new)|releasing)\b/i;
const ANALYSIS_HEADLINE_RE = /^\s*(how|why|what|when|who|is|are|does|did|should|could|would|will|can|has|have)\b/i;

export function isProductRelease(title, desc) {
  if (ANALYSIS_HEADLINE_RE.test(String(title || '').trim())) return false;
  return RELEASE_SHIP_RE.test(`${title} ${desc || ''}`);
}

// ---------- license detection (open-weight feed) ----------
export function detectLicense(text) {
  const t = String(text || '');
  if (/\bapache(\s*2(\.0)?)?\b/i.test(t)) return { lic: 'apache', licClass: 'lic-apache' };
  if (/\bmit licen[cs]e\b/i.test(t)) return { lic: 'mit', licClass: 'lic-mit' };
  if (/\bopen.?weight|open.?source|weights (are|now)? ?(public|available|released)\b/i.test(t))
    return { lic: 'open weights', licClass: 'lic-open' };
  if (/\bhugging ?face\b/i.test(t)) return { lic: 'open weights', licClass: 'lic-open' };
  return { lic: 'see model card', licClass: 'lic-custom' };
}

// ---------- research field inference (breakthrough cards) ----------
const FIELD_RULES = [
  ['Robotics', /\b(robot|humanoid|manipulat|actuator|embodied|dexter)/i],
  ['Biology', /\b(protein|genom|dna|rna|cell|drug|clinical|disease|medical|biolog|molecul)/i],
  ['Chemistry', /\b(chemist|catalyst|reaction|compound|synthesis)/i],
  ['Materials', /\b(material|semiconductor|battery|superconduct|crystal|alloy)/i],
  ['Hardware', /\b(chip|gpu|silicon|processor|photonic|quantum)/i],
  ['Safety', /\b(safety|alignment|interpretab|jailbreak|red.?team|misuse)/i],
  ['Vision', /\b(image|video|vision|diffusion|render|3d|generation)/i],
  ['Reasoning', /\b(reasoning|math|proof|benchmark|agent|planning)/i],
];

export function inferField(text) {
  for (const [field, re] of FIELD_RULES) {
    if (re.test(text)) return field;
  }
  return 'Research';
}

// ---------- significance scoring ----------
// Deterministic weighted blend in [0,100]. Documented in docs/METHODOLOGY.md.
// Not a claim of objective importance — a transparent ranking heuristic.
const CATEGORY_WEIGHT = {
  policy: 0.9,
  capital: 0.8,
  compute: 0.8,
  research: 0.75,
  market: 0.7,
  orggov: 0.65,
  product: 0.65,
  adoption: 0.6,
  opensource: 0.7,
  analysis: 0.4,
  general: 0.35,
};

export function recencyScore(date, now) {
  const hours = (now - new Date(date).getTime()) / 3.6e6;
  return clamp(1 - hours / 72, 0, 1); // linear decay to zero over 3 days
}

export function scoreSignificance(item, nodes, now) {
  const text = `${item.title} ${item.desc || ''}`;
  const { maxImportance } = matchEntities(text, nodes);
  const rec = recencyScore(item.date, now);
  const src = Math.min(item.sourceCount || 1, 4) / 4;
  const ent = maxImportance / 100;
  const cat = CATEGORY_WEIGHT[item.category] ?? 0.6;
  const score = 0.35 * rec + 0.25 * src + 0.25 * ent + 0.15 * cat;
  return Math.round(clamp(score, 0, 1) * 100);
}

// ---------- verification vs. impact (kept deliberately separate) ----------
// Source count alone is a bad proxy for "how sure are we this is true": three
// outlets repeating one unconfirmed rumor is not more verified than a single
// official blog post announcing a company's own release. These are two
// genuinely independent axes:
//   verification — how reliable is the REPORTING (source authority + hedging)
//   impact       — how big is the EVENT, from the significance score
// Rules (documented, deterministic, in priority order):
//   1. category === 'analysis'        → 'analysis'   (commentary isn't a fact to verify)
//   2. published by the subject itself → 'official'   (even with 1 source)
//   3. hedged/unconfirmed language     → 'uncertain'  (overrides source count —
//      repetition of one unsupported claim must not read as well-verified)
//   4. sourceCount >= 2                → 'corroborated'
//   5. otherwise                       → 'single'
const OFFICIAL_SOURCES = new Set(['OpenAI', 'Google', 'Google DeepMind', 'Anthropic', 'xAI', 'Meta AI']);
const HEDGE_RE = /\b(may have|reportedly|sources? say|unclear|alleged(ly)?|rumou?r(ed)?|according to (a )?report|unconfirmed|could be|might be|is said to)\b/i;

export function classifyVerification(item) {
  if (item.category === 'analysis') return 'analysis';
  // check every merged source, not just the (earliest-published) representative
  // — a later official confirmation should still count even if a third party
  // reported first.
  const sourceNames = item.sources?.length ? item.sources.map((s) => s.sourceName) : [item.sourceName];
  if (sourceNames.some((n) => OFFICIAL_SOURCES.has(n))) return 'official';
  if (HEDGE_RE.test(`${item.title} ${item.desc || ''}`)) return 'uncertain';
  if ((item.sourceCount || 1) >= 2) return 'corroborated';
  return 'single';
}

export const VERIFICATION_LABEL = {
  official: 'Official', corroborated: 'Corroborated', single: 'Single report',
  analysis: 'Analysis', uncertain: 'Uncertain',
};

// Impact magnitude from the significance score — deliberately worded
// differently from verification labels so the two chips never read as one
// combined "confidence", which is exactly the conflation this fixes.
export function classifyImpact(significance) {
  if (significance >= 70) return 'high';
  if (significance >= 45) return 'notable';
  return 'emerging';
}

export const IMPACT_LABEL = { high: 'High impact', notable: 'Notable', emerging: 'Emerging' };

// ---------- entity activity (ocean-map glow) ----------
// Real, live, deterministic: counts how many of the supplied signals mention
// each node. This is what makes a node "glow" — not a curated guess.
export function computeEntityActivity(signals, nodes) {
  const counts = {};
  for (const n of nodes) counts[n.id] = 0;
  for (const s of signals) {
    const text = `${s.title || s.h || ''} ${s.desc || s.p || ''}`;
    const { ids } = matchEntities(text, nodes);
    for (const id of ids) counts[id]++;
  }
  return counts;
}

// ---------- three strongest waves ----------
// One representative story per family (product / market / research), chosen by
// significance. Never just "the three newest" — recency is only one of four
// terms. Analysis/opinion and General (no operational category) are excluded:
// they're commentary or noise, not a "development" a wave should represent.
export function buildWaves(signals) {
  const eligible = signals.filter((s) => s.category !== 'analysis' && s.category !== 'general');
  const byFamily = { product: [], market: [], research: [] };
  for (const s of eligible) byFamily[waveFamily(s.category)].push(s);
  const waves = [];
  for (const family of ['product', 'market', 'research']) {
    const list = byFamily[family].slice().sort((a, b) => b.significance - a.significance);
    if (list[0]) waves.push({ family, ...list[0] });
  }
  return waves;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
