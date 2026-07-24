#!/usr/bin/env node
// Launch Radar fetcher — the "be first to know" pipeline. Watches the labs'
// MACHINERY (model-hub uploads + official SDK/model GitHub releases) rather
// than downstream press/RSS, so a new model or SDK bump is detected at, or
// slightly before, the marketing blog post. Writes data/launch-radar.json.
//
// Runs on its own FAST cron (.github/workflows/update-launchradar.yml) —
// separate from the 30-min data pipeline because it's cheap (keyless, tiny
// responses) and the whole point is low latency to detection.
//
// Keyless: Hugging Face's model API needs no auth; GitHub's releases API works
// unauthenticated at low volume and, inside Actions, uses the free GITHUB_TOKEN
// automatically (raising the rate limit) when GITHUB_TOKEN is in the env.
//
// New-release detection is a diff against the PREVIOUS snapshot's known ids —
// on a cold start everything is baseline (never a flood of fake "launches").
// The workflow reads newCount from the output and opens a GitHub issue (which
// emails the repo owner) when something genuinely new appears.
//
// Run: node scripts/update-launchradar.mjs   (optionally GITHUB_TOKEN=… for higher limits)

import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildHfModelsUrl, buildGithubReleasesUrl,
  parseHfModels, parseGithubReleases, buildRadarSnapshot,
} from './lib/launchradar.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'launch-radar.json');
const FETCH_TIMEOUT_MS = 15000;
const HF_LIMIT = 10;   // newest N models per org
const GH_PER_PAGE = 5; // newest N releases per repo
const DISPLAY_LIMIT = 30;

// Open-weight labs: a new model appearing on Hugging Face IS the launch, often
// the single earliest machine-detectable moment. `org` is the HF author.
const HF_SOURCES = [
  { org: 'Qwen', label: 'Qwen' },
  { org: 'meta-llama', label: 'Llama' },
  { org: 'deepseek-ai', label: 'DeepSeek' },
  { org: 'mistralai', label: 'Mistral' },
  { org: 'moonshotai', label: 'Kimi' },
];

// Closed labs' official product/tooling repos, where a release genuinely
// signals something shipping (not a routine Python client-library bump —
// openai-python/anthropic-sdk-python/python-genai were dropped: those cut
// releases on every minor API tweak, which is noise, not launch signal).
const GH_SOURCES = [
  { repo: 'xai-org/grok-build', label: 'Grok', org: 'xAI' },
];

async function fetchWithTimeout(url, headers = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(id);
  }
}

async function fetchHf(src) {
  const res = await fetchWithTimeout(buildHfModelsUrl({ org: src.org, limit: HF_LIMIT }), {
    'User-Agent': 'ai-pulse-launch-radar',
  });
  if (!res.ok) throw new Error(`HF ${src.org} HTTP ${res.status}`);
  return parseHfModels(await res.json(), src);
}

async function fetchGithub(src, token) {
  const headers = {
    'User-Agent': 'ai-pulse-launch-radar', // GitHub requires a UA or it 403s
    Accept: 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(buildGithubReleasesUrl({ repo: src.repo, perPage: GH_PER_PAGE }), headers);
  if (!res.ok) throw new Error(`GitHub ${src.repo} HTTP ${res.status}`);
  return parseGithubReleases(await res.json(), src);
}

async function main() {
  const now = Date.now();
  const token = process.env.GITHUB_TOKEN || '';

  let prevSnapshot = null;
  try { prevSnapshot = JSON.parse(await readFile(OUT_PATH, 'utf-8')); } catch { /* cold start */ }

  const allEntries = [];
  const sources = [];

  for (const src of HF_SOURCES) {
    try {
      const entries = await fetchHf(src);
      allEntries.push(...entries);
      sources.push({ name: `HF:${src.label}`, ok: true, count: entries.length });
      console.log(`[radar] HF ${src.org}: ${entries.length} model(s)`);
    } catch (err) {
      sources.push({ name: `HF:${src.label}`, ok: false, count: 0 });
      console.error(`[radar] HF ${src.org}: ${err.message}`);
    }
  }

  for (const src of GH_SOURCES) {
    try {
      const entries = await fetchGithub(src, token);
      allEntries.push(...entries);
      sources.push({ name: `GH:${src.label}`, ok: true, count: entries.length });
      console.log(`[radar] GH ${src.repo}: ${entries.length} release(s)`);
    } catch (err) {
      sources.push({ name: `GH:${src.label}`, ok: false, count: 0 });
      console.error(`[radar] GH ${src.repo}: ${err.message}`);
    }
  }

  // If EVERY source failed, don't overwrite a good previous snapshot with an
  // empty one — same "never a needless downgrade to no-data" stance as YouTube.
  const anyOk = sources.some((s) => s.ok);
  if (!anyOk && prevSnapshot) {
    console.error('[radar] every source failed — keeping previous snapshot untouched.');
    return;
  }

  const snapshot = buildRadarSnapshot({
    prevSnapshot, allEntries, sources, displayLimit: DISPLAY_LIMIT, now,
  });

  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`Wrote ${OUT_PATH} — ${snapshot.entries.length} shown, ${snapshot.newCount} newly detected${snapshot.firstRun ? ' (cold-start baseline)' : ''}.`);
  if (snapshot.newCount > 0) {
    for (const n of snapshot.newlyDetected) console.log(`[radar]   NEW: ${n.label} — ${n.title} (${n.at})`);
  }
}

main().catch((err) => {
  console.error('[radar] fatal:', err);
  process.exit(1);
});
