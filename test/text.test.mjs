#!/usr/bin/env node
// Unit tests for text-cleaning helpers. Run: node --test test/text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities } from '../scripts/lib/text.mjs';

test('decodeEntities strips real HTML tags', () => {
  assert.equal(decodeEntities('<p>hello <b>world</b></p>'), 'hello world');
});

test('decodeEntities decodes basic HTML entities', () => {
  assert.equal(decodeEntities('AT&amp;T &lt;3 &quot;quotes&quot;'), 'AT&T <3 "quotes"');
});

test('regression: entity-encoded angle brackets must not survive as literal tags after decoding', () => {
  // Real HN comment (a git co-author trailer): the site encodes typed "<"/">"
  // as &lt;/&gt; entities. The old decodeEntities stripped tags BEFORE
  // decoding entities, so this literal text had no "<" for the stripper to
  // see yet — it decoded into "<composer@cursor.com>" afterward and slipped
  // straight into the excerpt, tripping validate.mjs's unsanitised-HTML check
  // on a live CI run.
  const raw = 'Co-authored-by: Cursor Grok 4.5 &lt;noreply@cursor.com&gt; 377 files changed';
  const out = decodeEntities(raw);
  assert.ok(!/<[a-z]/i.test(out), `decoded output still contains a tag-like sequence: "${out}"`);
  // the whole "<...>" span is removed, same as a real tag would be — the
  // point is nothing tag-shaped survives, not that the email is preserved
  assert.equal(out, 'Co-authored-by: Cursor Grok 4.5 377 files changed');
});

test('decodeEntities unwraps CDATA and still strips any HTML inside it', () => {
  assert.equal(decodeEntities('<![CDATA[<i>note</i>]]>'), 'note');
});

test('decodeEntities collapses whitespace and trims', () => {
  assert.equal(decodeEntities('  a\n\n  b   c  '), 'a b c');
});

test('decodeEntities handles empty/null input', () => {
  assert.equal(decodeEntities(''), '');
  assert.equal(decodeEntities(null), '');
  assert.equal(decodeEntities(undefined), '');
});
