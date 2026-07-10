// Pure event-history and range-calculation logic — no file I/O, no Date.now().
// Imported by scripts/update-data.mjs (which handles reading/writing the daily
// event files) and test/history.test.mjs. Kept separate from signals.mjs
// because this operates on ALREADY-clustered/categorized events, one level up.
//
// Design: every build appends today's clustered signals as compact "events" to
// data/history/events/YYYY-MM-DD.json (one file per UTC day, today's file is
// rewritten each run, past days are frozen). At build time we load the last
// ~60 days of event files and compute real range-specific stats — current
// window vs the EQUIVALENT prior window, never a single blended snapshot.

import { matchEntities } from './signals.mjs';

export const RANGE_HOURS = { '24H': 24, '7D': 24 * 7, '30D': 24 * 30 };
export const HISTORY_RETENTION_DAYS = 60;

// Strip a full signal down to the compact fields worth retaining historically
// — no article bodies, no source URLs, nothing that grows the repo unbounded.
export function toCompactEvent(signal) {
  return {
    id: signal.id,
    clusterId: signal.clusterId,
    title: signal.title,
    publishedAt: signal.dateISO,
    category: signal.category,
    family: signal.family,
    entityIds: signal.entityIds || [],
    significance: signal.significance,
    sourceCount: signal.sourceCount,
    verification: signal.verification,
  };
}

// UTC day key, e.g. "2026-07-10".
export function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Merge today's freshly-built events into what's already on disk for today,
// de-duplicating by clusterId (a cluster seen again this build — e.g. it
// picked up a new source — replaces the earlier record; genuinely new
// clusters are appended). Returns the merged array to write back.
export function mergeTodayEvents(existingToday, freshToday) {
  const byCluster = new Map(existingToday.map((e) => [e.clusterId, e]));
  for (const e of freshToday) byCluster.set(e.clusterId, e);
  return Array.from(byCluster.values());
}

// Which day files (as ISO date strings) are needed to cover the last N days
// from `now`, inclusive of today.
export function neededDayKeys(now, days) {
  const keys = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

function inWindow(publishedAt, start, end) {
  const t = new Date(publishedAt).getTime();
  return t > start && t <= end;
}

// Real range-specific stats: current window vs the EQUIVALENT prior window of
// the same length (e.g. 7D compares the last 7 days to the 7 days before
// that) — not a single fixed comparison point. `historyDepthHours` is how far
// back retained events actually go (oldest event timestamp to now); when it's
// shorter than 2x the requested range, the previous window is incomplete and
// `previousWindowComplete` is false so the caller can show "accumulating"
// honestly instead of a misleading delta.
export function computeRangeStats(events, now, rangeHours, nodes, historyDepthHours) {
  const rangeMs = rangeHours * 3.6e6;
  const curStart = now - rangeMs, curEnd = now;
  const prevStart = now - 2 * rangeMs, prevEnd = now - rangeMs;

  const current = events.filter((e) => inWindow(e.publishedAt, curStart, curEnd));
  const previous = events.filter((e) => inWindow(e.publishedAt, prevStart, prevEnd));
  const previousWindowComplete = (historyDepthHours ?? 0) >= rangeHours * 2;

  const entityActivity = {};
  const entityActivityPrev = {};
  for (const n of nodes) { entityActivity[n.id] = 0; entityActivityPrev[n.id] = 0; }
  for (const e of current) for (const id of e.entityIds) if (id in entityActivity) entityActivity[id]++;
  for (const e of previous) for (const id of e.entityIds) if (id in entityActivityPrev) entityActivityPrev[id]++;

  const entityDelta = {};
  for (const id of Object.keys(entityActivity)) {
    entityDelta[id] = previousWindowComplete ? entityActivity[id] - entityActivityPrev[id] : null;
  }

  const categoryCounts = {};
  for (const e of current) categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;

  const topEntities = Object.entries(entityActivity)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({ id, count, delta: entityDelta[id] }));

  return {
    entityActivity,
    entityDelta: previousWindowComplete ? entityDelta : {},
    categoryCounts,
    topEntities,
    eventCount: current.length,
    previousWindowComplete,
  };
}

// Builds the full ranges object for 24H/7D/30D plus a daily category-volume
// series (for the Tide visualization) bounded to however much history
// actually exists — never implies data before collection began.
//
// `collectionStartMs` must be the timestamp collection ACTUALLY started (the
// earliest day-file's date), not the oldest article's publish date. Articles
// up to 60 days old can appear in day ONE of collection (the staleness
// filter allows them through) — using article age here would let a single
// day of running claim up to 60 days of "history," which is exactly the
// fabrication this system exists to prevent.
export function buildRangesDoc(events, now, nodes, collectionStartMs) {
  const historyDepthHours = collectionStartMs != null
    ? (now - collectionStartMs) / 3.6e6
    : events.reduce((min, e) => Math.min(min, now - new Date(e.publishedAt).getTime()), 0);

  const ranges = {};
  for (const [key, hours] of Object.entries(RANGE_HOURS)) {
    ranges[key] = computeRangeStats(events, now, hours, nodes, historyDepthHours);
  }

  // Daily category volume for the Tide chart. Grouped by `collectedOn` (the
  // day-file an event was actually recorded in), NOT `publishedAt` (the
  // article's own date) — a single day of scraping can pull in articles
  // published up to 60 days ago, and grouping by publish date would make one
  // day of collection look like 60 days of monitoring history. `collectedOn`
  // falls back to publishedAt's day only for safety if it's ever absent.
  const byDay = new Map();
  for (const e of events) {
    const d = e.collectedOn || dayKey(e.publishedAt);
    if (!byDay.has(d)) byDay.set(d, {});
    const rec = byDay.get(d);
    rec[e.category] = (rec[e.category] || 0) + 1;
  }
  const dailyCategoryHistory = Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, counts]) => ({ date, counts }));

  return {
    generatedAt: new Date(now).toISOString(),
    historyDepthDays: Math.round((historyDepthHours / 24) * 10) / 10,
    ranges,
    dailyCategoryHistory,
  };
}
