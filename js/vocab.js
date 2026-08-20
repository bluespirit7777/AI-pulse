// Entry-point script for vocab.html — the same role js/main.js plays for
// app.html and js/landing.js plays for index.html. Pure synchronous render
// from the hand-maintained js/vocab-data.js; no fetch, no async data.
import { vocabTerms, VOCAB_SECTIONS } from './vocab-data.js';

function termsFor(sectionId) {
  return vocabTerms
    .filter((entry) => entry.section === sectionId)
    .sort((a, b) => a.term.localeCompare(b.term));
}

function renderGroup(section) {
  const terms = termsFor(section.id);
  if (!terms.length) return null;

  const group = document.createElement('section');
  group.className = 'vocab-group';

  const title = document.createElement('h2');
  title.className = 'section-head__title';
  title.textContent = section.label;
  group.appendChild(title);

  const list = document.createElement('div');
  list.className = 'vocab-list';

  for (const entry of terms) {
    const item = document.createElement('div');
    item.className = 'vocab-entry';

    const term = document.createElement('div');
    term.className = 'vocab-term';
    term.textContent = entry.term;

    const def = document.createElement('div');
    def.className = 'vocab-def';
    def.textContent = entry.definition + ' ';

    const link = document.createElement('a');
    link.className = 'vocab-see';
    link.href = `app.html#${entry.anchor}`;
    link.textContent = 'See it on the dashboard →';
    def.appendChild(link);

    item.appendChild(term);
    item.appendChild(def);
    list.appendChild(item);
  }

  group.appendChild(list);
  return group;
}

function renderVocab() {
  const mount = document.getElementById('vocab-sections');
  if (!mount) return;
  for (const section of VOCAB_SECTIONS) {
    const group = renderGroup(section);
    if (group) mount.appendChild(group);
  }
}

renderVocab();
