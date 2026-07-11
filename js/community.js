// Community pulse — a big, interactive model conversation stage. Bubble size
// = validated public discussion volume (not raw keyword hits — see R3 in
// scripts/lib/signals.mjs). Clicking a model bubble fans its representative
// comments out as cards arranged AROUND the bubble, connected by thin lines —
// no separate list panel, no topic filter, just click and read. All data is
// pre-built in latest.json.community; excerpts are already sanitised at build
// time but we still esc() on render.
import { esc, timeAgo, prefersReducedMotion } from './util.js';

const FAMILY_COLOR = {
  gpt: 'var(--deep)', claude: 'var(--coral)', gemini: 'var(--sea)', grok: 'var(--ink-soft)',
  llama: 'var(--sand)', deepseek: 'var(--teal)', qwen: '#7a5c8e',
};
const VW = 900, VH = 560;
const GRID_COLS = 3; // bubbles lay out 3-per-row
const GRID_TOP_Y = 60;
const GRID_ROW_GAP = 100;
// Petals always anchor in this fixed band BELOW THE WHOLE GRID, regardless of
// which row the selected bubble is in — a fixed radial fan (as when there was
// only one bubble row) would land a top-row bubble's petals on top of the
// rows below it. A short connector line from the bubble down to this band
// still reads as "its comments, right here" without ever overlapping another
// model's bubble. All petals sit in ONE horizontal row (not stacked) — real
// card height (~150-180px, several lines of excerpt text) is too tall for a
// second stacked row to fit in the remaining vertical budget below the grid.
const PETAL_ZONE_Y = 330;
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

  // ---- bubble layout: 3 per row, wrapping into a grid; a partial last row
  //      is centered rather than left-hugging so it doesn't look stranded ----
  const pad = 70;
  const positions = [];
  for (let start = 0; start < ranked.length; start += GRID_COLS) {
    const rowModels = ranked.slice(start, start + GRID_COLS);
    const ri = start / GRID_COLS;
    rowModels.forEach((m, ci) => {
      positions.push({
        key: m.key,
        x: pad + ((ci + 0.5) * (VW - pad * 2)) / rowModels.length,
        y: GRID_TOP_Y + ri * GRID_ROW_GAP,
        // capped so two vertically-adjacent rows of bubbles never touch
        r: 15 + Math.sqrt(discussions(m) / maxDisc) * 29,
      });
    });
  }
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

  function petalAnchor(bubble, i, count, colsPerRow, colGapUnits, rowGapUnits, shiftUnits) {
    // A grid of cards below the bubble — NOT a radial fan around it, because
    // with bubbles now on 3 rows, a fan from a top-row bubble would land on
    // top of the rows below it. Anchoring every model's petals to the same
    // below-the-grid band means they never overlap another bubble regardless
    // of which row was clicked. colsPerRow adapts to the stage's actual
    // width (see drawPetals) so cards never need to overlap or overflow —
    // on desktop that's usually all of them in one row; on narrow/mobile
    // stages it wraps to 2 columns.
    const row = Math.floor(i / colsPerRow);
    const col = i % colsPerRow;
    const colsInThisRow = Math.min(colsPerRow, count - row * colsPerRow);
    const xOffset = colsInThisRow > 1 ? (col - (colsInThisRow - 1) / 2) * colGapUnits : 0;
    return { x: bubble.x + xOffset + shiftUnits, y: PETAL_ZONE_Y + row * rowGapUnits };
  }

  function drawPetals() {
    gConn.innerHTML = '';
    petalsEl.innerHTML = '';
    stageWrap.style.minHeight = ''; // reset before recomputing below
    if (!state.modelId) return;
    const bubble = posByKey[state.modelId];
    const mine = comments.filter((c) => c.modelId === state.modelId).slice(0, 4);
    if (!mine.length) {
      petalsEl.innerHTML = `<div class="cm-petal-empty">No representative comments for this model in the current window.</div>`;
      return;
    }
    // Two-pass layout: first render every real card (hidden, unpositioned) to
    // measure its ACTUAL size — different excerpts wrap to different heights,
    // so sizing row/column spacing off just one probe card left taller cards
    // overlapping the row below them. Only once every card's real size is
    // known do we compute a uniform grid (max width/height) and position them.
    // pxPerUnit is derived from WIDTH alone (never affected by the min-height
    // growth below) so it stays valid even after the wrapper grows taller —
    // the SVG's own preserveAspectRatio scales by width the same way.
    const rect = stageWrap.getBoundingClientRect();
    const pxPerUnit = (rect.width || VW) / VW;
    const els = mine.map((c) => {
      const petal = document.createElement('div');
      petal.className = 'cm-petal';
      petal.style.visibility = 'hidden';
      petal.innerHTML = `
        <p class="cm-petal-excerpt">${esc(c.excerpt)}</p>
        <div class="cm-petal-meta">
          <span>${esc(c.author || 'anon')} · ${esc(timeAgo(c.publishedAt))}</span>
          <a href="${esc(c.url)}" target="_blank" rel="noopener">read on HN</a>
        </div>`;
      petalsEl.appendChild(petal);
      return petal;
    });
    const sizesPx = els.map((el) => el.getBoundingClientRect());
    const maxWidthPx = Math.max(...sizesPx.map((s) => s.width));
    const maxHeightPx = Math.max(...sizesPx.map((s) => s.height));
    const widthUnits = maxWidthPx / pxPerUnit;
    const heightUnits = maxHeightPx / pxPerUnit;
    const gutterUnits = VW * 0.015;
    const colGapUnits = widthUnits + gutterUnits; // adjacent cards can never overlap: gap >= widest card
    const rowGapUnits = heightUnits + VH * 0.05; // stacked rows can never overlap: gap >= tallest card
    const marginUnits = widthUnits / 2 + gutterUnits;

    // as many columns as actually fit across the stage — usually all of them
    // on desktop, fewer on narrow/mobile stages, wrapping the rest to
    // additional rows instead of forcing an overflow.
    const colsPerRow = Math.max(1, Math.min(mine.length, Math.floor((VW - 2 * marginUnits) / colGapUnits) || 1));
    const rowCount = Math.ceil(mine.length / colsPerRow);

    // shift the WHOLE grid horizontally (not each card independently — that
    // let cards near an edge collapse onto each other) just enough to keep
    // every card within the stage bounds, preserving their even spacing.
    const widestRowCols = Math.min(colsPerRow, mine.length);
    const halfSpan = widestRowCols > 1 ? ((widestRowCols - 1) / 2) * colGapUnits : 0;
    let shiftUnits = 0;
    if (bubble.x - halfSpan < marginUnits) shiftUnits = marginUnits - (bubble.x - halfSpan);
    else if (bubble.x + halfSpan > VW - marginUnits) shiftUnits = (VW - marginUnits) - (bubble.x + halfSpan);

    // if wrapping to multiple rows needs more vertical room than the panel's
    // natural aspect-ratio height provides (a real possibility with several
    // long excerpts stacked on a narrow phone), grow the panel to fit rather
    // than letting cards spill past its background into whatever follows it
    // on the page. Positions below are in PX (not %) specifically so this
    // growth never shifts them — a percentage would recompute against the
    // new, taller height and throw off the whole layout.
    const neededUnits = PETAL_ZONE_Y + (rowCount - 1) * rowGapUnits + heightUnits + VH * 0.03;
    const neededPx = neededUnits * pxPerUnit;
    if (neededPx > rect.height) stageWrap.style.minHeight = `${Math.ceil(neededPx)}px`;

    // every connector starts at the same point — the bubble's bottom edge —
    // and fans out to each card, a clean "starburst from one point" look.
    const originX = bubble.x, originY = bubble.y + bubble.r + 4;
    els.forEach((petal, i) => {
      const a = petalAnchor(bubble, i, mine.length, colsPerRow, colGapUnits, rowGapUnits, shiftUnits);
      gConn.insertAdjacentHTML('beforeend', `<path class="cm-connector" d="M ${originX.toFixed(1)} ${originY.toFixed(1)} L ${a.x.toFixed(1)} ${(a.y - 6).toFixed(1)}"></path>`);
      petal.style.left = `${(a.x * pxPerUnit).toFixed(1)}px`;
      petal.style.top = `${(a.y * pxPerUnit).toFixed(1)}px`;
      petal.style.animationDelay = `${i * 40}ms`;
      petal.style.visibility = '';
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
