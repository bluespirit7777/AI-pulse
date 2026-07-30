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
