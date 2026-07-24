#!/usr/bin/env node
// Pulls fresh AI-industry content from official publisher RSS feeds + free stock
// quotes, scores it with the shared deterministic logic in lib/signals.mjs, and
// writes data/latest.json (+ a bounded daily snapshot under data/history/).
// No API keys required.
//
// Run: node scripts/update-data.mjs

import { writeFile, mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dedupeMerge,
  categorize,
  waveFamily,
  detectLicense,
  inferField,
  isProductRelease,
  scoreSignificance,
  classifyVerification,
  applyIntegrityCaps,
  matchEntities,
  computeEntityActivity,
  buildWaves,
  classifyTopics,
  isValidatedMention,
  matchModelMention,
  COMMUNITY_MATCH_THRESHOLD,
  themeSpecificity,
  contextualCompleteness,
  communityRecencyScore,
  commentRelevanceScore,
  communityStoryCoverage,
  similarity,
  TOPICS,
} from './lib/signals.mjs';
import { computeReturns, correlationPairs, relativeVolume, average, direction, dailyChange, DAILY_CHANGE_REVIEW_PCT, periodChange, WEEK_TRADING_DAYS, MONTH_TRADING_DAYS } from './lib/stocks.mjs';
import { toCompactEvent, mergeTodayEvents, dayKey, buildRangesDoc, HISTORY_RETENTION_DAYS } from './lib/history.mjs';
import { decodeEntities } from './lib/text.mjs';
import { GPU_CATALOG, mergeGpuPricing, formatRate, computeTrend } from './lib/compute.mjs';
import { buildCandleSeries } from './lib/chart.mjs';
import { MODEL_REGISTRY, MODEL_KEYS } from './lib/models.mjs';
import { shortDateUTC } from './lib/dates.mjs';
import { buildDiscourseSearchUrl, discourseAfterDate, parseDiscourseSearch } from './lib/discourse.mjs';
import { buildDiscussionsQueryBody, buildAuthHeaders, parseDiscussionsResponse, windowedDiscussions } from './lib/github-discussions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'latest.json');
const RANGES_PATH = path.join(DATA_DIR, 'range.json');
const STOCKNET_PATH = path.join(DATA_DIR, 'stock-network.json');
const COMPUTE_HISTORY_PATH = path.join(DATA_DIR, 'compute-history.json');
const ENTITIES_PATH = path.join(DATA_DIR, 'entities.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const EVENTS_DIR = path.join(HISTORY_DIR, 'events');

// Deterministic (non-cryptographic) short hash — used for stable cluster IDs
// so the same story keeps the same ID across builds (its representative URL
// doesn't change once assigned).
function stableId(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const UA = 'Mozilla/5.0 (compatible; AIMarketPulseBot/1.0; +https://github.com/)';
const FETCH_TIMEOUT_MS = 12000;

// Build provenance (R10): the commit the data was generated from, so the footer
// can show exactly which build is live and a deploy can be verified against the
// repo. In GitHub Actions GITHUB_SHA is set; locally we fall back to `git rev-parse`.
function buildInfo() {
  let sha = process.env.GITHUB_SHA || '';
  if (!sha) {
    try { sha = execSync('git rev-parse HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
    catch { sha = ''; }
  }
  return {
    sha,
    shortSha: sha ? sha.slice(0, 7) : 'local',
    ref: process.env.GITHUB_REF_NAME || 'main',
    builtAt: new Date().toISOString(),
  };
}

const FEEDS = [
  { url: 'https://openai.com/blog/rss.xml', name: 'OpenAI', logoKey: 'openai' },
  { url: 'https://blog.google/technology/ai/rss/', name: 'Google', logoKey: 'google' },
  { url: 'https://deepmind.google/blog/rss.xml', name: 'Google DeepMind', logoKey: 'google' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch', logoKey: 'other' },
  { url: 'https://venturebeat.com/category/ai/feed/', name: 'VentureBeat', logoKey: 'other' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge', logoKey: 'other' },
  { url: 'https://arstechnica.com/ai/feed/', name: 'Ars Technica', logoKey: 'other' },
  { url: 'https://www.wired.com/feed/tag/ai/latest/rss', name: 'Wired', logoKey: 'other' },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', name: 'MIT Technology Review', logoKey: 'other' },
  // Anthropic publishes no official RSS/Atom feed (unlike OpenAI/Google), so
  // without this, Claude coverage depends entirely on generic tech outlets —
  // which rarely use ship-language ("launches"/"introduces") — leaving too few
  // qualifying Frontier Releases items. Google News RSS search needs no API
  // key and aggregates Anthropic's own "Introducing Claude X" posts (via
  // syndication/reprints) alongside third-party coverage. isGoogleNews strips
  // the "Headline - Publisher" suffix Google News appends to every title.
  { url: 'https://news.google.com/rss/search?q=Anthropic+Claude+when:60d&hl=en-US&gl=US&ceid=US:en', name: 'Google News (Anthropic)', logoKey: 'anthropic', isGoogleNews: true },
  // Official frontier-lab YouTube channels (Atom feeds, no API key). Videos are
  // gated in fetchFeed to release-like uploads only, so keynotes and tutorials
  // don't pollute the general signal stream — an official launch video simply
  // corroborates the lab's blog-RSS release.
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A', name: 'OpenAI (YouTube)', logoKey: 'openai', isVideo: true },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA', name: 'Anthropic (YouTube)', logoKey: 'anthropic', isVideo: true },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A', name: 'Google DeepMind (YouTube)', logoKey: 'google', isVideo: true },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC04FyDIvYXNecpbG8gyOw4A', name: 'AI at Meta (YouTube)', logoKey: 'meta', isVideo: true },
  // Note: xAI has no verified official model-release channel on YouTube; Grok
  // launches are still captured via news/blog RSS + detectLab('xai').
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHuiy8bXnmK5nisYHUd1J5g', name: 'NVIDIA (YouTube)', logoKey: 'other', isVideo: true },
];

// `shares` = approximate shares outstanding in billions (curated, changes only
// quarterly). Market cap is computed as shares × live price — a real, current
// figure that updates with price, NOT fabricated. `netLayer` places the stock
// in the ecosystem depth map: 1 platforms/software · 2 cloud/compute ·
// 3 chips/networking · 4 foundry.
const STOCKS = [
  { t: 'NVDA', n: 'Nvidia', layer: 'Chips', netLayer: 3, shares: 24.4, signal: 'Dominant AI GPU stack — data center is the majority of revenue' },
  { t: 'MSFT', n: 'Microsoft', layer: 'Cloud', netLayer: 2, shares: 7.43, signal: 'Azure AI + Copilot pushed across the whole product line' },
  { t: 'AVGO', n: 'Broadcom', layer: 'Chips', netLayer: 3, shares: 4.92, signal: 'Custom AI XPUs for hyperscalers plus AI networking silicon' },
  { t: 'GOOGL', n: 'Alphabet', layer: 'Cloud', netLayer: 2, shares: 12.2, signal: 'Gemini and in-house TPUs across search, cloud and devices' },
  { t: 'AMZN', n: 'Amazon', layer: 'Cloud', netLayer: 2, shares: 10.7, signal: 'Custom Trainium chips and AWS Bedrock model hosting' },
  { t: 'META', n: 'Meta', layer: 'Software', netLayer: 1, shares: 2.52, signal: 'Ad-ranking AI and in-house frontier model efforts' },
  { t: 'TSM', n: 'TSMC', layer: 'Foundry', netLayer: 4, shares: 5.19, signal: 'Manufactures advanced-node chips for Nvidia, AMD and Apple' },
  { t: 'AMD', n: 'AMD', layer: 'Chips', netLayer: 3, shares: 1.62, signal: 'Instinct GPU line chasing Nvidia’s ecosystem lead' },
  { t: 'PLTR', n: 'Palantir', layer: 'Software', netLayer: 1, shares: 2.40, signal: 'AIP platform adoption across government and enterprise' },
  { t: 'ORCL', n: 'Oracle', layer: 'Cloud', netLayer: 2, shares: 2.81, signal: 'Large-scale cloud compute deals with frontier AI labs' },
];

// Curated BUSINESS relationships (kept strictly separate from statistical price
// correlations). from → to.
const STOCK_RELS = [
  { from: 'MSFT', to: 'NVDA', type: 'depends' }, { from: 'AMZN', to: 'NVDA', type: 'depends' },
  { from: 'GOOGL', to: 'NVDA', type: 'depends' }, { from: 'ORCL', to: 'NVDA', type: 'depends' },
  { from: 'META', to: 'NVDA', type: 'depends' }, { from: 'NVDA', to: 'TSM', type: 'depends' },
  { from: 'AMD', to: 'TSM', type: 'depends' }, { from: 'AVGO', to: 'TSM', type: 'depends' },
  { from: 'PLTR', to: 'MSFT', type: 'depends' },
  { from: 'MSFT', to: 'AVGO', type: 'partner' }, { from: 'GOOGL', to: 'AVGO', type: 'partner' },
  { from: 'AMZN', to: 'AVGO', type: 'partner' },
  { from: 'NVDA', to: 'AMD', type: 'competes' }, { from: 'NVDA', to: 'AVGO', type: 'competes' },
  { from: 'MSFT', to: 'GOOGL', type: 'competes' }, { from: 'MSFT', to: 'AMZN', type: 'competes' },
  { from: 'GOOGL', to: 'AMZN', type: 'competes' },
];

const NET_LAYERS = [
  { id: 1, name: 'Platforms & software' },
  { id: 2, name: 'Cloud & compute' },
  { id: 3, name: 'Chips & networking' },
  { id: 4, name: 'Foundry' },
];

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(id);
  }
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}
function attr(block, name, attrName) {
  const m = block.match(new RegExp(`<${name}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`, 'i'));
  return m ? m[1] : '';
}

function parseFeed(xml, source) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of itemBlocks) {
    let title = tag(block, 'title');
    let link = tag(block, 'link');
    if (!link) link = attr(block, 'link', 'href');
    if (!link) {
      const m = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (m) link = m[1];
    }
    const dateStr = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    // media:description is the video summary in YouTube Atom feeds
    let desc = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content') || tag(block, 'media:description');
    const date = dateStr ? new Date(dateStr) : new Date();
    if (!title || !link) continue;
    let sourceName = source.name;
    if (source.isGoogleNews) {
      // every Google News RSS title ends " - <Publisher>" — split it out so
      // items get real per-article attribution and a clean headline instead
      // of a blanket "Google News (…)" label and a mangled title.
      const m = title.match(/^(.*)\s+-\s+([^-]+)$/);
      if (m) { title = m[1].trim(); sourceName = m[2].trim(); }
      desc = ''; // Google News descriptions are just the title+publisher HTML re-concatenated — no signal
    }
    items.push({
      title: title.trim(),
      link: link.trim(),
      desc: desc.slice(0, 400),
      date: isNaN(date.getTime()) ? new Date() : date,
      sourceName,
      feedLogoKey: source.logoKey,
      isVideo: !!source.isVideo,
    });
  }
  return items;
}

