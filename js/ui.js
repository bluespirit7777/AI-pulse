import { initOcean } from './ocean.js';
import { initMotion } from './motion.js';
import { initLanguage } from './i18n.js';
import { esc } from './util.js';
import { vocabTerms } from './vocab-data.js';
export function safeUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; }
}
export function sourceLink(url, label) { return `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`; }
export function setDrawerBackground(inert) {
  document.querySelectorAll('body > header,body > main,body > footer,body > .skip-link').forEach(n => { n.toggleAttribute('inert', inert); });
}
export function openDialog(title, content) {
  const d = document.getElementById('detail-dialog'), previous = document.activeElement;
  d.innerHTML = `<div class="dialog-head"><h2 id="detail-title">${esc(title)}</h2><button type="button" class="button quiet" data-close>Close</button></div>${content}`;
  d.showModal(); d.querySelector('[data-close]').focus();
  d.querySelector('[data-close]').onclick = () => d.close();
  d.addEventListener('close', () => { if (previous?.isConnected) previous.focus({preventScroll:true}); }, { once: true });
}
export function initShell() {
  initOcean();
  initMotion();
  initLanguage();
  const menu = document.getElementById('site-menu'), toggle = document.getElementById('menu-toggle');
  const close = () => { menu?.classList.remove('is-open'); toggle?.setAttribute('aria-expanded','false'); };
  toggle?.addEventListener('click', () => { const on = menu.classList.toggle('is-open'); toggle.setAttribute('aria-expanded', String(on)); });
  menu?.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && menu?.classList.contains('is-open')) { close(); toggle.focus(); } });
  document.addEventListener('click', e => {
    if (menu?.classList.contains('is-open') && !e.target.closest('.site-header')) close();
    const help = e.target.closest('[data-term]');
    if(help) {
      const term = vocabTerms.find(t => t.id === help.dataset.term || t.term?.toLowerCase() === help.dataset.term.toLowerCase());
      openDialog(term?.term || help.dataset.term, `<p>${esc(term?.definition || term?.def || 'Explore the glossary for definitions, examples, and source context.')}</p><a class="button" href="vocab.html">Learn more in the glossary</a>`);
    }
    if(e.target.closest('[data-methodology]')) openDialog('Sources & methodology', `<p>AI Pulse brings together news, model evaluations, community discussion, and market snapshots. Each view names its sources and observation period.</p><dl><dt>Collected automatically</dt><dd>News from publisher feeds; discussions from Hacker News, developer forums and GitHub; stock snapshots from Yahoo Finance; GPU listings from Vast.ai and RunPod.</dd><dt>Curated snapshots</dt><dd>Model evaluations and referral share are updated by hand. Their dates stay visible even when the news refreshes.</dd><dt>Estimates</dt><dd>Partial discussion samples and hardware requirements are labeled. Popularity and discussion counts do not measure answer quality.</dd></dl><p>Briefs are AI-written and source-linked when a current, fully cited brief is available. Otherwise, recent source headlines are shown.</p><p>Missing data remains missing. Automatic collection is not independent verification.</p><a href="docs/METHODOLOGY.md">Read the detailed methodology</a>`);
  });
}
