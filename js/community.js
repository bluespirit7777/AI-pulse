// Community pulse — a model conversation map + representative public comments.
// Not just a comment feed and not a sentiment score: bubble size = mention
// volume, per-model topic themes, and real excerpts you can click through to.
// All data is pre-built in latest.json.community; excerpts are already
// sanitised at build time but we still esc() on render. Topic/volume grouping
// is used instead of a made-up positive/negative score.
import { esc, timeAgo, prefersReducedMotion } from './util.js';

const FAMILY_COLOR = {
  gpt: 'var(--deep)', claude: 'var(--coral)', gemini: 'var(--sea)', grok: 'var(--ink-soft)',
  llama: 'var(--sand)', deepseek: 'var(--teal)', qwen: '#7a5c8e',
};
const VW = 900, VH = 190;
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

export function renderCommunity(root, community) {
  if (!root) return;
  const models = community?.models || [];
  const comments = community?.comments || [];
  if (!models.length) {
    root.innerHTML = `<p class="empty-state">Community discussion is unavailable right now — it refreshes from Hacker News each cycle. Check back shortly.</p>`;
    return;
  }

  const ranked = models.slice().sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0));
  const state = { modelId: ranked[0].key, theme: 'all' };
  const maxMention = Math.max(...models.map((m) => m.mentionCount || 0), 1);

  // ---- bubble layout (deterministic, sized by mention volume) ----
  const n = ranked.length;
  const pad = 60;
  const positions = ranked.map((m, i) => ({
    key: m.key,
    x: pad + ((i + 0.5) * (VW - pad * 2)) / n,
    y: VH / 2 - 6,
    r: 14 + Math.sqrt((m.mentionCount || 0) / maxMention) * 34,
  }));
  const posByKey = Object.fromEntries(positions.map((p) => [p.key, p]));

  root.innerHTML = `
    <div class="cm-map-wrap">
      <svg class="cm-map" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Model conversation map: bubble size is 30-day mention volume on Hacker News. A per-model breakdown follows.">
        <g class="cm-bubbles"></g>
      </svg>
    </div>
    <div class="cm-detail" id="cm-detail"></div>
    <p class="cm-foot">A <b>sample</b> of public developer discussion from <a class="src-link" href="https://news.ycombinator.com/" target="_blank" rel="noopener">Hacker News</a> (${esc(community.window || '30D')}) — not the whole community, and not a sentiment score. Updated ${esc(timeAgo(community.updatedAt))}.</p>
  `;
  const gB = root.querySelector('.cm-bubbles');

  for (const m of ranked) {
    const p = posByKey[m.key];
    const color = FAMILY_COLOR[m.key] || 'var(--ink-soft)';
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'cm-bubble');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('data-key', m.key);
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    g.setAttribute('aria-label', `${m.model}: ${fmt(m.mentionCount)} mentions in ${esc(community.window || '30D')}. Top themes ${(m.themes || []).slice(0, 3).map((t) => t.label).join(', ') || 'none'}. Select to see comments.`);
    g.innerHTML = `
      <circle class="cm-bub-core" r="${p.r.toFixed(1)}" fill="${color}"></circle>
      <text class="cm-bub-label" text-anchor="middle" dy="0.32em" y="0">${esc(m.model)}</text>
      <text class="cm-bub-count" text-anchor="middle" y="${(p.r + 13).toFixed(0)}">${fmt(m.mentionCount)}</text>`;
    gB.appendChild(g);
    const sel = () => selectModel(m.key);
    g.addEventListener('click', sel);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); } });
    if (!prefersReducedMotion && m.key === state.modelId) g.querySelector('.cm-bub-core').classList.add('cm-bub-pulse');
  }

  function selectModel(key) {
    state.modelId = key;
    state.theme = 'all';
    gB.querySelectorAll('.cm-bubble').forEach((b) => b.classList.toggle('cm-selected', b.dataset.key === key));
    gB.querySelectorAll('.cm-bub-core').forEach((c) => c.classList.remove('cm-bub-pulse'));
    drawDetail();
  }

  function drawDetail() {
    const m = models.find((x) => x.key === state.modelId) || ranked[0];
    const detail = root.querySelector('#cm-detail');
    const themeChips = [{ id: 'all', label: 'All', count: (m.themes || []).reduce((s, t) => s + t.count, 0) }, ...(m.themes || [])];
    const mine = comments.filter((c) => c.modelId === m.key && (state.theme === 'all' || c.theme === state.theme));

    detail.innerHTML = `
      <div class="cm-head">
        <div><span class="cm-model">${esc(m.model)}</span> <span class="cm-org">${esc(m.org || '')}${m.version && m.version !== m.model ? ' · ' + esc(m.version) : ''}</span></div>
        <div class="cm-stats"><span><b>${fmt(m.mentionCount)}</b> mentions</span><span><b>${fmt(m.uniqueDiscussionCount)}</b> threads</span></div>
      </div>
      ${(m.themes || []).length ? `<div class="cm-themes" role="tablist" aria-label="Filter comments by topic">
        ${themeChips.map((t) => `<button class="cm-theme${t.id === state.theme ? ' active' : ''}" role="tab" aria-selected="${t.id === state.theme}" data-theme="${esc(t.id)}">${esc(t.label)}${t.id !== 'all' ? ` <span class="cm-theme-n">${t.count}</span>` : ''}</button>`).join('')}
      </div>` : ''}
      <div class="cm-comments">
        ${mine.length ? mine.map((c) => `
          <blockquote class="cm-comment">
            <span class="cm-comment-theme">${esc(themeLabel(m, c.theme))}</span>
            <p class="cm-excerpt">${esc(c.excerpt)}</p>
            <footer class="cm-comment-meta">${esc(c.author || 'anon')} · ${esc(c.source)} · ${esc(timeAgo(c.publishedAt))} · <a class="src-link" href="${esc(c.url)}" target="_blank" rel="noopener">read on HN</a></footer>
          </blockquote>`).join('')
        : `<p class="empty-state">No representative comments for this filter in the current window.</p>`}
      </div>
      ${(m.topThreads || []).length ? `<div class="cm-threads"><span class="cm-threads-h">Most-discussed threads</span>
        ${m.topThreads.map((t) => `<a href="${esc(t.url)}" target="_blank" rel="noopener" class="cm-thread">${esc(t.title)} <span class="cm-thread-n">${t.points} pts</span></a>`).join('')}</div>` : ''}
    `;
    detail.querySelectorAll('.cm-theme').forEach((b) => b.addEventListener('click', () => {
      state.theme = b.dataset.theme;
      detail.querySelectorAll('.cm-theme').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-selected', String(on)); });
      // re-render only the comments list
      drawDetail();
    }));
  }

  function themeLabel(m, id) {
    return (m.themes || []).find((t) => t.id === id)?.label || id;
  }

  selectModel(state.modelId);
}