// Returns { items, ok } rather than a bare array — `ok` distinguishes "feed
// fetched fine but genuinely has 0 new items" from "feed fetch failed", which
// a bare empty array can't. The Data Health control needs this distinction to
// report a real successful/configured feed count instead of just item totals.
async function fetchFeed(source) {
  try {
    const res = await fetchWithTimeout(source.url);
    if (!res.ok) {
      console.error(`[feed] ${source.name}: HTTP ${res.status}`);
      return { items: [], ok: false };
    }
    let items = parseFeed(await res.text(), source);
    // Video channels post far more than releases — keep only uploads that name a
    // lab AND read as a product release, so the general stream stays clean.
    if (source.isVideo) {
      items = items.filter((it) => detectLab(`${it.title} ${it.desc}`) && isProductRelease(it.title, it.desc));
    }
    return { items, ok: true };
  } catch (err) {
    console.error(`[feed] ${source.name}: ${err.message}`);
    return { items: [], ok: false };
  }
}

const LAB_KEYWORDS = {
  anthropic: /\b(anthropic|claude)\b/i,
  openai: /\b(openai|chatgpt|gpt-?\d)\b/i,
  google: /\b(google\s*(deepmind)?|gemini|deepmind)\b/i,
  meta: /\bmeta\b.*\b(ai|llama)\b|\bllama\s*\d/i,
  xai: /\bx\.?ai\b|\bgrok\b/i,
};
const COMPANY_TAG = { anthropic: 'ANTHROPIC', openai: 'OPENAI', google: 'GOOGLE', meta: 'META', xai: 'XAI' };
const LAB_NAMES = { anthropic: 'Anthropic · Claude', openai: 'OpenAI · ChatGPT', google: 'Google · Gemini', meta: 'Meta · AI', xai: 'xAI · Grok' };
// Frontier Releases always shows exactly these 3 brands — see the release-
// building block in main() for why.
const RELEASE_LABS = ['anthropic', 'openai', 'google'];

