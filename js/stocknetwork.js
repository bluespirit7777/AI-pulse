// AI Stock Network — a deterministic SVG ecosystem depth map of the 10 AI
// stocks (no force simulation). Two clearly-separated modes:
//   • Ecosystem   — curated business ties (depends/partner/competes)
//   • Market motion — 30-day price-return correlation (|r| >= 0.5)
// Node size = market cap · inner glow = relative volume · outer ring = day
// change · marker = direction. Connections are faint by default and only
// brighten for the selected stock (others fade). Everything reads from the
// pre-built data/stock-network.json; no heavy math in the browser.
import { esc, prefersReducedMotion, clamp, fmtSnapshot } from './util.js';

const VW = 1000, VH = 540, PAD_X = 60, PAD_TOP = 30, PAD_BOT = 20;
const LAYER_LABELS = { 1: 'Platforms & software', 2: 'Cloud & compute', 3: 'Chips & networking', 4: 'Foundry' };
const REL_STYLE = {
  depends: { stroke: 'var(--sea)', dash: '', label: 'depends on' },
  partner: { stroke: 'var(--teal)', dash: '6 4', label: 'partners with' },
  competes: { stroke: 'var(--coral)', dash: '2 5', label: 'competes with' },
};
const DIM = 0.10, BRIGHT = 0.9;
// TradingView symbols need an exchange prefix — mapped by hand since it's a
// fixed, small, rarely-changing list (our 10 tracked tickers' primary listing
// venues), not something worth round-tripping through the data pipeline.
const TV_EXCHANGE = { TSM: 'NYSE', ORCL: 'NYSE', PLTR: 'NYSE' }; // default NASDAQ otherwise
const tvSymbol = (t) => `${TV_EXCHANGE[t] || 'NASDAQ'}:${t}`;
// core fill = direction at a glance: green up, orange down, slate flat.
const CORE_COLOR = { up: '#1f7a4d', down: '#d9760a', flat: '#5b6b74' };
const fmtUSD = (n) => (n == null ? '—' : n >= 1e12 ? '$' + (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : '$' + (n / 1e6).toFixed(0) + 'M');
const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtPct = (n) => (n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%');
const pctClass = (n) => (n == null ? '' : n >= 0 ? 'stock-up' : 'stock-down');

export function createStockNetwork(root, net) {
  if (!root) return;
  if (!net || !Array.isArray(net.nodes) || !net.nodes.length) {
    root.innerHTML = `<p class="empty-state">Stock network data is unavailable right now — the table below still works.</p>`;
    return;
  }
  const nodes = net.nodes;
  const byT = new Map(nodes.map((n) => [n.t, n]));
  const maxMcap = Math.max(...nodes.map((n) => n.marketCap || 0), 1);

  // ---- deterministic layout: 4 depth bands, spread within each by index ----
  const layers = [1, 2, 3, 4];
  const bandH = (VH - PAD_TOP - PAD_BOT) / layers.length;
  const pos = new Map();
  layers.forEach((L, li) => {
    const inLayer = nodes.filter((n) => n.netLayer === L);
    const usable = VW - PAD_X * 2;
    inLayer.forEach((n, i) => {
      const x = PAD_X + ((i + 0.5) * usable) / inLayer.length;
      const y = PAD_TOP + li * bandH + bandH / 2;
      pos.set(n.t, { x, y, r: 15 + Math.sqrt((n.marketCap || 0) / maxMcap) * 26 });
    });
  });

  let mode = 'ecosystem';
  let selected = null;

  root.innerHTML = `
    <div class="snet-frame">
      <svg class="snet-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="AI stock ecosystem depth map. A text summary and an accessible table follow.">
        <g class="snet-bands"></g>
        <g class="snet-conns"></g>
        <g class="snet-nodes"></g>
      </svg>
      <div class="snet-tooltip" id="snet-tooltip" role="status" aria-live="polite" hidden></div>
    </div>
    <div class="snet-legend" id="snet-legend" aria-hidden="true"></div>
    <p class="snet-summary" id="snet-summary"></p>
    <div class="snet-drawer" id="snet-drawer" role="dialog" aria-modal="true" aria-labelledby="snet-drawer-title" hidden></div>
  `;
  const svg = root.querySelector('.snet-svg');
  const gBands = svg.querySelector('.snet-bands');
  const gConns = svg.querySelector('.snet-conns');
  const gNodes = svg.querySelector('.snet-nodes');
  const tooltip = root.querySelector('#snet-tooltip');
  const drawer = root.querySelector('#snet-drawer');
  const summary = root.querySelector('#snet-summary');
  const legend = root.querySelector('#snet-legend');
  let lastFocused = null;

  // depth bands + labels
  layers.forEach((L, li) => {
    const y = PAD_TOP + li * bandH;
    gBands.insertAdjacentHTML('beforeend', `
      <rect x="0" y="${y}" width="${VW}" height="${bandH}" fill="rgba(14,42,55,${0.02 + li * 0.03})"></rect>
      <text x="14" y="${y + 15}" class="snet-band-label">${esc(LAYER_LABELS[L])}</text>`);
  });

  // nodes
  for (const n of nodes) {
    const p = pos.get(n.t);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'snet-node');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('data-t', n.t);
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    const ringColor = n.direction === 'up' ? '#1f7a4d' : n.direction === 'down' ? 'var(--coral)' : 'var(--ink-dim)';
    const ringW = 2 + Math.min(Math.abs(n.changePct || 0), 10) / 10 * 3;
    const glowNorm = clamp(((n.relVolume ?? 1) - 0.8) / 1.2, 0, 1);
    const coreColor = CORE_COLOR[n.direction] || CORE_COLOR.flat;
    g.innerHTML = `
      <circle class="snet-glow" r="${(p.r + 4 + glowNorm * 16).toFixed(1)}" fill="var(--sea)" opacity="${(glowNorm * 0.35).toFixed(3)}"></circle>
      <circle class="snet-ring" r="${(p.r + 3).toFixed(1)}" fill="none" stroke="${ringColor}" stroke-width="${ringW.toFixed(1)}"></circle>
      <circle class="snet-core" r="${p.r.toFixed(1)}" fill="${coreColor}" stroke="var(--deep)" stroke-width="1.5"></circle>
      <text class="snet-ticker" text-anchor="middle" dy="-1">${esc(n.t)}</text>
      <text class="snet-dir" text-anchor="middle" dy="11">${n.direction === 'up' ? '▲' : n.direction === 'down' ? '▼' : '—'}</text>`;
    gNodes.appendChild(g);
    const open = () => selectNode(n.t, true);
    g.addEventListener('click', open);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    g.addEventListener('mouseenter', () => { showTip(n, p); highlight(n.t); });
    g.addEventListener('mouseleave', () => { hideTip(); if (!selected) highlight(null); });
    g.addEventListener('focus', () => { showTip(n, p); highlight(n.t); });
    g.addEventListener('blur', () => { hideTip(); if (!selected) highlight(null); });
    g.setAttribute('aria-label', ariaFor(n));
  }

  function ariaFor(n) {
    return `${n.n} (${n.t}), ${LAYER_LABELS[n.netLayer]}. ${n.price != null ? '$' + n.price.toFixed(2) : 'price n/a'}, ${n.changePct != null ? (n.changePct >= 0 ? 'up ' : 'down ') + Math.abs(n.changePct).toFixed(2) + '%' : ''}. Market cap ${fmtUSD(n.marketCap)}, relative volume ${n.relVolume != null ? n.relVolume.toFixed(2) + '×' : 'n/a'}. Activate for details.`;
  }

  // ---- connection rendering per mode ----
  function drawConnections() {
    gConns.innerHTML = '';
    if (mode === 'ecosystem') {
      for (const c of net.relationships || []) {
        const a = pos.get(c.from), b = pos.get(c.to);
        if (!a || !b) continue;
        const st = REL_STYLE[c.type] || REL_STYLE.depends;
        gConns.insertAdjacentHTML('beforeend', bezier(a, b, st.stroke, 1.6, st.dash, DIM, `${c.from}|${c.to}`));
      }
    } else {
      for (const c of net.correlations || []) {
        const a = pos.get(c.a), b = pos.get(c.b);
        if (!a || !b) continue;
        const positive = c.r >= 0;
        const stroke = positive ? 'var(--teal)' : 'var(--coral)';
        const w = 1 + Math.abs(c.r) * 4;
        const dash = positive ? '' : '3 4'; // pattern distinguishes sign, not colour alone
        gConns.insertAdjacentHTML('beforeend', bezier(a, b, stroke, w, dash, DIM, `${c.a}|${c.b}`, c.r));
      }
    }
    gConns.querySelectorAll('path').forEach((p) => { p.dataset.baseW = p.getAttribute('stroke-width'); });
    highlight(selected);
  }

  function bezier(a, b, stroke, w, dash, opacity, key, r) {
    const dy = b.y - a.y;
    const bend = clamp(Math.abs(dy) * 0.3, 18, 80) * (a.x < b.x ? 1 : -1);
    const d = `M ${a.x} ${a.y} C ${a.x + bend} ${a.y + dy * 0.33}, ${b.x - bend} ${a.y + dy * 0.67}, ${b.x} ${b.y}`;
    const mid = r != null ? `<text class="snet-corr-label" x="${((a.x + b.x) / 2).toFixed(0)}" y="${((a.y + b.y) / 2).toFixed(0)}" text-anchor="middle" opacity="0">${r > 0 ? '+' : ''}${r.toFixed(2)}</text>` : '';
    return `<g class="snet-conn" data-key="${esc(key)}"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w.toFixed(1)}" stroke-dasharray="${dash}" stroke-linecap="round" opacity="${opacity}"></path>${mid}</g>`;
  }

  function highlight(t) {
    gConns.querySelectorAll('.snet-conn').forEach((cg) => {
      const [x, y] = cg.dataset.key.split('|');
      const on = t && (x === t || y === t);
      const path = cg.querySelector('path');
      const base = parseFloat(path.dataset.baseW || path.getAttribute('stroke-width'));
      path.setAttribute('opacity', on ? BRIGHT : (t ? DIM * 0.5 : DIM));
      path.setAttribute('stroke-width', on ? (base + 0.8).toFixed(1) : base);
      const lbl = cg.querySelector('.snet-corr-label');
      if (lbl) lbl.setAttribute('opacity', on ? 1 : 0);
    });
    gNodes.querySelectorAll('.snet-node').forEach((g) => {
      const nt = g.dataset.t;
      const connected = !t || nt === t || isConnected(t, nt);
      g.style.opacity = connected ? 1 : 0.3;
      g.classList.toggle('snet-selected', nt === selected);
    });
  }

  function isConnected(a, b) {
    if (mode === 'ecosystem') return (net.relationships || []).some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a));
    return (net.correlations || []).some((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  }

  function showTip(n, p) {
    tooltip.innerHTML = `<strong>${esc(n.n)}</strong> <span class="snet-tt-t">${esc(n.t)}</span><br>
      <span class="snet-tt-m">${n.price != null ? '$' + n.price.toFixed(2) : '—'} · ${n.changePct != null ? (n.changePct >= 0 ? '+' : '') + n.changePct.toFixed(2) + '%' : ''} · ${fmtUSD(n.marketCap)}</span>`;
    tooltip.hidden = false;
    tooltip.style.left = (p.x / VW) * 100 + '%';
    tooltip.style.top = (p.y / VH) * 100 + '%';
  }
  function hideTip() { tooltip.hidden = true; }

  function relationshipsOf(t) {
    return (net.relationships || [])
      .filter((c) => c.from === t || c.to === t)
      .map((c) => ({ other: c.from === t ? c.to : c.from, type: c.type, dir: c.from === t ? 'out' : 'in' }));
  }
  function correlationsOf(t) {
    const rel = (net.correlations || []).filter((c) => c.a === t || c.b === t).map((c) => ({ other: c.a === t ? c.b : c.a, r: c.r }));
    return {
      positives: rel.filter((x) => x.r > 0).sort((a, b) => b.r - a.r).slice(0, 3),
      strongestNegative: rel.filter((x) => x.r < 0).sort((a, b) => a.r - b.r)[0] || null,
    };
  }

  function selectNode(t, openDrawerToo) {
    selected = t;
    highlight(t);
    if (openDrawerToo) openDrawer(byT.get(t));
  }

  function openDrawer(n) {
    if (!n) return;
    lastFocused = document.activeElement;
    const rels = relationshipsOf(n.t);
    const { positives, strongestNegative } = correlationsOf(n.t);
    const nameOf = (t) => (byT.get(t)?.n || t);
    drawer.innerHTML = `
      <div class="drawer-inner">
        <button class="drawer-close" aria-label="Close details">✕</button>
        <div class="drawer-eyebrow">${esc(LAYER_LABELS[n.netLayer])}</div>
        <h3 id="snet-drawer-title">${esc(n.n)} <span class="drawer-org">${esc(n.t)}</span></h3>
        <div class="snet-chart" id="snet-chart"></div>
        <div class="snet-chart-link">
          <a href="${esc(`https://www.tradingview.com/symbols/${tvSymbol(n.t).replace(':', '-')}/`)}" target="_blank" rel="noopener" class="src-link">Open ${esc(n.t)} chart on TradingView ↗</a>
        </div>
        <div class="snet-facts">
          <span><b>Price</b>${n.price != null ? '$' + n.price.toFixed(2) : '—'}</span>
          <span class="${pctClass(n.changePct)}"><b>Day change</b>${fmtPct(n.changePct)}</span>
          <span class="${pctClass(n.weekChangePct)}"><b>Week change</b>${fmtPct(n.weekChangePct)}</span>
          <span class="${pctClass(n.monthChangePct)}"><b>Month change</b>${fmtPct(n.monthChangePct)}</span>
          <span><b>Market cap</b>${fmtUSD(n.marketCap)}</span>
          <span><b>Latest volume</b>${fmtNum(n.volume)}</span>
          <span><b>Dollar volume</b>${fmtUSD(n.dollarVolume)}</span>
          <span><b>20-day avg vol</b>${fmtNum(n.avg20Volume != null ? Math.round(n.avg20Volume) : null)}</span>
          <span><b>Relative volume</b>${n.relVolume != null ? n.relVolume.toFixed(2) + '×' : '—'}</span>
        </div>
        ${positives.length ? `<div class="snet-block"><span class="drawer-h">Top 30-day return correlations</span>
          <ul>${positives.map((p) => `<li><span class="snet-corr pos">+${p.r.toFixed(2)}</span> moves with <b>${esc(nameOf(p.other))}</b></li>`).join('')}
          ${strongestNegative ? `<li><span class="snet-corr neg">${strongestNegative.r.toFixed(2)}</span> moves opposite <b>${esc(nameOf(strongestNegative.other))}</b></li>` : ''}</ul>
          <span class="snet-caveat">Price-return correlation, not a business link. Correlation ≠ causation.</span></div>` : ''}
        ${rels.length ? `<div class="snet-block"><span class="drawer-h">Business relationships (curated)</span>
          <ul>${rels.map((r) => `<li>${esc((REL_STYLE[r.type] || {}).label || r.type)} <b>${esc(nameOf(r.other))}</b></li>`).join('')}</ul></div>` : ''}
        <div class="snet-block snet-meta">
          <span>Data ${esc(fmtSnapshot(net.updatedAt))}</span>
          <a href="${esc(n.url)}" target="_blank" rel="noopener" class="src-link">Yahoo Finance quote</a>
        </div>
        <p class="snet-nia">Not investment advice.</p>
      </div>`;
    drawer.hidden = false;
    document.body.classList.add('drawer-open');
    drawer.querySelector('.drawer-close').focus();
    drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    drawer.addEventListener('keydown', onDrawerKey);
    drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });
    mountChart(n.t);
  }

  // TradingView's free embeddable "Advanced Chart" widget — a live third-party
  // iframe, the one exception to this site's otherwise fully self-built,
  // build-time-data architecture. Deliberate trade-off: real, familiar
  // candlestick charting with zero backend and no API key, at the cost of not
  // controlling its internal accessibility/reduced-motion behaviour (its own
  // ticking price updates aren't ours to gate). <script> tags set via
  // .innerHTML never execute, so the embed script is created and appended
  // here explicitly, after the drawer markup is already in the DOM.
  function mountChart(ticker) {
    const host = drawer.querySelector('#snet-chart');
    if (!host) return;
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    host.appendChild(widgetDiv);
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.text = JSON.stringify({
      autosize: true,
      symbol: tvSymbol(ticker),
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: false,
      hide_top_toolbar: false,
      support_host: 'https://www.tradingview.com',
    });
    // Ad blockers and privacy extensions commonly block this exact domain at
    // the network level — a real, frequent failure mode (Opera's built-in
    // blocker does this by default), not a hypothetical. `error` fires when
    // the request itself is blocked; the timeout is belt-and-braces for the
    // rarer case where the script loads but the iframe never actually
    // appears. Either way, a real fallback with a direct link beats leaving
    // silent blank space that reads as the site being broken.
    const fallback = () => showChartFallback(host, ticker);
    script.addEventListener('error', fallback);
    host.appendChild(script);
    setTimeout(() => { if (!host.querySelector('iframe')) fallback(); }, 4000);
  }

  function showChartFallback(host, ticker) {
    if (host.querySelector('iframe')) return; // it loaded just in time
    const tvUrl = `https://www.tradingview.com/symbols/${tvSymbol(ticker).replace(':', '-')}/`;
    host.innerHTML = `
      <div class="snet-chart-fallback">
        <p>Chart didn't load — likely blocked by an ad blocker or privacy extension in this browser.</p>
        <a href="${esc(tvUrl)}" target="_blank" rel="noopener" class="src-link">View ${esc(ticker)} on TradingView →</a>
      </div>`;
  }
  function onDrawerKey(e) {
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'Tab') {
      const f = drawer.querySelectorAll('button, a[href]');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function closeDrawer() {
    drawer.hidden = true;
    drawer.removeEventListener('keydown', onDrawerKey);
    document.body.classList.remove('drawer-open');
    selected = null; highlight(null);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function paintLegendAndSummary() {
    if (mode === 'ecosystem') {
      legend.innerHTML = `
        <span><i class="snet-key-line" style="border-top:2px solid var(--sea)"></i>depends on</span>
        <span><i class="snet-key-line" style="border-top:2px dashed var(--teal)"></i>partners with</span>
        <span><i class="snet-key-line" style="border-top:2px dotted var(--coral)"></i>competes with</span>
        <span>select a node to trace its ties</span>`;
      summary.innerHTML = `<span class="ms-h">Ecosystem view.</span> ${nodes.length} AI stocks across four depth layers; ${(net.relationships || []).length} curated business relationships. Select any node to highlight its dependencies, partners and rivals.`;
    } else {
      const strongest = (net.correlations || [])[0];
      legend.innerHTML = `
        <span><i class="snet-key-line" style="border-top:3px solid var(--teal)"></i>moves together (+)</span>
        <span><i class="snet-key-line" style="border-top:2px dashed var(--coral)"></i>moves oppositely (−)</span>
        <span>line thickness = strength · |r| ≥ ${net.correlationThreshold ?? 0.5}</span>`;
      summary.innerHTML = `<span class="ms-h">Market-motion view.</span> ${(net.correlations || []).length} pairs with a 30-day price-return correlation of |r| ≥ ${net.correlationThreshold ?? 0.5}${strongest ? ` — strongest: ${esc(byT.get(strongest.a)?.t)}–${esc(byT.get(strongest.b)?.t)} at ${strongest.r > 0 ? '+' : ''}${strongest.r.toFixed(2)}` : ''}. Correlation ≠ causation.`;
    }
  }

  function setMode(next) {
    mode = next;
    drawConnections();
    paintLegendAndSummary();
  }

  // wire external controls
  document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-selected', String(on)); });
    setMode(b.dataset.mode);
  }));

  // node pulse only when motion allowed (elevated-volume nodes)
  if (!prefersReducedMotion) {
    gNodes.querySelectorAll('.snet-node').forEach((g) => {
      const n = byT.get(g.dataset.t);
      if ((n.relVolume ?? 0) > 1.3) g.querySelector('.snet-glow').classList.add('snet-pulse');
    });
  }

  const asof = document.getElementById('stocks-asof');
  if (asof) asof.textContent = fmtSnapshot(net.updatedAt);

  drawConnections();
  paintLegendAndSummary();
  return { closeDrawer };
}
