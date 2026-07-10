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

// ---------- duplicate merging ----------
// Groups items covering the same event. Two items merge when their titles share
// >= threshold token overlap. The earliest-kept item wins as the representative;
// every distinct source is preserved on `sources` / `sourceCount` so the UI can
// show "3 sources" and the confidence tier can reflect corroboration.
export function dedupeMerge(items, threshold = 0.5) {
  const groups = [];
  for (const it of items) {
    let placed = false;
    for (const g of groups) {
      if (similarity(g.rep.title, it.title) >= threshold) {
        if (!g.sources.some((s) => s.sourceName === it.sourceName)) {
          g.sources.push({ sourceName: it.sourceName, link: it.link });
        }
        // keep the earliest publication as the canonical timestamp/link
        if (it.date < g.rep.date) g.rep = it;
        placed = true;
        break;
      }
    }
    if (!placed) groups.push({ rep: it, sources: [{ sourceName: it.sourceName, link: it.link }] });
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
    const re = new RegExp('(?:' + n.match.map(escapeForClass).join('|') + ')', 'i');
    if (re.test(t)) {
      ids.push(n.id);
      if (n.importance > maxImportance) maxImportance = n.importance;
    }
  }
  return { ids, maxImportance };
}

function escapeForClass(term) {
  // terms already containing regex (e.g. "\\bh100\\b") pass through; plain words
  // get their regex-significant chars escaped.
  if (/\\b|\\d|\[|\]/.test(term)) return term;
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- categorization ----------
export const CATEGORIES = [
  'policy',
  'capital',
  'compute',
  'opensource',
  'research',
  'market',
  'adoption',
  'product',
];

const CATEGORY_RULES = [
  ['policy', /\b(regulat|eu ai act|lawsuit|sued?|court|antitrust|ban(ned|s)?|executive order|senate|congress|policy|copyright|safety institute)\b/i],
  ['capital', /\b(raise[sd]?|funding|valuation|valued|seed|series [a-e]|investment|invests?|ipo|acquir(e|es|ed|ing)|acquisition|\$\d+ ?(m|b|bn|billion|million))\b/i],
  ['compute', /\b(gpu|h100|h200|b200|b300|blackwell|hopper|tsmc|foundry|data ?cent(er|re)|cluster|wafer|hbm|chip|silicon|accelerator|trainium|tpu)\b/i],
  ['opensource', /\b(open.?source|open.?weight|apache 2|mit licen[cs]e|hugging ?face|weights (are|now)? ?(public|available|released))\b/i],
  ['research', /\b(paper|preprint|arxiv|study|studies|benchmark|breakthrough|researchers?|findings|state.of.the.art|sota)\b/i],
  ['market', /\b(stock|shares|market cap|revenue|earnings|quarter(ly)?|sales|profit|guidance|nasdaq)\b/i],
  ['adoption', /\b(users?|adoption|enterprise|customers?|deploy(ed|ment)?|rolls? out|million (users|people)|integrat(e|es|ed|ion))\b/i],
  ['product', /\b(launch|release[sd]?|unveil|introduc|now available|debuts?|ships?|announc|update|feature|preview|beta)\b/i],
];

export function categorize(text) {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(text)) return cat;
  }
  return 'product';
}

// Which of the three "wave" families a category belongs to.
// Business/regulatory forces (market, capital, compute, policy) sit in the
// market family; shipping/adoption/open-weights in product; papers in research.
export function waveFamily(category) {
  if (category === 'research') return 'research';
  if (category === 'market' || category === 'capital' || category === 'compute' || category === 'policy') return 'market';
  return 'product';
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
  product: 0.65,
  adoption: 0.6,
  opensource: 0.7,
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

export function confidenceTier(sourceCount) {
  if (sourceCount >= 3) return 'strong';
  if (sourceCount === 2) return 'moderate';
  return 'early';
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
// significance. Never just "the three newest" — recency is only one of four terms.
export function buildWaves(signals) {
  const byFamily = { product: [], market: [], research: [] };
  for (const s of signals) byFamily[waveFamily(s.category)].push(s);
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