function detectLab(text) {
  for (const [key, re] of Object.entries(LAB_KEYWORDS)) if (re.test(text)) return key;
  return null;
}
function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// ---------- community pulse (Hacker News Algolia — free, no key) ----------
// A model conversation map + representative public comments, built entirely at
// build time. For each model family we pull recent STORIES (for discussion
// volume) and recent COMMENTS (for topic themes + representative excerpts).
// This is a SAMPLE of public developer discussion, not the whole community, and
// it's labelled as such in the UI. `q` is the single best keyword.
//
// name/version/org come from the canonical MODEL_REGISTRY (scripts/lib/models.mjs)
// — the same source Ocean Map (entities.json, kept in sync by hand) and the
// Leaderboard reference — so a version bump can't drift between sections.
// Official first-party developer forums (Discourse) for the labs that run one.
// Only OpenAI and Google publish a public forum; Anthropic/xAI/Alibaba/Meta
// don't (Anthropic's claude.com/community is a marketing page that links out to
// Discord/Reddit), so those models stay HN-only for now — honestly asymmetric,
// surfaced per-model in the `sources` breakdown. The forum is lab-specific, so
// a search for the flagship generation returns discussion ABOUT that model:
// unlike HN (where "Gemini" could be the zodiac sign), the forum + version
// query IS the relevance guard, so no keyword-mention regex is applied here —
// forum users rarely repeat the brand name on the brand's own forum.
const DISCOURSE_FORUMS = {
  gpt: { base: 'https://community.openai.com', sourceName: 'OpenAI forum', query: 'GPT-5' },
  gemini: { base: 'https://discuss.ai.google.dev', sourceName: 'Google AI forum', query: 'Gemini 3' },
};

// Official GitHub Discussions boards on each lab's own tooling repo — fills
// the gap for labs with no public Discourse forum (Anthropic, xAI, Alibaba),
// confirmed active with real, dated, moderator-answered threads during
// research. Added for Gemini too (alongside its Discourse forum) since
// gemini-cli's board is extremely high-volume and genuinely additive. Unlike
// Discourse this needs a Bearer token for every call (GraphQL has no
// anonymous access even for public repos) — GITHUB_DISCUSSIONS_TOKEN below.
const GITHUB_DISCUSSIONS_REPOS = {
  claude: { owner: 'anthropics', name: 'claude-code-action', sourceName: 'Anthropic GitHub' },
  gemini: { owner: 'google-gemini', name: 'gemini-cli', sourceName: 'Google GitHub' },
  grok: { owner: 'xai-org', name: 'grok-build', sourceName: 'xAI GitHub' },
  qwen: { owner: 'QwenLM', name: 'Qwen3.6', sourceName: 'Qwen GitHub' },
};
const GITHUB_DISCUSSIONS_FETCH = 15; // newest N discussions per repo per run

const COMMUNITY_MODELS = MODEL_KEYS.map((key) => {
  const m = MODEL_REGISTRY[key];
  return {
    key, model: m.name, version: m.version, org: m.org, q: m.hnQuery,
    discourse: DISCOURSE_FORUMS[key] || null,
    ghDiscussions: GITHUB_DISCUSSIONS_REPOS[key] || null,
  };
});

// Strip HTML/entities from an HN comment and cut to ~180 chars on word
// boundaries. When a `focus` keyword is given and present, the window is
// centred on it so the excerpt is actually about the model being discussed
// (not a random opening sentence). HN comment_text is HTML; never rendered raw.
function sanitizeExcerpt(html, max = 180, focus = '') {
  const text = decodeEntities(html); // decodeEntities also strips tags
  if (text.length <= max) return text;
  let start = 0;
  if (focus) {
    const idx = text.toLowerCase().indexOf(focus.toLowerCase());
    if (idx > max * 0.5) start = idx - Math.floor(max * 0.35);
  }
  let slice = text.slice(start, start + max);
  // trim to word boundaries on both ends
  if (start > 0) { const s = slice.indexOf(' '); if (s > 0 && s < 25) slice = slice.slice(s + 1); }
  const end = slice.lastIndexOf(' ');
  if (end > max * 0.6) slice = slice.slice(0, end);
  return (start > 0 ? '…' : '') + slice.trimEnd() + '…';
}

const COMMUNITY_LIMITED_MIN = 8; // fewer than this relevant discussions → "limited sample"

// HN Algolia caps a single response at hitsPerPage; a documented, bounded
// pagination loop lets us report an EXACT count when a model's raw hits fit
// within the cap, and an honest, explicitly-labelled ESTIMATE (scaled from
// the validated fraction of whatever we did fetch) when they don't — see
// storyCoverage/isEstimated below. HN_MAX_PAGES bounds worst-case build time
// (7 models × 2 queries × up to 3 pages each).
const HN_PAGE_SIZE = 100;
const HN_MAX_PAGES = 3; // up to 300 raw hits sampled per query per model

async function fetchAlgoliaPaginated(urlBase, maxPages = HN_MAX_PAGES) {
  let hits = [], nbHits = 0, fetchedCount = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchWithTimeout(`${urlBase}&page=${page}&hitsPerPage=${HN_PAGE_SIZE}`);
    if (!res.ok) break;
    const j = await res.json();
    // Algolia's nbHits is an approximate, eventually-consistent count that can
    // shift between paginated requests as the index updates live (a real CI
    // failure: page 0 reported nbHits=200, but by page 2 the live index had
    // grown enough that fetchedCount reached 250 — an honest "raw hits" figure
    // must never end up SMALLER than what we actually, verifiably fetched, so
    // track the max seen across pages rather than overwriting with the latest).
    nbHits = Math.max(nbHits, j.nbHits ?? 0);
    const pageHits = j.hits || [];
    hits = hits.concat(pageHits);
    fetchedCount += pageHits.length;
    if (pageHits.length < HN_PAGE_SIZE || fetchedCount >= nbHits) break; // no more pages
  }
  return { hits, nbHits, fetchedCount };
}

