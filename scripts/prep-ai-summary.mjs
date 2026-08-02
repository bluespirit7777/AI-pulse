#!/usr/bin/env node
// Read-only helper for the daily AI Summary Wave routine.
//
// Prints the last 24h of signals grouped into Product / Market / Research and
// sorted by significance, in the exact shape the three summaries need to be
// written in. Every line carries the signal's `id`, so the ids for
// `sourceIds` can be copied straight out of this listing rather than re-derived
// by hand against latest.json.
//
// This script NEVER writes anything. The summary file it feeds
// (data/ai-summary.json) is hand-written — see docs/AI_SUMMARY_PROCEDURE.md.
//
//   node scripts/prep-ai-summary.mjs           # Markdown, for reading/writing from
//   node scripts/prep-ai-summary.mjs --json    # same data, for an automated routine
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupByFamily, SUMMARY_FAMILIES, WINDOW_HOURS } from './lib/summary-input.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const LABEL = { product: 'Product', market: 'Market', research: 'Research' };

async function main() {
  const asJson = process.argv.includes('--json');

  let latest;
  try {
    latest = JSON.parse(await readFile(path.join(DATA_DIR, 'latest.json'), 'utf-8'));
  } catch (e) {
    console.error(`Could not read data/latest.json: ${e.message}`);
    console.error('Run `npm run build` first, or check out the committed data.');
    process.exit(1);
  }

  const now = Date.now();
  const windowEnd = new Date(now).toISOString();
  const windowStart = new Date(now - WINDOW_HOURS * 3.6e6).toISOString();
  const groups = groupByFamily(latest.signals || [], now);

  if (asJson) {
    console.log(JSON.stringify({
      windowStart,
      windowEnd,
      families: Object.fromEntries(SUMMARY_FAMILIES.map((f) => [f, {
        label: LABEL[f],
        signalCount: groups[f].length,
        signals: groups[f].map((s) => ({
          id: s.id, title: s.title, desc: s.desc, url: s.url,
          category: s.category, significance: s.significance, sourceCount: s.sourceCount,
        })),
      }])),
    }, null, 2));
    return;
  }

  const total = SUMMARY_FAMILIES.reduce((n, f) => n + groups[f].length, 0);
  console.log(`# AI Summary prep — ${windowStart} → ${windowEnd}`);
  console.log(`# ${total} eligible signals in the last ${WINDOW_HOURS}h `
    + '(commentary categories "analysis" and "general" are excluded, as they are everywhere else).');
  console.log(`# Copy windowStart/windowEnd above into data/ai-summary.json verbatim.`);

  for (const fam of SUMMARY_FAMILIES) {
    const rows = groups[fam];
    console.log(`\n## ${LABEL[fam].toUpperCase()} (${rows.length} signal${rows.length === 1 ? '' : 's'})`);
    if (!rows.length) {
      console.log('  (nothing eligible in this window — say so honestly, or omit the family)');
      continue;
    }
    for (const s of rows) {
      const src = s.sourceCount > 1 ? `, ${s.sourceCount} sources` : '';
      console.log(`\n- [${s.category}, significance ${s.significance}${src}] ${s.title}`);
      if (s.desc) console.log(`  ${s.desc}`);
      console.log(`  id: ${s.id}`);
    }
  }

  console.log('\n---');
  console.log('Write 2–4 short bullet points per family. Synthesize — do not recap');
  console.log('headline by headline. Cite in sourceIds only the ids you actually drew on.');
}

main().catch((e) => { console.error(e); process.exit(1); });
