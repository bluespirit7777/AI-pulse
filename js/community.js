// Community pulse — "Community Current": a horizontal model selector (real
// buttons in an accessible tablist, not SVG-embedded controls) plus a
// two-column info/themes panel and a short list of representative comments.
// Replaces the earlier radial/petal stage entirely — no absolute-positioned
// cards, no runtime measurement, no starburst connector lines. All data is
// pre-built in latest.json.community; excerpts are sanitised at build time
// but we still esc() on render.
import { esc, timeAgo } from './util.js';

const FAMILY_COLOR = {
  gpt: 'var(--deep)', claude: 'var(--coral)', gemini: 'var(--sea)', grok: 'var(--ink-soft)',
  llama: 'var(--sand)', deepseek: 'var(--teal)', qwen: '#7a5c8e',
};
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
const pct = (n) => `${Math.round((n || 0) * 100)}%`;

// A model's headline discussion count: exact when the whole raw-hit set was
// paginated through and validated (isEstimated === false), otherwise a
// clearly-marked estimate scaled from the validated fraction of the sample —
// never presented as if it were an exact count. See scripts/update-data.mjs.
function discussionCount(m) {
  return m.estimatedRelevantDiscussions || 0;
}

export function renderCommunity(root, community) {
  if (!root) return;
  const models = community?.models || [];
  const comments = community?.comments || [];
  if (!models.length) {
    root.innerHTML = `<p class="empty-state">Community discussion is unavailable right now — it refreshes from Hacker News each cycle. Check back shortly.</p>`;
    return;
  }

  const ranked = models.slice().sort((a, b) => discussionCount(b) - discussionCount(a));
  const maxDisc = Math.max(...ranked.map(discussionCount), 1);
  const state = { modelId: ranked[0].key, showAll: false };

  root.innerHTML = `
    <div class="cc">
      <div class="cc-selector" role="tablist" aria-label="Select a model to see its community discussion">
        ${ranked.map((m, i) => {
          const disc = discussionCount(m);
          const scale = Math.sqrt(disc / maxDisc); // 0..1, area-proportional to discussion volume
          const color = FAMILY_COLOR[m.key] || 'var(--ink-soft)';
          return `
          <button type="button" role="tab" class="cc-tab${m.limited ? ' cc-tab--limited' : ''}"
            id="cc-tab-${esc(m.key)}" data-key="${esc(m.key)}"
            aria-selected="${m.key === state.modelId}" aria-controls="cc-panel" tabindex="${m.key === state.modelId ? '0' : '-1'}"
            style="--scale:${scale.toFixed(3)};--accent:${color}"
            aria-label="${esc(m.model)}: ${m.isEstimated ? 'approximately ' : ''}${fmt(disc)} relevant discussions${m.limited ? ', limited sample' : ''}">
            <span class="cc-tab-name">${esc(m.model)}</span>
            <span class="cc-tab-count">${m.isEstimated ? '≈' : ''}${fmt(disc)}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="cc-panel" id="cc-panel" role="tabpanel" aria-labelledby="cc-tab-${esc(state.modelId)}"></div>
    </div>
    <p class="cc-foot">Discussion volume and themes come from a <b>sample</b> of <a class="src-link" href="https://news.ycombinator.com/" target="_blank" rel="noopener">Hacker News</a> stories and comments (${esc(community.window || '30D')}), matched to each model with contextual validation — not a raw keyword count and not a sentiment score. Updated ${esc(timeAgo(community.updatedAt))}.</p>
  `;

  const tabs = Array.from(root.querySelectorAll('.cc-tab'));
  const panel = root.querySelector('#cc-panel');

  function select(key, { focusTab = false } = {}) {
    state.modelId = key;
    state.showAll = false;
    tabs.forEach((t) => {
      const isSel = t.dataset.key === key;
      t.setAttribute('aria-selected', String(isSel));
      t.tabIndex = isSel ? 0 : -1;
      if (isSel && focusTab) t.focus();
    });
    panel.setAttribute('aria-labelledby', `cc-tab-${key}`);
    renderPanel();
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.key));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(i + dir + tabs.length) % tabs.length];
        select(next.dataset.key, { focusTab: true });
      } else if (e.key === 'Home') {
        e.preventDefault();
        select(tabs[0].dataset.key, { focusTab: true });
      } else if (e.key === 'End') {
        e.preventDefault();
        select(tabs[tabs.length - 1].dataset.key, { focusTab: true });
      }
    });
  });

  function renderPanel() {
    const m = models.find((x) => x.key === state.modelId);
    if (!m) { panel.innerHTML = ''; return; }
    const mine = comments.filter((c) => c.modelId === state.modelId);
    const visibleCount = state.showAll ? Math.min(4, mine.length) : Math.min(3, mine.length);
    const topThemes = (m.themes || []).slice(0, 4);
    const maxThemeCount = Math.max(...topThemes.map((t) => t.count), 1);

    panel.innerHTML = `
      <div class="cc-grid">
        <div class="cc-col cc-col-info">
          <div class="cc-info-head">
            <span class="cc-info-model">${esc(m.model)}</span>
            <span class="cc-info-org">${esc(m.org || '')}${m.version && m.version !== m.model ? ' · ' + esc(m.version) : ''}</span>
          </div>
          <dl class="cc-facts">
            <div><dt>Relevant discussions</dt><dd>${m.isEstimated ? '≈' : ''}${fmt(discussionCount(m))}</dd></div>
            <div><dt>Validated comments</dt><dd>${fmt(m.validatedCommentCount)}</dd></div>
            <div><dt>Data coverage</dt><dd>${pct(m.storyCoverage)} stories · ${pct(m.commentCoverage)} comments</dd></div>
          </dl>
          <p class="cc-status">
            ${m.isEstimated ? '<span class="cc-badge cc-badge--estimate">Estimated</span>' : '<span class="cc-badge cc-badge--exact">Exact count</span>'}
            ${m.limited ? '<span class="cc-badge cc-badge--limited">Limited sample</span>' : ''}
          </p>
        </div>
        <div class="cc-col cc-col-themes">
          <span class="cc-themes-h">Themes in sampled comments</span>
          ${topThemes.length ? `<ul class="cc-wavebars">
            ${topThemes.map((t) => `
              <li>
                <span class="cc-wavebar-label">${esc(t.label)}</span>
                <span class="cc-wavebar-track"><span class="cc-wavebar-fill" style="--w:${Math.round((t.count / maxThemeCount) * 100)}%; --accent:${FAMILY_COLOR[m.key] || 'var(--ink-soft)'}"></span></span>
                <span class="cc-wavebar-n">${t.count}</span>
              </li>`).join('')}
          </ul>` : `<p class="cc-empty">No clear themes in the sampled comments yet.</p>`}
        </div>
      </div>
      <div class="cc-voices">
        <h3 class="cc-voices-h">Representative voices</h3>
        ${mine.length ? `
          <ul class="cc-comments">
            ${mine.slice(0, visibleCount).map((c) => `
              <li class="cc-comment">
                <div class="cc-comment-themes">${(c.themes || []).map((tid) => {
                  const theme = (m.themes || []).find((t) => t.id === tid);
                  return theme ? `<span class="cc-theme-tag">${esc(theme.label)}</span>` : '';
                }).join('')}</div>
                <p class="cc-comment-excerpt">${esc(c.excerpt)}</p>
                <div class="cc-comment-meta">
                  <span>${esc(c.author || 'anon')} · ${esc(timeAgo(c.publishedAt))}</span>
                  <a href="${esc(c.url)}" target="_blank" rel="noopener">Read on Hacker News</a>
                </div>
              </li>`).join('')}
          </ul>
          ${mine.length > 3 && !state.showAll ? `<button type="button" class="cc-show-more">Show one more</button>` : ''}
        ` : `<p class="cc-empty">No representative comments for this model in the current window.</p>`}
      </div>
    `;

    const moreBtn = panel.querySelector('.cc-show-more');
    if (moreBtn) moreBtn.addEventListener('click', () => { state.showAll = true; renderPanel(); });
  }

  renderPanel();
}
