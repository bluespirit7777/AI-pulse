#!/usr/bin/env node
// Guard tests for landing <-> dashboard continuity. This project has zero npm
// dependencies and therefore no jsdom, so these are source-text contracts in
// the same style as test/landing.test.mjs — they pin the structural promises
// the two pages make to each other. Visual correctness is verified by
// screenshot in the browser, not here.
// Run: node --test test/continuity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(__dirname, '..', p), 'utf-8');

const landingHtml = read('index.html');
const appHtml = read('app.html');
const tokensCss = read('css/tokens.css');

test('both pages link the shared token stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/tokens\.css"/, `${name} must link css/tokens.css`);
  }
});

test('neither page redefines a canonical colour token locally', () => {
  // The whole point of tokens.css is that there is ONE definition. A local
  // redefinition is exactly the drift this replaces (index.html used to
  // hand-copy the dashboard's hexes with "/* app.html --ink */" beside them).
  const canonical = ['--ink', '--deep', '--teal', '--sea', '--sand', '--foam'];
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    const styleBlocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const token of canonical) {
      assert.doesNotMatch(
        styleBlocks,
        new RegExp(`${token}\\s*:`),
        `${name} redefines ${token} locally; it belongs in css/tokens.css`
      );
    }
  }
});

test('tokens.css keeps the two pages\' conflicting pale tone separate', () => {
  // --foam was #F4FAFB on the landing and #EAF4F6 on the dashboard. Collapsing
  // them would visibly change one page, so the landing's pale value lives on
  // as --mist.
  assert.match(tokensCss, /--foam:\s*#EAF4F6/i, '--foam keeps the dashboard value (18 usages)');
  assert.match(tokensCss, /--mist:\s*#F4FAFB/i, "--mist carries the landing's pale value");
});

test('the landing keeps its aliases so its existing rules still resolve', () => {
  for (const alias of ['--tide', '--mid', '--warm', '--serif', '--sans', '--mono']) {
    assert.match(tokensCss, new RegExp(`${alias}\\s*:`), `${alias} alias missing from tokens.css`);
  }
});

test('no page still uses var(--foam) where it meant the landing pale tone', () => {
  // The landing's three gradient endpoints must have moved to --mist.
  const landingStyles = [...landingHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const gradientLines = landingStyles.split('\n').filter((l) => /linear-gradient/.test(l) && /var\(--foam\)/.test(l));
  assert.deepEqual(gradientLines, [], `landing gradients must use var(--mist): ${gradientLines.join(' | ')}`);
});

test('both pages link the shared shell stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/shell\.css"/, `${name} must link css/shell.css`);
  }
});

test('the dashboard restores its ocean wallpaper, with a legibility veil', () => {
  // Reversed by explicit owner request after the continuity branch shipped.
  // The photo was originally removed because small mono type (depth rail,
  // ticker, section descriptors) read poorly directly on it -- see
  // docs/superpowers/specs/2026-07-30-landing-dashboard-continuity-design.md.
  // Restoring it WITH a legibility veil (rather than bare) keeps that fix
  // intact -- the same two-layer pattern the site used before the photo was
  // ever removed.
  assert.match(appHtml, /class="ocean-bg"/, 'app.html must paint the ocean photo again');
  assert.match(appHtml, /url\(assets\/ocean\.jpg\)/, 'the .ocean-bg layer must reference assets/ocean.jpg');
  assert.match(appHtml, /class="ocean-veil"/, 'the photo must be paired with a legibility veil, not left bare');
  // This is a dashboard-only reversal -- the shared gradient in css/shell.css,
  // and the landing that reads from it, must not change.
  assert.doesNotMatch(landingHtml, /class="ocean-bg"/, 'the landing must NOT gain a photo background');
});

test('the dashboard keeps its animated wave footer (a signature element, not the photo)', () => {
  assert.match(appHtml, /class="waves"/, 'the wave footer stays');
});

test('one measure governs both pages', () => {
  const shellCss = read('css/shell.css');
  assert.match(shellCss, /\.wrap\{[^}]*max-width:\s*var\(--maxw\)/, '.wrap must use the shared --maxw');
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /\.wrap\{[^}]*max-width:\s*\d+px/, 'app.html must not hardcode its own measure');
});

test('both pages use the shared header and brand classes', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /class="[^"]*site-header/, `${name} must use .site-header`);
    assert.match(html, /class="[^"]*site-brand/, `${name} must use .site-brand`);
  }
});

