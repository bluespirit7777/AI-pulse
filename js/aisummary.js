// AI Summary Wave — three short bullet lists synthesising the day in Product,
// Market and Research, written by an AI agent and committed as data (see
// docs/AI_SUMMARY_PROCEDURE.md). Replaces the three "strongest wave" cards,
// which showed one story per family rather than summarising the day.
//
// The honesty rules this module enforces, in order of importance:
//
//  1. It renders NOTHING unless the data is present, well-formed and fresh.
//     The stream below refreshes every 30 minutes; a day-old take sitting on
//     top of fresh headlines would be worse than no take, so a missed routine
//     day makes the section disappear rather than go quietly stale.
//  2. The "written by an AI" disclosure is HARDCODED here and gated on
//     method === 'ai-written'. It is never read as text out of the data file,
//     so a malformed or hand-tampered file cannot relabel itself as something
//     it isn't.
//  3. Source links are resolved against the signals currently in the feed.
//     Ids that have aged out of latest.json simply don't render — the summary
//     never links somewhere that no longer exists, and never invents a URL.
import { esc, timeAgo } from './util.js';

// Kept in step with docs/AI_SUMMARY_PROCEDURE.md, which tells the operator the
// same deadline. If this changes, change it there too.
const STALE_HOURS = 36;
const FAMILIES = ['product', 'market', 'research'];

function isUsable(s, now) {
  if (!s || typeof s !== 'object') return false;
  if (s.method !== 'ai-written') return false;
  const at = Date.parse(s.generatedAt);
  if (!Number.isFinite(at)) return false;
  if (now - at > STALE_HOURS * 3.6e6) return false;
  if (!s.families || typeof s.families !== 'object') return false;
  // Every family must carry real bullets. A partially-written file is a
  // mistake, not a state worth rendering half of.
  return FAMILIES.every((f) => {
    const fam = s.families[f];
    return fam && Array.isArray(fam.bullets) && fam.bullets.length > 0
      && fam.bullets.every((b) => typeof b === 'string' && b.trim().length > 0);
  });
}

export function renderAiSummary(root, aiSummary, signals = [], now = Date.now()) {
  if (!root) return;

  if (!isUsable(aiSummary, now)) {
    root.innerHTML = '';
    root.hidden = true;
    return;
  }
  root.hidden = false;

  // id → signal, for resolving sourceIds to real, still-live links.
  const byId = new Map();
  for (const s of signals) if (s && s.id) byId.set(s.id, s);

  const cards = FAMILIES.map((key) => {
    const fam = aiSummary.families[key];
    const label = typeof fam.label === 'string' && fam.label ? fam.label : key;
    const count = Number.isFinite(fam.signalCount) ? fam.signalCount : null;

    const sources = (Array.isArray(fam.sourceIds) ? fam.sourceIds : [])
      .map((id) => byId.get(id))
      .filter(Boolean);

    const sourceList = sources.length
      ? `<ul class="aisum-sources">${sources.map((s) => `
          <li><a class="src-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>`
      : '';

    return `
      <article class="aisum-card aisum-${esc(key)}">
        <div class="aisum-head">
          <span class="aisum-fam">${esc(label)}</span>
          ${count !== null ? `<span class="aisum-count">${esc(String(count))} signal${count === 1 ? '' : 's'}</span>` : ''}
        </div>
        <ul class="aisum-text">${fam.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        ${sourceList}
      </article>`;
  }).join('');

  const covers = Date.parse(aiSummary.windowStart);
  const windowNote = Number.isFinite(covers)
    ? ` · covering the 24h to ${esc(new Date(aiSummary.windowEnd).toISOString().slice(0, 16).replace('T', ' '))} UTC`
    : '';

  root.innerHTML = `
    <p class="aisum-disclosure">
      <span class="fr-chip fr-curated" title="Written by an AI agent from the day's collected signals, then committed as data"><span class="fr-mark" aria-hidden="true">●</span>AI-written</span>
      Summarised by an AI agent from the signals below — not human editorial, and not a live model call.
      Written ${esc(timeAgo(aiSummary.generatedAt))}${windowNote}.
    </p>
    <div class="aisum-grid">${cards}</div>
  `;
}
