// Today's 60-second briefing — the calm default view. Built entirely from
// data already computed for Waves/River/Releases (data.waves, data.signals,
// data.releases); no separate fetch, no invented summary. Compact references
// only (headline + one line), never full duplicate cards — the full detail
// lives one click away in the Waves/River/Tide tabs.
import { esc, timeAgo } from './util.js';
import { freshnessChip } from './freshness.js';

const FAMILY_LABEL = { product: 'Product', market: 'Market', research: 'Research' };

function countLast24h(signals) {
  const now = Date.now();
  return (signals || []).filter((s) => (now - Date.parse(s.dateISO)) / 3.6e6 <= 24).length;
}

function countByCategory(signals) {
  const now = Date.now();
  const counts = {};
  for (const s of signals || []) {
    if ((now - Date.parse(s.dateISO)) / 3.6e6 > 24) continue;
    counts[s.category] = (counts[s.category] || 0) + 1;
  }
  return counts;
}

export function renderBriefing(root, data) {
  if (!root) return;
  const waves = data.waves || [];
  const signals = data.signals || [];
  const count24h = countLast24h(signals);
  const byCat = countByCategory(signals);
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const firstRelease = (data.releases || []).find((r) => (r.items || []).length);
  const topRelease = firstRelease?.items?.[0];

  root.innerHTML = `
    <div class="briefing">
      <p class="briefing-lede">
        <b>${esc(String(count24h))} signal${count24h === 1 ? '' : 's'}</b> crossed the wire in the last 24 hours${
          topCats.length ? ', led by ' + topCats.map(([c, n]) => `${esc(c)} (${n})`).join(', ') : ''
        }. ${freshnessChip(data.updatedAt)}
      </p>

      ${waves.length ? `
        <div class="briefing-waves">
          <span class="briefing-h">Today's strongest moves</span>
          <ul class="briefing-list">
            ${waves.map((w) => `
              <li>
                <span class="briefing-fam">${esc(FAMILY_LABEL[w.family] || w.family)}</span>
                <span class="briefing-title">${esc(w.title)}</span>
                <span class="briefing-why">${esc(w.whyItMatters || '')}</span>
              </li>`).join('')}
          </ul>
          <button type="button" class="briefing-goto" data-goto-tab="waves">See the full waves →</button>
        </div>` : ''}

      ${topRelease ? `
        <div class="briefing-release">
          <span class="briefing-h">Most recent release</span>
          <a class="src-link" href="${esc(topRelease.url)}" target="_blank" rel="noopener">${esc(topRelease.h)}</a>
          <span class="briefing-d">${esc(topRelease.d)}</span>
        </div>` : ''}

      <div class="briefing-more">
        <button type="button" class="briefing-goto" data-goto-tab="river">Full chronological river →</button>
        <button type="button" class="briefing-goto" data-goto-tab="tide">Daily activity by category →</button>
      </div>

      <p class="briefing-updated">Data updated ${esc(timeAgo(data.updatedAt))}. Waves are an editorial pick (impact, not just recency) — River shows everything, unfiltered.</p>
    </div>
  `;
}
