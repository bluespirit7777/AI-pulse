// Pure routing contract. Old bookmarks take precedence over query parameters.
export const PANELS = ['today', 'models', 'ecosystem', 'markets'];
const aliases = {
  full: ['today'], top: ['today'], 'panel-today': ['today'], 'sec-river': ['today'], 'sec-waves': ['today'],
  'panel-models': ['models'], 'sec-releases': ['models', 'releases'], 'tab-releases': ['models', 'releases'],
  'tab-leaderboard': ['models', 'text'], 'sec-leaderboard': ['models', 'text'],
  'sec-media': ['models', 'image'], 'tab-media': ['models', 'image'], 'tab-image': ['models', 'image'], 'sec-media-image': ['models', 'image'],
  'tab-video': ['models', 'video'], 'sec-media-video': ['models', 'video'], 'tab-local': ['models', 'local'], 'sec-media-local': ['models', 'local'],
  'tab-community': ['models', 'community'], 'sec-community': ['models', 'community'],
  'panel-ecosystem': ['ecosystem', 'map'], 'sec-map': ['ecosystem', 'map'], 'sec-market': ['ecosystem', 'adoption'],
  'panel-markets': ['markets', 'stocks'], 'sec-stocks': ['markets', 'stocks'], 'tab-stocknet': ['markets', 'stocks'],
  'sec-compute': ['markets', 'compute'], 'tab-compute': ['markets', 'compute'],
};
export function readView(search = '', hash = '', mobile = false) {
  const p = new URLSearchParams(search), old = aliases[hash.replace(/^#/, '')];
  const view = old?.[0] || (PANELS.includes(p.get('view')) ? p.get('view') : 'today');
  const categories = ['text', 'image', 'video', 'local', 'community', 'releases', 'watch'];
  const modes = view === 'ecosystem' ? ['map', 'list', 'adoption'] : ['stocks', 'network', 'compute'];
  const requested = old?.[1] || p.get(view === 'models' ? 'category' : 'mode');
  return { view, category: categories.includes(requested) ? requested : 'text',
    mode: modes.includes(requested) ? requested : view === 'ecosystem' ? (mobile ? 'list' : 'map') : 'stocks' };
}
export function viewUrl(state, base = 'app.html') {
  const p = new URLSearchParams({ view: state.view });
  if (state.view === 'models') p.set('category', state.category || 'text');
  if (['ecosystem', 'markets'].includes(state.view)) p.set('mode', state.mode || (state.view === 'ecosystem' ? 'map' : 'stocks'));
  return base + '?' + p;
}
