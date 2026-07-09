#!/usr/bin/env node
// Pulls fresh AI-industry content from official publisher RSS feeds + free stock quotes,
// and writes data/latest.json for the site to render. No API keys required.
//
// Run: node scripts/update-data.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'latest.json');

const UA = 'Mozilla/5.0 (compatible; AIMarketPulseBot/1.0; +https://github.com/)';
const FETCH_TIMEOUT_MS = 12000;

// ---------- RSS sources (official publisher feeds only — no scraping, no ToS-restricted feeds) ----------
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

// ---------- Stocks: free, no-key Yahoo Finance chart endpoint ----------
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

const ACCENT_KEYS = ['anthropic', 'openai', 'google', 'meta', 'xai', 'policy', 'other'];

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    return res;
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
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : '';
}

function attr(block, name, attrName) {
  const re = new RegExp(`<${name}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*/?>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

// Minimal RSS 2.0 / Atom parser — good enough for <item>/<entry> title+link+date+summary.
function parseFeed(xml, source) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of itemBlocks) {
    const title = tag(block, 'title');
    let link = tag(block, 'link');
    if (!link) link = attr(block, 'link', 'href'); // Atom <link href="..."/>
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
    const xml = await res.text();
    return parseFeed(xml, source);
  } catch (err) {
    console.error(`[feed] ${source.name}: ${err.message}`);
    return [];
  }
}

// ---------- Categorization ----------
const LAB_KEYWORDS = {
  anthropic: /\b(anthropic|claude)\b/i,
  openai: /\b(openai|chatgpt|gpt-?\d)\b/i,
  google: /\b(google\s*(deepmind)?|gemini|deepmind)\b/i,
  meta: /\bmeta\b.*\b(ai|llama)\b|\bllama\s*\d/i,
  xai: /\bx\.?ai\b|\bgrok\b/i,
};

const RELEASE_RE = /\b(launch|launches|launched|release[sd]?|unveil[sed]*|introduc(e|es|ed|ing)|now available|debuts?|ships?|announc(e|es|ed))\b/i;
const OPEN_RE = /\b(open.?source|open.?weight|apache 2\.0|mit licen[cs]e|hugging ?face|weights (are|now) (public|available))\b/i;
const RESEARCH_RE = /\b(research(er)?s?|study|studies|paper|preprint|arxiv|breakthrough|discover(s|ed|y)?|findings)\b/i;
const COMPANY_TAG = { anthropic: 'ANTHROPIC', openai: 'OPENAI', google: 'GOOGLE', meta: 'META', xai: 'XAI' };

function detectLab(text) {
  for (const [key, re] of Object.entries(LAB_KEYWORDS)) {
    if (re.test(text)) return key;
  }
  return null;
}

function shortDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase().replace(',', '');
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function buildBuckets(allItems) {
  // newest first, dedupe by link
  const seen = new Set();
  const items = allItems
    .sort((a, b) => b.date - a.date)
    .filter((it) => (seen.has(it.link) ? false : (seen.add(it.link), true)));

  const releasesByLab = {};
  const local = [];
  const breakthroughs = [];
  const wire = [];

  for (const it of items) {
    const text = `${it.title} ${it.desc}`;
    const lab = detectLab(text);

    if (lab && RELEASE_RE.test(text)) {
      (releasesByLab[lab] ||= []).push(it);
      continue;
    }
    if (OPEN_RE.test(text)) {
      local.push(it);
      continue;
    }
    if (RESEARCH_RE.test(text)) {
      breakthroughs.push(it);
      continue;
    }
    wire.push({ ...it, lab });
  }

  return { releasesByLab, local, breakthroughs, wire, items };
}

function toReleaseCards(releasesByLab) {
  const labNames = { anthropic: 'Anthropic · Claude', openai: 'OpenAI · ChatGPT', google: 'Google · Gemini', meta: 'Meta · AI', xai: 'xAI · Grok' };
  const cards = [];
  for (const [lab, list] of Object.entries(releasesByLab)) {
    if (!list.length) continue;
    const top = list[0];
    cards.push({
      lab: labNames[lab] || lab,
      logoKey: lab,
      date: shortDate(top.date),
      h: truncate(top.title, 90),
      p: truncate(top.desc, 220) || top.title,
      items: list.slice(0, 3).map((it) => ({ n: truncate(it.title, 50), d: shortDate(it.date), note: it.sourceName })),
      url: top.link,
      sourceName: top.sourceName,
    });
  }
  return cards.slice(0, 3);
}

function toWireCards(wire) {
  return wire.slice(0, 8).map((it) => ({
    org: it.lab ? COMPANY_TAG[it.lab] : 'AI WIRE',
    logoKey: it.lab || 'other',
    date: shortDate(it.date),
    h: truncate(it.title, 80),
    p: truncate(it.desc, 260) || it.title,
    url: it.link,
    sourceName: it.sourceName,
  }));
}

function toFeedRows(local) {
  return local.slice(0, 8).map((it) => ({
    name: truncate(it.title, 60),
    org: it.sourceName,
    date: shortDate(it.date),
    lic: 'open',
    licClass: 'lic-open',
    desc: truncate(it.desc, 140) || 'Open-weight model coverage — check the publisher for exact license terms.',
    url: it.link,
    sourceName: it.sourceName,
  }));
}

function toBreakthroughs(list) {
  return list.slice(0, 6).map((it) => ({
    field: 'Research',
    date: shortDate(it.date),
    h: truncate(it.title, 80),
    p: truncate(it.desc, 260) || it.title,
    url: it.link,
    sourceName: it.sourceName,
  }));
}

function buildTicker(releasesByLab, wire) {
  const headlineItems = [
    ...Object.values(releasesByLab).map((l) => l[0]).filter(Boolean),
    ...wire,
  ].slice(0, 10);
  return headlineItems.map((it) => truncate(it.title, 110).toUpperCase());
}

// ---------- Stocks (Yahoo Finance chart API, no key required) ----------
async function fetchStock(meta) {
  try {
    const res = await fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${meta.t}?interval=1d&range=5d`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const m = result?.meta;
    if (!m || m.regularMarketPrice == null) throw new Error('no price data');
    const price = m.regularMarketPrice;
    const prevClose = m.chartPreviousClose ?? m.previousClose;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
    return {
      t: meta.t,
      n: m.longName || m.shortName || meta.n,
      layer: meta.layer,
      signal: meta.signal,
      price,
      changePct,
      url: `https://finance.yahoo.com/quote/${meta.t}`,
    };
  } catch (err) {
    console.error(`[stock] ${meta.t}: ${err.message}`);
    return { t: meta.t, n: meta.n, layer: meta.layer, signal: meta.signal, price: null, changePct: null, url: `https://finance.yahoo.com/quote/${meta.t}` };
  }
}

async function main() {
  console.log('Fetching RSS feeds…');
  const feedResults = await Promise.all(FEEDS.map(fetchFeed));
  const allItems = feedResults.flat();
  console.log(`Fetched ${allItems.length} items from ${FEEDS.length} feeds.`);

  const { releasesByLab, local, breakthroughs, wire } = buildBuckets(allItems);

  console.log('Fetching stock quotes…');
  const stocks = await Promise.all(STOCKS.map(fetchStock));

  const data = {
    updatedAt: new Date().toISOString(),
    ticker: buildTicker(releasesByLab, wire),
    releases: toReleaseCards(releasesByLab),
    wire: toWireCards(wire),
    feed: toFeedRows(local),
    breakthroughs: toBreakthroughs(breakthroughs),
    stocks,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  releases: ${data.releases.length}, wire: ${data.wire.length}, feed: ${data.feed.length}, breakthroughs: ${data.breakthroughs.length}, stocks: ${data.stocks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