// One model's first-party forum (Discourse) discussion. Validated by SCOPE, not
// keyword regex: the forum is the lab's own, the query targets the current model
// generation, so returned topics are relevant discussion (see DISCOURSE_FORUMS).
// `more` from search means the visible set is a floor → the source is estimated.
async function fetchModelDiscourse(forum, sinceMs) {
  const query = `${forum.query} after:${discourseAfterDate(sinceMs)} order:latest`;
  const res = await fetchWithTimeout(buildDiscourseSearchUrl({ base: forum.base, query }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = parseDiscourseSearch(await res.json(), { base: forum.base, sinceISO: new Date(sinceMs).toISOString() });
  return { sourceName: forum.sourceName, discussions: parsed.topics.length, isEstimated: parsed.more, posts: parsed.posts };
}

// One model's official GitHub Discussions board. GraphQL requires a Bearer
// token for every request (even public repos) — the caller only invokes this
// when a token is present; there's no "unauthenticated but limited" fallback
// the way Discourse/HN have. Discussions being disabled on the target repo, or
// the token lacking `discussions:read`, surfaces as a normal ok:false — caught
// like any other per-source failure, never crashes the model's whole fetch.
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

async function fetchModelGithubDiscussions(repoCfg, token, sinceMs) {
  const body = buildDiscussionsQueryBody({ owner: repoCfg.owner, name: repoCfg.name, first: GITHUB_DISCUSSIONS_FETCH });
  const res = await fetchWithTimeout(GITHUB_GRAPHQL_URL, {
    method: 'POST', headers: buildAuthHeaders(token), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = parseDiscussionsResponse(await res.json(), { owner: repoCfg.owner, name: repoCfg.name, label: repoCfg.sourceName, org: repoCfg.owner });
  if (!parsed.ok) throw new Error(parsed.errorMessage || 'unknown GraphQL error');
  const { inWindow, isEstimated } = windowedDiscussions(parsed.discussions, new Date(sinceMs).toISOString());
  return { sourceName: repoCfg.sourceName, discussions: inWindow.length, isEstimated, items: inWindow };
}

async function fetchModelCommunity(m, now, usedCommentIds, ghToken) {
  const sinceMs = now - 30 * 24 * 3600 * 1000;
  const since = Math.floor(sinceMs / 1000); // last 30 days (HN Algolia uses epoch seconds)
  const base = 'https://hn.algolia.com/api/v1/search';
  const model = {
    key: m.key, model: m.model, version: m.version, org: m.org,
    rawStoryHits: 0, fetchedStoryCount: 0, validatedStoryCount: 0, storyCoverage: 1,
    estimatedRelevantDiscussions: 0, isEstimated: true,
    rawCommentHits: 0, fetchedCommentCount: 0, validatedCommentCount: 0, commentCoverage: 1,
    limited: true, points: 0, themes: [], topThreads: [], sources: [],
  };
  const comments = [];             // HN representative voices
  const forumComments = [];        // first-party Discourse forum representative voices
  const ghComments = [];           // first-party GitHub Discussions representative voices
  const themeCounts = {};          // combined across sources; model.themes built at the end
  const chosenTexts = [];          // near-duplicate guard shared across all sources
  let hnDiscussions = 0, hnEstimated = true;
  try {
    const [storiesData, commentsData] = await Promise.all([
      fetchAlgoliaPaginated(`${base}?query=${encodeURIComponent(m.q)}&tags=story&numericFilters=created_at_i>${since}`),
      fetchAlgoliaPaginated(`${base}?query=${encodeURIComponent(m.q)}&tags=comment&numericFilters=created_at_i>${since}`),
    ]);

    // ---- stories: exact count when fully paginated, explicit estimate otherwise ----
    const storyHits = storiesData.hits.filter((h) => h.title);
    const validatedStories = storyHits.filter((h) => isValidatedMention(`${h.title} ${h.story_text || ''}`, m.key));
    model.rawStoryHits = storiesData.nbHits || storyHits.length;
    model.fetchedStoryCount = storiesData.fetchedCount;
    model.validatedStoryCount = validatedStories.length;
    const cov = communityStoryCoverage({
      rawHits: model.rawStoryHits, fetchedCount: model.fetchedStoryCount,
      validatedCount: validatedStories.length, sampleSize: storyHits.length,
    });
    model.storyCoverage = cov.coverage;
    hnDiscussions = cov.estimatedRelevantDiscussions;
    hnEstimated = cov.isEstimated;
    model.points = validatedStories.reduce((s, h) => s + (h.points || 0), 0);
    model.topThreads = validatedStories.slice().sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 2)
      .map((h) => ({ title: truncate(h.title, 90), points: h.points || 0, comments: h.num_comments || 0, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, date: shortDateUTC(new Date((h.created_at_i || 0) * 1000)) }));

    // ---- comments: coverage-aware counts, up to 2 themes each, relevance-ranked picks ----
    const rawComments = commentsData.hits.filter((h) => h.comment_text);
    model.rawCommentHits = commentsData.nbHits || rawComments.length;
    model.fetchedCommentCount = commentsData.fetchedCount;
    model.commentCoverage = model.rawCommentHits ? clamp01(model.fetchedCommentCount / model.rawCommentHits) : 1;

    const decoded = rawComments.map((h) => ({ h, text: decodeEntities(h.comment_text) }));
    const scored = decoded.map((c) => ({ ...c, matchConfidence: matchModelMention(c.text, m.key) }));
    const validated = scored.filter((c) => c.matchConfidence >= COMMUNITY_MATCH_THRESHOLD);
    model.validatedCommentCount = validated.length;

    for (const c of validated) {
      c.topics = classifyTopics(c.text).slice(0, 2); // a comment may carry up to 2 themes
      for (const tid of c.topics) themeCounts[tid] = (themeCounts[tid] || 0) + 1;
    }

    // Representative comments: ranked by a composite relevance score — model-
    // match confidence, then theme specificity, contextual completeness and
    // recency (see commentRelevanceScore in lib/signals.mjs). Deliberately NOT
    // sorted by length or points. Non-duplication is enforced here as a
    // selection-time filter: a candidate is skipped if it's near-identical to
    // one already picked for this model, both globally (usedCommentIds, so no
    // excerpt repeats across model panels) and within this model's own list.
    const totalValidated = validated.length || 1;
    const candidates = validated
      .filter((c) => c.topics.length && !usedCommentIds.has(c.h.objectID))
      .map((c) => {
        const spec = c.topics.reduce((s, t) => s + themeSpecificity(t, themeCounts, totalValidated), 0) / c.topics.length;
        const score = commentRelevanceScore({
          matchConfidence: c.matchConfidence,
          themeSpecificity: spec,
          completeness: contextualCompleteness(c.text),
          recency: communityRecencyScore((c.h.created_at_i || 0) * 1000, now),
        });
        return { ...c, score };
      })
      .sort((a, b) => b.score - a.score);

    for (const c of candidates) {
      if (comments.length >= 4) break; // leave room for first-party forum voices
      if (chosenTexts.some((t) => similarity(t, c.text) > 0.6)) continue; // near-duplicate of an already-picked comment
      chosenTexts.push(c.text);
      usedCommentIds.add(c.h.objectID);
      comments.push({
        modelId: m.key, themes: c.topics,
        excerpt: sanitizeExcerpt(c.h.comment_text, 180, m.q),
        source: 'Hacker News', author: c.h.author || 'anon',
        publishedAt: new Date((c.h.created_at_i || 0) * 1000).toISOString(),
        url: `https://news.ycombinator.com/item?id=${c.h.objectID}`,
      });
    }
  } catch (err) {
    console.error(`[community] ${m.key} HN: ${err.message}`);
  }

  // ---- first-party forum (Discourse), when the lab runs one ----
  let forumDiscussions = 0, forumEstimated = false, forumSourceName = null;
  if (m.discourse) {
    try {
      const forum = await fetchModelDiscourse(m.discourse, sinceMs);
      forumSourceName = forum.sourceName;
      forumDiscussions = forum.discussions;
      forumEstimated = forum.isEstimated;
      // forum post themes feed the SAME combined theme tally as HN
      const scored = forum.posts
        .map((p) => ({ p, topics: classifyTopics(p.blurb).slice(0, 2) }))
        .sort((a, b) => String(b.p.createdAt).localeCompare(String(a.p.createdAt)));
      for (const fp of scored) for (const tid of fp.topics) themeCounts[tid] = (themeCounts[tid] || 0) + 1;
      // up to 2 representative forum voices, newest-first, deduped against HN.
      // Guards: a voice must carry at least one classified theme (every shown
      // comment does, and the validator enforces it), and only ONE voice per
      // topic — two posts in the same thread would share a topic URL, which the
      // validator rejects as a duplicate.
      const usedTopics = new Set();
      for (const fp of scored) {
        if (forumComments.length >= 2) break;
        if (!fp.topics.length || usedTopics.has(fp.p.topicId)) continue;
        const uid = `disc:${fp.p.id}`;
        if (usedCommentIds.has(uid)) continue;
        const text = decodeEntities(fp.p.blurb);
        if (chosenTexts.some((t) => similarity(t, text) > 0.6)) continue;
        chosenTexts.push(text);
        usedCommentIds.add(uid);
        usedTopics.add(fp.p.topicId);
        forumComments.push({
          modelId: m.key, themes: fp.topics,
          excerpt: sanitizeExcerpt(fp.p.blurb, 180, m.discourse.query),
          source: forum.sourceName, author: fp.p.username || 'member',
          publishedAt: fp.p.createdAt, url: fp.p.url,
        });
      }
    } catch (err) {
      console.error(`[community] ${m.key} forum: ${err.message}`);
    }
  }

  // ---- official GitHub Discussions board, when one is configured AND a token
  // is available. GraphQL needs auth for every call (unlike Discourse/HN), so
  // a missing token is a silent, expected skip — not an error — same
  // graceful-absence contract as YOUTUBE_API_KEY: the source just doesn't
  // contribute this run rather than failing the whole model. ----
  let ghDiscussions = 0, ghEstimated = false, ghSourceName = null;
  if (m.ghDiscussions && ghToken) {
    try {
      const gh = await fetchModelGithubDiscussions(m.ghDiscussions, ghToken, sinceMs);
      ghSourceName = gh.sourceName;
      ghDiscussions = gh.discussions;
      ghEstimated = gh.isEstimated;
      const scored = gh.items.map((d) => ({ d, topics: classifyTopics(`${d.title} ${d.bodyText}`).slice(0, 2) }));
      for (const gd of scored) for (const tid of gd.topics) themeCounts[tid] = (themeCounts[tid] || 0) + 1;
      // up to 2 representative voices, newest-first (items already sorted),
      // deduped against every other source; one voice per discussion thread.
      for (const gd of scored) {
        if (ghComments.length >= 2) break;
        if (!gd.topics.length) continue;
        const uid = `gh:${gd.d.id}`;
        if (usedCommentIds.has(uid)) continue;
        const text = gd.d.bodyText || gd.d.title;
        if (chosenTexts.some((t) => similarity(t, text) > 0.6)) continue;
        chosenTexts.push(text);
        usedCommentIds.add(uid);
        ghComments.push({
          modelId: m.key, themes: gd.topics,
          excerpt: sanitizeExcerpt(text, 180),
          source: gh.sourceName, author: gd.d.author,
          publishedAt: gd.d.createdAt, url: gd.d.url,
        });
      }
    } catch (err) {
      console.error(`[community] ${m.key} github: ${err.message}`);
    }
  }

  // ---- combine: interleave voices (first-party sources first — forum, then
  // GitHub, then HN — so first-party visibility isn't crowded out), rebuild
  // themes over all sources, honest per-source totals ----
  const merged = [];
  const hnQ = comments.slice(), fQ = forumComments.slice(), gQ = ghComments.slice();
  while (hnQ.length || fQ.length || gQ.length) {
    if (fQ.length) merged.push(fQ.shift());
    if (gQ.length) merged.push(gQ.shift());
    if (hnQ.length) merged.push(hnQ.shift());
  }
  model.themes = TOPICS.filter((t) => themeCounts[t.id]).map((t) => ({ id: t.id, label: t.label, count: themeCounts[t.id] })).sort((a, b) => b.count - a.count);
  model.sources = [{ name: 'Hacker News', discussions: hnDiscussions, isEstimated: hnEstimated }];
  if (forumSourceName) model.sources.push({ name: forumSourceName, discussions: forumDiscussions, isEstimated: forumEstimated });
  if (ghSourceName) model.sources.push({ name: ghSourceName, discussions: ghDiscussions, isEstimated: ghEstimated });
  model.estimatedRelevantDiscussions = hnDiscussions + forumDiscussions + ghDiscussions;
  model.isEstimated = model.sources.some((s) => s.isEstimated);
  model.limited = model.estimatedRelevantDiscussions < COMMUNITY_LIMITED_MIN;

  return { model, comments: merged };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ---------- stocks ----------
async function fetchStock(meta) {
  try {
    // 3 months of daily bars — enough for a 30-day return correlation and a
    // 20-day average volume, plus latest price/volume.
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${meta.t}?interval=1d&range=3mo`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = (await res.json())?.chart?.result?.[0];
    const m = result?.meta;
    if (!m || m.regularMarketPrice == null) throw new Error('no price data');

    // build a date-sorted [{date, close, volume}] series (skip null bars) plus
    // a parallel OHLC series for the native candlestick chart in the drawer
    const ts = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const closes = q.close || [], opens = q.open || [], highs = q.high || [], lows = q.low || [];
    const vols = q.volume || [];
    const series = [];
    const ohlc = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] == null) continue;
      series.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: closes[i], volume: vols[i] ?? null });
      if (opens[i] != null && highs[i] != null && lows[i] != null) {
        ohlc.push({ d: new Date(ts[i] * 1000).toISOString().slice(5, 10), o: opens[i], h: highs[i], l: lows[i], c: closes[i] });
      }
    }

    // Daily change from the last two valid bars (NOT the 3-month range start).
    const dc = dailyChange(series, m.regularMarketPrice);
    if (dc.review) console.warn(`[stock] ${meta.t}: daily change ${dc.changePct.toFixed(1)}% exceeds ±${DAILY_CHANGE_REVIEW_PCT}% — flagged for review`);
    const price = m.regularMarketPrice;

    return {
      t: meta.t, n: m.longName || m.shortName || meta.n, layer: meta.layer, signal: meta.signal,
      price, changePct: dc.changePct, changeReview: dc.review, url: `https://finance.yahoo.com/quote/${meta.t}`,
      volume: m.regularMarketVolume ?? (series.length ? series[series.length - 1].volume : null),
      series, ohlc,
    };
  } catch (err) {
    console.error(`[stock] ${meta.t}: ${err.message}`);
    return { t: meta.t, n: meta.n, layer: meta.layer, signal: meta.signal, price: null, changePct: null, changeReview: false, url: `https://finance.yahoo.com/quote/${meta.t}`, volume: null, series: [] };
  }
}

// Build data/stock-network.json from the fetched quotes: ecosystem nodes with
// market cap (curated shares × live price), relative/dollar volume, plus the
// 30-day price-return correlation pairs (|r| >= 0.5) and curated business
// relationships. All heavy math happens here at build time, never in the browser.
function buildStockNetwork(quotes, metaByTicker, now) {
  const tickers = quotes.map((q) => q.t);
  const returnsByTicker = {};
  for (const q of quotes) if (q.series?.length) returnsByTicker[q.t] = computeReturns(q.series);

  const correlations = correlationPairs(returnsByTicker, tickers, 30, 0.5);

  const nodes = quotes.map((q) => {
    const meta = metaByTicker[q.t] || {};
    const vols = (q.series || []).map((r) => r.volume);
    const relVol = relativeVolume(vols, 20);
    const avg20 = average((q.series || []).slice(-21, -1).map((r) => r.volume));
    const marketCap = meta.shares != null && q.price != null ? meta.shares * 1e9 * q.price : null;
    // week/month change for the drawer — null (not fabricated) until enough
    // trading-day history has accumulated for that lookback.
    const weekChangePct = periodChange(q.series, WEEK_TRADING_DAYS, q.price).changePct;
    const monthChangePct = periodChange(q.series, MONTH_TRADING_DAYS, q.price).changePct;
    return {
      t: q.t, n: q.n, layer: q.layer, netLayer: meta.netLayer ?? 2, url: q.url, signal: q.signal,
      price: q.price, changePct: q.changePct, changeReview: !!q.changeReview, direction: direction(q.changePct),
      weekChangePct, monthChangePct,
      marketCap, volume: q.volume ?? null,
      dollarVolume: q.volume != null && q.price != null ? q.volume * q.price : null,
      avg20Volume: avg20, relVolume: relVol,
      // compact ~3-month daily candle series for the drawer's native chart
      chart: buildCandleSeries(q.ohlc),
    };
  });

  return {
    updatedAt: new Date(now).toISOString(),
    layers: NET_LAYERS,
    correlationWindow: 30,
    correlationThreshold: 0.5,
    marketCapNote: 'Market cap = curated shares outstanding × live price (shares update quarterly).',
    nodes,
    correlations,
    relationships: STOCK_RELS,
  };
}

// ---------- compute pricing (Vast.ai + RunPod public marketplace APIs — free, no key) ----------
// Live cloud-GPU $/hr rates, replacing the previous hand-typed, unverifiable
// ranges. Both APIs are public read endpoints confirmed to need no
// authentication. `segment` (what a chip is typically used for) stays a small
// curated classification — real domain knowledge, not a price, so it doesn't
// go stale the way a dollar figure does. See scripts/lib/compute.mjs.
async function fetchVastOffers() {
  try {
    const q = encodeURIComponent(JSON.stringify({
      order: [['score', 'desc']], type: 'on-demand', limit: 400,
      verified: { eq: true }, rentable: { eq: true },
    }));
    const res = await fetchWithTimeout(`https://console.vast.ai/api/v0/bundles/?q=${q}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).offers || [];
  } catch (err) {
    console.error(`[compute] Vast.ai: ${err.message}`);
    return [];
  }
}

async function fetchRunpodTypes() {
  try {
    const res = await fetchWithTimeout('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { gpuTypes { id displayName memoryInGb communityPrice securePrice } }' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (j.errors) throw new Error(j.errors.map((e) => e.message).join('; '));
    return j.data.gpuTypes || [];
  } catch (err) {
    console.error(`[compute] RunPod: ${err.message}`);
    return [];
  }
}

async function fetchComputePricing(now) {
  const [vastOffers, runpodTypes] = await Promise.all([fetchVastOffers(), fetchRunpodTypes()]);

  let history = {};
  try { history = JSON.parse(await readFile(COMPUTE_HISTORY_PATH, 'utf-8')); } catch { /* first run */ }

  const today = dayKey(now);
  const rows = [];
  for (const entry of GPU_CATALOG) {
    const merged = mergeGpuPricing(entry, vastOffers, runpodTypes);
    if (!merged) {
      console.warn(`[compute] ${entry.chip}: no current offer from either marketplace, skipping`);
      continue;
    }
    const mid = (merged.low + merged.high) / 2;
    const chipHistory = history[entry.chip] || [];
    // one snapshot per day (re-running the same day overwrites today's entry,
    // never duplicates it), bounded to the last 30 days
    const withoutToday = chipHistory.filter((h) => h.date !== today);
    const nextHistory = [...withoutToday, { date: today, mid }].slice(-30);
    history[entry.chip] = nextHistory;

    const { trend, trendClass } = computeTrend(nextHistory);
    rows.push({
      chip: entry.chip, segment: entry.segment,
      rate: formatRate(merged.low, merged.high),
      trend, trendClass,
      note: `Live from ${merged.sampleSize} rented offer${merged.sampleSize === 1 ? '' : 's'} across Vast.ai + RunPod`,
    });
  }

  await writeFile(COMPUTE_HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
  return rows;
}

async function main() {
  const now = Date.now();
  const entities = JSON.parse(await readFile(ENTITIES_PATH, 'utf-8'));
  const nodes = entities.nodes;

  console.log('Fetching RSS feeds…');
  const feedResults = await Promise.all(FEEDS.map(fetchFeed));
  const allItems = feedResults.flatMap((r) => r.items);
  const feedsSucceeded = feedResults.filter((r) => r.ok).length;
  console.log(`Fetched ${allItems.length} items from ${feedsSucceeded}/${FEEDS.length} feeds (succeeded/configured).`);

  // 1) drop stale/evergreen posts (some publisher feeds carry years-old items),
  //    newest first
  const RECENT_MS = 60 * 24 * 3.6e6; // 60 days
  const recent = allItems.filter((it) => now - new Date(it.date).getTime() <= RECENT_MS);
  const pool = recent.length >= 12 ? recent : allItems; // fallback if feeds are sparse
  pool.sort((a, b) => b.date - a.date);
  if (process.env.DUMP_POOL) {
    await writeFile(process.env.DUMP_POOL, JSON.stringify(pool, null, 2), 'utf-8');
    console.log('DUMP_POOL written, exiting early for inspection.');
    process.exit(0);
  }

  // 2) categorize EACH raw item first (needed as a clustering signal — two
  //    reports of the same event are almost always categorized identically),
  //    then cluster duplicate reports of the same event together.
  const categorized = pool.map((it) => {
    const { category, confidence: catConfidence } = categorize(it.title, it.desc);
    return { ...it, category, catConfidence };
  });
  const merged = dedupeMerge(categorized, { threshold: 0.34, nodes });

  // 3) enrich EVERY merged cluster once with significance/impact/verification/
  //    entityIds — every downstream section (signals, releases, wire, feed,
  //    breakthroughs) reads these same computed fields, so a story's
  //    verification chip is never re-derived differently in different places.
  //    Order matters: verification must be known BEFORE integrity caps run
  //    (the General/Analysis cap checks official-source + corroboration).
  for (const it of merged) {
    it.significance = scoreSignificance(it, nodes, now);
    it.verification = classifyVerification(it);
    const capped = applyIntegrityCaps(it);
    it.significance = capped.significance;
    it.impact = capped.impact;
    it.capped = capped.capped;
    it.entityIds = matchEntities(`${it.title} ${it.desc}`, nodes).ids;
    it.clusterId = stableId(it.link);
  }

  // 4) unified signal stream — the spine of the hero/waves/river.
  const signals = merged
    .map((it) => ({
      id: it.link, clusterId: it.clusterId, title: it.title, desc: it.desc, url: it.link,
      dateISO: new Date(it.date).toISOString(), date: shortDateUTC(it.date),
      category: it.category, catConfidence: it.catConfidence, family: waveFamily(it.category),
      significance: it.significance, impact: it.impact, verification: it.verification,
      sourceCount: it.sourceCount, sources: it.sources.map((s) => ({ name: s.sourceName, url: s.link })),
      sourceName: it.sourceName, entityIds: it.entityIds,
    }))
    .sort((a, b) => b.significance - a.significance);

  // Written here (rather than at the very end) so its return value —
  // historyDepthDays — is available for the Data Health summary below.
  const rangesDoc = await writeEventHistoryAndRanges(signals, nodes, now);

  // 5) derive the existing detailed sections from the same merged stream —
  //    every section reads the same underlying clusters, so a story never
  //    appears in one place miscategorized relative to another.
  //
  //    Frontier Releases always shows exactly these 3 brands (Claude/ChatGPT/
  //    Gemini), each with its up to 5 most-recent qualifying releases within
  //    the 60-day pool — never collapsed to whichever lab happened to publish
  //    most recently, and never silently dropped if a lab has zero releases
  //    right now (the card still renders, with an honest empty state).
  const releasesByLab = Object.fromEntries(RELEASE_LABS.map((l) => [l, []]));
  const feedRows = [];
  const breakthroughs = [];
  const wire = [];
  for (const it of merged) {
    const lab = detectLab(`${it.title} ${it.desc}`);
    if (lab && RELEASE_LABS.includes(lab) && isProductRelease(it.title, it.desc)) { releasesByLab[lab].push(it); continue; }
    if (it.category === 'opensource') { feedRows.push(it); continue; }
    if (it.category === 'research') { breakthroughs.push(it); continue; }
    wire.push({ ...it, lab });
  }

  const releases = RELEASE_LABS.map((lab) => {
    const list = releasesByLab[lab].slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    return {
      lab: LAB_NAMES[lab] || lab, logoKey: lab,
      items: list.map((it) => {
        // Surface the official YouTube upload distinctly: either the whole
        // release IS the video (its own canonical link — the video-native
        // case), or a video merged alongside a separate text source reporting
        // the same event, in which case it gets its own secondary ▶ link.
        const video = it.sources.find((s) => /\(YouTube\)/.test(s.sourceName || ''));
        const isVideo = !!video && video.link === it.link;
        return {
          h: truncate(it.title, 90), d: shortDateUTC(it.date), url: it.link,
          isVideo,
          videoUrl: video && !isVideo ? video.link : null,
          sourceName: it.sourceName, sourceCount: it.sourceCount,
          verification: it.verification, impact: it.impact,
        };
      }),
    };
  });

  const wireCards = wire.slice(0, 8).map((it) => ({
    org: it.lab ? COMPANY_TAG[it.lab] : 'AI WIRE', logoKey: it.lab || 'other', date: shortDateUTC(it.date),
    verification: it.verification, impact: it.impact,
    h: truncate(it.title, 80), p: truncate(it.desc, 260) || it.title, url: it.link,
    sourceName: it.sourceName, sourceCount: it.sourceCount,
  }));

  const feed = feedRows.slice(0, 8).map((it) => {
    const { lic, licClass } = detectLicense(`${it.title} ${it.desc}`);
    return {
      name: truncate(it.title, 60), org: it.sourceName, date: shortDateUTC(it.date), lic, licClass,
      desc: truncate(it.desc, 140) || 'Open-weight coverage — confirm exact license on the model card.',
      url: it.link, sourceName: it.sourceName, verification: it.verification, impact: it.impact,
    };
  });

  // Sort newest first — previously inherited dedupeMerge's significance
  // order, which showed dates out of sequence with no explanation.
  const brk = breakthroughs.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6).map((it) => ({
    field: inferField(`${it.title} ${it.desc}`), date: shortDateUTC(it.date),
    verification: it.verification, impact: it.impact,
    h: truncate(it.title, 80), p: truncate(it.desc, 260) || it.title, url: it.link,
    sourceName: it.sourceName, sourceCount: it.sourceCount,
  }));

  const ticker = signals.slice(0, 10).map((s) => truncate(s.title, 110).toUpperCase());

  // 5) live ocean-map inputs + strongest waves (all deterministic)
  const entityActivity = computeEntityActivity(signals, nodes);
  const waves = buildWaves(signals).map((w) => ({
    family: w.family, category: w.category, title: w.title, summary: truncate(w.desc, 180) || w.title,
    significance: w.significance, impact: w.impact, verification: w.verification, date: w.date, dateISO: w.dateISO,
    url: w.url, sourceCount: w.sourceCount, sources: w.sources, entityIds: w.entityIds,
    whyItMatters: w.whyItMatters,
  }));

  console.log('Fetching stock quotes…');
  const quotes = await Promise.all(STOCKS.map(fetchStock));
  const metaByTicker = Object.fromEntries(STOCKS.map((s) => [s.t, s]));
  const stockNetwork = buildStockNetwork(quotes, metaByTicker, now);
  // latest.json keeps compact per-stock fields (no history series), with
  // relVolume + marketCap included for any consumer that wants them
  const netByTicker = Object.fromEntries(stockNetwork.nodes.map((n) => [n.t, n]));
  const stocks = quotes.map(({ series, ...rest }) => ({
    ...rest,
    relVolume: netByTicker[rest.t]?.relVolume ?? null,
    marketCap: netByTicker[rest.t]?.marketCap ?? null,
  }));

  console.log('Fetching compute pricing…');
  const compute = await fetchComputePricing(now);
  console.log(`  compute: ${compute.length}/${GPU_CATALOG.length} chips priced live`);

  console.log('Fetching community pulse…');
  // shared across models so a comment excerpt is never reused between bubbles
  const usedCommentIds = new Set();
  // GitHub Discussions (GraphQL) needs a Bearer token for every call, unlike
  // Discourse/HN. In Actions the free, zero-setup GITHUB_TOKEN covers this;
  // running locally without one, that source is silently skipped per model
  // (see fetchModelCommunity) rather than failing the build.
  const ghToken = process.env.GITHUB_TOKEN || '';
  if (!ghToken) console.log('  (GITHUB_TOKEN not set — GitHub Discussions source skipped this run)');
  const communityResults = [];
  for (const cm of COMMUNITY_MODELS) communityResults.push(await fetchModelCommunity(cm, now, usedCommentIds, ghToken));
  const community = {
    updatedAt: new Date(now).toISOString(),
    window: '30D',
    source: 'Hacker News + official model forums + GitHub Discussions',
    models: communityResults.map((r) => r.model),
    comments: communityResults.flatMap((r) => r.comments),
  };

  const build = buildInfo();
  const nowISO = new Date(now).toISOString();

  // A compact, honest snapshot of the pipeline's own health — separate from
  // the content itself, so a reader (or the site) can tell "is this data
  // fresh and complete" without having to infer it from feed counts buried in
  // build logs. `estimatedDatasets` counts community models whose discussion
  // count is a scaled estimate rather than an exact paginated count (see
  // fetchModelCommunity / communityStoryCoverage).
  const dataHealth = {
    feedsSucceeded, feedsConfigured: FEEDS.length,
    stockNodesAvailable: stockNetwork.nodes.length,
    communityModelsAvailable: community.models.length,
    historyDepthDays: rangesDoc.historyDepthDays,
    estimatedDatasets: community.models.filter((m) => m.isEstimated).length,
    buildSha: build.shortSha,
    lastSuccessfulUpdate: nowISO,
  };

  const data = {
    updatedAt: nowISO,
    build,
    dataHealth,
    ticker,
    signals: signals.slice(0, 40),
    waves,
    entityActivity,
    releases,
    wire: wireCards,
    feed,
    breakthroughs: brk,
    stocks,
    compute,
    community,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);
  await writeFile(STOCKNET_PATH, JSON.stringify(stockNetwork, null, 2), 'utf-8');
  console.log(`Wrote ${STOCKNET_PATH} (${stockNetwork.nodes.length} nodes, ${stockNetwork.correlations.length} correlations >= 0.5)`);

  console.log(`  signals: ${signals.length}, waves: ${waves.length}, releases: ${releases.length}, wire: ${wireCards.length}, feed: ${feed.length}, breakthroughs: ${brk.length}, stocks: ${stocks.length}, compute: ${compute.length}, community: ${community.models.length} models / ${community.comments.length} comments, correlations: ${stockNetwork.correlations.length}`);
}

// Appends today's clustered signals to data/history/events/YYYY-MM-DD.json
// (de-duplicated by clusterId against what's already there today), prunes
// event files older than HISTORY_RETENTION_DAYS, loads the retained window,
// and writes data/range.json with REAL per-range stats (current window vs the
// equivalent prior window — never a single blended comparison point).
async function writeEventHistoryAndRanges(signals, nodes, now) {
  await mkdir(EVENTS_DIR, { recursive: true });

  const today = dayKey(now);
  const todayPath = path.join(EVENTS_DIR, `${today}.json`);
  let existingToday = [];
  try { existingToday = JSON.parse(await readFile(todayPath, 'utf-8')); } catch { /* first run today */ }

  const freshToday = signals.map((s) => ({ ...toCompactEvent(s), collectedOn: today }));
  const mergedToday = mergeTodayEvents(existingToday, freshToday);
  await writeFile(todayPath, JSON.stringify(mergedToday, null, 2), 'utf-8');
  console.log(`Wrote ${mergedToday.length} events to history/events/${today}.json`);

  // prune anything older than the retention window (bounds growth to ~60 files)
  const cutoff = now - HISTORY_RETENTION_DAYS * 24 * 3.6e6;
  const files = await readdir(EVENTS_DIR);
  for (const f of files) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    if (new Date(m[1] + 'T00:00:00Z').getTime() < cutoff) {
      await unlink(path.join(EVENTS_DIR, f));
      console.log(`Pruned expired history/events/${f}`);
    }
  }

  // load everything within the retention window (including the file we just wrote)
  const remaining = await readdir(EVENTS_DIR);
  let allEvents = [];
  let earliestDay = today;
  for (const f of remaining) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    if (m[1] < earliestDay) earliestDay = m[1];
    try {
      const day = JSON.parse(await readFile(path.join(EVENTS_DIR, f), 'utf-8'));
      allEvents = allEvents.concat(day);
    } catch (err) {
      console.error(`[history] failed to read ${f}: ${err.message}`);
    }
  }
  // collection start = midnight UTC of the earliest day-file we actually have
  // on disk — NOT the oldest article's publish date (see buildRangesDoc doc).
  const collectionStartMs = new Date(`${earliestDay}T00:00:00Z`).getTime();

  const rangesDoc = buildRangesDoc(allEvents, now, nodes, collectionStartMs);
  await writeFile(RANGES_PATH, JSON.stringify(rangesDoc, null, 2), 'utf-8');
  console.log(`Wrote ${RANGES_PATH} (${allEvents.length} events, ${rangesDoc.historyDepthDays}d of history)`);
  return rangesDoc;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
