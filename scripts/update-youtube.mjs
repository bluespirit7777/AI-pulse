#!/usr/bin/env node
// Fetches the most-watched YouTube video in the trailing 7 days for Claude,
// ChatGPT and Gemini — SEPARATELY, so one model's search volume never
// crowds out another's — and writes data/youtube-trending.json. Runs on its
// own 12-hour cron (.github/workflows/update-youtube.yml), independent of
// the main 30-minute data pipeline, because it needs an API key (the only
// credentialed source in this pipeline — everything else is keyless) and a
// slower cadence to stay well under the free daily quota.
//
// Requires YOUTUBE_API_KEY in the environment. If it's not set, this exits
// cleanly (not an error) and leaves any existing data/youtube-trending.json
// untouched — the frontend already has an honest "unavailable" state for
// that. Same per-model: if one model's fetch fails, that model's PREVIOUS
// snapshot is kept rather than wiped to empty — never a fabricated result,
// but also never a needless downgrade to "no data" for what's actually a
// transient failure.
//
// Run: YOUTUBE_API_KEY=xxx node scripts/update-youtube.mjs

import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_REGISTRY } from './lib/models.mjs';
import { buildSearchUrl, buildVideosStatsUrl, buildTopVideos, daysAgoISO } from './lib/youtube.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'youtube-trending.json');
const FETCH_TIMEOUT_MS = 15000;
const WINDOW_DAYS = 7;
const MAX_RESULTS = 5;
// search.list costs the same 100 quota units regardless of maxResults, so
// pulling a bigger pool here is free — it just gives filterOutShorts()
// something left to work with instead of starving the final top-5.
const SEARCH_POOL_SIZE = 15;
const TRACKED_KEYS = ['claude', 'gpt', 'gemini']; // the 3 the user asked for — not the full registry

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchModelVideos(query, apiKey, now) {
  const searchUrl = buildSearchUrl({ query, apiKey, publishedAfter: daysAgoISO(WINDOW_DAYS, now), maxResults: SEARCH_POOL_SIZE });
  const searchRes = await fetchWithTimeout(searchUrl);
  if (!searchRes.ok) throw new Error(`search HTTP ${searchRes.status}`);
  const searchJson = await searchRes.json();

  const ids = (searchJson.items || []).map((it) => it?.id?.videoId).filter(Boolean);
  let statsJson = { items: [] };
  if (ids.length) {
    const statsUrl = buildVideosStatsUrl({ videoIds: ids, apiKey });
    const statsRes = await fetchWithTimeout(statsUrl);
    if (!statsRes.ok) throw new Error(`videos HTTP ${statsRes.status}`);
    statsJson = await statsRes.json();
  }

  return buildTopVideos(searchJson, statsJson, {
    maxResults: MAX_RESULTS,
    onStage: (label, count) => console.log(`[youtube]   ${query} — ${label}: ${count}`),
  });
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const now = Date.now();

  let prev = { models: {} };
  try { prev = JSON.parse(await readFile(OUT_PATH, 'utf-8')); } catch { /* first run — no prior snapshot */ }

  if (!apiKey) {
    console.log('[youtube] YOUTUBE_API_KEY not set — skipping this run, leaving any existing snapshot as-is.');
    return;
  }

  const models = { ...prev.models };
  for (const key of TRACKED_KEYS) {
    const entry = MODEL_REGISTRY[key];
    try {
      const videos = await fetchModelVideos(entry.ytQuery, apiKey, now);
      models[key] = { query: entry.ytQuery, updatedAt: new Date(now).toISOString(), videos };
      console.log(`[youtube] ${entry.ytQuery}: ${videos.length} video(s)`);
    } catch (err) {
      console.error(`[youtube] ${entry.ytQuery}: ${err.message} — keeping previous snapshot for this model`);
      // leave models[key] as whatever it already was from `prev` (untouched)
    }
  }

  const out = { updatedAt: new Date(now).toISOString(), windowDays: WINDOW_DAYS, models };
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('[youtube] fatal:', err);
  process.exit(1);
});
