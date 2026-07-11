// Renderers for the detailed evidence sections below the hero. Live sections
// (releases, wire, feed, breakthroughs, stocks) come from latest.json; ranking
// panels come from curated.js. Ported from the original inline script, with
// freshness/provenance chips added.
import { esc } from './util.js';
import { freshnessChip, verificationChip, sourceChip } from './freshness.js';
import * as C from './curated.js';

const LOGO = {
  anthropic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="5.3" x2="18.7" y2="18.7"/><line x1="18.7" y1="5.3" x2="5.3" y2="18.7"/></svg>`,
  openai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2.6 20.2,7.3 20.2,16.7 12,21.4 3.8,16.7 3.8,7.3"/><circle cx="12" cy="12" r="3.1"/></svg>`,
  google: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8c.3 5.1.9 8.7 3.1 10.2-2.2 1.5-2.8 5.1-3.1 10.2-.3-5.1-.9-8.7-3.1-10.2C11.1 10.5 11.7 6.9 12 1.8Z"/><path d="M22.2 12c-5.1.3-8.7.9-10.2 3.1 1.5-2.2 1.5-5.9 0-8.2C13.5 9.1 17.1 11.7 22.2 12Z" opacity=".55"/></svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/></svg>`,
};
const ACCENT = { anthropic: 'var(--coral)', openai: 'var(--deep)', google: 'var(--sea)', meta: 'var(--ink-soft)', xai: 'var(--ink-soft)', policy: 'var(--sand)', other: 'var(--sand)' };
// Frontier Releases shows exactly these 3 brands, always, in this order.
const RELEASE_BRAND = {
  anthropic: { name: 'Claude', org: 'Anthropic' },
  openai: { name: 'ChatGPT', org: 'OpenAI' },
  google: { name: 'Gemini', org: 'Google DeepMind' },
};
const YT_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true"><path d="M9.5 7.5v9l8-4.5-8-4.5Z"/></svg>`;

const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

function rankRows(rows) {
  return rows.map((r) => `
    <div class="lb-row">
      <div class="lb-top">
        <div class="lb-name">
          <span class="lb-rank">${String(r.rank).padStart(2, '0')}</span>
          <span class="lb-model">${esc(r.model)}</span>
          <span class="lb-org">${esc(r.org)}</span>
        </div>
        <span class="lb-stat">${esc(r.stat)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="--w:${r.w}%"></div></div>
      <div class="lb-note">${esc(r.note)}</div>
    </div>`).join('');
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
}

export function renderCurated() {
  setHTML('stats', C.stats.map((s) => `<div class="stat"><div class="num">${esc(s.num)}</div><div class="lbl">${esc(s.lbl)}</div></div>`).join(''));
  setHTML('leaderboard', rankRows(C.leaderboard));
  setHTML('image-ai', rankRows(C.imageAI));
  setHTML('local-ai', rankRows(C.localAI));
  setHTML('video-ai', rankRows(C.videoAI));

  const donut = document.getElementById('donut');
  if (donut) donut.style.background = C.donutGradient();
  setHTML('legend', C.marketShare.map((l) =>
    `<div class="row"><span class="dot" style="background:${l.color}"></span><span class="name">${esc(l.name)}</span><span class="pct">${esc(l.pct)}%</span></div>`
  ).join(''));
  wireDonutTooltip();

  setHTML('compute-rows', C.compute.map((c) => `
    <tr><td class="ticker-cell">${esc(c.chip)}</td><td class="signal-cell">${esc(c.segment)}</td>
    <td class="metric-cell">${esc(c.rate)}</td><td class="${c.trendClass}">${esc(c.trend)}</td>
    <td class="signal-cell">${esc(c.note)}</td></tr>`).join(''));

  document.querySelectorAll('.curated-asof').forEach((el) => { el.textContent = 'Curated · ' + C.CURATED_ASOF; });
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
    return `
    <div class="release-card" style="border-top-color:${ACCENT[r.logoKey] || ACCENT.other}">
      <div class="release-lab">
        <span class="release-logo" style="color:${ACCENT[r.logoKey] || ACCENT.other}">${LOGO[r.logoKey] || LOGO.other}</span>
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
    </div>`;
  }).join(''));

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

  // stocks
  const layerClass = { Chips: 'layer-chips', Cloud: 'layer-cloud', Software: 'layer-software', Foundry: 'layer-foundry' };
  setHTML('stocks', (data.stocks || []).map((s) => {
    const up = (s.changePct || 0) >= 0;
    return `<tr>
      <td><a href="${esc(s.url)}" target="_blank" rel="noopener" class="ticker-cell" style="text-decoration:none;">${esc(s.t)}</a><span class="co-name">${esc(s.n)}</span></td>
      <td><span class="layer-pill ${layerClass[s.layer] || ''}">${esc(s.layer)}</span></td>
      <td class="metric-cell">${s.price != null ? '$' + Number(s.price).toFixed(2) : '—'}</td>
      <td class="${up ? 'stock-up' : 'stock-down'}">${s.changePct != null ? (up ? '+' : '') + Number(s.changePct).toFixed(2) + '%' : '—'}</td>
      <td class="metric-cell">${s.relVolume != null ? Number(s.relVolume).toFixed(2) + '×' : '—'}</td>
      <td class="signal-cell">${esc(s.signal || '')}</td>
    </tr>`;
  }).join(''));
}

// animate ordinal bars once rows exist
export function animateBars() {
  document.querySelectorAll('.bar-fill').forEach((el, i) => {
    el.style.width = '0';
    setTimeout(() => { el.style.width = el.style.getPropertyValue('--w'); }, 150 + i * 35);
  });
}
