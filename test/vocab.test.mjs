#!/usr/bin/env node
// Unit tests for the Vocab page's term data. Run: node --test test/vocab.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vocabTerms, VOCAB_SECTIONS } from '../js/vocab-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appHtml = readFileSync(path.join(__dirname, '..', 'app.html'), 'utf-8');
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
