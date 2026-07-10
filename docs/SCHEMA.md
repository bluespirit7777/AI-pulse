# Data schema

## `data/latest.json`

```jsonc
{
  "updatedAt": "2026-07-10T10:05:00.000Z",  // ISO timestamp of this build
  "ticker": ["HEADLINE …"],                  // up to 10 uppercase headlines

  "signals": [                               // unified scored stream (≤40)
    {
      "id": "https://…",
      "clusterId": "a1b2c3",                 // stable across builds
      "title": "…", "desc": "…", "url": "https://…",
      "dateISO": "2026-07-10T08:00:00.000Z",
      "date": "JUL 10 2026",
      "category": "product",                 // one of CATEGORIES (below)
      "catConfidence": 0.62,                 // 0–1 dominance over runner-up
      "family": "product",                   // product | market | research
      "significance": 74,                    // 0–100
      "impact": "high",                      // high | notable | emerging
      "verification": "corroborated",        // official|corroborated|single|uncertain|analysis
      "sourceCount": 2,
      "sources": [{ "name": "The Verge", "url": "https://…" }],
      "sourceName": "The Verge",
      "entityIds": ["gpt", "chatgpt"]        // matched map-node ids
    }
  ],

  "waves": [                                 // ≤3, one per family
    { "family": "product", "category": "product", "title": "…", "summary": "…",
      "significance": 74, "impact": "high", "verification": "corroborated",
      "date": "JUL 10 2026", "dateISO": "…", "url": "https://…",
      "sourceCount": 2, "sources": [ … ], "entityIds": [ … ] }
  ],

  "entityActivity": { "chatgpt": 28, "gemini": 21, "nvidia": 4, … },

  "releases":     [ … ],  // + verification, impact
  "wire":         [ … ],  // built for compatibility; no longer rendered
  "feed":         [ … ],  // open-weight rows + verification, impact
  "breakthroughs":[ … ],  // research cards + verification, impact
  "stocks":       [ { "t": "NVDA", "n": "…", "layer": "Chips",
                      "price": 201.76, "changePct": 2.11, "url": "https://…" } ]
}
```

`CATEGORIES` = `policy · capital · compute · opensource · research · market ·
adoption · orggov · analysis · product · general`.

The page is fully functional with only `latest.json`; range/history are
enrichments.

## `data/range.json`

Real per-range stats built each fetch from the retained event history.

```jsonc
{
  "generatedAt": "2026-07-10T10:05:00.000Z",
  "historyDepthDays": 0.3,                   // from earliest day-file, NOT article age
  "ranges": {
    "24H": {
      "entityActivity": { "gpt": 11, … },    // current window counts
      "entityDelta": { "gpt": 3, … },        // vs equivalent prior window; {} if incomplete
      "categoryCounts": { "product": 7, … },
      "topEntities": [ { "id": "gpt", "count": 11, "delta": 3 }, … ],
      "eventCount": 27,
      "previousWindowComplete": false        // false ⇒ entityDelta is {} (no fabrication)
    },
    "7D": { … }, "30D": { … }
  },
  "dailyCategoryHistory": [                   // one entry per COLLECTED day only
    { "date": "2026-07-10", "counts": { "product": 21, "research": 12, … } }
  ]
}
```

## `data/history/events/YYYY-MM-DD.json`

One file per UTC day (today's is rewritten each run, past days frozen), pruned
after 60 days. Compact — no article bodies.

```jsonc
[
  { "id": "https://…", "clusterId": "a1b2c3", "title": "…",
    "publishedAt": "2026-07-10T08:00:00.000Z", "category": "product",
    "family": "product", "entityIds": ["gpt"], "significance": 74,
    "sourceCount": 2, "verification": "corroborated", "collectedOn": "2026-07-10" }
]
```

`collectedOn` (the day the event was recorded) drives the Tide's daily buckets —
never `publishedAt`, so one day of scraping can't look like 60 days of history.

## `data/entities.json`

Curated ecosystem map (hand-maintained). See the file's own `_doc`.

```jsonc
{
  "layers": [{ "id": 1, "name": "Applications & adoption", "blurb": "…" }, …],
  "nodes": [
    { "id": "gpt", "name": "GPT", "version": "GPT-5.5", "org": "OpenAI",
      "layer": 2, "importance": 96,        // 0–100 curated weight → node SIZE
      "match": ["gpt-5", "openai"],        // terms → live activity (glow)
      "why": "…", "links": [{ "label": "OpenAI", "url": "https://…" }] }
  ],
  "connections": [
    { "from": "gpt", "to": "azure", "type": "depends" }  // depends|partner|competes
  ]
}
```

`name` is the stable family label shown on the map; `version` is the specific
current release shown in the detail drawer.