test('both pages offer a reciprocal control to the other page, in the header', () => {
  // The landing has always had "Open dashboard"; the dashboard's way back was
  // a plain text link in a different position. Both are now pills in the same
  // header slot, so the control does not move as you cross between pages.
  assert.match(landingHtml, /class="[^"]*nav-pill[^"]*"[^>]*href="app\.html"/, 'landing needs its dashboard pill');
  assert.match(appHtml, /class="[^"]*nav-pill[^"]*"[^>]*href="\.\/"/, 'dashboard needs its landing pill');
});

test('the focus ring is one colour across both pages', () => {
  const shellCss = read('css/shell.css');
  assert.match(shellCss, /:focus-visible\{[^}]*outline:[^;]*var\(--sand\)/, 'shared sand focus ring');
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /focus-visible\{[^}]*outline:\s*2px solid var\(--teal\)/, 'app.html must not keep its own teal focus ring');
});

test('both renderers emit the same shared row component', () => {
  const landingJs = read('js/landing.js');
  const sectionsJs = read('js/sections.js');
  // Match the emitted markup itself, not a comment referencing it — a
  // comment can say "Uses the SHARED .rank-row component" while the
  // renderer still emits the superseded class="r".
  assert.match(landingJs, /class="rank-row/, 'js/landing.js must emit class="rank-row..."');
  assert.doesNotMatch(landingJs, /class="r"/, 'js/landing.js must not emit the superseded class="r"');
  assert.match(sectionsJs, /class="rank-row/, 'js/sections.js must emit class="rank-row..."');
});

test('the superseded per-page row classes are gone', () => {
  const appStyles = [...appHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const landingStyles = [...landingHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(appStyles, /\.(lb-row|lb-top|lb-name|lb-rank|lb-model|lb-org|lb-score|lb-stat|lb-note|bar-track|bar-fill)\s*\{/, 'app.html inline styles must not define superseded row classes (.lb-note-lead and .lb-tab* rules are OK)');
  assert.doesNotMatch(landingStyles, /\.mini\s+\.r\{/, 'index.html must not define its own row');
});

test('both pages link the shared component stylesheet', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /<link[^>]+href="css\/components\.css"/, `${name} must link css/components.css`);
  }
});

test('the landing bands carry the dashboard\'s panel names', () => {
  for (const id of ['today', 'ecosystem', 'models', 'markets', 'research']) {
    assert.match(landingHtml, new RegExp(`id="${id}"`), `landing must have a #${id} band`);
  }
});

test('the old landing anchors still resolve, so existing links do not break', () => {
  for (const id of ['surface', 'currents', 'seabed']) {
    assert.match(landingHtml, new RegExp(`id="${id}"`), `legacy anchor #${id} must survive as an alias`);
  }
});

test('no landing id collides with the deeplink forwarder allowlist', () => {
  // js/deeplink.js forwards /^#(full$|panel-|tab-|sec-)/ to app.html. A landing
  // id matching that pattern would bounce visitors off the landing page the
  // moment they clicked its own nav.
  const deeplinkJs = read('js/deeplink.js');
  const src = deeplinkJs.match(/if \(!(\/\^#\([^/]+\)\/)\.test\(hash\)\) return;/)?.[1];
  assert.ok(src, 'could not locate the hash predicate in js/deeplink.js');
  const re = new RegExp(src.slice(1, -1));
  const ids = [...landingHtml.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    assert.ok(!re.test('#' + id), `landing id #${id} would be forwarded to app.html by deeplink.js`);
  }
});

test('the landing rail is a depth READOUT, not a second navigation', () => {
  // This is the fix for the core problem: depth was the scroll spine on the
  // landing and a property of content on the dashboard, so the mental model a
  // visitor had just learned stopped predicting anything at the transition.
  const railMatch = landingHtml.match(/<div class="depth-rail"[\s\S]*?<\/div>/);
  assert.ok(railMatch, 'landing must carry a .depth-rail');
  assert.doesNotMatch(railMatch[0], /<a\b/, 'the rail must contain no links — it reports, it does not navigate');
  assert.match(railMatch[0], /data-depth="surface"/, 'rail must report depths');
});

test('both pages use the same depth-rail markup contract', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    for (const d of ['surface', 'currents', 'midwater', 'seabed']) {
      assert.match(html, new RegExp(`data-depth="${d}"`), `${name} must report the ${d} depth`);
    }
  }
});

test('the landing bands declare which depths they span', () => {
  for (const id of ['today', 'ecosystem', 'models', 'markets', 'research']) {
    const band = landingHtml.match(new RegExp(`<[^>]+id="${id}"[^>]*>`));
    assert.ok(band, `#${id} not found`);
    assert.match(band[0], /data-depth="/, `#${id} must declare its depth span`);
  }
});

test('the landing bands report the exact same depth set as their dashboard panel', () => {
  // The dashboard never hand-declares a panel's depth: js/nav.js's
  // panelDepths() derives it live by scanning every data-depth attribute
  // under #panel-X (normalizeLocalNav() unhides all tabpanels at init, so
  // every subsection counts, not just the visible tab). The landing instead
  // hand-writes a single data-depth on its #X band, because it has no
  // panel/tab structure to scan. Those two mechanisms can silently diverge
  // whenever a dashboard subsection's data-depth changes without someone
  // remembering to update the landing band to match -- which is exactly the
  // Models bug this suite exists to catch (dashboard spans surface+midwater,
  // landing declared midwater only). So here we derive the dashboard's real
  // depth set from the source text, the same way panelDepths() would at
  // runtime, and assert the landing band declares that exact set.
  const panelMap = {
    today: 'panel-today',
    ecosystem: 'panel-ecosystem',
    models: 'panel-models',
    markets: 'panel-markets',
    research: 'panel-research',
  };

  for (const [bandId, panelId] of Object.entries(panelMap)) {
    // Slice this panel's markup: from just after its own opening tag (so a
    // data-depth on the panel tag itself, if any, would NOT count -- mirroring
    // querySelectorAll('[data-depth]'), which only matches descendants) up to
    // the next id="panel-" or </main>, whichever comes first.
    const startTag = appHtml.match(new RegExp(`<[^>]+id="${panelId}"[^>]*>`));
    assert.ok(startTag, `app.html must have #${panelId}`);
    const sliceStart = startTag.index + startTag[0].length;
    const rest = appHtml.slice(sliceStart);
    const nextPanelOffset = rest.search(/id="panel-/);
    const endOfMainOffset = rest.search(/<\/main>/);
    const candidateEnds = [rest.length, nextPanelOffset, endOfMainOffset].filter((n) => n !== -1);
    const panelSlice = rest.slice(0, Math.min(...candidateEnds));

    const dashboardDepths = new Set(
      [...panelSlice.matchAll(/data-depth="([^"]+)"/g)].map((m) => m[1])
    );

    const band = landingHtml.match(new RegExp(`<[^>]+id="${bandId}"[^>]*>`));
    assert.ok(band, `index.html must have #${bandId}`);
    const bandDepthAttr = band[0].match(/data-depth="([^"]*)"/);
    assert.ok(bandDepthAttr, `#${bandId} must declare data-depth`);
    const landingDepths = new Set(bandDepthAttr[1].split(/\s+/).filter(Boolean));

    const fmt = (set) => `{${[...set].sort().join(', ')}}`;
    assert.deepEqual(
      [...landingDepths].sort(),
      [...dashboardDepths].sort(),
      `depth mismatch for "${bandId}": landing #${bandId} declares ${fmt(landingDepths)} ` +
        `but dashboard #${panelId} spans ${fmt(dashboardDepths)}`
    );
  }
});

test('both pages use the shared section heading component', () => {
  for (const [name, html] of [['index.html', landingHtml], ['app.html', appHtml]]) {
    assert.match(html, /class="[^"]*section-head/, `${name} must use .section-head`);
  }
});

test('the superseded per-page heading and button classes are gone', () => {
  // .section-ribbon only ever lived in css/app.css (not app.html's inline
  // <style>), and was written there as ".section-ribbon {" with a space
  // before the brace — checking app.html with a no-space regex could never
  // have caught a regression here.
  const appCss = read('css/app.css');
  assert.doesNotMatch(appCss, /\.section-ribbon\s*\{/, 'css/app.css must not define its own section heading');
  // Assert the shared buttons are actually used, not merely defined —
  // a stylesheet asserting its own class always passes.
  assert.match(landingHtml, /btn--primary/, 'index.html must use .btn--primary');
  assert.match(landingHtml, /btn--secondary/, 'index.html must use .btn--secondary');
});
