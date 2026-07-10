// AI Ocean Map — the hero. A 5-layer depth map of the AI ecosystem rendered as
// SVG. Node SIZE = curated importance (an estimate). Node GLOW = live activity
// (real: how many recent signals mention it). Connections = dependency /
// partnership / competition. Fully keyboard-accessible; a text summary and a
// per-node drawer mean nothing is locked behind hover. Ripples only animate
// when the user hasn't asked for reduced motion.
import { esc, prefersReducedMotion, clamp } from './util.js';

const VW = 1000, VH = 560, PAD_X = 70, PAD_TOP = 44, PAD_BOT = 30;
const CONN_STYLE = {
  depends: { stroke: 'var(--sea)', w: 1.6, dash: '', label: 'depends on' },
  partner: { stroke: 'var(--teal)', w: 1.6, dash: '5 4', label: 'partners with' },
  competes: { stroke: 'var(--coral)', w: 1.4, dash: '2 5', label: 'competes with' },
};
// Direction-aware phrase for the drawer's "Connected to" list, so it reads as
// a natural sentence ("Competes with GPT", "Depended on by ChatGPT") rather
// than "GPT competes with". `out` = this node is the connection's source,
// `in` = this node is the target.
const REL_PHRASE = {
  depends: { out: 'Depends on', in: 'Depended on by' },
  partner: { out: 'Partners with', in: 'Partners with' },
  competes: { out: 'Competes with', in: 'Competes with' },
};

