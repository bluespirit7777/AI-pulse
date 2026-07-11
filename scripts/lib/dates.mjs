// All PERSISTED display dates are generated with explicit UTC. Without this,
// `toLocaleDateString` uses the machine's local timezone — the exact same
// ISO instant could format to "JUL 10" on a GitHub Actions runner (UTC) and
// "JUL 11" on a contributor's local machine east of UTC, making the stored
// date depend on WHERE the build ran rather than WHEN the event happened.
// `dateISO` stays the authority everywhere; this is only ever a display
// label derived from it.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// "JUL 10 2026" — always the UTC calendar day for the given instant,
// regardless of the machine's local timezone.
export function shortDateUTC(d) {
  const dt = new Date(d);
  const mon = MONTHS[dt.getUTCMonth()];
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${mon} ${day} ${dt.getUTCFullYear()}`;
}

// "2026-07-10" — the UTC day key used to bucket events into daily history
// files. Kept here (not just in history.mjs) so any module needing a plain
// UTC day string uses the same definition.
export function dayKeyUTC(d) {
  return new Date(d).toISOString().slice(0, 10);
}
