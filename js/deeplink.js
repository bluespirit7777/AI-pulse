// Landing-page deep-link forwarder. Classic (non-module) script loaded in the
// <head> of index.html so it runs BEFORE first paint — a deferred module would
// flash the landing page before redirecting.
//
// The dashboard used to live at the site root, so links, bookmarks and shares
// already out in the wild point at "/#panel-models", "/#sec-leaderboard",
// "/#full" and friends. Those hashes belong to app.html now; forward them
// rather than dropping the visitor on a landing page that silently ignores
// their deep link.
//
// The match is an explicit allowlist of the dashboard's four hash shapes (see
// resolveHash + LEGACY_HASH in js/nav.js) rather than "anything the landing
// doesn't recognise", so the landing's own anchors — #today, #ecosystem,
// #models, #markets, #research — can never be captured by accident. Older
// #surface, #currents, #seabed aliases are equally protected.
//
// location.replace (not assign) keeps the landing out of session history, so
// Back returns to wherever the visitor actually came from.
(function () {
  var hash = window.location.hash;
  if (!hash) return;
  if (!/^#(full$|panel-|tab-|sec-)/.test(hash)) return;
  window.location.replace('app.html' + hash);
})();
