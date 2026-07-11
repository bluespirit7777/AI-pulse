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

// ---------- explicit event extraction (for same-event clustering) ----------
// A story's "event" is roughly (entity, action, object). Two reports are the
// same event when they agree on the action AND share an object — even if the
// wording barely overlaps ("shutting down Atlas" vs "the ChatGPT browser is
// dead"). Conversely, two same-company stories with DIFFERENT actions (a launch
// vs a shutdown) are different events and must not merge.
const ACTION_RULES = [
  ['shutdown', /\b(shut(s|ting)?\s?down|sunset(s|ting|ted)?|discontinu\w+|deprecat\w+|is (already )?dead|kill(s|ed|ing)?\b|retir(es|ed|ing)|shutter\w*)\b/i],
  ['resign', /\b(resign\w*|steps?\s?down|stepping\s?down|departs?|departure|leaving|exits?\b)\b/i],
  ['acquire', /\b(acqui\w+|buys?\b|bought|takeover|merge[sr]?)\b/i],
  ['raise', /\b(raise[sd]?\b|funding round|series [a-e]\b|\bipo\b|valuation)\b/i],
  ['invest', /\b(invests?|investment|takes? a stake|backs?\b)\b/i],
  // su(e|es|ing|ed) covers "sue/sues/suing/sued" uniformly — the earlier
  // `sues?\b` alone missed the gerund "is suing", which was a real miss: two
  // genuine reports of the same Apple/OpenAI trade-secrets suit ("Apple is
  // SUING OpenAI..." vs "Apple SUES OpenAI...") failed to merge because only
  // one of the two headlines used a form the old regex recognized.
  ['sue', /\b(su(e|es|ing|ed)|lawsuit|sanction\w*|court|antitrust)\b/i],
  ['regulate', /\b(regulat\w+|ban(s|ned|ning)?\b|executive order|investigat\w+)\b/i],
  ['partner', /\b(partner\w*|teams? up|collaborat\w+)\b/i],
  ['launch', /\b(launch\w*|unveil\w*|introduc\w*|debuts?|ships?\b|rolls? out|now available|releas\w+)\b/i],
  // NB: publish is verb-form only — "publishers"/"publisher" are nouns and must
  // NOT trigger a research action (that mis-fire broke the copyright merge).
  ['research', /\b(paper|preprint|study|studies|research(es|ed|ing)?|discover\w+|publish(es|ed|ing)?|findings)\b/i],
];
export function extractAction(text) {
  const t = String(text || '');
  for (const [action, re] of ACTION_RULES) if (re.test(t)) return action;
  return null;
}

// Salient object tokens: domain nouns that identify WHAT an event is about,
// plus multi-word proper names. "browser" is what links the two Atlas stories.
// Split strong (genuinely identifying, safe to force a merge on their own —
// "copyright" is what links the NYT/OpenAI pair) from weak (so generic that
// nearly every AI product launch uses them — "model", "tool", "app" — and
// must NOT by themselves justify merging two otherwise-unrelated stories; this
// is what wrongly merged "Introducing Gemma 4 12B" with an unrelated "Claude
// Fable 5" launch video, both merely containing the word "model").
const OBJECT_NOUNS_STRONG = /\b(browser|chip|gpu|robot|humanoid|funding|ipo|lawsuit|copyright|license|privacy|studio|dataset|benchmark|silicon|foundry|datacenter|data center|secrets?|trademark)\b/gi;
const OBJECT_NOUNS_WEAK = /\b(model|models|app|api|tool|agent|assistant|search|cloud|voice|image|video|chatbot)\b/gi;
function extractNouns(text, re) {
  const objs = new Set();
  const m = text.match(re) || [];
  for (const w of m) {
    let norm = w.toLowerCase().replace('data center', 'datacenter');
    // singular/plural must collapse to one token, or "hardware secrets" vs
    // "trade secret" (same story, different qualifier) fail to overlap.
    if (norm === 'secrets') norm = 'secret';
    objs.add(norm);
  }
  return objs;
}
export function salientObjects(title, desc = '') {
  const objs = new Set();
  for (const p of properNounPhrases(title)) objs.add(p);
  const text = `${title} ${desc}`;
  for (const o of extractNouns(text, OBJECT_NOUNS_STRONG)) objs.add(o);
  for (const o of extractNouns(text, OBJECT_NOUNS_WEAK)) objs.add(o);
  return objs;
}
// Distinctive-only variant for the event-relation forced-merge decision:
// proper-noun phrases + strong nouns, excluding generic ones a weak overlap
// could trivially satisfy across unrelated stories.
function distinctiveObjects(title, desc = '') {
  const objs = new Set();
  for (const p of properNounPhrases(title)) objs.add(p);
  for (const o of extractNouns(`${title} ${desc}`, OBJECT_NOUNS_STRONG)) objs.add(o);
  return objs;
}
function objectOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const o of a) if (b.has(o)) inter++;
  return inter / Math.min(a.size, b.size);
}

