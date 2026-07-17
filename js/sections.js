// Renderers for the detailed evidence sections below the hero. Live sections
// (releases, wire, feed, breakthroughs, stocks) come from latest.json; ranking
// panels come from curated.js. Ported from the original inline script, with
// freshness/provenance chips added.
import { esc, fmtSnapshot } from './util.js';
import { freshnessChip, verificationChip, sourceChip } from './freshness.js';
import * as C from './curated.js';
import { MODEL_REGISTRY } from '../scripts/lib/models.mjs';

const LOGO = {
  anthropic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="5.3" x2="18.7" y2="18.7"/><line x1="18.7" y1="5.3" x2="5.3" y2="18.7"/></svg>`,
  openai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2.6 20.2,7.3 20.2,16.7 12,21.4 3.8,16.7 3.8,7.3"/><circle cx="12" cy="12" r="3.1"/></svg>`,
  google: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8c.3 5.1.9 8.7 3.1 10.2-2.2 1.5-2.8 5.1-3.1 10.2-.3-5.1-.9-8.7-3.1-10.2C11.1 10.5 11.7 6.9 12 1.8Z"/><path d="M22.2 12c-5.1.3-8.7.9-10.2 3.1 1.5-2.2 1.5-5.9 0-8.2C13.5 9.1 17.1 11.7 22.2 12Z" opacity=".55"/></svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/></svg>`,
};
const ACCENT = { anthropic: 'var(--coral)', openai: 'var(--deep)', google: 'var(--sea)', meta: 'var(--ink-soft)', xai: 'var(--ink-soft)', policy: 'var(--sand)', other: 'var(--sand)' };
// Frontier Releases shows exactly these 3 brands, always, in this order —
// name/org come from the canonical MODEL_REGISTRY so this can never drift
// from Community Pulse or the Leaderboard.
const RELEASE_BRAND = {
  anthropic: { name: MODEL_REGISTRY.claude.brand, org: MODEL_REGISTRY.claude.org },
  openai: { name: MODEL_REGISTRY.gpt.brand, org: MODEL_REGISTRY.gpt.org },
  google: { name: MODEL_REGISTRY.gemini.brand, org: MODEL_REGISTRY.gemini.org },
};
const YT_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true"><path d="M9.5 7.5v9l8-4.5-8-4.5Z"/></svg>`;
// Release cards are keyed by logoKey (anthropic/openai/google, matching the
// RSS/YouTube feed source); the trending-videos data is keyed by the
// canonical MODEL_REGISTRY id (claude/gpt/gemini) — this bridges the two.
const LOGO_TO_MODEL_KEY = { anthropic: 'claude', openai: 'gpt', google: 'gemini' };
const fmtViews = (n) => (n == null ? null : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));

const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

