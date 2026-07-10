// Community pulse — user/developer feedback for the top models. Hybrid by
// necessity: a computed sentiment score has no free live source (Twitter/X and
// Reddit APIs are now paid/restricted), so this joins two honestly-labelled
// parts:
//   • LIVE (auto): discussion volume, total engagement, and the top threads
//     from the Hacker News Algolia API (free, no key) — real developer
//     feedback you can click into and read. From data.community[].
//   • CURATED: a one-line editorial reception summary per model, from
//     curated.js, chip-labelled "Curated".
import { esc } from './util.js';
import { sourceChip } from './freshness.js';
import { modelReception } from './curated.js';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

export function renderCommunity(root, community = []) {
  if (!root) return;
  if (!community.length) {
    root.innerHTML = `<p class="empty-state">Community discussion is loading — it refreshes from Hacker News each cycle.</p>`;
    return;
  }
  // busiest first, so the models people are talking about most lead
  const rows = community.slice().sort((a, b) => (b.points || 0) - (a.points || 0));
  root.innerHTML = rows.map((c) => {
    const reception = modelReception[c.key];
    return `
      <article class="cm-card">
        <div class="cm-head">
          <span class="cm-model">${esc(c.model)}</span>
          <span class="cm-org">${esc(c.org)}</span>
        </div>
        ${reception ? `<p class="cm-reception">${esc(reception)}
          <span class="fr-chip fr-curated" title="Editorial reception summary, updated by hand"><span class="fr-mark" aria-hidden="true">✎</span>Curated</span></p>` : ''}
        <div class="cm-buzz">
          <span class="cm-stat"><b>${fmt(c.discussions)}</b> discussions</span>
          <span class="cm-stat"><b>${fmt(c.points)}</b> points</span>
          ${sourceChip('auto', 'Hacker News · last 30 days')}
        </div>
        ${(c.threads || []).length ? `<ul class="cm-threads">
          ${c.threads.map((t) => `<li>
            <a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.title)}</a>
            <span class="cm-tmeta">${fmt(t.points)} pts · ${fmt(t.comments)} comments</span>
          </li>`).join('')}
        </ul>` : `<p class="cm-empty">No recent threads matched in the last 30 days.</p>`}
      </article>`;
  }).join('');
}
