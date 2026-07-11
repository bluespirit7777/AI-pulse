// Community pulse — a big, interactive model conversation stage. Bubble size
// = validated public discussion volume (not raw keyword hits — see R3 in
// scripts/lib/signals.mjs). Clicking a model bubble fans its representative
// comments out as cards arranged AROUND the bubble, connected by thin lines —
// no separate list panel, no topic filter, just click and read. All data is
// pre-built in latest.json.community; excerpts are already sanitised at build
// time but we still esc() on render.
import { esc, timeAgo, prefersReducedMotion, clamp } from './util.js';

const FAMILY_COLOR = {
  gpt: 'var(--deep)', claude: 'var(--coral)', gemini: 'var(--sea)', grok: 'var(--ink-soft)',
  llama: 'var(--sand)', deepseek: 'var(--teal)', qwen: '#7a5c8e',
};
const VW = 900, VH = 560;
const BUBBLE_Y = 78; // bubble row near the top, leaving room for petals below
const PETAL_R = 190; // distance from bubble center to each petal anchor
const PETAL_ARC = 130; // total degrees the petal fan spans, centered straight down
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());

export function renderCommunity(root, community) {
  if (!root) return;
  const models = community?.models || [];
  const comments = community?.comments || [];
  if (!models.length) {
    root.innerHTML = `<p class="empty-state">Community discussion is unavailable right now — it refreshes from Hacker News each cycle. Check back shortly.</p>`;
    return;
  }

  // bubble size = validated public discussions (stories that genuinely discuss
  // the model), NOT raw keyword hits. See scripts/lib/signals.mjs matchModelMention.
  const discussions = (m) => m.validatedDiscussions || 0;
  const ranked = models.slice().sort((a, b) => discussions(b) - discussions(a));
  const state = { modelId: null };
  const maxDisc = Math.max(...models.map(discussions), 1);

  // ---- bubble layout: one row near the top of the stage ----
  const n = ranked.length;
  const pad = 70;
  const positions = ranked.map((m, i) => ({
    key: m.key,
    x: pad + ((i + 0.5) * (VW - pad * 2)) / n,
    y: BUBBLE_Y,
    r: 18 + Math.sqrt(discussions(m) / maxDisc) * 40,
  }));
  const posByKey = Object.fromEntries(positions.map((p) => [p.key, p]));

  root.innerHTML = `
    <div class="cm-stage-wrap">
      <svg class="cm-stage" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="Model conversation stage. Bubble size is validated public discussion volume. Click a model to see its comments arranged around it.">
        <g class="cm-connectors"></g>
        <g class="cm-bubbles"></g>
      </svg>
      <div class="cm-petals" id="cm-petals"></div>
    </div>
    <div class="cm-info" id="cm-info"></div>
    <p class="cm-foot"><b>Bubble size = validated public discussions</b> — Hacker News threads (${esc(community.window || '30D')}) that genuinely discuss the model, not raw keyword hits. A <b>sample</b> of public developer discussion, not the whole community and not a sentiment score. <a class="src-link" href="https://news.ycombinator.com/" target="_blank" rel="noopener">Hacker News</a> · updated ${esc(timeAgo(community.updatedAt))}.</p>
  `;
  const stageWrap = root.querySelector('.cm-stage-wrap');
  const gConn = root.querySelector('.cm-connectors');
  const gB = root.querySelector('.cm-bubbles');
  const petalsEl = root.querySelector('#cm-petals');
  const infoEl = root.querySelector('#cm-info');

  for (const m of ranked) {
    const p = posByKey[m.key];
    const color = FAMILY_COLOR[m.key] || 'var(--ink-soft)';
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'cm-bubble');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('data-key', m.key);
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    g.setAttribute('aria-label', `${m.model}: ${fmt(discussions(m))} validated public discussions in ${esc(community.window || '30D')}${m.limited ? ' (limited sample)' : ''}. Select to see comments around it.`);
    g.innerHTML = `
      <circle class="cm-bub-core" r="${p.r.toFixed(1)}" fill="${color}"></circle>
      <text class="cm-bub-label" text-anchor="middle" dy="0.32em" y="0">${esc(m.model)}</text>
      <text class="cm-bub-count" text-anchor="middle" y="${(p.r + 15).toFixed(0)}">${fmt(discussions(m))}</text>`;
    gB.appendChild(g);
    const sel = () => selectModel(state.modelId === m.key ? null : m.key);
    g.addEventListener('click', sel);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); }
      if (e.key === 'Escape') selectModel(null);
    });
    if (!prefersReducedMotion) g.querySelector('.cm-bub-core').classList.add('cm-bub-pulse');
  }

  // clicking empty stage space deselects
  stageWrap.addEventListener('click', (e) => { if (e.target === stageWrap) selectModel(null); });

  function selectModel(key) {
    state.modelId = key;
    gB.querySelectorAll('.cm-bubble').forEach((b) => {
      const isSel = b.dataset.key === key;
      b.classList.toggle('cm-selected', isSel);
      b.classList.toggle('cm-dimmed', !!key && !isSel);
      b.querySelector('.cm-bub-core').classList.toggle('cm-bub-pulse', !prefersReducedMotion && !key);
    });
    drawPetals();
    drawInfo();
  }

  function petalAnchor(bubble, i, count, marginUnits) {
    // bubbles near the left/right edge of the stage bias their fan toward the
    // center so petals never spill off-stage — without this, the leftmost/
    // rightmost model's petals render partly invisible (clipped by the stage).
    const normX = clamp((bubble.x - VW / 2) / (VW / 2 - pad), -1, 1);
    const biasDeg = -normX * (PETAL_ARC / 2 - 8);
    const angleDeg = biasDeg + (count > 1 ? -PETAL_ARC / 2 + (PETAL_ARC * i) / (count - 1) : 0);
    const rad = (angleDeg * Math.PI) / 180;
    // safety margin sized to the card's OWN rendered half-width (as a fraction
    // of the actual stage width) so it can never push past the edge — this
    // has to be measured live, not a fixed fraction, because the card is
    // proportionally much wider on narrow/mobile stages than on desktop.
    const x = clamp(bubble.x + PETAL_R * Math.sin(rad), marginUnits, VW - marginUnits);
    return { x, y: bubble.y + PETAL_R * Math.cos(rad), rad };
  }

  function drawPetals() {
    gConn.innerHTML = '';
    petalsEl.innerHTML = '';
    if (!state.modelId) return;
    const bubble = posByKey[state.modelId];
    const mine = comments.filter((c) => c.modelId === state.modelId).slice(0, 4);
    // measure a throwaway petal to get its real rendered half-width, then
    // convert to SVG units via the stage's actual current pixel width.
    const stagePx = stageWrap.clientWidth || VW;
    let cardHalfUnits = VW * 0.1;
    if (mine.length) {
      const probe = document.createElement('div');
      probe.className = 'cm-petal';
      probe.style.visibility = 'hidden';
      probe.style.position = 'absolute';
      probe.innerHTML = '<p class="cm-petal-excerpt">x</p>';
      petalsEl.appendChild(probe);
      const halfPx = probe.getBoundingClientRect().width / 2;
      probe.remove();
      cardHalfUnits = (halfPx / stagePx) * VW + VW * 0.02; // + small gutter
    }
    if (!mine.length) {
      petalsEl.innerHTML = `<div class="cm-petal-empty">No representative comments for this model in the current window.</div>`;
      return;
    }
    mine.forEach((c, i) => {
      const a = petalAnchor(bubble, i, mine.length, cardHalfUnits);
      const edgeX = bubble.x + (bubble.r + 4) * Math.sin(a.rad);
      const edgeY = bubble.y + (bubble.r + 4) * Math.cos(a.rad);
      gConn.insertAdjacentHTML('beforeend', `<path class="cm-connector" d="M ${edgeX.toFixed(1)} ${edgeY.toFixed(1)} L ${a.x.toFixed(1)} ${(a.y - 6).toFixed(1)}"></path>`);
      const petal = document.createElement('div');
      petal.className = 'cm-petal';
      petal.style.left = `${(a.x / VW) * 100}%`;
      petal.style.top = `${(a.y / VH) * 100}%`;
      petal.style.animationDelay = `${i * 40}ms`;
      petal.innerHTML = `
        <p class="cm-petal-excerpt">${esc(c.excerpt)}</p>
        <div class="cm-petal-meta">
          <span>${esc(c.author || 'anon')} · ${esc(timeAgo(c.publishedAt))}</span>
          <a href="${esc(c.url)}" target="_blank" rel="noopener">read on HN</a>
        </div>`;
      petalsEl.appendChild(petal);
    });
  }

  function drawInfo() {
    if (!state.modelId) {
      infoEl.innerHTML = `<p class="empty-state" style="margin:0;">Click a model above to see what people are saying about it.</p>`;
      return;
    }
    const m = models.find((x) => x.key === state.modelId);
    if (!m) { infoEl.innerHTML = ''; return; }
    infoEl.innerHTML = `
      <div class="cm-head">
        <div><span class="cm-model">${esc(m.model)}</span> <span class="cm-org">${esc(m.org || '')}${m.version && m.version !== m.model ? ' · ' + esc(m.version) : ''}</span></div>
        <div class="cm-stats"><span><b>${fmt(m.validatedDiscussions)}</b> discussions</span><span><b>${fmt(m.validatedMentions)}</b> mentions</span></div>
      </div>
      ${m.limited ? `<p class="cm-limited">⚠ Limited discussion sample — few validated threads in this window; treat as indicative only.</p>` : ''}
      ${(m.topThreads || []).length ? `<div class="cm-threads"><span class="cm-threads-h">Most-discussed threads</span>
        ${m.topThreads.map((t) => `<a href="${esc(t.url)}" target="_blank" rel="noopener" class="cm-thread">${esc(t.title)} <span class="cm-thread-n">${t.points} pts</span></a>`).join('')}</div>` : ''}
    `;
  }

  drawInfo();
}