// Hardware-tier tables for the Local AI flip-card backs (curated.js's
// localAiPcSpecs / localAiMobileSpecs) — a calculated editorial estimate
// (params × quantization ratio), never presented as a benchmarked figure.
function specTable(rows) {
  return `
    <table class="spec-table">
      <thead><tr><th>Model</th><th>Params</th><th>Size (4-bit)</th><th>Needs</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td><span class="spec-model">${esc(r.model)}</span><br><span class="spec-tier spec-tier-${r.tier}">${esc(r.tierLabel)}</span></td>
            <td>${esc(r.params)}</td>
            <td>${esc(r.approxSize)}</td>
            <td>${esc(r.setup)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// Honesty pass (Phase 4): a bar only appears where a rating exists. A real,
// published `score` (Humanity's Last Exam %, Elo …) drives a bar scaled
// linearly against the strongest score in the same list and is shown as the
// row's rating. When `showIndex` is on (the Frontier leaderboard), a view
// without per-model benchmarks instead surfaces `w` — a 0–100 editorial
// composite index — as the rating, with a "/100" unit and a tooltip so it
// reads as a weighted placement, not a measurement (the per-view disclaimer
// and each row's note reinforce this). Rows with neither a score nor (where
// allowed) an index — a benchmark simply not run on that model — fall back to
// an ordinal rank with an "Editorial ranking" tag and no fabricated number.
// Other ranked lists (local/video AI) leave `showIndex` off so their `stat`
// column (hardware needs, etc.) stays prominent instead of a bare index.
// Ties share a rank number with a "T-" prefix.
function rankRows(rows, { showIndex = false } = {}) {
  const scored = rows.filter((r) => r.score != null);
  const maxScore = scored.length ? Math.max(...scored.map((r) => r.score)) : 0;
  const rankCounts = new Map();
  for (const r of rows) rankCounts.set(r.rank, (rankCounts.get(r.rank) || 0) + 1);

  return rows.map((r) => {
    const tied = rankCounts.get(r.rank) > 1;
    const rankLabel = (tied ? 'T-' : '') + String(r.rank).padStart(2, '0');
    const hasScore = r.score != null;
    const hasIndex = showIndex && !hasScore && r.w != null;
    const showBar = hasScore || hasIndex;
    const barPct = hasScore
      ? (maxScore ? Math.round((r.score / maxScore) * 100) : 0)
      : (hasIndex ? Math.max(0, Math.min(100, r.w)) : 0);
    const rating = hasScore
      ? `${esc(String(r.score))}<span class="lb-score-unit">${esc(r.scoreUnit || '')}</span>`
      : (hasIndex ? `${esc(String(r.w))}<span class="lb-score-unit">/100</span>` : '');
    return `
    <div class="lb-row${showBar ? '' : ' lb-row--ordinal'}">
      <div class="lb-top">
        <div class="lb-name">
          <span class="lb-rank">${esc(rankLabel)}</span>
          <span class="lb-model">${esc(r.model)}</span>
          <span class="lb-org">${esc(r.org)}</span>
        </div>
        ${rating
          ? `<span class="lb-score"${hasIndex ? ' title="Composite index (0–100), editorial weighting — not a single measured benchmark"' : ''}>${rating}</span>`
          : `<span class="lb-stat">${esc(r.stat)}</span>`}
      </div>
      ${showBar
        ? `<div class="bar-track"><div class="bar-fill" style="--w:${barPct}%"></div></div>`
        : `<div class="lb-editorial-tag">Editorial ranking · no measured score for this view</div>`}
      <div class="lb-note">${hasIndex && r.stat ? `<span class="lb-note-lead">${esc(r.stat)}</span> — ` : ''}${esc(r.note)}</div>
    </div>`;
  }).join('');
}

// Hovering the donut shows which AI a wedge belongs to — the conic-gradient
// has no per-wedge DOM element, so the wedge is found by converting the
// cursor angle (clockwise from 12 o'clock, matching CSS conic-gradient) into
// a cumulative-percent lookup against the same marketShare array that drew
// the gradient, so tooltip and wedge can never disagree.
function segmentAtPct(pct) {
  let acc = 0;
  for (const row of C.marketShare) {
    const start = acc;
    acc += row.pct;
    if (pct < acc || row === C.marketShare[C.marketShare.length - 1]) return { ...row, start, end: acc };
  }
  return null;
}

function wireDonutTooltip() {
  const donut = document.getElementById('donut');
  const wrap = donut?.closest('.donut-wrap');
  const tip = document.getElementById('donut-tooltip');
  if (!donut || !wrap || !tip || donut.dataset.tooltipWired) return;
  donut.dataset.tooltipWired = '1';
  const label = donut.querySelector('.donut-label');

  function onMove(e) {
    const rect = donut.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const outerR = rect.width / 2;
    const innerR = label ? label.getBoundingClientRect().width / 2 : outerR * 0.42;
    if (dist > outerR || dist < innerR) { tip.hidden = true; return; }
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI); // clockwise from 12 o'clock
    if (angle < 0) angle += 360;
    const seg = segmentAtPct((angle / 360) * 100);
    if (!seg) { tip.hidden = true; return; }
    tip.innerHTML = `<span class="donut-tt-dot" style="background:${seg.color}"></span><b>${esc(seg.name)}</b> ${esc(seg.pct)}%`;
    tip.hidden = false;
    const wrapRect = wrap.getBoundingClientRect();
    tip.style.left = (e.clientX - wrapRect.left + 14) + 'px';
    tip.style.top = (e.clientY - wrapRect.top - 12) + 'px';
  }
  donut.addEventListener('mousemove', onMove);
  donut.addEventListener('mouseleave', () => { tip.hidden = true; });
  // safety net: also hide on leaving the wider wrap (covers the legend and
  // any gap between it and the circle), so the tooltip can never be left
  // showing once the cursor is no longer anywhere near the pie chart.
  wrap.addEventListener('mouseleave', () => { tip.hidden = true; });
}

// Leaderboard: 4 use-case-specific views (Overall balance / Reasoning /
// Agentic coding / Cost efficiency), not one blended "objective" rank — see
// LEADERBOARD_VIEWS in curated.js. Overall balance is the only view with a
// disclaimer (it's an editorial blend); the other three are direct benchmark
// readouts, so no disclaimer is shown for them.
function wireLeaderboardTabs() {
  const tabsEl = document.getElementById('lb-tabs');
  const disclaimerEl = document.getElementById('lb-disclaimer');
  if (!tabsEl) return;
  tabsEl.innerHTML = C.LEADERBOARD_VIEWS.map((v, i) => `
    <button type="button" role="tab" class="lb-tab" id="lb-tab-${v.id}" data-id="${v.id}"
      aria-selected="${i === 0}" aria-controls="leaderboard" tabindex="${i === 0 ? '0' : '-1'}">${esc(v.label)}</button>
  `).join('');
  const tabs = Array.from(tabsEl.querySelectorAll('.lb-tab'));

  function select(id, { focusTab = false } = {}) {
    const view = C.LEADERBOARD_VIEWS.find((v) => v.id === id) || C.LEADERBOARD_VIEWS[0];
    tabs.forEach((t) => {
      const isSel = t.dataset.id === view.id;
      t.setAttribute('aria-selected', String(isSel));
      t.tabIndex = isSel ? 0 : -1;
      if (isSel && focusTab) t.focus();
    });
    setHTML('leaderboard', rankRows(view.data, { showIndex: true }));
    if (disclaimerEl) {
      disclaimerEl.textContent = view.disclaimer || '';
      disclaimerEl.hidden = !view.disclaimer;
    }
    animateBars();
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.id));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        select(tabs[(i + dir + tabs.length) % tabs.length].dataset.id, { focusTab: true });
      } else if (e.key === 'Home') { e.preventDefault(); select(tabs[0].dataset.id, { focusTab: true }); }
      else if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1].dataset.id, { focusTab: true }); }
    });
  });

  select(C.LEADERBOARD_VIEWS[0].id);
}

export function renderCurated() {
  setHTML('stats', C.stats.map((s) => `<div class="stat"><div class="num">${esc(s.num)}</div><div class="lbl">${esc(s.lbl)}</div></div>`).join(''));
  wireLeaderboardTabs();
  setHTML('image-ai', rankRows(C.imageAI));
  setHTML('local-ai', rankRows(C.localAI));
  setHTML('video-ai', rankRows(C.videoAI));
  setHTML('local-mobile-ai', rankRows(C.localAiMobile));
  setHTML('local-ai-specs', specTable(C.localAiPcSpecs));
  setHTML('local-mobile-specs', specTable(C.localAiMobileSpecs));
  setHTML('local-ai-specs-note', C.LOCAL_AI_SPECS_METHODOLOGY);
  setHTML('local-mobile-specs-note', C.LOCAL_AI_SPECS_METHODOLOGY);
  wireFlipCards('sec-media-local');

  const donut = document.getElementById('donut');
  if (donut) donut.style.background = C.donutGradient();
  setHTML('legend', C.marketShare.map((l) =>
    `<div class="row"><span class="dot" style="background:${l.color}"></span><span class="name">${esc(l.name)}</span><span class="pct">${esc(l.pct)}%</span></div>`
  ).join(''));
  wireDonutTooltip();

  document.querySelectorAll('.curated-asof').forEach((el) => { el.textContent = 'Curated · ' + C.CURATED_ASOF; });
  sizeFlipCards();
}

export function renderLive(data, now = Date.now()) {
  // ticker
  const headlines = data.ticker || [];
  const line = headlines.map((h) => `<span>~</span>${esc(h)}`).join('&nbsp;&nbsp;&nbsp;&nbsp;');
  setHTML('ticker', line + '&nbsp;&nbsp;&nbsp;&nbsp;' + line);

  // releases — always exactly 3 brand cards (Claude/ChatGPT/Gemini), each
  // listing up to its 5 most-recent qualifying releases with a direct link,
  // plus a separate ▶ link when an official YouTube upload corroborated it.
  const releases = data.releases || [];
  setHTML('releases', releases.map((r) => {
    const brand = RELEASE_BRAND[r.logoKey] || { name: r.lab, org: '' };
    const accent = ACCENT[r.logoKey] || ACCENT.other;
    const modelKey = LOGO_TO_MODEL_KEY[r.logoKey];
    const backId = `yt-back-${esc(r.logoKey)}`;
    const listId = `yt-list-${esc(r.logoKey)}`;
    return `
    <div class="release-card flip-card" data-model-key="${esc(modelKey || '')}">
      <div class="flip-card-inner">
        <div class="flip-card-face flip-card-front" style="border-top-color:${accent}">
          <div class="release-lab">
            <span class="release-logo" style="color:${accent}">${LOGO[r.logoKey] || LOGO.other}</span>
            <span class="release-labtext">${esc(brand.name)}<span class="release-org">${esc(brand.org)}</span></span>
          </div>
          <ul class="release-list">
            ${(r.items || []).map((i) => `
              <li>
                <span class="release-item-main">
                  <a class="release-item-link" href="${esc(i.url)}" target="_blank" rel="noopener">${i.isVideo ? `<span class="release-yt-inline" aria-hidden="true">${YT_ICON}</span>` : ''}<b>${esc(i.h)}</b></a>
                  ${i.videoUrl ? `<a class="release-yt-link" href="${esc(i.videoUrl)}" target="_blank" rel="noopener" aria-label="Watch the launch video on YouTube" title="Watch on YouTube">${YT_ICON}</a>` : ''}
                </span>
                <span class="d">${esc(i.d)}</span>
              </li>`).join('') || `<li class="release-empty">No qualifying releases in the last 60 days — this section only shows actual ships, not general lab news.</li>`}
          </ul>
          ${modelKey ? `<button type="button" class="flip-card-btn" data-flip="1" aria-expanded="false" aria-controls="${backId}">${YT_ICON} Top videos this week</button>` : ''}
        </div>
        ${modelKey ? `
        <div class="flip-card-face flip-card-back" id="${backId}" style="border-top-color:${accent}" inert>
          <div class="release-lab">
            <span class="release-logo" style="color:${accent}">${LOGO[r.logoKey] || LOGO.other}</span>
            <span class="release-labtext">Top videos this week<span class="release-org">${esc(brand.name)} on YouTube</span></span>
          </div>
          <div class="yt-videos" id="${listId}"><p class="yt-loading">Loading this week's top videos…</p></div>
          <button type="button" class="flip-card-btn" data-flip="0">← Back to releases</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join(''));
  wireFlipCards('releases');
  sizeFlipCards();

  // (The former "Big AI wire" section was removed — the Signal River now
  //  carries the full chronological stream with filters, so a separate wire
  //  grid was pure duplication. data.wire is still built for compatibility
  //  but no longer rendered.)

  // breakthroughs
  const brk = data.breakthroughs || [];
  setHTML('breakthroughs', brk.length ? brk.map((b) => `
    <div class="brk-card">
      <div class="brk-top"><span class="brk-field">${esc(b.field)}</span><span class="asof">${esc(b.date)}</span></div>
      <h4>${esc(b.h)}</h4>
      <p>${esc(b.p)}</p>
      ${b.url ? `<div class="card-src"><span>${sourceChip('auto')} ${esc(b.sourceName || '')}</span><a class="src-link" href="${esc(b.url)}" target="_blank" rel="noopener">Read original</a></div>` : ''}
    </div>`).join('') : `<p class="empty-state">No research signals in the current window.</p>`);

  // compute pricing — live from Vast.ai + RunPod public marketplace APIs
  // (see scripts/lib/compute.mjs); empty, not a stale fallback, if both fetches failed
  const compute = data.compute || [];
  setHTML('compute-rows', compute.length ? compute.map((c) => `
    <tr><td class="ticker-cell">${esc(c.chip)}</td><td class="signal-cell">${esc(c.segment)}</td>
    <td class="metric-cell">${esc(c.rate)}</td><td class="${c.trendClass}">${esc(c.trend)}</td>
    <td class="signal-cell">${esc(c.note)}</td></tr>`).join('') :
    `<tr><td colspan="5" class="signal-cell">Live GPU pricing unavailable this cycle — check back shortly.</td></tr>`);
  const computeAsof = document.getElementById('compute-asof');
  if (computeAsof) computeAsof.textContent = compute.length ? 'Live · ' + fmtSnapshot(data.updatedAt) : 'Unavailable';
}

// Generic flip-card interaction: front (default view) / back (secondary view
// revealed by a button). Shared by the Frontier Releases cards and the Local
// AI hardware-spec cards. Delegated on a stable container id rather than
// bound per-button, since the container's innerHTML gets replaced on re-
// render — direct button listeners would go stale.
function setCardFlipped(card, flipped) {
  card.classList.toggle('is-flipped', flipped);
  const front = card.querySelector('.flip-card-front');
  const back = card.querySelector('.flip-card-back');
  const openBtn = card.querySelector('.flip-card-btn[data-flip="1"]');
  if (openBtn) openBtn.setAttribute('aria-expanded', String(flipped));
  if (front) front.inert = flipped;
  if (back) back.inert = !flipped;
  // move focus with the flip, same pattern as this codebase's drawers
  (flipped ? back?.querySelector('.flip-card-btn') : openBtn)?.focus();
}

function wireFlipCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.flipWired) return;
  container.dataset.flipWired = '1';
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.flip-card-btn');
    if (!btn) return;
    const card = btn.closest('.flip-card');
    if (!card) return;
    setCardFlipped(card, btn.dataset.flip === '1');
    sizeFlipCards();
  });
}

// Flip-card faces are position:absolute (needed for the 3D rotate), so their
// content doesn't naturally push the container taller and a fixed min-height
// guess either wastes space or forces an internal scrollbar. This measures
// each face's real content height — scrollHeight still reports the full,
// unclipped height even while overflow-y:auto is actively clipping it — and
// sizes the shared container to the tallest of the two, so neither face ever
// needs to scroll internally.
function sizeFlipCards() {
  // Deferred by a tick: called right after a `hidden` attribute flip +
  // innerHTML write (e.g. renderCurated() runs immediately after initNav()
  // unhides the target tab on a direct #tab-local load), and measuring in
  // that same synchronous pass can still see stale/zero layout. A 0ms
  // setTimeout — not requestAnimationFrame — is the reliable way to defer
  // past that: rAF depends on the browser actually scheduling a paint
  // frame, which doesn't happen in every rendering context (confirmed via
  // direct testing), while a plain macrotask always runs after the current
  // synchronous work and DOM mutations are already applied.
  setTimeout(sizeFlipCardsNow, 0);
}

function sizeFlipCardsNow() {
  document.querySelectorAll('.flip-card').forEach((card) => {
    const inner = card.querySelector('.flip-card-inner');
    if (!inner) return;
    let tallest = 0;
    card.querySelectorAll('.flip-card-face').forEach((f) => { tallest = Math.max(tallest, f.scrollHeight); });
    if (tallest) inner.style.minHeight = tallest + 'px';
  });
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(sizeFlipCards, 150);
});

// Top-5-by-view-count-in-7-days videos per model (data/youtube-trending.json,
// refreshed twice daily — see scripts/update-youtube.mjs). Independent fetch
// from the main data cycle, so this fills in the card backs whenever it
// resolves — separately from renderLive(), and honestly empty if the fetch
// hasn't succeeded yet or the model has no results this cycle.
export function renderYouTubeTrending(yt) {
  const models = yt?.models || {};
  for (const key of ['claude', 'gpt', 'gemini']) {
    const listEl = document.querySelector(`.release-card[data-model-key="${key}"] .yt-videos`);
    if (!listEl) continue;
    const videos = models[key]?.videos || [];
    if (!videos.length) {
      listEl.innerHTML = `<p class="yt-empty">No trending videos available this cycle — refreshes twice a day.</p>`;
      continue;
    }
    listEl.innerHTML = `
      <ul class="yt-video-list">
        ${videos.map((v) => `
          <li class="yt-video">
            <a class="yt-video-title" href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a>
            <div class="yt-video-meta">
              <span class="yt-video-channel">${esc(v.channelTitle)}</span>
              ${v.viewCount != null ? `<span class="yt-video-views">${esc(fmtViews(v.viewCount))} views</span>` : ''}
              ${freshnessChip(v.publishedAt)}
            </div>
          </li>`).join('')}
      </ul>
      <p class="yt-caption">${sourceChip('snapshot12h', `Top by view count in the last ${yt?.windowDays || 7} days`)}</p>
    `;
  }
  sizeFlipCards();
}

// animate ordinal bars once rows exist
export function animateBars() {
  document.querySelectorAll('.bar-fill').forEach((el, i) => {
    el.style.width = '0';
    setTimeout(() => { el.style.width = el.style.getPropertyValue('--w'); }, 150 + i * 35);
  });
}
