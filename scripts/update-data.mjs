#!/usr/bin/env node
// Pulls fresh AI-industry content from official publisher RSS feeds + free stock
// quotes, scores it with the shared deterministic logic in lib/signals.mjs, and
// writes data/latest.json (+ a bounded daily snapshot under data/history/).
// No API keys required.
//
// Run: node scripts/update-data.mjs

import { writeFile, mkdir, readFile, readdir, unlink } from 'node:fs/promises';
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
  classifyImpact,
  matchEntities,
  computeEntityActivity,
  buildWaves,
  classifyTopics,
  isValidatedMention,
  TOPICS,
} from './lib/signals.mjs';
import { computeReturns, correlationPairs, relativeVolume, average, direction, dailyChange, DAILY_CHANGE_REVIEW_PCT } from './lib/stocks.mjs';
import { toCompactEvent, mergeTodayEvents, dayKey, buildRangesDoc, HISTORY_RETENTION_DAYS } from './lib/history.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'latest.json');
const RANGES_PATH = path.join(DATA_DIR, 'range.json');
const STOCKNET_PATH = path.join(DATA_DIR, 'stock-network.json');
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

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    const title = tag(block, 'title');
    let link = tag(block, 'link');
    if (!link) link = attr(block, 'link', 'href');
    if (!link) {
      const m = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (m) link = m[1];
    }
    const dateStr = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    // media:description is the video summary in YouTube Atom feeds
    const desc = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content') || tag(block, 'media:description');
    const date = dateStr ? new Date(dateStr) : new Date();
    if (!title || !link) continue;
    items.push({
      title: title.trim(),
      link: link.trim(),
      desc: desc.slice(0, 400),
      date: isNaN(date.getTime()) ? new Date() : date,
      sourceName: source.name,
      feedLogoKey: source.logoKey,
      isVideo: !!source.isVideo,
    });
  }
  return items;
}

