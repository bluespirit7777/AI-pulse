// Shared, pure, deterministic YouTube search helpers — imported by
// scripts/update-youtube.mjs (build time, twice daily) and
// test/youtube.test.mjs. No I/O: URL-building and response-parsing only, so
// every rule here is testable without a live API key or network call.
//
// Finds the most-watched video in the trailing 7 days for each of Claude,
// ChatGPT and Gemini, searched SEPARATELY so one model's volume never crowds
// out another's. `order=viewCount` does the ranking server-side (YouTube's
// own view counts, not a derived score); a follow-up videos.list call adds
// the real view-count + duration, since search.list returns neither. Three
// filters run before the final top-5 cut: a relevance guard (the "Gemini"
// zodiac false-positive), an English-only guard (script-based on the title,
// since YouTube's relevanceLanguage hint is soft), and a Shorts exclusion
// (duration-based — YouTube's public API has no explicit "is a Short" field).

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

// YouTube's own Shorts eligibility window is up to 3 minutes (extended from
// the original 60s in 2024). There's no official API flag for "is a Short" —
// duration is the best available proxy, so this is a best-effort filter, not
// a guarantee: a landscape video that happens to be under 3 minutes could
// still slip through, and there's no way to tell from the public API alone.
export const MAX_SHORT_SECONDS = 180;

export function buildSearchUrl({ query, apiKey, publishedAfter, maxResults = 5 }) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'viewCount',
    publishedAfter,
    maxResults: String(maxResults),
    safeSearch: 'strict',
    relevanceLanguage: 'en', // bias results toward English (a hint, not a hard
    regionCode: 'US',        // filter — the script-based isLikelyEnglish check
    key: apiKey,             // below is what actually drops non-English titles)
  });
  return `${SEARCH_URL}?${params.toString()}`;
}

// Requests statistics + contentDetails in the SAME call — videos.list costs
// 1 quota unit per call regardless of how many parts or ids (up to 50) are
// requested, so adding contentDetails for the Shorts-duration check is free.
export function buildVideosStatsUrl({ videoIds, apiKey }) {
  const params = new URLSearchParams({
    part: 'statistics,contentDetails',
    id: (videoIds || []).join(','),
    key: apiKey,
  });
  return `${VIDEOS_URL}?${params.toString()}`;
}

// search.list items → normalized, unranked-by-views-yet video objects.
export function parseSearchResponse(json) {
  const items = json?.items || [];
  return items
    .filter((it) => it?.id?.videoId && it?.snippet)
    .map((it) => ({
      videoId: it.id.videoId,
      title: it.snippet.title || '',
      description: it.snippet.description || '',
      channelTitle: it.snippet.channelTitle || '',
      publishedAt: it.snippet.publishedAt || null,
      thumbnailUrl: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url || null,
      url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      viewCount: null, // filled in by mergeVideoDetails once videos.list responds
      durationSeconds: null,
    }));
}

