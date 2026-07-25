#!/usr/bin/env node
// Guard tests for the landing page (index.html + js/landing.js + js/deeplink.js).
//
// The landing page is the one place on the site where it would be easiest to
// quietly regress the project's prime directive: it is a *marketing* surface,
// and marketing surfaces attract hardcoded "example" numbers. The mockup this
// page was built from shipped exactly that — invented model names and made-up
// leaderboard scores. These tests make sure none of that can creep back in:
// every figure on the landing page must arrive at runtime from curated.js or
// data/latest.json, never from the markup.
//
// They also pin the two structural contracts the page depends on: its CSP
// forbids inline script, and it is now the site root, so legacy dashboard
// deep links have to be forwarded to app.html.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_REGISTRY } from '../scripts/lib/models.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(path.join(ROOT, p), 'utf-8');

const landingHtml = await read('index.html');
const landingJs = await read('js/landing.js');
const deeplinkJs = await read('js/deeplink.js');
const appHtml = await read('app.html');

// ---------------------------------------------------------- anti-fabrication

test('landing markup names no model, org or version — every one comes from data at runtime', () => {
  // Strip the <style> block first: the CSS is full of colour/­font tokens that
  // would produce meaningless substring hits.
  const body = landingHtml.replace(/<style>[\s\S]*?<\/style>/g, '');
  const banned = [];
  for (const m of Object.values(MODEL_REGISTRY)) {
    for (const term of [m.version, m.versionLabel, m.brand, m.org]) {
      // `name`/`brand` alone are too generic to test ("GPT" appears in no
      // prose here, but "Claude" legitimately could) — version strings and
      // org names are the ones that actually go stale.
      if (term && term.includes(' ') && body.includes(term)) banned.push(term);
    }
  }
  assert.deepEqual(banned, [], `landing markup hardcodes model/version strings: ${banned.join(', ')}`);
});

test('landing markup contains no hardcoded score-like numbers in the data slots', () => {
  // Every list on the page is rendered into an empty container by landing.js.
  // If a container ships with children, someone has pasted static rows in.
  const containers = [
    'lp-ticker', 'lp-waves', 'lp-river', 'lp-tide',
    'lp-share', 'lp-lb-text', 'lp-lb-image', 'lp-lb-video', 'lp-lb-local',
    'lp-compute',
  ];
  for (const id of containers) {
    const re = new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</div>`);
    const match = landingHtml.match(re);
    assert.ok(match, `container #${id} is missing from index.html`);
    assert.equal(match[1].trim(), '', `container #${id} ships static markup; it must be filled from data`);
  }
});

test('landing controller sources its figures from curated.js and latest.json, not literals', () => {
  assert.match(landingJs, /from '\.\/curated\.js'/, 'landing.js must read curated tables from curated.js');
  assert.match(landingJs, /from '\.\/data\.js'/, 'landing.js must read live data via data.js');
  // No inline leaderboard/price tables: a bare array of objects carrying a
  // `model:` or `chip:` key would be a duplicated dataset.
  assert.doesNotMatch(landingJs, /\bmodel:\s*'/, 'landing.js defines a literal model row — import it instead');
  assert.doesNotMatch(landingJs, /\bchip:\s*'/, 'landing.js defines a literal compute row — import it instead');
});

test('landing surfaces provenance for both curated and live panels', () => {
  // Same honesty contract the dashboard panels carry: say where a number came
  // from and, for curated tables, how old it is.
  assert.match(landingJs, /CURATED_ASOF/, 'curated share panel must show its as-of date');
  assert.match(landingJs, /LEADERBOARD_SNAPSHOT/, 'leaderboard preview must show its snapshot date');
  assert.match(landingJs, /LEADERBOARD_OVERALL_DISCLAIMER/, 'the editorial-synthesis disclaimer must be shown');
  assert.match(landingJs, /renderLiveUnavailable/, 'live panels need an honest unavailable state');
});

// ------------------------------------------------------------ CSP + structure

test('landing page ships no inline script (its CSP has no unsafe-inline)', () => {
  const csp = landingHtml.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(csp, 'index.html must carry a CSP meta tag');
  assert.match(csp, /script-src 'self'/, "script-src must stay 'self'");
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/, 'script-src must not allow inline script');
  // Any <script> on the page must therefore carry a src. Comments are stripped
  // first — the explanatory comment above the script tags mentions "<script>"
  // in prose, and that is not markup.
  const markup = landingHtml.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of markup.match(/<script\b[^>]*>/g) || []) {
    assert.match(tag, /\ssrc=/, `inline <script> would be blocked by the page's own CSP: ${tag}`);
  }
  assert.match(csp, /media-src 'self'/, 'the hero video needs media-src');
});

