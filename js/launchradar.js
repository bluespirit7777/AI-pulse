// Launch Radar — renders data/launch-radar.json: the newest model-hub uploads
// and official SDK/model releases across the frontier labs, so a visitor sees a
// new model or SDK bump the moment the machinery moves (see
// scripts/lib/launchradar.mjs for why that's early). Anything flagged isNew by
// the build-time diff gets a "NEW" highlight; the panel hides itself entirely
// if the data file is missing/empty, rather than showing a broken state.
import { esc, timeAgo } from './util.js';

// Lab → the same accent tokens the rest of the site uses, so Launch Radar reads
// as part of the whole (not a bolted-on widget). Falls back to a neutral tone.
const LABEL_ACCENT = {
  OpenAI: 'var(--deep)', Claude: 'var(--coral)', Gemini: 'var(--sea)',
  Grok: 'var(--ink-soft)', Qwen: 'var(--sand)', Llama: 'var(--ink-soft)',
  DeepSeek: 'var(--teal)', Mistral: 'var(--sand)', Kimi: 'var(--ink-soft)',
};
const SOURCE_LABEL = { huggingface: 'Hugging Face', github: 'GitHub release' };

export function renderLaunchRadar(root, radar) {
  if (!root) return;
  const entries = (radar && Array.isArray(radar.entries)) ? radar.entries : [];
  if (!entries.length) { root.innerHTML = ''; root.hidden = true; return; }
  root.hidden = false;

  const newCount = radar.newCount || entries.filter((e) => e.isNew).length;
  const rows = entries.map((e) => {
    const accent = LABEL_ACCENT[e.label] || 'var(--ink-dim)';
    const when = e.at ? timeAgo(e.at) : '';
    return `
      <li class="lr-item${e.isNew ? ' lr-item--new' : ''}">
        <span class="lr-badge" style="--lr-accent:${accent}">${esc(e.label)}</span>
        <a class="lr-title" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>
        ${e.isNew ? '<span class="lr-new" title="First detected in the latest scan">NEW</span>' : ''}
        <span class="lr-meta">${esc(SOURCE_LABEL[e.source] || e.source)}${when ? ' · ' + esc(when) : ''}</span>
      </li>`;
  }).join('');

  root.innerHTML = `
    <div class="lr-head">
      <span class="lr-kicker">${newCount > 0
        ? `<span class="lr-pulse" aria-hidden="true"></span>${newCount} new since last scan`
        : 'No new releases since last scan'}</span>
      <span class="lr-note">Watches model-hub uploads &amp; official SDK releases — earliest machine signal of a launch, ahead of press.</span>
    </div>
    <ul class="lr-list">${rows}</ul>`;
}
