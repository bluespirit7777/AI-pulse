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

  for (const key of ['ticker', 'signals', 'waves', 'releases', 'wire', 'feed', 'breakthroughs', 'stocks']) {
    if (!isArr(data[key])) fail(`${key} must be an array`);
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
  });

  // entityActivity keys must be known entity ids
  for (const id of Object.keys(data.entityActivity || {})) {
    if (!entityIds.has(id)) fail(`entityActivity has unknown entity id: ${id}`);
  }

  // stocks
  (data.stocks || []).forEach((s, i) => {
    if (!isStr(s.t)) fail(`stocks[${i}].t missing`);
    if (!isStr(s.url)) fail(`stocks[${i}].url missing`);
    if (s.price != null && !isNum(s.price)) fail(`stocks[${i}].price must be number or null`);
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

  // community (object: { window, models[], comments[] })
  if (data.community != null) {
    const c = data.community;
    if (!isArr(c.models)) fail('community.models must be an array');
    if (!isArr(c.comments)) fail('community.comments must be an array');
    const modelIds = new Set((c.models || []).map((m) => m.key));
    (c.models || []).forEach((m, i) => {
      if (!isStr(m.key)) fail(`community.models[${i}].key missing`);
      if (!isNum(m.mentionCount) || m.mentionCount < 0) fail(`community.models[${i}].mentionCount invalid`);
      if (!isArr(m.themes)) fail(`community.models[${i}].themes must be an array`);
    });
    (c.comments || []).forEach((cm, i) => {
      if (!modelIds.has(cm.modelId)) fail(`community.comments[${i}].modelId unknown: ${cm.modelId}`);
      if (!isStr(cm.excerpt)) fail(`community.comments[${i}].excerpt missing`);
      if (cm.excerpt && cm.excerpt.length > 200) fail(`community.comments[${i}].excerpt too long (${cm.excerpt.length})`);
      if (/<[a-z]/i.test(cm.excerpt || '')) fail(`community.comments[${i}].excerpt contains unsanitised HTML`);
      if (!isStr(cm.url)) fail(`community.comments[${i}].url missing`);
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

  if (errors.length) {
    console.error(`✗ validate.mjs: ${errors.length} problem(s):`);
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log(`✓ validate.mjs: latest.json OK (${data.signals.length} signals, ${data.waves.length} waves, ${data.stocks.length} stocks); range.json OK (${ranges.historyDepthDays}d history); stock-network.json OK (${net.nodes.length} nodes, ${net.correlations.length} correlations)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
