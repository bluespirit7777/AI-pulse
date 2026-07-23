// Launch Radar — pure, deterministic helpers for the "be first to know" signal.
// Imported by scripts/update-launchradar.mjs (build-time IO) and
// test/launchradar.test.mjs. No I/O here: URL building, response parsing, and
// the new-release diff are all pure so every rule is testable offline.
//
// The idea: a model/feature appears in a lab's MACHINERY — a model-hub upload,
// an SDK release that adds a model constant — at, or slightly before, the
// marketing blog post. Watching that machinery (rather than press/RSS, which
// are downstream) is what makes detection early. This v1 covers the two
// cleanest, fully-structured, keyless signals:
//   1. Hugging Face model uploads  → open-weight labs (Qwen, Llama, DeepSeek…)
//   2. GitHub releases on official SDK/model repos → the closed labs' tooling
// Both are plain JSON. Richer signals (API /v1/models diffs, machine-readable
// changelogs) are documented follow-ups that need per-lab API keys.

const HF_API = 'https://huggingface.co/api/models';
const GH_API = 'https://api.github.com';

// ---------- URL building ----------

// Newest-first model list for one HF org/author. No key required.
export function buildHfModelsUrl({ org, limit = 10 }) {
  const params = new URLSearchParams({
    author: org,
    sort: 'createdAt',
    direction: '-1',
    limit: String(limit),
  });
  return `${HF_API}?${params.toString()}`;
}

// Newest-first releases for one GitHub repo ("owner/name").
export function buildGithubReleasesUrl({ repo, perPage = 5 }) {
  return `${GH_API}/repos/${repo}/releases?per_page=${perPage}`;
}

// ---------- response parsing → normalized entries ----------
// A normalized entry is the common shape every source maps into, so the diff
// and the frontend never care which source it came from:
//   { id, source, org, label, title, kind, at, url }
// `id` is a stable, globally-unique key used for de-duplication AND for the
// new-vs-seen diff — it must be derived from immutable identity (the HF repo
// id, the GH repo+tag), never from a timestamp or a display string.

export function parseHfModels(json, { org, label }) {
  const items = Array.isArray(json) ? json : [];
  return items
    .filter((it) => it && (it.id || it.modelId) && it.createdAt)
    .map((it) => {
      const repoId = it.id || it.modelId; // e.g. "Qwen/Qwen3.6-30B"
      return {
        id: `hf:${repoId}`,
        source: 'huggingface',
        org,
        label,
        title: shortModelName(repoId),
        kind: 'model',
        at: normalizeISO(it.createdAt),
        url: `https://huggingface.co/${repoId}`,
      };
    })
    .filter((e) => e.at); // drop anything whose timestamp didn't parse
}

export function parseGithubReleases(json, { repo, label, org }) {
  const items = Array.isArray(json) ? json : [];
  return items
    .filter((it) => it && !it.draft && (it.tag_name || it.name) && (it.published_at || it.created_at))
    .map((it) => {
      const tag = it.tag_name || it.name;
      return {
        id: `gh:${repo}@${tag}`,
        source: 'github',
        org,
        label,
        title: `${repoShortName(repo)} ${tag}`,
        kind: it.prerelease ? 'sdk-prerelease' : 'sdk-release',
        at: normalizeISO(it.published_at || it.created_at),
        url: it.html_url || `https://github.com/${repo}/releases`,
      };
    })
    .filter((e) => e.at);
}

// "Qwen/Qwen3.6-30B-Instruct" → "Qwen3.6-30B-Instruct" (repo id minus the org).
function shortModelName(repoId) {
  const s = String(repoId);
  const slash = s.indexOf('/');
  return slash >= 0 ? s.slice(slash + 1) : s;
}
// "openai/openai-python" → "openai-python"
function repoShortName(repo) {
  const s = String(repo);
  const slash = s.indexOf('/');
  return slash >= 0 ? s.slice(slash + 1) : s;
}

// Normalize any date-ish input to a real ISO string, or '' if it doesn't parse
// (never a fabricated "now" — an unparseable timestamp is dropped, not guessed).
function normalizeISO(v) {
  if (!v) return '';
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

// ---------- de-dupe + ordering ----------

// Keep the first occurrence of each id (sources shouldn't collide, but a repo
// listed twice in config shouldn't double-count).
export function dedupeById(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries || []) {
    if (!e || !e.id || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

// Newest first by the source's own timestamp (the real release time).
export function sortByRecency(entries) {
  return (entries || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

// ---------- the new-release diff (the actual "be first" logic) ----------
// `knownIds` is the set of ids seen in PRIOR runs. An entry is "new" only if
// its id isn't in that set AND this isn't the very first run — on a cold start
// (no prior known ids) everything is treated as an existing baseline, NOT a
// flood of fake "launches". This is the same first-run discipline the range
// history and community estimation already use elsewhere in the codebase.
export function markNew(entries, knownIds, { firstRun = false } = {}) {
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds || []);
  return (entries || []).map((e) => ({
    ...e,
    isNew: firstRun ? false : !known.has(e.id),
  }));
}

// Union of prior + current ids, most-recent kept, capped so the diff store
// can't grow without bound. Order: current ids first (they're the freshest),
// then prior ids, de-duped, sliced to `cap`.
export function mergeKnownIds(prevIds, currentIds, cap = 800) {
  const out = [];
  const seen = new Set();
  for (const id of [...(currentIds || []), ...(prevIds || [])]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

// Full assembly over already-fetched, already-parsed entries + the previous
// snapshot object. Pure: the caller does the fetches and the file IO.
//   prevSnapshot: the parsed previous data/launch-radar.json (or null on cold start)
//   allEntries:   flat array of normalized entries from every source this run
//   displayLimit: how many recent entries the frontend shows
export function buildRadarSnapshot({ prevSnapshot, allEntries, sources = [], displayLimit = 30, knownCap = 800, now = Date.now() }) {
  const firstRun = !prevSnapshot || !Array.isArray(prevSnapshot.knownIds) || prevSnapshot.knownIds.length === 0;
  const knownIds = new Set(firstRun ? [] : prevSnapshot.knownIds);
  // preserve the firstSeen timestamp of anything we already displayed, so the
  // "detected" time is stable across runs and doesn't reset every fetch.
  const prevFirstSeen = new Map((prevSnapshot?.entries || []).map((e) => [e.id, e.firstSeenAt]));

  const ranked = sortByRecency(dedupeById(allEntries));
  const marked = markNew(ranked, knownIds, { firstRun }).map((e) => ({
    ...e,
    firstSeenAt: prevFirstSeen.get(e.id) || new Date(now).toISOString(),
  }));

  const display = marked.slice(0, displayLimit);
  const currentIds = ranked.map((e) => e.id);
  const knownOut = mergeKnownIds(prevSnapshot?.knownIds || [], currentIds, knownCap);
  const newlyDetected = marked.filter((e) => e.isNew);

  return {
    updatedAt: new Date(now).toISOString(),
    firstRun,
    sources,
    newCount: newlyDetected.length,
    newlyDetected: newlyDetected.map(({ id, label, title, url, at, source }) => ({ id, label, title, url, at, source })),
    entries: display,
    knownIds: knownOut,
  };
}