export function createOceanMap(root, entities) {
  const nodes = entities.nodes;
  const layers = entities.layers;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // ---- deterministic layout: layer band by depth, x spread by importance ----
  const bandH = (VH - PAD_TOP - PAD_BOT) / layers.length;
  const pos = new Map();
  layers.forEach((layer, li) => {
    const inLayer = nodes.filter((n) => n.layer === layer.id).sort((a, b) => b.importance - a.importance);
    const usable = VW - PAD_X * 2;
    inLayer.forEach((n, i) => {
      const x = PAD_X + ((i + 0.5) * usable) / inLayer.length;
      const y = PAD_TOP + li * bandH + bandH / 2;
      pos.set(n.id, { x, y, r: 13 + (n.importance / 100) * 19 });
    });
  });

  let state = { activity: {}, delta: {}, rangeLabel: '24H', historyAvailable: false, maxAct: 1, maxAbsDelta: 1 };

  // ---- build static scaffolding once ----
  root.innerHTML = `
    <div class="map-frame">
      <svg class="ocean-map-svg" viewBox="0 0 ${VW} ${VH}" role="img"
           aria-label="AI ecosystem depth map. A text summary follows below.">
        <g class="map-bands"></g>
        <g class="map-conns"></g>
        <g class="map-nodes"></g>
      </svg>
      <div class="map-tooltip" id="map-tooltip" role="status" aria-live="polite" hidden></div>
    </div>
    <p class="map-summary" id="map-summary"></p>
    <div class="map-drawer" id="map-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden></div>
  `;

  const svg = root.querySelector('.ocean-map-svg');
  const gBands = svg.querySelector('.map-bands');
  const gConns = svg.querySelector('.map-conns');
  const gNodes = svg.querySelector('.map-nodes');
  const tooltip = root.querySelector('#map-tooltip');
  const drawer = root.querySelector('#map-drawer');
  const summary = root.querySelector('#map-summary');
  let lastFocused = null;
  let drawerOpenFor = null;

  // depth bands + labels
  layers.forEach((layer, li) => {
    const y = PAD_TOP + li * bandH;
    gBands.insertAdjacentHTML('beforeend', `
      <rect x="0" y="${y}" width="${VW}" height="${bandH}" fill="rgba(14,42,55,${0.03 + li * 0.03})"></rect>
      <text x="16" y="${y + 16}" class="band-label">${esc(layer.name)}</text>
    `);
  });

  // connections (behind nodes) — curved current paths, not straight wires.
  // De-emphasized by default (this is a field, not a wiring diagram); a
  // connection brightens only when one of its endpoints is hovered, focused,
  // or has its drawer open (see highlightNode below).
  const CONN_DIM = 0.14, CONN_BRIGHT = 0.85;
  for (const c of entities.connections) {
    const a = pos.get(c.from), b = pos.get(c.to);
    if (!a || !b) continue;
    const st = CONN_STYLE[c.type] || CONN_STYLE.depends;
    // gentle S-curve: control points offset horizontally, proportional to
    // vertical distance, so the path "flows" rather than cutting straight
    // through intermediate layers.
    const dy = b.y - a.y;
    const bend = clamp(Math.abs(dy) * 0.35, 20, 90) * (c.from < c.to ? 1 : -1);
    const c1x = a.x + bend, c1y = a.y + dy * 0.33;
    const c2x = b.x - bend, c2y = a.y + dy * 0.67;
    const d = `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`;
    gConns.insertAdjacentHTML('beforeend',
      `<path d="${d}" fill="none" stroke="${st.stroke}" stroke-width="${st.w}" stroke-dasharray="${st.dash}" stroke-linecap="round" opacity="${CONN_DIM}" data-from="${esc(c.from)}" data-to="${esc(c.to)}"></path>`
    );
  }

  gConns.querySelectorAll('path').forEach((p) => { p.dataset.baseWidth = p.getAttribute('stroke-width'); });
  function highlightNode(id) {
    gConns.querySelectorAll('path').forEach((p) => {
      const on = id && (p.dataset.from === id || p.dataset.to === id);
      const base = parseFloat(p.dataset.baseWidth);
      p.setAttribute('opacity', on ? CONN_BRIGHT : CONN_DIM);
      p.setAttribute('stroke-width', on ? String(base + 0.8) : String(base));
    });
  }

  // nodes
  for (const n of nodes) {
    const p = pos.get(n.id);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'map-node');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('data-id', n.id);
    g.setAttribute('transform', `translate(${p.x} ${p.y})`);
    g.innerHTML = `
      <circle class="node-glow" r="${p.r}" fill="var(--sea)" opacity="0"></circle>
      <circle class="node-ripple" r="${p.r}" fill="none" stroke="var(--sea)" stroke-width="1.5" opacity="0"></circle>
      <circle class="node-ring" r="${p.r + 5}" fill="none" stroke="var(--coral)" stroke-width="2" opacity="0" stroke-dasharray="3 3"></circle>
      <circle class="node-core" r="${p.r}" fill="var(--panel-solid)" stroke="var(--deep)" stroke-width="2"></circle>
      <text class="node-trend" x="${p.r - 2}" y="${-p.r + 4}" text-anchor="middle" opacity="0">▲</text>
      <text class="node-label" y="${p.r + 15}" text-anchor="middle">${esc(n.name)}</text>
    `;
    gNodes.appendChild(g);

    const open = () => openDrawer(n);
    g.addEventListener('click', open);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    g.addEventListener('mouseenter', () => { showTooltip(n, p); highlightNode(n.id); });
    g.addEventListener('mouseleave', () => { hideTooltip(); if (!drawerOpenFor) highlightNode(null); });
    g.addEventListener('focus', () => { showTooltip(n, p); highlightNode(n.id); });
    g.addEventListener('blur', () => { hideTooltip(); if (!drawerOpenFor) highlightNode(null); });
  }

  function actLevel(id) {
    const a = state.activity[id] || 0;
    return { count: a, norm: state.maxAct ? a / state.maxAct : 0 };
  }

  function orgLabel(n) { return n.org && n.org !== n.name ? n.org : ''; }

  function showTooltip(n, p) {
    const { count } = actLevel(n.id);
    tooltip.innerHTML = `<strong>${esc(n.name)}</strong> <span class="tt-org">${esc(orgLabel(n))}</span><br>
      <span class="tt-act">${count} signal${count === 1 ? '' : 's'} · ${esc(state.rangeLabel)}</span>`;
    tooltip.hidden = false;
    // position within the frame using the node's viewBox coords → percentages
    tooltip.style.left = (p.x / VW) * 100 + '%';
    tooltip.style.top = (p.y / VH) * 100 + '%';
  }
  function hideTooltip() { tooltip.hidden = true; }

  function relatedOf(id) {
    const rel = [];
    for (const c of entities.connections) {
      if (c.from === id && byId.get(c.to)) rel.push({ node: byId.get(c.to), type: c.type, dir: 'out' });
      if (c.to === id && byId.get(c.from)) rel.push({ node: byId.get(c.from), type: c.type, dir: 'in' });
    }
    return rel;
  }

  function openDrawer(n) {
    lastFocused = document.activeElement;
    drawerOpenFor = n.id;
    highlightNode(n.id);
    const { count } = actLevel(n.id);
    const d = state.delta[n.id];
    const deltaTxt = !state.historyAvailable
      ? `<span class="drawer-note">${esc(state.rangeLabel)} comparison is still accumulating — showing current activity.</span>`
      : `<span class="drawer-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '– no change'} vs ${esc(state.rangeLabel)} ago</span>`;
    const rel = relatedOf(n.id);
    const layerName = (layers.find((l) => l.id === n.layer) || {}).name || '';

    drawer.innerHTML = `
      <div class="drawer-inner">
        <button class="drawer-close" aria-label="Close details">✕</button>
        <div class="drawer-eyebrow">${esc(layerName)}</div>
        <h3 id="drawer-title">${esc(n.name)} <span class="drawer-org">${esc(orgLabel(n))}</span></h3>
        ${n.version && n.version !== n.name ? `<div class="drawer-version">Current version: <b>${esc(n.version)}</b></div>` : ''}
        <div class="drawer-signal">
          <span class="drawer-count">${count}</span>
          <span class="drawer-count-lbl">recent signal${count === 1 ? '' : 's'} mention it · ${esc(state.rangeLabel)}</span>
        </div>
        ${deltaTxt}
        <div class="drawer-why"><span class="drawer-h">Why it matters</span>${esc(n.why)}</div>
        ${rel.length ? `<div class="drawer-rel"><span class="drawer-h">Connected to</span>
          <ul>${rel.map((r) => `<li><span class="rel-type">${esc((REL_PHRASE[r.type] || {})[r.dir] || r.type)}</span> <button class="rel-link" data-id="${esc(r.node.id)}">${esc(r.node.name)}</button></li>`).join('')}</ul>
        </div>` : ''}
        <div class="drawer-meta">
          <span class="fr-chip fr-live" title="Signal counts come from live feeds"><span class="fr-mark" aria-hidden="true">●</span>Activity: live</span>
          <span class="fr-chip fr-curated" title="Importance/size is a hand-set editorial estimate"><span class="fr-mark" aria-hidden="true">✎</span>Size: curated estimate</span>
        </div>
        ${(n.links || []).length ? `<div class="drawer-links">${n.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="src-link">${esc(l.label)}</a>`).join(' · ')}</div>` : ''}
      </div>`;
    drawer.hidden = false;
    document.body.classList.add('drawer-open');
    drawer.querySelector('.drawer-close').focus();

    drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer);
    drawer.querySelectorAll('.rel-link').forEach((b) =>
      b.addEventListener('click', () => { const t = byId.get(b.dataset.id); if (t) openDrawer(t); })
    );
    drawer.addEventListener('keydown', onDrawerKey);
    drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });
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
    drawerOpenFor = null;
    highlightNode(null);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function paint() {
    let max = 1, maxAbsDelta = 1;
    for (const n of nodes) {
      max = Math.max(max, state.activity[n.id] || 0);
      const d = state.delta[n.id];
      if (state.historyAvailable && d != null) maxAbsDelta = Math.max(maxAbsDelta, Math.abs(d));
    }
    state.maxAct = max;
    state.maxAbsDelta = maxAbsDelta;
    const ranked = nodes.slice().sort((a, b) => (state.activity[b.id] || 0) - (state.activity[a.id] || 0));
    const topActive = new Set(ranked.slice(0, 4).filter((n) => (state.activity[n.id] || 0) > 0).map((n) => n.id));

    for (const n of nodes) {
      const g = gNodes.querySelector(`[data-id="${cssEsc(n.id)}"]`);
      if (!g) continue;
      const p = pos.get(n.id);
      const { count, norm } = actLevel(n.id);
      const glow = g.querySelector('.node-glow');
      const ripple = g.querySelector('.node-ripple');
      const ring = g.querySelector('.node-ring');
      const trend = g.querySelector('.node-trend');
      const core = g.querySelector('.node-core');
      const quiet = count === 0;
      const d = state.historyAvailable ? state.delta[n.id] : null;

      // inner brightness = activity in the SELECTED range (real, live)
      glow.setAttribute('r', p.r + 6 + norm * 22);
      glow.setAttribute('opacity', quiet ? 0 : (0.1 + norm * 0.3).toFixed(3));
      core.setAttribute('stroke-dasharray', quiet ? '3 3' : ''); // dashed = no fresh signal this range
      core.setAttribute('opacity', quiet ? 0.6 : 1);

      // outer ring = change vs the equivalent PRIOR period; absent entirely
      // when we don't yet have a complete prior window to compare against —
      // never a fabricated "no change" ring.
      if (d == null || d === 0) {
        ring.setAttribute('opacity', 0);
      } else {
        const mag = clamp(Math.abs(d) / maxAbsDelta, 0.15, 1);
        ring.setAttribute('stroke', d > 0 ? 'var(--coral)' : 'var(--sea)');
        ring.setAttribute('stroke-width', (1.5 + mag * 2.5).toFixed(2));
        ring.setAttribute('opacity', (0.35 + mag * 0.45).toFixed(3));
      }

      // trend marker = rising / falling; hidden when flat or accumulating
      if (d == null || d === 0) {
        trend.setAttribute('opacity', 0);
      } else {
        trend.textContent = d > 0 ? '▲' : '▼';
        trend.setAttribute('fill', d > 0 ? 'var(--coral)' : 'var(--sea)');
        trend.setAttribute('opacity', 1);
      }

      const deltaTxt = d == null ? ', trend accumulating' : d > 0 ? `, up ${d} vs prior ${state.rangeLabel}` : d < 0 ? `, down ${Math.abs(d)} vs prior ${state.rangeLabel}` : ', flat vs prior period';
      g.setAttribute('aria-label', `${n.name}${orgLabel(n) ? ', ' + orgLabel(n) : ''}. ${count} recent signal${count === 1 ? '' : 's'}, ${state.rangeLabel}${deltaTxt}. Activate for details.`);

      // ripple: reuse SMIL only when motion is allowed and node is top-active
      ripple.innerHTML = '';
      ripple.setAttribute('opacity', 0);
      if (!prefersReducedMotion && topActive.has(n.id)) {
        ripple.setAttribute('opacity', 0.5);
        ripple.innerHTML = `
          <animate attributeName="r" from="${p.r}" to="${p.r + 30}" dur="2.4s" repeatCount="indefinite"></animate>
          <animate attributeName="opacity" from="0.5" to="0" dur="2.4s" repeatCount="indefinite"></animate>`;
      }
    }

    // text summary (always present — the accessible, no-hover fallback)
    const top = ranked.slice(0, 5).filter((n) => (state.activity[n.id] || 0) > 0);
    summary.innerHTML = top.length
      ? `<span class="ms-h">Most active now (${esc(state.rangeLabel)}):</span> ` +
        top.map((n) => {
          const d = state.historyAvailable ? state.delta[n.id] : null;
          const trendTxt = d == null ? '' : d > 0 ? ` (▲${d})` : d < 0 ? ` (▼${Math.abs(d)})` : ' (flat)';
          return `${esc(n.name)} <b>${state.activity[n.id]}</b>${trendTxt}`;
        }).join(' · ') +
        (state.historyAvailable ? '' : ` <span class="ms-note">· ${esc(state.rangeLabel)} trend accumulating</span>`)
      : `<span class="ms-note">No live signals matched tracked entities in this window.</span>`;
  }

  return {
    update(next) { state = { ...state, ...next }; paint(); },
    closeDrawer,
    // Lets other components (a wave, a river item) reveal a specific node's
    // ecosystem path and open its detail drawer — the map isn't an island.
    revealEntity(id) {
      const n = byId.get(id);
      if (!n) return false;
      root.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
      openDrawer(n);
      return true;
    },
  };
}

function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
