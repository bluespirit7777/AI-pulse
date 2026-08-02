# AI Summary Wave — daily procedure

The News Wave section leads with three short bullet lists summarising the day
in **Product**, **Market** and **Research**. They are written by an AI agent
and committed as data. There is no API call in the build: the site has zero
npm dependencies and no LLM key in CI, and this keeps it that way.

Run this once a day.

---

## 1. Get the input

```bash
node scripts/prep-ai-summary.mjs
```

Read-only. It prints the last 24 hours of eligible signals grouped by family and
sorted by significance, each with the `id` you'll need for `sourceIds`. Add
`--json` if you're driving this from an automated routine.

Commentary categories (`analysis`, `general`) are excluded, the same way they
are excluded everywhere else on the site — those are opinion *about* events, and
summarising them would describe the discourse rather than the news.

## 2. Write the bullets

Two to four short bullet points per family.

- **Synthesize, don't recap.** If the output is "X happened, then Y happened,
  then Z happened," it adds nothing the stream below doesn't already show. Say
  what the day *amounted to*.
- **One idea per bullet.** Keep each bullet a single short sentence — that's
  what makes the list scannable instead of a paragraph broken into pieces.
- **Only claim what's in the input.** No outside knowledge, no predictions, no
  filling a thin day with hedging prose.
- **A thin day is a fine thing to say.** If Research has one signal, write one
  bullet about that signal. If a family has none, say so plainly.
- **Cite only what you used.** `sourceIds` lists the ids you actually drew on,
  not everything you were shown.

## 3. Write `data/ai-summary.json`

```json
{
  "generatedAt": "2026-08-01T17:12:51.089Z",
  "windowStart": "2026-07-31T17:12:51.089Z",
  "windowEnd": "2026-08-01T17:12:51.089Z",
  "method": "ai-written",
  "families": {
    "product":  { "label": "Product",  "bullets": ["…", "…"], "signalCount": 2, "sourceIds": ["https://…", "https://…"] },
    "market":   { "label": "Market",   "bullets": ["…", "…"], "signalCount": 1, "sourceIds": ["https://…"] },
    "research": { "label": "Research", "bullets": ["…", "…"], "signalCount": 1, "sourceIds": ["https://…"] }
  }
}
```

- `generatedAt` — now. **This drives the staleness gate** (see below).
- `windowStart` / `windowEnd` — copy verbatim from the helper's header line, so
  the UI can state the period covered instead of vaguely implying "today".
- `method` — must be exactly `"ai-written"`. The disclosure label the UI shows
  readers is keyed on this string; the label text itself is hardcoded in
  `js/aisummary.js` so a bad data file can't spoof it.
- `signalCount` — how many signals fed that family's summary (the helper's
  per-family count). Lets a reader judge "synthesized from 14" vs "from 1".
- `sourceIds` — signal `id`s, copied from the helper output. The frontend
  resolves these against the *currently loaded* `latest.json` and links the ones
  that still resolve; ids that have aged out simply don't render. Never put raw
  URLs of your own here.

## 4. Validate, then commit

```bash
npm run check
```

`scripts/validate.mjs` treats the file as optional but checks it strictly when
present — the shape, the three families, the date fields, and that `method` is
exactly right. Commit `data/ai-summary.json` on its own.

---

## The 36-hour deadline

`js/aisummary.js` hides the entire section when the file is missing, malformed,
or when `generatedAt` is more than **36 hours** old (`STALE_HOURS`). That is
deliberate: the stream underneath refreshes every 30 minutes, and a day-old take
sitting above fresh headlines would be worse than no take at all.

So: if you skip a day, the section quietly disappears until the next run. It
never shows a stale summary. If you change `STALE_HOURS`, change it here too.

## Things worth knowing

- **The build never touches this file.** `scripts/update-data.mjs` only writes
  `data/latest.json`. Your summary won't be overwritten.
- **But the bot commits the whole `data/` directory.** `update-data.yml` runs
  `git add data/` every 30 minutes. If you leave `ai-summary.json` edited but
  uncommitted, the bot's next run may sweep it into its own commit, or race your
  push. Commit promptly, or scope that workflow's `git add` to the files the
  build actually writes.
- **The 24h window can be thin.** The committed `latest.json` is only as fresh as
  the last successful build, so if it's several hours old the window will hold
  fewer signals than a full day's worth. The helper prints the real count — trust
  it rather than assuming a full day.
