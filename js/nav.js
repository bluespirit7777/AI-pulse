import { PANELS, readView, viewUrl } from './view-state.js';
export { PANELS };
let state;
export function getView() { return state; }
function paint(focus = false) {
  state = readView(location.search, location.hash, matchMedia('(max-width:767px)').matches);
  document.querySelectorAll('.topsection').forEach(el => { el.hidden = el.dataset.panel !== state.view; });
  document.querySelectorAll('[data-view-link]').forEach(el => {
    if (el.dataset.viewLink === state.view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-category]').forEach(el => { el.hidden = el.dataset.category !== state.category; });
  document.querySelectorAll('[data-mode-view]').forEach(el => { el.hidden = el.dataset.modeView !== state.mode; });
  document.querySelectorAll('.subnav a').forEach(el => {
    const target = readView(new URL(el.href).search);
    const on = target.view === state.view && (state.view === 'models' ? target.category === state.category : target.mode === state.mode);
    if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  document.title = `${state.view[0].toUpperCase() + state.view.slice(1)} · AI Pulse`;
  if (state.view === 'models') {
    const headings = {
      watch: ['Watch the current', 'Recent AI videos. One model at a time.'],
      local: ['Local AI', 'Find a model that fits your device. Understand the memory tradeoffs.'],
      releases: ['Release radar', 'Follow new models and features. Go straight to the source.'],
      community: ['Community currents', 'Explore what developers are discussing, building, and discovering.']
    };
    const [title, description] = headings[state.category] || ['AI leaderboard', 'Find the right model. Compare the scores. Explore the tradeoffs.'];
    const heading = document.querySelector('#panel-models .view-title');
    heading.replaceChildren(document.createTextNode(title));
    const dot = document.createElement('span'); dot.className = 'accent'; dot.textContent = '.'; heading.append(dot);
    document.querySelector('#panel-models .view-head .lede').textContent = description;
    document.title = `${title} · AI Pulse`;
  }
  if (focus) {
    document.querySelector(`#panel-${state.view} .view-title`)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.dispatchEvent(new CustomEvent('app:view', { detail: state }));
}
export function initNav() {
  if (location.hash && /^(#full|#top|#panel-|#tab-|#sec-)/.test(location.hash)) {
    history.replaceState(null, '', viewUrl(readView(location.search, location.hash, matchMedia('(max-width:767px)').matches), location.pathname));
  }
  paint();
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0 || a.target) return;
    const u = new URL(a.href);
    if (u.origin !== location.origin || u.pathname !== location.pathname || !u.searchParams.has('view')) return;
    e.preventDefault(); history.pushState(null, '', u.pathname + u.search + u.hash); paint(true);
  });
  addEventListener('popstate', () => paint(true));
  addEventListener('hashchange', () => paint(true));
}
export function notifyDataReady() { window.dispatchEvent(new Event('app:data-ready')); }
