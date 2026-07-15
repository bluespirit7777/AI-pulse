#!/usr/bin/env node
// Schema + sanity gate for data/latest.json and data/range.json. Runs in CI
// after the fetch and BEFORE the commit, so malformed data never reaches the
// deployed site. Exits non-zero (fails the job) on any violation.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from './lib/signals.mjs';
import { RANGE_HOURS } from './lib/history.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const errors = [];
const fail = (m) => errors.push(m);

function isArr(v) { return Array.isArray(v); }
function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function isStr(v) { return typeof v === 'string' && v.length > 0; }

const VERIFICATION_VALUES = ['official', 'corroborated', 'single', 'analysis', 'uncertain'];
const IMPACT_VALUES = ['high', 'notable', 'emerging'];

async function main() {
  const raw = await readFile(path.join(DATA_DIR, 'latest.json'), 'utf-8');
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error('latest.json is not valid JSON:', e.message); process.exit(1); }

  const entities = JSON.parse(await readFile(path.join(DATA_DIR, 'entities.json'), 'utf-8'));
  const entityIds = new Set(entities.nodes.map((n) => n.id));

  if (!isStr(data.updatedAt) || isNaN(Date.parse(data.updatedAt))) fail('updatedAt missing/invalid');

  // build provenance (R10)
  if (!data.build || typeof data.build !== 'object') fail('build metadata missing');
  else {
    if (!isStr(data.build.shortSha)) fail('build.shortSha missing');
    if (!isStr(data.build.builtAt) || isNaN(Date.parse(data.build.builtAt))) fail('build.builtAt missing/invalid');
  }

  // Data Health summary — a compact, honest snapshot of the pipeline's own
  // completeness (feed success rate, coverage, history depth), separate from
  // the content itself.
  if (!data.dataHealth || typeof data.dataHealth !== 'object') fail('dataHealth missing');
  else {
    const h = data.dataHealth;
    for (const f of ['feedsSucceeded', 'feedsConfigured', 'stockNodesAvailable', 'communityModelsAvailable', 'historyDepthDays', 'estimatedDatasets']) {
      if (!isNum(h[f]) || h[f] < 0) fail(`dataHealth.${f} invalid`);
    }
    if (h.feedsSucceeded > h.feedsConfigured) fail('dataHealth.feedsSucceeded exceeds feedsConfigured');
    if (h.estimatedDatasets > h.communityModelsAvailable) fail('dataHealth.estimatedDatasets exceeds communityModelsAvailable');
    if (!isStr(h.buildSha)) fail('dataHealth.buildSha missing');
    if (!isStr(h.lastSuccessfulUpdate) || isNaN(Date.parse(h.lastSuccessfulUpdate))) fail('dataHealth.lastSuccessfulUpdate missing/invalid');
  }

  for (const key of ['ticker', 'signals', 'waves', 'releases', 'wire', 'feed', 'breakthroughs', 'stocks']) {
    if (!isArr(data[key])) fail(`${key} must be an array`);
  }

  // releases: exactly 3 fixed brand cards (Claude/ChatGPT/Gemini), always
  // present even with zero qualifying releases; each item needs its own link.
  const RELEASE_LABS = ['anthropic', 'openai', 'google'];
  if (isArr(data.releases)) {
    if (data.releases.length !== RELEASE_LABS.length) fail(`releases must have exactly ${RELEASE_LABS.length} brand cards, got ${data.releases.length}`);
    const seenLabs = new Set();
    data.releases.forEach((r, i) => {
      if (!RELEASE_LABS.includes(r.logoKey)) fail(`releases[${i}].logoKey unexpected: ${r.logoKey}`);
      if (seenLabs.has(r.logoKey)) fail(`releases[${i}].logoKey duplicated: ${r.logoKey}`);
      seenLabs.add(r.logoKey);
      if (!isArr(r.items)) fail(`releases[${i}].items must be an array`);
      if (r.items && r.items.length > 5) fail(`releases[${i}].items must be <= 5`);
      (r.items || []).forEach((it, j) => {
        if (!isStr(it.h)) fail(`releases[${i}].items[${j}].h missing`);
        if (!isStr(it.url)) fail(`releases[${i}].items[${j}].url missing`);
      });
    });
    for (const lab of RELEASE_LABS) if (!seenLabs.has(lab)) fail(`releases is missing the fixed brand: ${lab}`);
  }

  // signals
  (data.signals || []).forEach((s, i) => {
    if (!isStr(s.title)) fail(`signals[${i}].title missing`);
    if (!isStr(s.url)) fail(`signals[${i}].url missing`);
    if (!isStr(s.clusterId)) fail(`signals[${i}].clusterId missing`);
    if (!isNum(s.significance) || s.significance < 0 || s.significance > 100) fail(`signals[${i}].significance out of range`);
    if (!CATEGORIES.includes(s.category)) fail(`signals[${i}].category invalid: ${s.category}`);
    if (!IMPACT_VALUES.includes(s.impact)) fail(`signals[${i}].impact invalid: ${s.impact}`);
    if (!VERIFICATION_VALUES.includes(s.verification)) fail(`signals[${i}].verification invalid: ${s.verification}`);
    if (!isNum(s.sourceCount) || s.sourceCount < 1) fail(`signals[${i}].sourceCount invalid`);
    if (isNaN(Date.parse(s.dateISO))) fail(`signals[${i}].dateISO invalid`);
    if (!isArr(s.entityIds)) fail(`signals[${i}].entityIds must be an array`);
    for (const id of s.entityIds || []) if (!entityIds.has(id)) fail(`signals[${i}].entityIds has unknown id: ${id}`);
  });

  // waves
  if (data.waves.length > 3) fail('waves must be <= 3');
  const fams = new Set();
  data.waves.forEach((w, i) => {
    if (!['product', 'market', 'research'].includes(w.family)) fail(`waves[${i}].family invalid`);
    if (fams.has(w.family)) fail(`waves duplicate family ${w.family}`);
    fams.add(w.family);
    if (!isStr(w.title)) fail(`waves[${i}].title missing`);
    if (!isStr(w.url)) fail(`waves[${i}].url missing`);
    if (!isNum(w.significance)) fail(`waves[${i}].significance invalid`);
    if (!IMPACT_VALUES.includes(w.impact)) fail(`waves[${i}].impact invalid: ${w.impact}`);
    if (!VERIFICATION_VALUES.includes(w.verification)) fail(`waves[${i}].verification invalid: ${w.verification}`);
    // R5: "why it matters" must be a real consequence sentence, not scoring leakage
    if (!isStr(w.whyItMatters) || w.whyItMatters.length < 20) fail(`waves[${i}].whyItMatters missing/too short`);
    if (/impact score|source count|significance|strongest .* move/i.test(w.whyItMatters || '')) {
      fail(`waves[${i}].whyItMatters leaks scoring methodology instead of a consequence`);
    }
  });

  // entityActivity keys must be known entity ids
  for (const id of Object.keys(data.entityActivity || {})) {
    if (!entityIds.has(id)) fail(`entityActivity has unknown entity id: ${id}`);
  }

  // stocks — daily change must be sane (the AMD +128% bug guard): an absurd
  // |change| is only allowed if it was explicitly flagged for review.
  (data.stocks || []).forEach((s, i) => {
    if (!isStr(s.t)) fail(`stocks[${i}].t missing`);
    if (!isStr(s.url)) fail(`stocks[${i}].url missing`);
    if (s.price != null && !isNum(s.price)) fail(`stocks[${i}].price must be number or null`);
    const chg = s.changePct != null ? s.changePct : s.change;
    if (chg != null) {
      if (!isNum(chg)) fail(`stocks[${i}].changePct must be number or null`);
      else if (Math.abs(chg) > 25 && !s.changeReview) {
        fail(`stocks[${i}] (${s.t}) daily change ${chg.toFixed(1)}% is absurd and not flagged for review — likely a stale-baseline bug`);
      }
    }
  });

  // compute pricing — live from Vast.ai + RunPod, not the old curated array.
  // An empty array (both marketplace fetches failed) is valid — the honest
  // "unavailable" empty state — but every row present must be a real range.
  const TREND_CLASSES = ['trend-up', 'trend-down', 'trend-flat', 'trend-new'];
  (data.compute || []).forEach((c, i) => {
    if (!isStr(c.chip)) fail(`compute[${i}].chip missing`);
    if (!isStr(c.segment)) fail(`compute[${i}].segment missing`);
    if (!isStr(c.rate) || !/^\$\d/.test(c.rate)) fail(`compute[${i}].rate missing/invalid: ${c.rate}`);
    if (!TREND_CLASSES.includes(c.trendClass)) fail(`compute[${i}].trendClass invalid: ${c.trendClass}`);
    if (!isStr(c.note)) fail(`compute[${i}].note missing`);
  });

  // range.json
  let ranges;
  try {
    ranges = JSON.parse(await readFile(path.join(DATA_DIR, 'range.json'), 'utf-8'));
  } catch (e) {
    fail(`range.json missing or invalid: ${e.message}`);
  }
  if (ranges) {
    if (!isStr(ranges.generatedAt) || isNaN(Date.parse(ranges.generatedAt))) fail('range.json: generatedAt missing/invalid');
    if (!isNum(ranges.historyDepthDays) || ranges.historyDepthDays < 0) fail('range.json: historyDepthDays invalid');
    for (const key of Object.keys(RANGE_HOURS)) {
      const r = ranges.ranges?.[key];
      if (!r) { fail(`range.json: ranges.${key} missing`); continue; }
      if (typeof r.entityActivity !== 'object') fail(`range.json: ranges.${key}.entityActivity must be an object`);
      if (typeof r.previousWindowComplete !== 'boolean') fail(`range.json: ranges.${key}.previousWindowComplete must be boolean`);
      if (r.previousWindowComplete === false && Object.keys(r.entityDelta || {}).length > 0) {
        fail(`range.json: ranges.${key} has entityDelta despite incomplete previous window — must not fabricate a delta`);
      }
      if (!isArr(r.topEntities)) fail(`range.json: ranges.${key}.topEntities must be an array`);
    }
    if (!isArr(ranges.dailyCategoryHistory)) fail('range.json: dailyCategoryHistory must be an array');
    if (ranges.dailyCategoryHistory && ranges.dailyCategoryHistory.length > Math.ceil(ranges.historyDepthDays) + 1) {
      fail('range.json: dailyCategoryHistory has more days than historyDepthDays claims — implies data before collection began');
    }
  }

  // community (object: { window, models[], comments[] }) — validated matching
  if (data.community != null) {
    const c = data.community;
    if (!isArr(c.models)) fail('community.models must be an array');
    if (!isArr(c.comments)) fail('community.comments must be an array');
    const modelIds = new Set((c.models || []).map((m) => m.key));
    (c.models || []).forEach((m, i) => {
      if (!isStr(m.key)) fail(`community.models[${i}].key missing`);
      // explicit coverage/estimation fields — see docs/METHODOLOGY.md. A story
      // count is only ever "exact" (isEstimated === false) when storyCoverage
      // reached 1 (every raw hit was actually fetched and validated).
      for (const f of [
        'rawStoryHits', 'fetchedStoryCount', 'validatedStoryCount', 'storyCoverage', 'estimatedRelevantDiscussions',
        'rawCommentHits', 'fetchedCommentCount', 'validatedCommentCount', 'commentCoverage',
      ]) {
        if (!isNum(m[f]) || m[f] < 0) fail(`community.models[${i}].${f} invalid`);
      }
      if (typeof m.isEstimated !== 'boolean') fail(`community.models[${i}].isEstimated must be boolean`);
      // validated is filtered FROM fetched in-process, so this can never drift —
      // a real logic bug, not an external-data quirk, unlike the raw-hit checks below.
      if (m.validatedStoryCount > m.fetchedStoryCount) fail(`community.models[${i}].validatedStoryCount exceeds fetchedStoryCount`);
      if (m.validatedCommentCount > m.fetchedCommentCount) fail(`community.models[${i}].validatedCommentCount exceeds fetchedCommentCount`);
      // NOTE: deliberately NOT asserting fetchedCount <= rawHits here. HN
      // Algolia's nbHits is an approximate, eventually-consistent count that
      // can legitimately shift between paginated requests as the live index
      // updates mid-fetch (a real CI failure caught this: fetchedStoryCount
      // briefly exceeded rawStoryHits on a live run). update-data.mjs already
      // takes the max nbHits seen across pages to keep this rare, but Algolia's
      // count is external and approximate by design — not something this
      // pipeline can guarantee an exact ordering against, so it isn't a data-
      // integrity violation the way validated > fetched would be.
      if (m.storyCoverage > 1) fail(`community.models[${i}].storyCoverage cannot exceed 1`);
      if (m.commentCoverage > 1) fail(`community.models[${i}].commentCoverage cannot exceed 1`);
      // an exact (non-estimated) count is only honest when coverage is complete
      if (m.isEstimated === false && m.storyCoverage < 1) fail(`community.models[${i}] claims an exact count with incomplete storyCoverage`);
      if (typeof m.limited !== 'boolean') fail(`community.models[${i}].limited must be boolean`);
      if (!isArr(m.themes)) fail(`community.models[${i}].themes must be an array`);
    });
    // representative comments must be relevant, sanitised, and globally unique
    const seenComment = new Set();
    (c.comments || []).forEach((cm, i) => {
      if (!modelIds.has(cm.modelId)) fail(`community.comments[${i}].modelId unknown: ${cm.modelId}`);
      if (!isStr(cm.excerpt)) fail(`community.comments[${i}].excerpt missing`);
      if (cm.excerpt && cm.excerpt.length > 200) fail(`community.comments[${i}].excerpt too long (${cm.excerpt.length})`);
      if (/<[a-z]/i.test(cm.excerpt || '')) fail(`community.comments[${i}].excerpt contains unsanitised HTML`);
      if (!isStr(cm.url)) fail(`community.comments[${i}].url missing`);
      if (!isArr(cm.themes) || !cm.themes.length) fail(`community.comments[${i}].themes must be a non-empty array`);
      if (cm.themes && cm.themes.length > 2) fail(`community.comments[${i}].themes has more than 2 entries (up to 2 allowed)`);
      // no excerpt reused across models/themes (would imply a comment counted twice)
      if (cm.url) { if (seenComment.has(cm.url)) fail(`community.comments[${i}] reuses url ${cm.url}`); seenComment.add(cm.url); }
    });
  }

  // stock-network.json
  let net;
  try {
    net = JSON.parse(await readFile(path.join(DATA_DIR, 'stock-network.json'), 'utf-8'));
  } catch (e) {
    fail(`stock-network.json missing or invalid: ${e.message}`);
  }
  if (net) {
    if (!isArr(net.nodes) || net.nodes.length === 0) fail('stock-network.json: nodes missing/empty');
    if (!isArr(net.correlations)) fail('stock-network.json: correlations must be an array');
    if (!isArr(net.relationships)) fail('stock-network.json: relationships must be an array');
    const tickers = new Set((net.nodes || []).map((n) => n.t));
    (net.nodes || []).forEach((n, i) => {
      if (!isStr(n.t)) fail(`stock-network node[${i}].t missing`);
      if (![1, 2, 3, 4].includes(n.netLayer)) fail(`stock-network node[${i}].netLayer invalid`);
      if (n.marketCap != null && !isNum(n.marketCap)) fail(`stock-network node[${i}].marketCap must be number or null`);
      if (n.relVolume != null && !isNum(n.relVolume)) fail(`stock-network node[${i}].relVolume must be number or null`);
      if (!['up', 'down', 'flat'].includes(n.direction)) fail(`stock-network node[${i}].direction invalid`);
      if (n.weekChangePct != null && !isNum(n.weekChangePct)) fail(`stock-network node[${i}].weekChangePct must be number or null`);
      if (n.monthChangePct != null && !isNum(n.monthChangePct)) fail(`stock-network node[${i}].monthChangePct must be number or null`);
      // native candlestick chart series — an empty array is valid (the drawer
      // shows an honest "no history" state), but every present bar must be a
      // real OHLC quad with low <= high
      if (n.chart != null) {
        if (!isArr(n.chart)) fail(`stock-network node[${i}].chart must be an array`);
        else n.chart.forEach((c, j) => {
          for (const f of ['o', 'h', 'l', 'c']) if (!isNum(c[f])) fail(`stock-network node[${i}].chart[${j}].${f} invalid`);
          if (isNum(c.l) && isNum(c.h) && c.l > c.h) fail(`stock-network node[${i}].chart[${j}] has low > high`);
        });
      }
    });
    (net.correlations || []).forEach((c, i) => {
      if (!tickers.has(c.a) || !tickers.has(c.b)) fail(`stock-network correlation[${i}] references unknown ticker`);
      if (!isNum(c.r) || Math.abs(c.r) < (net.correlationThreshold ?? 0.5) - 1e-9) fail(`stock-network correlation[${i}].r below threshold (must be pre-filtered)`);
      if (!isNum(c.n) || c.n !== (net.correlationWindow ?? 30)) fail(`stock-network correlation[${i}].n must equal the ${net.correlationWindow ?? 30}-day window`);
    });
    (net.relationships || []).forEach((r, i) => {
      if (!tickers.has(r.from) || !tickers.has(r.to)) fail(`stock-network relationship[${i}] references unknown ticker`);
      if (!['depends', 'partner', 'competes'].includes(r.type)) fail(`stock-network relationship[${i}].type invalid`);
    });
  }

  // data/youtube-trending.json — OPTIONAL (genuinely absent on a fresh
  // checkout before YOUTUBE_API_KEY is configured, or before its first
  // 12-hour cron run), so a missing file is not a failure. If it exists,
  // its contents must be well-formed.
  let yt;
  try {
    yt = JSON.parse(await readFile(path.join(DATA_DIR, 'youtube-trending.json'), 'utf-8'));
  } catch (e) {
    if (e.code !== 'ENOENT') fail(`youtube-trending.json present but invalid: ${e.message}`);
  }
  let ytVideoCount = 0;
  if (yt) {
    if (!isStr(yt.updatedAt) || isNaN(Date.parse(yt.updatedAt))) fail('youtube-trending.json: updatedAt missing/invalid');
    if (!yt.models || typeof yt.models !== 'object') fail('youtube-trending.json: models missing');
    else {
      for (const [key, entry] of Object.entries(yt.models)) {
        if (!entry || typeof entry !== 'object') { fail(`youtube-trending.json models.${key} malformed`); continue; }
        if (!isStr(entry.query)) fail(`youtube-trending.json models.${key}.query missing`);
        if (!isArr(entry.videos)) { fail(`youtube-trending.json models.${key}.videos must be an array`); continue; }
        if (entry.videos.length > 5) fail(`youtube-trending.json models.${key}.videos has more than 5 entries`);
        ytVideoCount += entry.videos.length;
        entry.videos.forEach((v, i) => {
          if (!isStr(v.videoId)) fail(`youtube-trending.json models.${key}.videos[${i}].videoId missing`);
          if (!isStr(v.title)) fail(`youtube-trending.json models.${key}.videos[${i}].title missing`);
          if (!isStr(v.url) || !v.url.includes(v.videoId || '\0')) fail(`youtube-trending.json models.${key}.videos[${i}].url missing/inconsistent`);
          if (v.viewCount != null && (!isNum(v.viewCount) || v.viewCount < 0)) fail(`youtube-trending.json models.${key}.videos[${i}].viewCount must be a non-negative number or null`);
          if (!isStr(v.publishedAt) || isNaN(Date.parse(v.publishedAt))) fail(`youtube-trending.json models.${key}.videos[${i}].publishedAt missing/invalid`);
        });
        // videos must actually be sorted by view count — the whole point of
        // the "top viewed" claim shown on the card
        for (let i = 1; i < entry.videos.length; i++) {
          const prev = entry.videos[i - 1].viewCount, cur = entry.videos[i].viewCount;
          if (prev != null && cur != null && cur > prev) fail(`youtube-trending.json models.${key}.videos not sorted by viewCount descending`);
        }
      }
    }
  }

  if (errors.length) {
    console.error(`✗ validate.mjs: ${errors.length} problem(s):`);
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log(`✓ validate.mjs: latest.json OK (${data.signals.length} signals, ${data.waves.length} waves, ${data.stocks.length} stocks); range.json OK (${ranges.historyDepthDays}d history); stock-network.json OK (${net.nodes.length} nodes, ${net.correlations.length} correlations)${yt ? `; youtube-trending.json OK (${ytVideoCount} videos)` : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
