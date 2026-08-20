#!/usr/bin/env node
// Unit tests for the Vocab page's term data, plus guard tests for
// vocab.html/js/vocab.js themselves — following the same raw-file-text
// pattern test/landing.test.mjs uses for index.html, so a renamed mount
// element or CSS class fails a test instead of silently shipping an empty
// or unstyled page. Run: node --test test/vocab.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vocabTerms, VOCAB_SECTIONS } from '../js/vocab-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf-8');
const appHtml = read('app.html');
const sectionIds = new Set(VOCAB_SECTIONS.map((s) => s.id));

test('vocabTerms has no duplicate term names', () => {
  const seen = new Set();
  for (const entry of vocabTerms) {
    assert.ok(!seen.has(entry.term), `duplicate term "${entry.term}"`);
    seen.add(entry.term);
  }
});

test('every vocabTerms entry has a non-empty definition', () => {
  for (const entry of vocabTerms) {
    assert.ok(typeof entry.definition === 'string' && entry.definition.length > 0, `${entry.term} has no definition`);
  }
});

test('every vocabTerms entry\'s section is a known VOCAB_SECTIONS id', () => {
  for (const entry of vocabTerms) {
    assert.ok(sectionIds.has(entry.section), `${entry.term} has unknown section "${entry.section}"`);
  }
});

test('every vocabTerms entry\'s anchor exists as a real id in app.html', () => {
  for (const entry of vocabTerms) {
    assert.ok(typeof entry.anchor === 'string' && entry.anchor.length > 0, `${entry.term} has no anchor`);
    assert.ok(appHtml.includes(`id="${entry.anchor}"`), `${entry.term}'s anchor "#${entry.anchor}" is not a real id in app.html`);
  }
});

test('VOCAB_SECTIONS ids match js/nav.js\'s PANELS exactly', () => {
  // Keeps the vocab page's four groups from drifting into different names
  // than the dashboard's own four top sections.
  const navJs = readFileSync(path.join(__dirname, '..', 'js', 'nav.js'), 'utf-8');
  const match = navJs.match(/const PANELS = (\[[^\]]*\]);/);
  assert.ok(match, 'could not find PANELS array in js/nav.js');
  const panels = JSON.parse(match[1].replace(/'/g, '"'));
  assert.deepEqual(VOCAB_SECTIONS.map((s) => s.id), panels);
});

// ------------------------------------------------------------ vocab.html + js/vocab.js

const vocabHtml = read('vocab.html');
const vocabJs = read('js/vocab.js');

test('vocab page ships no inline script (its CSP has no unsafe-inline)', () => {
  const csp = vocabHtml.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(csp, 'vocab.html must carry a CSP meta tag');
  assert.match(csp, /script-src 'self'/, "script-src must stay 'self'");
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/, 'script-src must not allow inline script');
  // Any <script> on the page must therefore carry a src. Comments are
  // stripped first — the explanatory comment above the script tag mentions
  // "<script>" in prose, and that is not markup.
  const markup = vocabHtml.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of markup.match(/<script\b[^>]*>/g) || []) {
    assert.match(tag, /\ssrc=/, `inline <script> would be blocked by the page's own CSP: ${tag}`);
  }
});

test('#vocab-sections mount element exists and ships empty in the raw HTML', () => {
  const match = vocabHtml.match(/<div id="vocab-sections">([\s\S]*?)<\/div>/);
  assert.ok(match, 'vocab.html must have a #vocab-sections mount element');
  assert.equal(match[1].trim(), '', '#vocab-sections must ship empty — it is populated by js/vocab.js at runtime');
});

test('every CSS class js/vocab.js assigns has a matching rule reachable from vocab.html', () => {
  // Pull the exact set of classes js/vocab.js hands out via `className = '...'`
  // straight from its source, rather than a hand-copied list that could drift.
  const assigned = new Set();
  for (const m of vocabJs.matchAll(/\.className\s*=\s*'([^']+)'/g)) {
    for (const cls of m[1].split(/\s+/).filter(Boolean)) assigned.add(cls);
  }
  assert.ok(assigned.size > 0, 'expected to find at least one className assignment in js/vocab.js');

  // Every stylesheet vocab.html can actually reach: its own inline <style>
  // block plus the three linked stylesheets.
  const inlineStyle = (vocabHtml.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const css = [
    inlineStyle,
    read('css/components.css'),
    read('css/shell.css'),
    read('css/tokens.css'),
  ].join('\n');

  const missing = [];
  for (const cls of assigned) {
    // Matches the class used as a selector (".vocab-term" followed by a
    // combinator, pseudo-class, attribute selector or rule-opening brace),
    // not merely as a substring of some longer, unrelated class name.
    const re = new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s,.:#>+~{[]|$)`, 'm');
    if (!re.test(css)) missing.push(cls);
  }
  assert.deepEqual(missing, [], `js/vocab.js assigns classes with no matching CSS rule: ${missing.join(', ')}`);
});
