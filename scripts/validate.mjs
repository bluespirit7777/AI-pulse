#!/usr/bin/env node
// Schema + sanity gate for data/latest.json. Runs in CI after the fetch and
// BEFORE the commit, so malformed data never reaches the deployed site.
// Exits non-zero (fails the job) on any violation.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from './lib/signals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const errors = [];
const fail = (m) => errors.push(m);

function isArr(v) { return Array.isArray(v); }
function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function isStr(v) { return typeof v === 'string' && v.length > 0; }

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
    if (!isNum(s.significance) || s.significance < 0 || s.significance > 100) fail(`signals[${i}].significance out of range`);
    if (!CATEGORIES.includes(s.category)) fail(`signals[${i}].category invalid: ${s.category}`);
    if (!isNum(s.sourceCount) || s.sourceCount < 1) fail(`signals[${i}].sourceCount invalid`);
    if (isNaN(Date.parse(s.dateISO))) fail(`signals[${i}].dateISO invalid`);
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

  if (errors.length) {
    console.error(`✗ validate.mjs: ${errors.length} problem(s):`);
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log(`✓ validate.mjs: latest.json OK (${data.signals.length} signals, ${data.waves.length} waves, ${data.stocks.length} stocks)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
