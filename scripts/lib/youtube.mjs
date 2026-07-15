// Shared, pure, deterministic YouTube search helpers — imported by
// scripts/update-youtube.mjs (build time, twice daily) and
// test/youtube.test.mjs. No I/O: URL-building and response-parsing only, so
// every rule here is testable without a live API key or network call.
//
// Finds the most-watched video in the trailing 7 days for each of Claude,
// ChatGPT and Gemini, searched SEPARATELY so one model's volume never crowds
// out another's. `order=viewCount` does the ranking server-side (YouTube's
// own view counts, not a derived score); a follow-up videos.list call adds
// the real view-count number for display, since search.list doesn't return
// statistics. A lightweight relevance filter guards against the one known
// false-positive risk: "Gemini" collides with the zodiac sign.

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export function buildSearchUrl({ query, apiKey, publishedAfter, maxResults = 5 }) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'viewCount',
    publishedAfter,
    maxResults: String(maxResults),
    safeSearch: 'strict',
    key: apiKey,
  });
  return `${SEARCH_URL}?${params.toString()}`;
}

export function buildVideosStatsUrl({ videoIds, apiKey }) {
  const params = new URLSearchParams({
    part: 'statistics',
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
      viewCount: null, // filled in by mergeViewCounts once videos.list responds
    }));
}

// videos.list items → Map<videoId, viewCount>. Missing/invalid counts are
// left out of the map rather than coerced to 0 (0 real views is possible but
// rare; a missing/malformed field is not the same claim).
export function parseVideosStatsResponse(json) {
  const map = new Map();
  for (const it of json?.items || []) {
    const raw = it?.statistics?.viewCount;
    const n = raw != null ? Number(raw) : NaN;
    if (it?.id && Number.isFinite(n)) map.set(it.id, n);
  }
  return map;
}

export function mergeViewCounts(videos, statsMap) {
  return (videos || []).map((v) => ({ ...v, viewCount: statsMap?.get(v.videoId) ?? null }));
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

// Trailing-N-days ISO timestamp, the `publishedAfter` search bound.
export function daysAgoISO(days, now = Date.now()) {
  return new Date(now - days * 86400000).toISOString();
}

// Full pipeline over already-fetched JSON (pure — the caller does the fetch()
// calls): filter for relevance, re-sort by real view count (defensive —
// search.list's server-side ordering and the later stats call could in
// theory disagree slightly), cap to maxResults.
export function buildTopVideos(searchJson, statsJson, { maxResults = 5 } = {}) {
  const parsed = parseSearchResponse(searchJson);
  const relevant = filterAiRelevant(parsed);
  const statsMap = parseVideosStatsResponse(statsJson);
  const withCounts = mergeViewCounts(relevant, statsMap);
  return withCounts
    .slice()
    .sort((a, b) => (b.viewCount ?? -1) - (a.viewCount ?? -1))
    .slice(0, maxResults);
}
