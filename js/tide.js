// The Tide — a native-SVG stacked-area view of daily signal volume by
// category over the collected history (Priority 9). Strictly bounded to the
// days actually collected: it renders exactly the day-buckets present in
// range.json's dailyCategoryHistory and labels the real available range. It
// never draws a smooth 30-day curve over 1 day of data — below a minimum
// number of days it shows an honest "collecting" state instead of implying
// history that doesn't exist.
import { esc } from './util.js';

const VW = 720, VH = 200, PAD_L = 34, PAD_R = 12, PAD_T = 14, PAD_B = 26;
const MIN_DAYS = 3; // fewer than this and a stacked area would be meaningless

// Draw order bottom→top; colors reuse the river category palette.
const CAT_ORDER = ['product', 'research', 'compute', 'capital', 'policy', 'adoption', 'opensource', 'market', 'orggov'];
const CAT_COLOR = {
  product: 'var(--sea)', research: 'var(--sand)', compute: 'var(--deep)', capital: 'var(--teal)',
  policy: '#7a5c8e', adoption: 'var(--ink-soft)', opensource: '#4b8a6f', market: 'var(--coral)', orggov: '#9a7bb5',
};
const CAT_LABEL = {
  product: 'Product', research: 'Research', compute: 'Compute', capital: 'Capital', policy: 'Policy',
  adoption: 'Adoption', opensource: 'Open source', market: 'Market', orggov: 'Org/gov',
};

export function renderTide(root, ranges) {
  if (!root) return;
  const history = ranges?.dailyCategoryHistory || [];
  const depth = ranges?.historyDepthDays ?? 0;

  if (history.length < MIN_DAYS) {
    root.innerHTML = `
      <div class="tide-collecting empty-state">
        <b>The 30-day Tide is still filling.</b> It charts how daily <b>operational</b>
        AI activity changes by category — general commentary and opinion/analysis
        are excluded. It only plots days actually collected — so far
        ${esc(String(history.length))} day${history.length === 1 ? '' : 's'}
        (${esc(String(depth))}d). It appears here once at least ${MIN_DAYS} days exist,
        and never draws history that wasn't recorded.
      </div>`;
    return;
  }

  // categories actually present, ordered
  const present = CAT_ORDER.filter((c) => history.some((d) => (d.counts || {})[c] > 0));
  const days = history.slice(-30); // at most the last 30 collected days
  const n = days.length;

  // stacked totals per day → max for y-scale
  const dayTotals = days.map((d) => present.reduce((s, c) => s + ((d.counts || {})[c] || 0), 0));
  const yMax = Math.max(1, ...dayTotals);

  const xFor = (i) => PAD_L + (n === 1 ? (VW - PAD_L - PAD_R) / 2 : (i / (n - 1)) * (VW - PAD_L - PAD_R));
  const yFor = (v) => VH - PAD_B - (v / yMax) * (VH - PAD_T - PAD_B);

  // build cumulative stacked bands (bottom→top)
  const cum = days.map(() => 0);
  const bands = present.map((cat) => {
    const lower = cum.slice();
    days.forEach((d, i) => { cum[i] += (d.counts || {})[cat] || 0; });
    const upper = cum.slice();
    const top = upper.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`);
    const bottom = lower.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).reverse();
    return { cat, points: [...top, ...bottom].join(' ') };
  });

  // y gridlines
  const ticks = 3;
  const grid = Array.from({ length: ticks + 1 }, (_, k) => {
    const v = Math.round((yMax * k) / ticks);
    const y = yFor(v);
    return `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${VW - PAD_R}" y2="${y.toFixed(1)}" class="tide-grid"></line>
            <text x="${PAD_L - 6}" y="${(y + 3).toFixed(1)}" class="tide-ytick">${v}</text>`;
  }).join('');

  // x labels (first, middle, last day)
  const xLabelIdx = n <= 3 ? days.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const xLabels = xLabelIdx.map((i) => {
    const d = days[i].date.slice(5); // MM-DD
    return `<text x="${xFor(i).toFixed(1)}" y="${VH - 8}" class="tide-xtick" text-anchor="middle">${esc(d)}</text>`;
  }).join('');

  root.innerHTML = `
    <div class="tide-head">
      <span class="tide-range">${esc(String(n))} day${n === 1 ? '' : 's'} of history · ${esc(days[0].date)} → ${esc(days[n - 1].date)}</span>
    </div>
    <svg class="tide-svg" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Daily AI signal volume by category over ${n} collected days. A text summary follows.">
      ${grid}
      ${bands.map((b) => `<polygon class="tide-band" points="${b.points}" fill="${CAT_COLOR[b.cat]}" opacity="0.72"><title>${esc(CAT_LABEL[b.cat] || b.cat)}</title></polygon>`).join('')}
      ${xLabels}
    </svg>
    <div class="tide-legend">
      ${present.map((c) => `<span class="tide-key"><span class="tide-swatch" style="background:${CAT_COLOR[c]}"></span>${esc(CAT_LABEL[c] || c)}</span>`).join('')}
    </div>
    <p class="tide-summary">Across ${esc(String(n))} collected day${n === 1 ? '' : 's'}, the busiest categories were ${esc(topCategories(days, present))}. <span class="tide-note">Operational categories only — general commentary and opinion/analysis are excluded.</span></p>
  `;
}

function topCategories(days, present) {
  const totals = {};
  for (const c of present) totals[c] = days.reduce((s, d) => s + ((d.counts || {})[c] || 0), 0);
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([c, v]) => `${CAT_LABEL[c] || c} (${v})`).join(', ');
}
