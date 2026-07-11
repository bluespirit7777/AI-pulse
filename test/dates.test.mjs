#!/usr/bin/env node
// Unit tests for UTC date stability. Run: node --test test/dates.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { shortDateUTC, dayKeyUTC } from '../scripts/lib/dates.mjs';

test('shortDateUTC reflects the UTC calendar day, computed independently of the function under test', () => {
  // Self-consistent check: derive the expected label directly from
  // getUTC* accessors (not toLocaleDateString) so this can't pass merely
  // because both sides share the same latent timezone assumption.
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const iso = '2026-07-10T23:45:00.000Z'; // near UTC midnight — the case most likely to roll over
  const d = new Date(iso);
  const expected = `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${d.getUTCFullYear()}`;
  assert.equal(shortDateUTC(iso), expected);
  assert.equal(shortDateUTC(iso), 'JUL 10 2026');
});

test('shortDateUTC gives the same stored date for the same ISO instant regardless of process timezone', () => {
  // The exact bug this guards against: a build running on a GitHub Actions
  // runner (UTC) and a contributor's local machine in a positive-offset zone
  // must record the SAME calendar day for the same instant — never a date
  // that depends on WHERE the build happened to run.
  const iso = '2026-07-10T23:45:00.000Z';
  const originalTZ = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14 — would roll to Jul 11 if not forced to UTC
    const a = shortDateUTC(iso);
    process.env.TZ = 'Etc/GMT+12'; // UTC-12 — would roll to Jul 10 either way, but exercises the other extreme
    const b = shortDateUTC(iso);
    process.env.TZ = 'America/Los_Angeles';
    const c = shortDateUTC(iso);
    assert.equal(a, 'JUL 10 2026');
    assert.equal(b, 'JUL 10 2026');
    assert.equal(c, 'JUL 10 2026');
    assert.equal(a, b);
    assert.equal(b, c);
  } finally {
    if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
  }
});

test('shortDateUTC: a midnight-UTC-crossing instant does not depend on local offset', () => {
  // 2026-01-01T00:15Z is "JAN 01" in UTC but would be "DEC 31" in any zone
  // west of UTC if local time leaked in.
  assert.equal(shortDateUTC('2026-01-01T00:15:00.000Z'), 'JAN 01 2026');
});

test('dayKeyUTC matches the UTC ISO date slice, independent of local timezone', () => {
  const originalTZ = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Kiritimati';
    assert.equal(dayKeyUTC('2026-07-10T23:45:00.000Z'), '2026-07-10');
    process.env.TZ = 'Etc/GMT+12';
    assert.equal(dayKeyUTC('2026-07-10T23:45:00.000Z'), '2026-07-10');
  } finally {
    if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
  }
});
