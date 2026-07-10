// Renderers for the detailed evidence sections below the hero. Live sections
// (releases, wire, feed, breakthroughs, stocks) come from latest.json; ranking
// panels come from curated.js. Ported from the original inline script, with
// freshness/provenance chips added.
import { esc } from './util.js';
import { freshnessChip, confidenceChip, sourceChip } from './freshness.js';
import * as C from './curated.js';

const LOGO = {
  anthropic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="5.3" x2="18.7" y2="18.7"/><line x1="18.7" y1="5.3" x2="5.3" y2="18.7"/></svg>`,
  openai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,2.6 20.2,7.3 20.2,16.7 12,21.4 3.8,16.7 3.8,7.3"/><circle cx="12" cy="12" r="3.1"/></svg>`,
  google: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8c.3 5.1.9 8.7 3.1 10.2-2.2 1.5-2.8 5.1-3.1 10.2-.3-5.1-.9-8.7-3.1-10.2C11.1 10.5 11.7 6.9 12 1.8Z"/><path d="M22.2 12c-5.1.3-8.7.9-10.2 3.1 1.5-2.2 1.5-5.9 0-8.2C13.5 9.1 17.1 11.7 22.2 12Z" opacity=".55"/></svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/></svg>`,
};
const ACCENT = { anthropic: 'var(--coral)', openai: 'var(--deep)', google: 'var(--sea)', meta: 'var(--ink-soft)', xai: 'var(--ink-soft)', policy: 'var(--sand)', other: 'var(--sand)' };

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

export function renderCurated() {
  setHTML('stats', C.stats.map((s) => `<div class="stat"><div class="num">${esc(s.num)}</div><div class="lbl">${esc(s.lbl)}</div></div>`).join(''));
  setHTML('leaderboard', rankRows(C.leaderboard));
  setHTML('image-ai', rankRows(C.imageAI));
  setHTML('video-ai', rankRows(C.videoAI));

  const donut = document.getElementById('donut');
  if (donut) donut.style.background = C.donutGradient();
  setHTML('legend', C.marketShare.map((l) =>
    `<div class="row"><span class="dot" style="background:${l.color}"></span><span class="name">${esc(l.name)}</span><span class="pct">${esc(l.pct)}%</span></div>`
  ).join(''));

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

  // releases
  setHTML('releases', (data.releases || []).map((r) => `
    <div class="release-card" style="border-top-color:${ACCENT[r.logoKey] || ACCENT.other}">
      <div class="release-lab">
        <span class="release-logo" style="color:${ACCENT[r.logoKey] || ACCENT.other}">${LOGO[r.logoKey] || LOGO.other}</span>
        <span class="release-labtext">${esc(r.lab)}</span>
        <span class="asof">${esc(r.date)}</span>
      </div>
      <h4>${esc(r.h)}</h4>
      <p>${esc(r.p)}</p>
      <ul class="release-list">
        ${(r.items || []).map((i) => `<li><span><b>${esc(i.n)}</b> — ${esc(i.note)}</span><span class="d">${esc(i.d)}</span></li>`).join('')}
      </ul>
      ${r.url ? `<div class="card-src"><span>${sourceChip('auto')} ${esc(r.sourceName || '')}</span><a class="src-link" href="${esc(r.url)}" target="_blank" rel="noopener">Read original</a></div>` : ''}
    </div>`).join(''));

  // wire
  setHTML('wire', (data.wire || []).map((c) => `
    <div class="card">
      <div class="card-top">
        <div class="card-tag"><span class="tdot" style="background:${ACCENT[c.logoKey] || 'var(--ink-soft)'}"></span>${esc(c.org)}</div>
        <span class="asof">${esc(c.date)}</span>
      </div>
      <h4>${esc(c.h)}</h4>
      <p>${esc(c.p)}</p>
      <div class="card-src"><span>${sourceChip('auto')} ${esc(c.sourceName || '')}${c.sourceCount >= 2 ? ' ' + confidenceChip(c.sourceCount >= 3 ? 'strong' : 'moderate') : ''}</span>${c.url ? `<a class="src-link" href="${esc(c.url)}" target="_blank" rel="noopener">Read original</a>` : ''}</div>
    </div>`).join(''));

  // open-weight feed
  const feed = data.feed || [];
  setHTML('feed', feed.length ? feed.map((f) => `
    <div class="feed-row">
      <div><span class="feed-name">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${esc(f.name)}</a>` : esc(f.name)}</span><span class="feed-org">${esc(f.org)}</span></div>
      <span class="license ${esc(f.licClass)}">${esc(f.lic)}</span>
      <span class="asof">${esc(f.date)}</span>
      <span class="feed-desc">${esc(f.desc)}</span>
    </div>`).join('') : `<p class="empty-state">No open-weight stories in the current window. New releases appear here as they cross the wire.</p>`);

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
      <td class="${up ? 'trend-up' : 'trend-down'}">${s.changePct != null ? (up ? '+' : '') + Number(s.changePct).toFixed(2) + '%' : '—'}</td>
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
