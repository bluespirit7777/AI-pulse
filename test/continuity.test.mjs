#!/usr/bin/env node
// Guard tests for landing <-> dashboard continuity. This project has zero npm
// dependencies and therefore no jsdom, so these are source-text contracts in
// the same style as test/landing.test.mjs — they pin the structural promises
// the two pages make to each other. Visual correctness is verified by
// screenshot in the browser, not here.
// Run: node --test test/continuity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(__dirname, '..', p), 'utf-8');

const landingHtml = read('index.html');
const appHtml = read('app.html');
const tokensCss = read('css/tokens.css');

test('both pages link the shared token stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/tokens\.css"/, `${name} must link css/tokens.css`);
  }
});

test('neither page redefines a canonical colour token locally', () => {
  // The whole point of tokens.css is that there is ONE definition. A local
  // redefinition is exactly the drift this replaces (index.html used to
  // hand-copy the dashboard's hexes with "/* app.html --ink */" beside them).
  const canonical = ['--ink', '--deep', '--teal', '--sea', '--sand', '--foam'];
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    const styleBlocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const token of canonical) {
      assert.doesNotMatch(
        styleBlocks,
        new RegExp(`${token}\\s*:`),
        `${name} redefines ${token} locally; it belongs in css/tokens.css`
      );
    }
  }
});

test('tokens.css keeps the two pages\' conflicting pale tone separate', () => {
  // --foam was #F4FAFB on the landing and #EAF4F6 on the dashboard. Collapsing
  // them would visibly change one page, so the landing's pale value lives on
  // as --mist.
  assert.match(tokensCss, /--foam:\s*#EAF4F6/i, '--foam keeps the dashboard value (18 usages)');
  assert.match(tokensCss, /--mist:\s*#F4FAFB/i, "--mist carries the landing's pale value");
});

test('the landing keeps its aliases so its existing rules still resolve', () => {
  for (const alias of ['--tide', '--mid', '--warm', '--serif', '--sans', '--mono']) {
    assert.match(tokensCss, new RegExp(`${alias}\\s*:`), `${alias} alias missing from tokens.css`);
  }
});

test('no page still uses var(--foam) where it meant the landing pale tone', () => {
  // The landing's three gradient endpoints must have moved to --mist.
  const landingStyles = [...landingHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const gradientLines = landingStyles.split('\n').filter((l) => /linear-gradient/.test(l) && /var\(--foam\)/.test(l));
  assert.deepEqual(gradientLines, [], `landing gradients must use var(--mist): ${gradientLines.join(' | ')}`);
});

test('both pages link the shared shell stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/shell\.css"/, `${name} must link css/shell.css`);
  }
});

test('the dashboard no longer paints a full-bleed photograph behind every view', () => {
  // The photo put small mono type (depth rail, ticker, section descriptors) on
  // a busy background at low contrast. The landing's gradient replaces it.
  // assets/ocean.jpg is still used as the landing's closing image and as the
  // og:image, so only the dashboard's background usage should be gone.
  assert.doesNotMatch(appHtml, /class="ocean-bg"/, 'the .ocean-bg photo layer must be removed from app.html');
  assert.doesNotMatch(appHtml, /url\(assets\/ocean\.jpg\)/, 'app.html must not paint ocean.jpg as a background');
});

test('the dashboard keeps its animated wave footer (a signature element, not the photo)', () => {
  assert.match(appHtml, /class="waves"/, 'the wave footer stays');
});

test('one measure governs both pages', () => {
  const shellCss = read('css/shell.css');
  assert.match(shellCss, /\.wrap\{[^}]*max-width:\s*var\(--maxw\)/, '.wrap must use the shared --maxw');
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /\.wrap\{[^}]*max-width:\s*\d+px/, 'app.html must not hardcode its own measure');
});

test('both pages use the shared header and brand classes', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /class="[^"]*site-header/, `${name} must use .site-header`);
    assert.match(html, /class="[^"]*site-brand/, `${name} must use .site-brand`);
  }
});

test('both pages offer a reciprocal control to the other page, in the header', () => {
  // The landing has always had "Open dashboard"; the dashboard's way back was
  // a plain text link in a different position. Both are now pills in the same
  // header slot, so the control does not move as you cross between pages.
  assert.match(landingHtml, /class="[^"]*nav-pill[^"]*"[^>]*href="app\.html"/, 'landing needs its dashboard pill');
  assert.match(appHtml, /class="[^"]*nav-pill[^"]*"[^>]*href="\.\/"/, 'dashboard needs its landing pill');
});

test('the focus ring is one colour across both pages', () => {
  const shellCss = read('css/shell.css');
  assert.match(shellCss, /:focus-visible\{[^}]*outline:[^;]*var\(--sand\)/, 'shared sand focus ring');
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /focus-visible\{[^}]*outline:\s*2px solid var\(--teal\)/, 'app.html must not keep its own teal focus ring');
});

test('both renderers emit the same shared row component', () => {
  const landingJs = read('js/landing.js');
  const sectionsJs = read('js/sections.js');
  assert.match(landingJs, /rank-row/, 'js/landing.js must render .rank-row');
  assert.match(sectionsJs, /rank-row/, 'js/sections.js must render .rank-row');
});

test('the superseded per-page row classes are gone', () => {
  const appCss = read('css/app.css');
  const landingStyles = [...landingHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appCss, /\.lb-row\{/, 'css/app.css must not define .lb-row any more');
  assert.doesNotMatch(landingStyles, /\.mini\s+\.r\{/, 'index.html must not define its own row');
});

test('both pages link the shared component stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/components\.css"/, `${name} must link css/components.css`);
  }
});
