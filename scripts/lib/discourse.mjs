// Discourse forum helpers — pure, deterministic. Imported by
// scripts/update-data.mjs (build-time IO) and test/discourse.test.mjs. No I/O
// here: URL building + response parsing only, so every rule is testable offline.
//
// The official developer forums for OpenAI (community.openai.com) and Google AI
// (discuss.ai.google.dev) both run on Discourse, whose search endpoint is
// public and keyless. It's a FIRST-PARTY discussion source — users of that
// exact model, on the vendor's own forum — complementing the third-party
// Hacker News sample Community Pulse already uses. The forum is lab-specific,
// so a query for the flagship model returns discussion ABOUT that model; the
// caller still runs the same relevance validation it uses for HN, so the
// honesty bar (validated mentions only) is identical across sources.

// GET {base}/search.json?q=<query>. The query may embed Discourse search
// operators (e.g. "GPT-5.6 after:2026-06-23 order:latest") — they're parsed
// from the decoded q server-side, so the whole string is URL-encoded as one.
export function buildDiscourseSearchUrl({ base, query }) {
  const b = String(base).replace(/\/+$/, '');
  return `${b}/search.json?q=${encodeURIComponent(query)}`;
}

// A Discourse "after:" date operator wants YYYY-MM-DD (UTC).
export function discourseAfterDate(sinceMs) {
  return new Date(sinceMs).toISOString().slice(0, 10);
}

// search.json → { topics, posts, more }. Normalized so the caller never touches
// raw Discourse field names:
//   topic: { id, title, url, createdAt, lastPostedAt, replyCount, postsCount, views }
//   post:  { id, username, blurb, createdAt, topicId, url }
// `more` mirrors grouped_search_result.more_full_page_results — true means the
// returned set is a FLOOR, not the complete match count (drives isEstimated).
// `sinceISO`, when given, drops anything older (defence-in-depth on top of the
// server-side after: operator — never trust the window to be pre-filtered).
export function parseDiscourseSearch(json, { base, sinceISO } = {}) {
  const b = String(base || '').replace(/\/+$/, '');
  const rawTopics = Array.isArray(json?.topics) ? json.topics : [];
  const rawPosts = Array.isArray(json?.posts) ? json.posts : [];
  const olderThanWindow = (iso) => sinceISO && iso && String(iso) < String(sinceISO);

  // topicId -> slug, so a post (which only carries topic_id) can build a URL.
  const slugById = new Map();
  for (const t of rawTopics) if (t && t.id != null && t.slug) slugById.set(t.id, t.slug);

  const topics = rawTopics
    .filter((t) => t && t.id != null && t.title && t.created_at && !olderThanWindow(t.created_at))
    .map((t) => ({
      id: t.id,
      title: String(t.title),
      url: t.slug ? `${b}/t/${t.slug}/${t.id}` : `${b}/t/${t.id}`,
      createdAt: normalizeISO(t.created_at),
      lastPostedAt: normalizeISO(t.last_posted_at || t.created_at),
      replyCount: numOr0(t.reply_count),
      postsCount: numOr0(t.posts_count),
      views: numOr0(t.views),
    }))
    .filter((t) => t.createdAt);

  const posts = rawPosts
    .filter((p) => p && p.id != null && p.blurb && p.created_at && !olderThanWindow(p.created_at))
    .map((p) => {
      const slug = slugById.get(p.topic_id);
      return {
        id: p.id,
        username: p.username || 'member',
        blurb: String(p.blurb),
        createdAt: normalizeISO(p.created_at),
        topicId: p.topic_id,
        url: slug ? `${b}/t/${slug}/${p.topic_id}` : `${b}/t/${p.topic_id}`,
      };
    })
    .filter((p) => p.createdAt);

  return { topics, posts, more: !!json?.grouped_search_result?.more_full_page_results };
}

function numOr0(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function normalizeISO(v) {
  if (!v) return '';
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}