// Same-event verdict from action + object agreement. Returns:
//   match    — same action + shared DISTINCTIVE object → merge even with low text overlap
//   conflict — different actions + weak object overlap → different events, block
export function eventRelation(x, y) {
  const ax = extractAction(`${x.title} ${x.desc || ''}`);
  const ay = extractAction(`${y.title} ${y.desc || ''}`);
  const ov = objectOverlap(distinctiveObjects(x.title, x.desc), distinctiveObjects(y.title, y.desc));
  const sameAction = ax && ay && ax === ay;
  const diffAction = ax && ay && ax !== ay;
  return {
    match: !!(sameAction && ov > 0),
    conflict: !!(diffAction && ov < 0.6), // different action AND not clearly the same object
    objectOverlap: ov,
  };
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

  const timeProx = clamp(1 - hoursBetween(x.date, y.date) / 48, 0, 1); // decays to 0 over 48h
  const closeInTime = hoursBetween(x.date, y.date) <= 72;
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

  // explicit event reasoning first — it both rescues real merges that text
  // similarity misses and blocks spurious ones it would otherwise allow.
  const ev = eventRelation(x, y);
  if (ev.conflict) return Math.min(contentSim, 0.15);   // different actions on different objects → different events
  // same event when action agrees + object shared, OR a distinctive object is
  // clearly shared between the same entities near in time (the copyright/Atlas
  // case where wording barely overlaps but the OBJECT is the same story).
  if (closeInTime && (ev.match || (ev.objectOverlap >= 0.5 && entSim > 0))) return Math.max(contentSim, 0.55);

  if (contentSim < MIN_CONTENT) return contentSim;

  // Structural signals (same entity / time / category) may only AMPLIFY real
  // textual overlap — never clear the bar alone. Scaling by contentSim means
  // two different same-company stories (near-zero content) can't merge on
  // entity+day+category, which was the "same-company false positive" bug.
  const catMatch = x.category && y.category && x.category === y.category ? 1 : 0;
  const structural = 0.4 * entSim + 0.35 * timeProx + 0.25 * catMatch;
  return contentSim + structural * Math.min(contentSim, 0.5) * 1.4;
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

// ---------- community discussion topics ----------
// Plain-language themes people discuss about AI models. A comment can match
// several. Used by the Community Pulse aggregation — topic/volume grouping is
// preferred over a made-up positive/negative sentiment score.
export const TOPICS = [
  { id: 'coding', label: 'Coding' }, { id: 'reasoning', label: 'Reasoning' },
  { id: 'writing', label: 'Writing' }, { id: 'speed', label: 'Speed' },
  { id: 'price', label: 'Price' }, { id: 'reliability', label: 'Reliability' },
  { id: 'context', label: 'Context limits' }, { id: 'multimodal', label: 'Image/video' },
  { id: 'local', label: 'Local use' }, { id: 'safety', label: 'Safety' },
];
const TOPIC_RULES = {
  coding: /\b(cod(e|ing)|program|developer|debug|refactor|swe|ide|repo|compiler|function|api)\b/i,
  reasoning: /\b(reason|logic|math|proof|problem|think|chain.of.thought|deduc|inference)\b/i,
  writing: /\b(writ(e|ing)|prose|essay|draft|grammar|style|copy|text generation)\b/i,
  speed: /\b(speed|fast|slow|latency|throughput|tokens?\/s|response time|quick)\b/i,
  price: /\b(pric(e|ing)|cost|cheap|expensive|\$\d|subscription|per token|budget|free tier)\b/i,
  reliability: /\b(reliab|hallucinat|inaccurate|wrong answer|mistake|consistent|flaky|trust|accuracy)\b/i,
  context: /\b(context (window|length|limit)|long context|token limit|memory|forgets|1m token)\b/i,
  multimodal: /\b(image|video|vision|multimodal|picture|photo|diagram|screenshot|audio)\b/i,
  local: /\b(local(ly)?|self.host|offline|gguf|ollama|quantiz|on.device|llama\.cpp|vram)\b/i,
  safety: /\b(safety|alignment|jailbreak|refus|censor|guardrail|harmful|misuse)\b/i,
};

export function classifyTopics(text) {
  const t = String(text || '');
  const out = [];
  for (const topic of TOPICS) if (TOPIC_RULES[topic.id].test(t)) out.push(topic.id);
  return out;
}

// ---------- contextual model matching (Community Pulse) ----------
// Raw keyword search over-counts: "grok" the verb, "llama" the animal or
// llama.cpp-as-tool, and comments that merely mention a company. This returns a
// 0–1 confidence that a text is really discussing a given model family, so we
// count VALIDATED mentions, not raw hits. Ambiguous families (grok, llama)
// require nearby AI context and reject ordinary-language usage.
const AI_CONTEXT = /\b(a\.?i\.?|llm|model|inference|benchmark|prompt|tokens?|coding|reasoning|xai|meta\b|local model|api|chatbot|fine.?tun|open.?weight|hugging ?face|context window|agent|anthropic|openai|google|assistant)\b/i;
const GROK_REJECT = /\b((hard|difficult|tries?|trying|able|unable|fully|easy|easier|hoping|want|need|starting|able)\s+to\s+grok|grok(king|ked)?\s+(the|this|it|that|his|her|their|its|our|my|your|some|a\b)|can'?t\s+grok|cannot\s+grok|understand\s+or\s+grok|to\s+grok\b|grok\s+the\s+(code|codebase|concept|idea|material|system))\b/i;
const LLAMA_ANIMAL = /\b(a\s+llama|the\s+llama|llamas\b|llama\s+(walked|farm|spit|wool|trek|ranch|standing)|alpaca|petting)\b/i;

const COMMUNITY_MATCHERS = {
  gpt: { name: 'GPT', strong: [/\bchatgpt\b/i, /\bgpt-?5(\.\d)?\b/i, /\bgpt-?4(\.\d)?\b/i, /\bopenai (gpt|model)\b/i], org: /\bopenai\b/i, version: /\bgpt-?\d(\.\d)?\b/i, product: /\bchatgpt (work|enterprise|plus)\b/i, ambiguous: false },
  claude: { name: 'Claude', strong: [/\bclaude\b/i], org: /\banthropic\b/i, version: /\bclaude (opus|sonnet|haiku|\d)/i, product: /\bclaude code\b/i, ambiguous: false },
  gemini: { name: 'Gemini', strong: [/\bgemini\b/i], org: /\bgoogle\b/i, version: /\bgemini \d/i, ambiguous: false },
  grok: { name: 'Grok', strong: [/\bgrok-?\s?\d(\.\d)?\b/i, /\bxai grok\b/i, /\bgrok ai\b/i, /\bgrok model\b/i], base: /\bgrok\b/i, org: /\bxai\b/i, version: /\bgrok-?\s?\d/i, ambiguous: true, reject: GROK_REJECT },
  llama: { name: 'Llama', strong: [/\bllama-?\s?\d\b/i, /\bmeta llama\b/i, /\bllama\.cpp\b/i, /\bllama model\b/i], base: /\bllama\b/i, org: /\bmeta\b/i, version: /\bllama-?\s?\d/i, ambiguous: true, reject: LLAMA_ANIMAL },
  deepseek: { name: 'DeepSeek', strong: [/\bdeepseek\b/i], version: /\bdeepseek[- ]?v?\d/i, ambiguous: false },
  qwen: { name: 'Qwen', strong: [/\bqwen\b/i], org: /\balibaba\b/i, version: /\bqwen[- ]?\d/i, ambiguous: false },
};
export const COMMUNITY_MATCH_THRESHOLD = 0.5;

// Confidence in [0,1] that `text` genuinely discusses model `key`.
export function matchModelMention(text, key) {
  const m = COMMUNITY_MATCHERS[key];
  if (!m) return 0;
  const t = ` ${text} `;
  const hasStrong = m.strong.some((re) => re.test(t));
  const hasBase = m.base ? m.base.test(t) : hasStrong;
  const hasOrg = m.org ? m.org.test(t) : false;
  const hasVersion = m.version ? m.version.test(t) : false;
  const hasProduct = m.product ? m.product.test(t) : false;
  const hasAI = AI_CONTEXT.test(t);

  if (m.ambiguous) {
    const rejected = m.reject && m.reject.test(t);
    if (hasStrong) return 0.9;                         // "Grok 4", "xAI Grok", "llama.cpp" — unambiguous
    if (hasBase && !rejected && (hasAI || hasOrg)) return 0.6; // bare grok/llama WITH AI context
    return 0;                                          // bare + ordinary-language use, or no AI context
  }
  if (!hasStrong && !hasBase) return 0;
  let c = 0.55;
  if (hasOrg) c += 0.15;
  if (hasVersion) c += 0.15;
  if (hasProduct) c += 0.1;
  if (hasAI) c += 0.05;
  return Math.min(c, 1);
}

export function isValidatedMention(text, key) {
  return matchModelMention(text, key) >= COMMUNITY_MATCH_THRESHOLD;
}

// ---------- representative-comment ranking (Community Pulse) ----------
// Composite relevance score in [0,1], deliberately NOT length-based: a long
// comment used to win by default under the old points-then-length sort, which
// is a bad proxy for "worth reading" (rambling replies beat sharp, short
// ones). Priority order is model-match confidence, then how specific/rare the
// comment's theme is (a "context limits" comment says more than a "coding"
// one when everyone's talking about coding), then whether the text reads as a
// complete thought, then recency. Non-duplication is enforced separately as a
// selection-time filter (see dedupe-by-similarity in update-data.mjs) rather
// than folded into the score, since "how different from what's already
// picked" only makes sense relative to the picks made so far.
export function themeSpecificity(themeId, themeCounts, totalValidatedComments) {
  if (!totalValidatedComments) return 0;
  const freq = (themeCounts[themeId] || 0) / totalValidatedComments;
  return clamp(1 - freq, 0, 1);
}

// A cheap, structural stand-in for "reads as a complete thought" — sentence
// punctuation, enough words to carry an idea, not a bare quote-reply. Length
// is only ONE input among several, and even then it's a floor/ceiling check
// rather than a monotonic reward, so a merely-longer comment doesn't win.
export function contextualCompleteness(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const words = t.split(/\s+/).filter(Boolean).length;
  const isQuoteOnly = t.split('\n').every((l) => !l.trim() || l.trim().startsWith('>'));
  const hasSentenceEnd = /[.!?]["')\]]?\s*$/.test(t) || /[.!?]["')\]]?\s+[A-Z]/.test(t);
  let score = 0.5;
  if (words >= 15) score += 0.2;
  if (words >= 30) score += 0.1;
  if (hasSentenceEnd) score += 0.15;
  if (isQuoteOnly) score -= 0.4;
  if (t.length < 40) score -= 0.3;
  return clamp(score, 0, 1);
}

// Linear decay over the community window (default 30 days) — recent
// discussion is more representative of the CURRENT conversation than a
// month-old comment, but it's the lowest-weighted of the four scored terms.
export function communityRecencyScore(publishedAtMs, now, windowDays = 30) {
  const days = (now - publishedAtMs) / 86400000;
  return clamp(1 - days / windowDays, 0, 1);
}

// Weights sum to 1; order matches the documented priority (model-match confidence
// > theme specificity > contextual completeness > recency). Non-duplication is
// applied by the caller as a selection-time filter, not a term here.
export function commentRelevanceScore({ matchConfidence = 0, themeSpecificity = 0, completeness = 0, recency = 0 }) {
  return 0.40 * matchConfidence + 0.25 * themeSpecificity + 0.20 * completeness + 0.15 * recency;
}

// ---------- community coverage / exact-vs-estimated (Community Pulse honesty) ----------
// Pure coverage math, split out from scripts/update-data.mjs's HN Algolia fetch
// specifically so the exact-vs-estimated decision is independently testable
// without mocking network calls. `rawHits` is the total Algolia reports for
// the query; `fetchedCount` is how many of those we actually paginated
// through (bounded by HN_MAX_PAGES in update-data.mjs); `validatedCount` is
// how many of the FETCHED sample passed contextual model-match validation.
//
// Rule: a count is only ever "exact" when every raw hit was fetched (coverage
// >= 1) — in that case validatedCount already IS the true total, no scaling
// needed. Otherwise the validated fraction of the sample is scaled up to the
// full raw-hit count and explicitly flagged as an estimate; this class of bug
// (silently presenting an extrapolated number as an exact count) is exactly
// what isEstimated exists to prevent.
export function communityStoryCoverage({ rawHits, fetchedCount, validatedCount, sampleSize }) {
  const coverage = rawHits ? clamp(fetchedCount / rawHits, 0, 1) : 1;
  if (coverage >= 1) {
    return { coverage, isEstimated: false, estimatedRelevantDiscussions: validatedCount };
  }
  const ratio = sampleSize ? validatedCount / sampleSize : 0;
  return { coverage, isEstimated: true, estimatedRelevantDiscussions: Math.round(rawHits * ratio) };
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

// Below this, categorize()'s own winner-vs-runner-up confidence is too weak to
// trust — the category is little better than a guess, so the story shouldn't
// be able to out-rank a confidently-categorized one on significance alone.
export const LOW_CATEGORY_CONFIDENCE = 0.45;

export function scoreSignificance(item, nodes, now) {
  const text = `${item.title} ${item.desc || ''}`;
  const { maxImportance } = matchEntities(text, nodes);
  const rec = recencyScore(item.date, now);
  const src = Math.min(item.sourceCount || 1, 4) / 4;
  const ent = maxImportance / 100;
  const cat = CATEGORY_WEIGHT[item.category] ?? 0.6;
  let score = 0.35 * rec + 0.25 * src + 0.25 * ent + 0.15 * cat;
  // meaningful penalty, not a rounding nudge — a low-confidence category call
  // (categorize() itself wasn't sure) must not let recency/entity weight alone
  // push a story to the top of the feed.
  if ((item.catConfidence ?? 1) < LOW_CATEGORY_CONFIDENCE) score *= 0.8;
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

// ---------- integrity caps (General/Analysis, low confidence, job posts) ----------
// A single thinly-sourced "General" story can otherwise still hit significance
// 70+ purely from recency + a heavily-weighted entity (e.g. "OpenAI hires a
// family product manager" — fresh, mentions OpenAI, but is routine personnel
// news, not a confirmed major event). These rules stop scoring machinery from
// dressing up routine/unconfirmed items as equivalent to a corroborated launch
// or lawsuit. Applied AFTER verification is known (needs sourceCount +
// official-source check), so this runs as a distinct step in the pipeline,
// not inside scoreSignificance itself.
const JOB_POSTING_RE = /\b(is hiring|we.?re hiring|now hiring|job (opening|posting|listing)|open position|now recruiting|join our team|apply (now|today)|careers? page|we.?re looking for a)\b/i;
const SPECULATIVE_RE = /\b(plans? to|is considering|are considering|may (launch|release|announce|acquire|build)|reportedly (planning|considering|weighing|exploring)|weighing (a|an|whether)|exploring (a|an|whether)|could (launch|release|announce)|in (early|talks|discussions) (for|to|about))\b/i;

// Single-source, non-official General/Analysis stories are capped here — real
// news that clears the bar for official/corroborated reporting is unaffected.
export const GENERAL_SIGNIFICANCE_CAP = 55;

function isOfficialOrCorroborated(item) {
  return item.verification === 'official' || (item.sourceCount || 1) >= 2;
}

// Returns the (possibly capped) { significance, impact, capped, capReason }.
// `item` needs: significance, category, verification, sourceCount, title, desc.
export function applyIntegrityCaps(item) {
  const text = `${item.title || ''} ${item.desc || ''}`;
  const isLowGrade = item.category === 'general' || item.category === 'analysis';
  const strong = isOfficialOrCorroborated(item);
  const isJobOrSpeculative = JOB_POSTING_RE.test(text) || SPECULATIVE_RE.test(text);

  let significance = item.significance;
  let capReason = null;

  // Single-source, non-official General/Analysis: significance capped —
  // recency + entity weight alone cannot carry it past a routine-news ceiling.
  if (isLowGrade && !strong && significance > GENERAL_SIGNIFICANCE_CAP) {
    significance = GENERAL_SIGNIFICANCE_CAP;
    capReason = 'single-source-general';
  }

  let impact = classifyImpact(significance);
  // General/Analysis cannot be High impact without an official primary source
  // or independent corroboration, regardless of what the raw score says.
  if (isLowGrade && !strong && impact === 'high') {
    impact = 'notable';
    capReason = capReason || 'general-without-evidence';
  }
  // Job postings and speculative/rumoured plans default to Emerging or
  // Notable — routine hiring news and "considering X" reporting should never
  // read as a confirmed major event, however fresh or entity-heavy it is.
  if (isJobOrSpeculative && impact === 'high') {
    impact = 'notable';
    capReason = capReason || 'job-or-speculative';
  }

  return { significance, impact, capped: capReason != null, capReason };
}

// ---------- editorial: "why it matters" (consequence, not scoring) ----------
// A deterministic, plain-language sentence about the CONSEQUENCE of an event —
// what it changes for users, developers, competitors or the field. This is
// deliberately NOT "why the algorithm surfaced it" (impact score, source count);
// that stays a separate, clearly-labelled "why selected" line in the UI.
// Templates are keyed by the extracted action first (most specific), then by
// category. When the signal is weak or thinly sourced the wording is hedged so
// the site never overstates an uncertain effect.
const WHY_BY_ACTION = {
  shutdown: 'Winding a product down pushes its users elsewhere and signals where the company is now placing its bets.',
  resign: 'Leadership change at this level can redirect a lab’s priorities, hiring and release timelines.',
  acquire: 'An acquisition folds talent and technology under one owner, reshaping who competes with whom.',
  raise: 'Fresh capital extends how long the company can fund training runs and hiring before it needs revenue.',
  invest: 'A strategic investment ties the two companies’ roadmaps — models, compute or distribution — closer together.',
  sue: 'However it resolves, the case could set a precedent for how models may be built, trained or licensed.',
  regulate: 'New rules here can change what products are allowed to ship, and in which markets.',
  partner: 'The partnership shifts who gets access to whose models, compute or customers.',
  launch: 'A new release raises the bar rivals are measured against and gives developers something to build on now.',
  research: 'If the result holds up it could shape how the next generation of models is built — though single papers often don’t replicate.',
};
const WHY_BY_CATEGORY = {
  policy: 'Policy sets the rules every lab has to build under, so the effect reaches well beyond the company named.',
  capital: 'Where the money flows signals which bets investors expect to pay off.',
  compute: 'Compute supply and cost set the ceiling on how large — and how cheap — the next models can be.',
  opensource: 'Open weights let anyone run and build on the model, widening who can compete.',
  research: WHY_BY_ACTION.research,
  market: 'The move reflects how investors are repricing the AI trade right now.',
  adoption: 'This is where model capability turns into real usage and revenue.',
  orggov: 'Governance changes shape how a lab makes its biggest calls.',
  product: WHY_BY_ACTION.launch,
  analysis: 'It’s an active argument in the field; the concrete effect is still a matter of debate.',
  general: 'It’s drawing attention across AI right now, though the downstream effect isn’t yet clear.',
};

export function whyItMatters(sig = {}) {
  const text = `${sig.title || sig.h || ''} ${sig.summary || sig.desc || sig.p || ''}`;
  const action = extractAction(text);
  let base = (action && WHY_BY_ACTION[action]) || WHY_BY_CATEGORY[sig.category] || WHY_BY_CATEGORY.general;
  // Hedge harder when the signal is emerging or thinly sourced — unless the
  // template is already conditional ("could", "if", "may", "isn't clear").
  const weak = sig.impact === 'emerging' || sig.verification === 'single' || sig.verification === 'uncertain';
  if (weak && !/\b(could|may|might|if it holds|still|isn’t yet clear|matter of debate)\b/i.test(base)) {
    base = 'If it holds up, ' + base.charAt(0).toLowerCase() + base.slice(1);
  }
  return base;
}

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
    if (list[0]) waves.push({ family, ...list[0], whyItMatters: whyItMatters(list[0]) });
  }
  return waves;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
