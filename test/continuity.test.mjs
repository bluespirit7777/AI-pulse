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
const navSrc = read('js/nav.js');
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
  for (const id of ['today', 'ecosystem', 'models', 'markets']) {
    assert.match(landingHtml, new RegExp(`id="${id}"`), `landing must have a #${id} band`);
  }
});

test('the old landing anchors still resolve, so existing links do not break', () => {
  for (const id of ['surface', 'currents']) {
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
  for (const id of ['today', 'ecosystem', 'models', 'markets']) {
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

test('the dashboard merges Waves and River into one "News Wave" section', () => {
  assert.match(appHtml, />News Wave</, 'app.html must show the merged "News Wave" heading');
  // Both original render mount points must survive underneath it unchanged --
  // js/waveform.js and js/river.js were not touched by this merge.
  assert.match(appHtml, /id="waves"/, 'the waves mount point must still exist');
  assert.match(appHtml, /id="river"/, 'the river mount point must still exist');
  // The old two-heading split is gone.
  assert.doesNotMatch(appHtml, /Today's strongest waves/, 'the old separate Waves heading must be gone');
  assert.doesNotMatch(appHtml, /Signal river/, 'the old separate River heading must be gone');
  // The depth union this section feeds the rail with must survive the merge:
  // panelDepths() in js/nav.js scans every descendant [data-depth], so both
  // values must still appear somewhere under #panel-today. Isolate the panel
  // by the next id="panel-" (or </main>) rather than a hardcoded neighbour
  // comment -- the panels' DOM order is not fixed (see Task 3's reorder).
  const todayStartTag = appHtml.match(/<[^>]+id="panel-today"[^>]*>/);
  assert.ok(todayStartTag, 'app.html must have #panel-today');
  const todayRest = appHtml.slice(todayStartTag.index + todayStartTag[0].length);
  const todayNextPanelOffset = todayRest.search(/id="panel-/);
  const todayEndOfMainOffset = todayRest.search(/<\/main>/);
  const todayCandidateEnds = [todayRest.length, todayNextPanelOffset, todayEndOfMainOffset].filter((n) => n !== -1);
  const panelToday = todayRest.slice(0, Math.min(...todayCandidateEnds));
  assert.ok(panelToday, 'could not isolate #panel-today for the depth check');
  assert.match(panelToday, /data-depth="surface"/, 'the waves portion must keep data-depth="surface"');
  assert.match(panelToday, /data-depth="currents"/, 'the river portion must keep data-depth="currents"');
});

test('the landing merges its Waves and River previews under "News Wave"', () => {
  const todayBand = landingHtml.match(/<section class="band" id="today"[\s\S]*?<\/section>/)?.[0];
  assert.ok(todayBand, 'landing must have a #today band');
  assert.match(todayBand, />News Wave</, 'the landing must label the merged preview "News Wave"');
  assert.match(todayBand, /id="lp-waves"/, 'the waves preview mount point must still exist');
  assert.match(todayBand, /id="lp-river"/, 'the river preview mount point must still exist');
  // The tab-switching UI is gone -- both previews are stacked, not chosen between.
  assert.doesNotMatch(todayBand, /role="tablist"/, 'the Surface-views tablist must be removed');
});

test('Research is removed from both pages', () => {
  assert.doesNotMatch(appHtml, /id="panel-research"/, 'app.html must not have a Research panel');
  assert.doesNotMatch(appHtml, /data-panel="research"/, 'app.html must not have a Research nav pill');
  assert.doesNotMatch(landingHtml, /id="research"/, 'index.html must not have a Research band');
  assert.doesNotMatch(landingHtml, /href="#research"/, 'index.html must not link to a Research anchor');
});

test('the dashboard is one continuous page, with no hidden top sections', () => {
  // Every .topsection used to be hidden except the active one; navigation
  // switched which was visible. The dashboard is now a single scroll, so a
  // `hidden` attribute on a topsection would silently remove a whole section
  // from the page with no way to get it back -- the nav no longer unhides.
  const topsections = [...appHtml.matchAll(/<section[^>]*class="topsection"[^>]*>/g)].map((m) => m[0]);
  assert.equal(topsections.length, 4, 'app.html must have exactly 4 top sections');
  for (const tag of topsections) {
    assert.doesNotMatch(tag, /\shidden(\s|>|=)/, `a topsection must not be hidden: ${tag}`);
  }
});

test('js/nav.js drives one page by scrolling, not by switching panels', () => {
  // The panel-switching API is gone. If any of these come back, the module
  // has regressed to the two-mode (tabbed + "Full page") IA this replaced.
  assert.doesNotMatch(navSrc, /export function goTo\b/, 'goTo() must be gone -- pills scroll now');
  assert.doesNotMatch(navSrc, /export function activateFullPage\b/, 'activateFullPage() must be gone -- the page IS full page now');
  assert.doesNotMatch(navSrc, /\.hidden\s*=/, 'nav.js must never set .hidden -- every section is always visible');
  // And the replacement must actually exist.
  assert.match(navSrc, /scrollIntoView|scrollTo/, 'nav.js must scroll to navigate');
  assert.match(navSrc, /addEventListener\('scroll'/, 'the depth rail must be driven by scroll position (scroll-spy)');
});

test('the dashboard top nav is labelled Top / Models / Ecosystem / News Wave / Markets', () => {
  const nav = appHtml.match(/<nav class="topnav"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav, 'app.html must have a .topnav');
  const labels = [...nav.matchAll(/<button[^>]*data-panel="[^"]*"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1].trim());
  assert.deepEqual(labels, ['Top', 'Models', 'Ecosystem', 'News Wave', 'Markets']);
  // The internal ids must NOT have been renamed along with the labels --
  // js/deeplink.js's allowlist, LEGACY_HASH and every landing link depend on
  // them. "News Wave" is the label for data-panel="today".
  assert.match(nav, /data-panel="today"[^>]*>News Wave</, 'News Wave must still be data-panel="today"');
  assert.match(nav, /data-panel="full"[^>]*>Top</, 'Top must still be data-panel="full"');
});

test('the dashboard sections appear in the same order as the nav pills', () => {
  // js/nav.js's scroll-spy walks its PANELS array in order and takes the last
  // section whose top has passed the chrome line. That is only correct if the
  // array, the nav pills and the DOM all agree, so pin the DOM order here.
  const domOrder = [...appHtml.matchAll(/<section[^>]*class="topsection"[^>]*data-panel="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(domOrder, ['models', 'ecosystem', 'today', 'markets']);

  const nav = appHtml.match(/<nav class="topnav"[\s\S]*?<\/nav>/)?.[0];
  const navOrder = [...nav.matchAll(/<button[^>]*data-panel="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== 'full');
  assert.deepEqual(navOrder, domOrder, 'nav pill order must match DOM section order');

  const navSrcOrder = navSrc.match(/const PANELS = \[([^\]]+)\]/)?.[1];
  assert.ok(navSrcOrder, 'js/nav.js must declare a PANELS array');
  assert.deepEqual(
    navSrcOrder.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean),
    domOrder,
    "js/nav.js's PANELS must be in DOM order -- the scroll-spy depends on it"
  );
});
