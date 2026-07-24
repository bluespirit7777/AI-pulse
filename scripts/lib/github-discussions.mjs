// GitHub Discussions helpers — pure, deterministic. Imported by
// scripts/update-data.mjs (build-time IO) and test/github-discussions.test.mjs.
// No I/O here: GraphQL request-body building + response parsing only.
//
// Fills the gap Discourse can't: Anthropic, xAI and Alibaba publish no public
// forum, but each has an ACTIVE, OFFICIAL GitHub Discussions board on their own
// tooling repo (anthropics/claude-code-action, xai-org/grok-build,
// QwenLM/Qwen3.6) — confirmed with real, dated, moderator-answered threads
// during research. Google's gemini-cli discussions are added too, alongside its
// Discourse forum, since they're extremely high-volume and genuinely additive.
//
// Unlike Discourse's REST search (keyless), the Discussions data lives behind
// GitHub's GraphQL API, which requires a Bearer token for EVERY request — even
// on public repos, there is no anonymous GraphQL access. In GitHub Actions the
// free, zero-setup GITHUB_TOKEN covers this; run locally without one, this
// source is skipped (same graceful-absence contract as YOUTUBE_API_KEY).
//
// Relevance is by SCOPE, same reasoning as the Discourse forums: the repo IS
// the lab's own tooling, so a thread there is relevant discussion of that
// product — no keyword-mention regex is applied (a thread rarely repeats the
// product name inside its own repo's discussion board).

const GRAPHQL_URL = 'https://api.github.com/graphql';

// A GraphQL request body (caller POSTs this with an Authorization header —
// this module has no fetch of its own, matching the "pure lib does no IO" rule
// the rest of the codebase's scripts/lib/*.mjs files follow).
export function buildDiscussionsQueryBody({ owner, name, first = 15 }) {
  return {
    query: `
      query($owner: String!, $name: String!, $first: Int!) {
        repository(owner: $owner, name: $name) {
          discussions(first: $first, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes {
              id
              title
              url
              createdAt
              author { login }
              bodyText
              category { name }
              comments { totalCount }
            }
          }
        }
      }`,
    variables: { owner, name, first },
  };
}

export function buildAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ai-pulse-community-pulse',
  };
}

// GraphQL response → { discussions, ok, errorMessage }. GraphQL returns HTTP
// 200 even on a query error (e.g. Discussions disabled on that repo, or the
// token lacks the `discussions:read` permission) — the real signal is an
// `errors` array or a null `repository`, which the caller must check instead
// of relying on res.ok. `ok: false` here means "treat as this source failed",
// same shape as an HTTP-level failure elsewhere in the pipeline.
export function parseDiscussionsResponse(json, { owner, name, label, org, category }) {
  if (json?.errors?.length) {
    return { discussions: [], ok: false, errorMessage: json.errors.map((e) => e.message).join('; ') };
  }
  const nodes = json?.data?.repository?.discussions?.nodes;
  if (!Array.isArray(nodes)) {
    return { discussions: [], ok: false, errorMessage: 'no discussions data (Discussions may be disabled on this repo)' };
  }
  const discussions = nodes
    .filter((n) => n && n.id && n.title && n.createdAt)
    .map((n) => ({
      id: n.id,
      title: String(n.title),
      url: n.url || `https://github.com/${owner}/${name}/discussions`,
      createdAt: normalizeISO(n.createdAt),
      author: n.author?.login || 'member',
      bodyText: String(n.bodyText || ''),
      category: n.category?.name || '',
      commentCount: n.comments?.totalCount || 0,
      repo: `${owner}/${name}`,
      label,
      org,
    }))
    .filter((d) => d.createdAt);
  return { discussions, ok: true, errorMessage: null };
}

// Client-side recency filter (the discussions connection has no date param) +
// coverage signal: if the fetched page's OLDEST item is still inside the
// window, there may be more beyond what we fetched → estimated (a floor);
// if the oldest item already falls outside the window, we hold the complete
// set for that window → exact. Same "did we capture everything" logic the
// rest of Community Pulse already uses (HN coverage, Launch Radar `more`).
export function windowedDiscussions(discussions, sinceISO) {
  const sorted = discussions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const inWindow = sorted.filter((d) => String(d.createdAt) >= String(sinceISO));
  const oldestFetched = sorted[sorted.length - 1];
  const isEstimated = sorted.length > 0 && (!oldestFetched || String(oldestFetched.createdAt) >= String(sinceISO));
  return { inWindow, isEstimated };
}

function normalizeISO(v) {
  if (!v) return '';
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}
