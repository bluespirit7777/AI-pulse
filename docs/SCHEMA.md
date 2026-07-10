# Data schema

## `data/latest.json`

```jsonc
{
  "updatedAt": "2026-07-10T10:05:00.000Z",  // ISO timestamp of this build
  "ticker": ["HEADLINE …"],                  // up to 10 uppercase headlines

  "signals": [                               // unified scored stream (≤40)
    {
      "id": "https://…",                     // canonical URL (also the id)
      "title": "…",
      "desc": "…",
      "url": "https://…",
      "dateISO": "2026-07-10T08:00:00.000Z",
      "date": "JUL 10 2026",
      "category": "product",                 // one of CATEGORIES (see below)
      "family": "product",                   // product | market | research
      "significance": 74,                    // 0–100 (see METHODOLOGY.md)
      "confidence": "moderate",              // strong | moderate | early
      "sourceCount": 2,
      "sources": [{ "name": "The Verge", "url": "https://…" }],
      "sourceName": "The Verge"
    }
  ],

  "waves": [                                 // ≤3, one per family
    {
      "family": "product",
      "category": "product",
      "title": "…", "summary": "…",
      "significance": 74, "confidence": "moderate",
      "date": "JUL 10 2026", "dateISO": "…",
      "url": "https://…", "sourceCount": 2,
      "sources": [{ "name": "…", "url": "…" }]
    }
  ],

  "entityActivity": { "chatgpt": 28, "gemini": 21, "nvidia": 4, … },  // id → count

  "releases":     [ … ],   // frontier release cards (lab, h, p, items[], url)
  "wire":         [ … ],   // big-AI wire cards (org, h, p, url, sourceCount)
  "feed":         [ … ],   // open-weight rows (name, lic, licClass, url)
  "breakthroughs":[ … ],   // research cards (field, h, p, url)
  "stocks":       [ { "t": "NVDA", "n": "…", "layer": "Chips",
                      "price": 201.76, "changePct": 2.11, "url": "https://…" } ]
}
```

`CATEGORIES` = `product · research · capital · market · compute · policy ·
opensource · adoption`.

The page reads `latest.json` and renders everything from it. All fields other
than `updatedAt` degrade to empty-state UI if missing.

## `data/history/YYYY-MM-DD.json`

Compact daily snapshot for computing deltas. One per UTC day (last run wins).

```jsonc
{
  "date": "2026-07-10",
  "updatedAt": "…",
  "signalCount": 40,
  "entityActivity": { "chatgpt": 28, … },
  "waveTitles": [{ "family": "product", "title": "…" }],
  "stocks": [{ "t": "NVDA", "price": 201.76, "changePct": 2.11 }],
  "topSignals": [{ "title": "…", "category": "product", "significance": 74 }]
}
```

## `data/entities.json`

Curated ecosystem map (hand-maintained). See the file's own `_doc` field.

```jsonc
{
  "layers": [{ "id": 1, "name": "Applications & adoption", "blurb": "…" }, …],
  "nodes": [
    {
      "id": "nvidia", "name": "Nvidia", "org": "Nvidia",
      "layer": 5,                 // which depth band
      "importance": 100,          // 0–100 curated weight → node SIZE only
      "match": ["nvidia", "\\bh100\\b"],  // terms → live activity (glow)
      "why": "…",                 // shown in the detail drawer
      "links": [{ "label": "Nvidia", "url": "https://…" }]
    }
  ],
  "connections": [
    { "from": "nvidia", "to": "tsmc", "type": "depends" }  // depends|partner|competes
  ]
}
```

To add an entity: append a node (pick a layer and importance, list match terms)
and any connections. The build's activity counts and the map both pick it up
automatically; no code change needed.
