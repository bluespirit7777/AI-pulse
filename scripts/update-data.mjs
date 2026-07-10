#!/usr/bin/env node
// Pulls fresh AI-industry content from official publisher RSS feeds + free stock
// quotes, scores it with the shared deterministic logic in lib/signals.mjs, and
// writes data/latest.json (+ a bounded daily snapshot under data/history/).
// No API keys required.
//
// Run: node scripts/update-data.mjs

import { writeFile, mkdir, readFile } from 'node:fs/promises';
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
  confidenceTier,
  computeEntityActivity,
  buildWaves,
} from './lib/signals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'latest.json');
const ENTITIES_PATH = path.join(DATA_DIR, 'entities.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

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
];

const STOCKS = [
  { t: 'NVDA', n: 'Nvidia', layer: 'Chips', signal: 'Dominant AI GPU stack — data center is the majority of revenue' },
  { t: 'MSFT', n: 'Microsoft', layer: 'Cloud', signal: 'Azure AI + Copilot pushed across the whole product line' },
  { t: 'AVGO', n: 'Broadcom', layer: 'Chips', signal: 'Custom AI XPUs for hyperscalers plus AI networking silicon' },
  { t: 'GOOGL', n: 'Alphabet', layer: 'Cloud', signal: 'Gemini and in-house TPUs across search, cloud and devices' },
  { t: 'AMZN', n: 'Amazon', layer: 'Cloud', signal: 'Custom Trainium chips and AWS Bedrock model hosting' },
  { t: 'META', n: 'Meta', layer: 'Software', signal: 'Ad-ranking AI and in-house frontier model efforts' },
  { t: 'TSM', n: 'TSMC', layer: 'Foundry', signal: 'Manufactures advanced-node chips for Nvidia, AMD and Apple' },
  { t: 'AMD', n: 'AMD', layer: 'Chips', signal: 'Instinct GPU line chasing Nvidia’s ecosystem lead' },
  { t: 'PLTR', n: 'Palantir', layer: 'Software', signal: 'AIP platform adoption across government and enterprise' },
  { t: 'ORCL', n: 'Oracle', layer: 'Cloud', signal: 'Large-scale cloud compute deals with frontier AI labs' },
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
    const desc = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content');
    const date = dateStr ? new Date(dateStr) : new Date();
    if (!title || !link) continue;
    items.push({
      title: title.trim(),
      link: link.trim(),
      desc: desc.slice(0, 400),
      date: isNaN(date.getTime()) ? new Date() : date,
      sourceName: source.name,
      feedLogoKey: source.logoKey,
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
    return parseFeed(await res.text(), source);
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

// ---------- stocks ----------
async function fetchStock(meta) {
  try {
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${meta.t}?interval=1d&range=5d`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = (await res.json())?.chart?.result?.[0];
    const m = result?.meta;
    if (!m || m.regularMarketPrice == null) throw new Error('no price data');
    const price = m.regularMarketPrice;
    const prevClose = m.chartPreviousClose ?? m.previousClose;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    return { t: meta.t, n: m.longName || m.shortName || meta.n, layer: meta.layer, signal: meta.signal, price, changePct, url: `https://finance.yahoo.com/quote/${meta.t}` };
  } catch (err) {
    console.error(`[stock] ${meta.t}: ${err.message}`);
    return { t: meta.t, n: meta.n, layer: meta.layer, signal: meta.signal, price: null, changePct: null, url: `https://finance.yahoo.com/quote/${meta.t}` };
  }
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
  //    newest first, then merge duplicate stories (preserves per-source corroboration)
  const RECENT_MS = 60 * 24 * 3.6e6; // 60 days
  const recent = allItems.filter((it) => now - new Date(it.date).getTime() <= RECENT_MS);
  const pool = recent.length >= 12 ? recent : allItems; // fallback if feeds are sparse
  pool.sort((a, b) => b.date - a.date);
  const merged = dedupeMerge(pool, 0.5);

  // 2) unified, categorized, scored signal stream — the spine of the new sections
  const signals = merged
    .map((it) => {
      const text = `${it.title} ${it.desc}`;
      const category = categorize(text);
      const item = { ...it, category };
      const significance = scoreSignificance(item, nodes, now);
      return {
        id: it.link,
        title: it.title,
        desc: it.desc,
        url: it.link,
        dateISO: new Date(it.date).toISOString(),
        date: shortDate(it.date),
        category,
        family: waveFamily(category),
        significance,
        confidence: confidenceTier(it.sourceCount),
        sourceCount: it.sourceCount,
        sources: it.sources.map((s) => ({ name: s.sourceName, url: s.link })),
        sourceName: it.sourceName,
      };
    })
    .sort((a, b) => b.significance - a.significance);

  // 3) derive the existing detailed sections from the same merged stream
  const releasesByLab = {};
  const feedRows = [];
  const breakthroughs = [];
  const wire = [];
  for (const it of merged) {
    const text = `${it.title} ${it.desc}`;
    const lab = detectLab(text);
    const cat = categorize(text);
    if (lab && isProductRelease(it.title, it.desc)) { (releasesByLab[lab] ||= []).push(it); continue; }
    if (cat === 'opensource') { feedRows.push(it); continue; }
    if (cat === 'research') { breakthroughs.push(it); continue; }
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
      };
    });

  const wireCards = wire.slice(0, 8).map((it) => ({
    org: it.lab ? COMPANY_TAG[it.lab] : 'AI WIRE', logoKey: it.lab || 'other', date: shortDate(it.date),
    h: truncate(it.title, 80), p: truncate(it.desc, 260) || it.title, url: it.link,
    sourceName: it.sourceName, sourceCount: it.sourceCount,
  }));

  const feed = feedRows.slice(0, 8).map((it) => {
    const { lic, licClass } = detectLicense(`${it.title} ${it.desc}`);
    return {
      name: truncate(it.title, 60), org: it.sourceName, date: shortDate(it.date), lic, licClass,
      desc: truncate(it.desc, 140) || 'Open-weight coverage — confirm exact license on the model card.',
      url: it.link, sourceName: it.sourceName,
    };
  });

  const brk = breakthroughs.slice(0, 6).map((it) => ({
    field: inferField(`${it.title} ${it.desc}`), date: shortDate(it.date),
    h: truncate(it.title, 80), p: truncate(it.desc, 260) || it.title, url: it.link,
    sourceName: it.sourceName, sourceCount: it.sourceCount,
  }));

  const ticker = signals.slice(0, 10).map((s) => truncate(s.title, 110).toUpperCase());

  // 4) live ocean-map inputs + strongest waves (all deterministic)
  const entityActivity = computeEntityActivity(signals, nodes);
  const waves = buildWaves(signals).map((w) => ({
    family: w.family, category: w.category, title: w.title, summary: truncate(w.desc, 180) || w.title,
    significance: w.significance, confidence: w.confidence, date: w.date, dateISO: w.dateISO,
    url: w.url, sourceCount: w.sourceCount, sources: w.sources,
  }));

  console.log('Fetching stock quotes…');
  const stocks = await Promise.all(STOCKS.map(fetchStock));

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
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);

  await writeDailySnapshot(data);

  console.log(`  signals: ${signals.length}, waves: ${waves.length}, releases: ${releases.length}, wire: ${wireCards.length}, feed: ${feed.length}, breakthroughs: ${brk.length}, stocks: ${stocks.length}`);
}

// One compact snapshot per UTC day (the day's last run wins — bounds growth to
// ~365 small files/year). Enough to compute 24H/7D/30D deltas without storing
// full article text historically.
async function writeDailySnapshot(data) {
  const day = data.updatedAt.slice(0, 10);
  await mkdir(HISTORY_DIR, { recursive: true });
  const snap = {
    date: day,
    updatedAt: data.updatedAt,
    signalCount: data.signals.length,
    entityActivity: data.entityActivity,
    waveTitles: data.waves.map((w) => ({ family: w.family, title: w.title })),
    stocks: data.stocks.map((s) => ({ t: s.t, price: s.price, changePct: s.changePct })),
    topSignals: data.signals.slice(0, 12).map((s) => ({ title: s.title, category: s.category, significance: s.significance })),
  };
  await writeFile(path.join(HISTORY_DIR, `${day}.json`), JSON.stringify(snap, null, 2), 'utf-8');
  console.log(`Wrote history snapshot ${day}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
