// A small, keyboard-accessible guide, independent of live feed availability.
const currents = {
  models: { kicker: 'The intelligence', title: 'Meet the minds behind the tools.', description: 'An AI model is the engine that writes, reasons, or creates. Different models have different strengths.', label: 'Explore AI models', href: 'app.html?view=models' },
  apps: { kicker: 'The everyday experience', title: 'From possibility to something useful.', description: 'Apps turn AI capabilities into things you can use: a chat assistant, a coding helper, or an image-making tool.', label: 'Explore the ecosystem', href: 'app.html?view=ecosystem' },
  chips: { kicker: 'The computing power', title: 'Behind every answer, an ocean of compute.', description: 'Specialized chips called GPUs do the heavy lifting. Their availability and cost help shape what AI can do.', label: 'Understand GPU costs', href: 'app.html?view=markets&mode=compute' }
};
const depths = {
  surface: { tag: 'YOUR FIRST BEARINGS', title: 'You don’t need to know everything.\nStart with the bigger picture.', description: 'AI is a collection of tools that learn patterns from data. Models provide the capabilities; apps put them in your hands; chips power it all.', links: [['What’s happening in AI?', 'Recent stories, with their original sources.', 'app.html?view=today'], ['Learn the language', 'Plain-English definitions, one idea at a time.', 'vocab.html']] },
  explore: { tag: 'FOLLOW YOUR CURIOSITY', title: 'Find a tool. Understand the world around it.', description: 'Start with what you want to do: write, code, create images, or run AI on your own computer. Then see the companies and connections behind the tools.', links: [['Find an AI model', 'Explore text, image, video, and local models.', 'app.html?view=models'], ['Connect the dots', 'Explore the companies, models, and infrastructure.', 'app.html?view=ecosystem&mode=map']] },
  deep: { tag: 'CONTEXT BELOW THE SURFACE', title: 'Look past the headline.\nFollow the evidence.', description: 'Compare models side by side, inspect how evaluations work, or explore infrastructure costs. Every view keeps its dates, sources, and limitations close at hand.', links: [['Compare models and tradeoffs', 'Select up to three models in the leaderboard.', 'app.html?view=models&category=text'], ['Explore infrastructure costs', 'GPU rental offers, ranges, and source context.', 'app.html?view=markets&mode=compute']] }
};

export function initDiscovery() {
  document.querySelectorAll('[data-current]').forEach(button => button.addEventListener('click', () => {
    const item = currents[button.dataset.current];
    document.querySelectorAll('[data-current]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    document.getElementById('current-kicker').textContent = item.kicker;
    document.getElementById('current-title').textContent = item.title;
    document.getElementById('current-description').textContent = item.description;
    const link = document.getElementById('current-link');
    link.textContent = item.label + ' ↗'; link.href = item.href;
  }));
  const tabs = [...document.querySelectorAll('[data-depth]')];
  const panel = document.getElementById('depth-content');
  if (!panel) return;
  function select(tab) {
    const item = depths[tab.dataset.depth];
    tabs.forEach(b => { b.setAttribute('aria-selected', String(b === tab)); b.tabIndex = b === tab ? 0 : -1; });
    panel.setAttribute('aria-labelledby', tab.id);
    panel.querySelector('.depth-tag').textContent = item.tag;
    panel.querySelector('h3').textContent = item.title;
    panel.querySelector('.depth-story>p').textContent = item.description;
    panel.querySelectorAll('.depth-next>a').forEach((link, i) => {
      const [title, description, href] = item.links[i];
      link.href = href;
      const span = link.firstElementChild;
      span.replaceChildren(document.createTextNode(title));
      const small = document.createElement('small'); small.textContent = description; span.append(small);
    });
    panel.classList.remove('is-changing');
    void panel.offsetWidth;
    panel.classList.add('is-changing');
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) { event.preventDefault(); tabs[next].focus(); select(tabs[next]); }
    });
  });
}