// ISO 8601 duration ("PT4M13S", "PT45S", "PT1H2M3S") → total seconds.
// Returns null for anything that doesn't parse (never a guessed 0).
export function parseISO8601Duration(iso) {
  if (!iso) return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const hours = Number(m[1] || 0), minutes = Number(m[2] || 0), seconds = Number(m[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

// videos.list items → Map<videoId, {viewCount, durationSeconds}>. Missing/
// invalid values are left null rather than coerced to 0/false — a missing
// field is not the same claim as a real measured zero.
export function parseVideosDetailsResponse(json) {
  const map = new Map();
  for (const it of json?.items || []) {
    if (!it?.id) continue;
    const rawViews = it?.statistics?.viewCount;
    const viewCount = rawViews != null && Number.isFinite(Number(rawViews)) ? Number(rawViews) : null;
    const durationSeconds = parseISO8601Duration(it?.contentDetails?.duration);
    map.set(it.id, { viewCount, durationSeconds });
  }
  return map;
}

export function mergeVideoDetails(videos, detailsMap) {
  return (videos || []).map((v) => {
    const d = detailsMap?.get(v.videoId);
    return { ...v, viewCount: d?.viewCount ?? null, durationSeconds: d?.durationSeconds ?? null };
  });
}

// Unknown duration (parse failed / field missing) is NOT treated as a Short —
// same "don't over-filter on missing data" stance as isAiRelevant below.
export function isShort(durationSeconds) {
  return durationSeconds != null && durationSeconds <= MAX_SHORT_SECONDS;
}

export function filterOutShorts(videos) {
  return (videos || []).filter((v) => !isShort(v.durationSeconds));
}

// Negative signals that mean "almost certainly the zodiac sign, not the AI
// model" when they show up WITHOUT any AI-context signal alongside them.
// Deliberately does NOT include the model names themselves ("gemini",
// "claude", "chatgpt") — every result already contains the search query in
// its title, so those would make this check trivially true for 100% of
// results and defeat the one case it exists to catch.
const ZODIAC_SIGNALS = ['horoscope', 'zodiac', 'astrology', 'tarot', 'star sign', 'birth chart'];
const AI_CONTEXT_SIGNALS = [
  'ai', 'artificial intelligence', 'chatbot', 'llm', 'openai', 'anthropic', 'google',
  'assistant', 'model', 'prompt', 'coding', 'agent', 'app', 'update', 'review', 'tutorial',
];

export function isAiRelevant(title, description) {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  const hasAiContext = AI_CONTEXT_SIGNALS.some((s) => text.includes(s));
  if (hasAiContext) return true;
  const hasZodiacSignal = ZODIAC_SIGNALS.some((s) => text.includes(s));
  return !hasZodiacSignal; // no AI context and no zodiac tell either — let it through, ambiguous but not a known false positive
}

export function filterAiRelevant(videos) {
  return (videos || []).filter((v) => isAiRelevant(v.title, v.description));
}

// English-only filter. YouTube's `relevanceLanguage=en` search hint is soft —
// it still returns plenty of Hindi/Chinese/Japanese/Korean/etc. AI videos — and
// the public API exposes no reliable per-video language field in the data we
// fetch. So the actual guard is script-based on the TITLE: if the title is
// written predominantly in a non-Latin script, it's not an English video.
// Same "don't over-filter on ambiguity" stance as isAiRelevant: a title with
// no letters at all (all emoji/numbers), or one where Latin letters merely tie,
// is kept. Only a title where non-Latin letters OUTNUMBER Latin ones is dropped
// — that reliably catches fully-foreign titles while letting an English title
// that happens to contain a stray foreign word or brand name through.
const NON_LATIN_LETTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Devanagari}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Thai}\p{Script=Hebrew}\p{Script=Bengali}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Greek}]/gu;
const LATIN_LETTER = /\p{Script=Latin}/gu;

export function isLikelyEnglish(title) {
  const text = String(title || '');
  const nonLatin = (text.match(NON_LATIN_LETTER) || []).length;
  if (nonLatin === 0) return true; // pure-Latin (or no letters) — keep
  const latin = (text.match(LATIN_LETTER) || []).length;
  return latin >= nonLatin; // drop only when a non-Latin script dominates
}

export function filterEnglish(videos) {
  return (videos || []).filter((v) => isLikelyEnglish(v.title));
}

// Trailing-N-days ISO timestamp, the `publishedAfter` search bound.
export function daysAgoISO(days, now = Date.now()) {
  return new Date(now - days * 86400000).toISOString();
}

// Full pipeline over already-fetched JSON (pure — the caller does the fetch()
// calls): filter for relevance, drop Shorts, re-sort by real view count
// (defensive — search.list's server-side ordering and the later stats call
// could in theory disagree slightly), cap to maxResults. The caller should
// request a bigger pool than maxResults from search.list (free — search.list
// costs the same 100 units regardless of maxResults) so there's still enough
// left after filtering to fill out a real top-5.
export function buildTopVideos(searchJson, statsJson, { maxResults = 5 } = {}) {
  const parsed = parseSearchResponse(searchJson);
  const relevant = filterEnglish(filterAiRelevant(parsed));
  const detailsMap = parseVideosDetailsResponse(statsJson);
  const withDetails = mergeVideoDetails(relevant, detailsMap);
  const longForm = filterOutShorts(withDetails);
  return longForm
    .slice()
    .sort((a, b) => (b.viewCount ?? -1) - (a.viewCount ?? -1))
    .slice(0, maxResults);
}