async function fetchFeed(source) {
  try {
    const res = await fetchWithTimeout(source.url);
    if (!res.ok) {
      console.error(`[feed] ${source.name}: HTTP ${res.status}`);
      return [];
    }
    let items = parseFeed(await res.text(), source);
    // Video channels post far more than releases — keep only uploads that name a
    // lab AND read as a product release, so the general stream stays clean.
    if (source.isVideo) {
      items = items.filter((it) => detectLab(`${it.title} ${it.desc}`) && isProductRelease(it.title, it.desc));
    }
    return items;
  } catch (err) {
    console.error(`[feed] ${source.name}: ${err.message}`);
    return [];
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

function detectLab(text) {
  for (const [key, re] of Object.entries(LAB_KEYWORDS)) if (re.test(text)) return key;
  return null;
}
function shortDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase().replace(',', '');
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
const COMMUNITY_MODELS = [
  { key: 'gpt', model: 'GPT', version: 'GPT-5.5', org: 'OpenAI', q: 'ChatGPT' },
  { key: 'claude', model: 'Claude', version: 'Claude Opus 4.8', org: 'Anthropic', q: 'Claude' },
  { key: 'gemini', model: 'Gemini', version: 'Gemini 3.1 Pro', org: 'Google', q: 'Gemini' },
  { key: 'grok', model: 'Grok', version: 'Grok 4', org: 'xAI', q: 'Grok' },
  { key: 'llama', model: 'Llama', version: 'Llama 4', org: 'Meta', q: 'Llama' },
  { key: 'deepseek', model: 'DeepSeek', version: 'DeepSeek V3.2', org: 'DeepSeek', q: 'DeepSeek' },
  { key: 'qwen', model: 'Qwen', version: 'Qwen 3.7', org: 'Alibaba', q: 'Qwen' },
];

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

const COMMUNITY_LIMITED_MIN = 8; // fewer than this validated discussions → "limited sample"

async function fetchModelCommunity(m, now, usedCommentIds) {
  const since = Math.floor(now / 1000) - 30 * 24 * 3600; // last 30 days
  const base = 'https://hn.algolia.com/api/v1/search';
  const model = {
    key: m.key, model: m.model, version: m.version, org: m.org,
    rawHits: 0, validatedMentions: 0, validatedDiscussions: 0, limited: true,
    points: 0, themes: [], topThreads: [],
  };
  const comments = [];
  try {
    const [storiesRes, commentsRes] = await Promise.all([
      fetchWithTimeout(`${base}?query=${encodeURIComponent(m.q)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=40`),
      fetchWithTimeout(`${base}?query=${encodeURIComponent(m.q)}&tags=comment&numericFilters=created_at_i>${since}&hitsPerPage=80`),
    ]);

    // ---- stories: validate each, estimate validated discussion volume ----
    let storyRatio = 0;
    if (storiesRes.ok) {
      const sj = await storiesRes.json();
      const hits = (sj.hits || []).filter((h) => h.title);
      const validated = hits.filter((h) => isValidatedMention(`${h.title} ${h.story_text || ''}`, m.key));
      storyRatio = hits.length ? validated.length / hits.length : 0;
      // validated unique discussions = raw story hits scaled by the validated
      // fraction of the sample (never exceeds raw hits).
      model.validatedDiscussions = Math.round((sj.nbHits || hits.length) * storyRatio);
      model.points = validated.reduce((s, h) => s + (h.points || 0), 0);
      model.topThreads = validated.slice().sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 2)
        .map((h) => ({ title: truncate(h.title, 90), points: h.points || 0, comments: h.num_comments || 0, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, date: shortDate(new Date((h.created_at_i || 0) * 1000)) }));
    }

    // ---- comments: validate, theme-tag validated ones, pick representatives ----
    if (commentsRes.ok) {
      const cj = await commentsRes.json();
      const raw = (cj.hits || []).filter((h) => h.comment_text);
      model.rawHits = cj.nbHits || raw.length;
      const decoded = raw.map((h) => ({ h, text: decodeEntities(h.comment_text) }));
      const validated = decoded.filter((c) => isValidatedMention(c.text, m.key));
      const commentRatio = decoded.length ? validated.length / decoded.length : 0;
      model.validatedMentions = Math.round(model.rawHits * commentRatio);

      const themeCounts = {};
      for (const c of validated) {
        for (const tid of classifyTopics(c.text)) themeCounts[tid] = (themeCounts[tid] || 0) + 1;
      }
      model.themes = TOPICS.filter((t) => themeCounts[t.id]).map((t) => ({ id: t.id, label: t.label, count: themeCounts[t.id] })).sort((a, b) => b.count - a.count);

      // representative comments: validated only, one per distinct theme, most
      // substantive first, globally de-duplicated so an excerpt never repeats
      // across model bubbles.
      const usedThemes = new Set();
      const candidates = validated
        .map((c) => ({ ...c, topics: classifyTopics(c.text), len: c.text.length }))
        .filter((c) => c.topics.length && c.len > 120 && !usedCommentIds.has(c.h.objectID))
        .sort((a, b) => (b.h.points || 0) - (a.h.points || 0) || b.len - a.len);
      for (const c of candidates) {
        const theme = c.topics.find((t) => !usedThemes.has(t));
        if (!theme) continue;
        usedThemes.add(theme);
        usedCommentIds.add(c.h.objectID);
        comments.push({
          modelId: m.key, theme,
          excerpt: sanitizeExcerpt(c.h.comment_text, 180, m.q),
          source: 'Hacker News', author: c.h.author || 'anon',
          publishedAt: new Date((c.h.created_at_i || 0) * 1000).toISOString(),
          url: `https://news.ycombinator.com/item?id=${c.h.objectID}`,
        });
        if (comments.length >= 4) break;
      }
    }
    model.limited = model.validatedDiscussions < COMMUNITY_LIMITED_MIN;
  } catch (err) {
    console.error(`[community] ${m.key}: ${err.message}`);
  }
  return { model, comments };
}

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

    // build a date-sorted [{date, close, volume}] series (skip null bars)
    const ts = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const vols = result.indicators?.quote?.[0]?.volume || [];
    const series = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] == null) continue;
      series.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: closes[i], volume: vols[i] ?? null });
    }

    // Daily change from the last two valid bars (NOT the 3-month range start).
    const dc = dailyChange(series, m.regularMarketPrice);
    if (dc.review) console.warn(`[stock] ${meta.t}: daily change ${dc.changePct.toFixed(1)}% exceeds ±${DAILY_CHANGE_REVIEW_PCT}% — flagged for review`);
    const price = m.regularMarketPrice;

    return {
      t: meta.t, n: m.longName || m.shortName || meta.n, layer: meta.layer, signal: meta.signal,
      price, changePct: dc.changePct, changeReview: dc.review, url: `https://finance.yahoo.com/quote/${meta.t}`,
      volume: m.regularMarketVolume ?? (series.length ? series[series.length - 1].volume : null),
      series,
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
    return {
      t: q.t, n: q.n, layer: q.layer, netLayer: meta.netLayer ?? 2, url: q.url, signal: q.signal,
      price: q.price, changePct: q.changePct, changeReview: !!q.changeReview, direction: direction(q.changePct),
      marketCap, volume: q.volume ?? null,
      dollarVolume: q.volume != null && q.price != null ? q.volume * q.price : null,
      avg20Volume: avg20, relVolume: relVol,
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

async function main() {
  const now = Date.now();
  const entities = JSON.parse(await readFile(ENTITIES_PATH, 'utf-8'));
  const nodes = entities.nodes;

  console.log('Fetching RSS feeds…');
  const feedResults = await Promise.all(FEEDS.map(fetchFeed));
  const allItems = feedResults.flat();
  console.log(`Fetched ${allItems.length} items from ${FEEDS.length} feeds.`);

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
  for (const it of merged) {
    it.significance = scoreSignificance(it, nodes, now);
    it.impact = classifyImpact(it.significance);
    it.verification = classifyVerification(it);
    it.entityIds = matchEntities(`${it.title} ${it.desc}`, nodes).ids;
    it.clusterId = stableId(it.link);
  }

  // 4) unified signal stream — the spine of the hero/waves/river.
  const signals = merged
    .map((it) => ({
      id: it.link, clusterId: it.clusterId, title: it.title, desc: it.desc, url: it.link,
      dateISO: new Date(it.date).toISOString(), date: shortDate(it.date),
      category: it.category, catConfidence: it.catConfidence, family: waveFamily(it.category),
      significance: it.significance, impact: it.impact, verification: it.verification,
      sourceCount: it.sourceCount, sources: it.sources.map((s) => ({ name: s.sourceName, url: s.link })),
      sourceName: it.sourceName, entityIds: it.entityIds,
    }))
    .sort((a, b) => b.significance - a.significance);

  // 5) derive the existing detailed sections from the same merged stream —
  //    every section reads the same underlying clusters, so a story never
  //    appears in one place miscategorized relative to another.
  const releasesByLab = {};
  const feedRows = [];
  const breakthroughs = [];
  const wire = [];
  for (const it of merged) {
    const lab = detectLab(`${it.title} ${it.desc}`);
    if (lab && isProductRelease(it.title, it.desc)) { (releasesByLab[lab] ||= []).push(it); continue; }
    if (it.category === 'opensource') { feedRows.push(it); continue; }
    if (it.category === 'research') { breakthroughs.push(it); continue; }
    wire.push({ ...it, lab });
  }

  const releases = Object.entries(releasesByLab)
    .filter(([, l]) => l.length)
    // every lab with a qualifying release today gets a card — a big multi-lab
    // release day should never get truncated to an arbitrary top-3
    .map(([lab, list]) => {
      const top = list[0];
      return {
        lab: LAB_NAMES[lab] || lab, logoKey: lab, date: shortDate(top.date),
        h: truncate(top.title, 90), p: truncate(top.desc, 220) || top.title,
        items: list.slice(0, 3).map((it) => ({ n: truncate(it.title, 50), d: shortDate(it.date), note: it.sourceName })),
        url: top.link, sourceName: top.sourceName, sourceCount: top.sourceCount,
        verification: top.verification, impact: top.impact,
      };
    });

  const wireCards = wire.slice(0, 8).map((it) => ({
    org: it.lab ? COMPANY_TAG[it.lab] : 'AI WIRE', logoKey: it.lab || 'other', date: shortDate(it.date),
    verification: it.verification, impact: it.impact,
    h: truncate(it.title, 80), p: truncate(it.desc, 260) || it.title, url: it.link,
    sourceName: it.sourceName, sourceCount: it.sourceCount,
  }));

  const feed = feedRows.slice(0, 8).map((it) => {
    const { lic, licClass } = detectLicense(`${it.title} ${it.desc}`);
    return {
      name: truncate(it.title, 60), org: it.sourceName, date: shortDate(it.date), lic, licClass,
      desc: truncate(it.desc, 140) || 'Open-weight coverage — confirm exact license on the model card.',
      url: it.link, sourceName: it.sourceName, verification: it.verification, impact: it.impact,
    };
  });

  const brk = breakthroughs.slice(0, 6).map((it) => ({
    field: inferField(`${it.title} ${it.desc}`), date: shortDate(it.date),
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
  // the latest.json table keeps compact per-stock fields (no history series) but
  // gains relVolume + marketCap so the "View as table" fallback is self-sufficient
  const netByTicker = Object.fromEntries(stockNetwork.nodes.map((n) => [n.t, n]));
  const stocks = quotes.map(({ series, ...rest }) => ({
    ...rest,
    relVolume: netByTicker[rest.t]?.relVolume ?? null,
    marketCap: netByTicker[rest.t]?.marketCap ?? null,
  }));

  console.log('Fetching community pulse…');
  // shared across models so a comment excerpt is never reused between bubbles
  const usedCommentIds = new Set();
  const communityResults = [];
  for (const cm of COMMUNITY_MODELS) communityResults.push(await fetchModelCommunity(cm, now, usedCommentIds));
  const community = {
    updatedAt: new Date(now).toISOString(),
    window: '30D',
    source: 'Hacker News',
    models: communityResults.map((r) => r.model),
    comments: communityResults.flatMap((r) => r.comments),
  };

  const data = {
    updatedAt: new Date().toISOString(),
    ticker,
    signals: signals.slice(0, 40),
    waves,
    entityActivity,
    releases,
    wire: wireCards,
    feed,
    breakthroughs: brk,
    stocks,
    community,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);
  await writeFile(STOCKNET_PATH, JSON.stringify(stockNetwork, null, 2), 'utf-8');
  console.log(`Wrote ${STOCKNET_PATH} (${stockNetwork.nodes.length} nodes, ${stockNetwork.correlations.length} correlations >= 0.5)`);

  await writeEventHistoryAndRanges(signals, nodes, now);

  console.log(`  signals: ${signals.length}, waves: ${waves.length}, releases: ${releases.length}, wire: ${wireCards.length}, feed: ${feed.length}, breakthroughs: ${brk.length}, stocks: ${stocks.length}, community: ${community.models.length} models / ${community.comments.length} comments, correlations: ${stockNetwork.correlations.length}`);
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