test('landing links into the dashboard point at app.html', () => {
  const hrefs = [...landingHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const dashboardHashes = hrefs.filter((h) => /^#?(panel-|tab-|full$|sec-)/.test(h.replace(/^app\.html/, '')));
  assert.ok(dashboardHashes.length > 0, 'expected some dashboard deep links on the landing page');
  for (const h of dashboardHashes) {
    assert.ok(h.startsWith('app.html#'), `dashboard deep link must target app.html, got "${h}"`);
  }
});

test('dashboard lives at app.html and links back to the landing root', () => {
  assert.match(appHtml, /<a href="\.\/"/, 'the dashboard wordmark must link back to the landing page');
  assert.match(appHtml, /canonical" href="https:\/\/bluespirit7777\.github\.io\/AI-pulse\/app\.html"/,
    'app.html must declare its own canonical URL, not the old root');
  assert.match(landingHtml, /canonical" href="https:\/\/bluespirit7777\.github\.io\/AI-pulse\/"/,
    'the landing page is the site root and must claim that canonical');
});

// ------------------------------------------------------------ deep-link rules

test('deeplink forwarder catches every dashboard hash shape and no landing anchor', () => {
  // Re-derive the predicate from the source so the test tracks the real regex
  // rather than a copy that can drift out of sync with it.
  const src = deeplinkJs.match(/if \(!(\/\^#\([^/]+\)\/)\.test\(hash\)\) return;/)?.[1];
  assert.ok(src, 'could not locate the hash predicate in js/deeplink.js');
  const re = new RegExp(src.slice(1, -1));

  // Every hash the dashboard's nav.js can resolve (PANELS, PANEL_TABS,
  // LEGACY_HASH and FULL_HASH) must be forwarded.
  const dashboard = [
    '#full',
    '#panel-today', '#panel-ecosystem', '#panel-models', '#panel-markets', '#panel-research',
    '#tab-briefing', '#tab-waves', '#tab-river', '#tab-tide', '#tab-releases',
    '#tab-leaderboard', '#tab-image', '#tab-video', '#tab-local', '#tab-community',
    '#tab-stocknet', '#tab-compute',
    '#sec-map', '#sec-waves', '#sec-river', '#sec-tide', '#sec-releases',
    '#sec-leaderboard', '#sec-media', '#sec-community', '#sec-stocks', '#sec-compute', '#sec-local',
  ];
  for (const h of dashboard) assert.ok(re.test(h), `${h} must be forwarded to app.html`);

  // The landing's own anchors must never be captured.
  for (const h of ['#surface', '#currents', '#models', '#markets', '#seabed']) {
    assert.ok(!re.test(h), `${h} is a landing anchor and must not be forwarded`);
  }
  // '#full' is anchored, so a longer hash that merely starts with it is safe.
  assert.ok(!re.test('#fullscreen'), '#fullscreen must not be mistaken for #full');
});

test('every landing nav anchor resolves to a real section on the page', () => {
  const anchors = [...landingHtml.matchAll(/href="(#[^"]+)"/g)].map((m) => m[1].slice(1));
  for (const id of new Set(anchors)) {
    assert.ok(landingHtml.includes(`id="${id}"`), `landing anchor #${id} has no matching element`);
  }
});
