# AI Pulse

**A living visual map of where AI energy is moving.** A quiet view of a loud
industry: a calm, ocean-themed intelligence product — not a news dump — that
helps a visitor see momentum, connections, and what changed, with every figure
traceable to its source.

Live at **https://bluespirit7777.github.io/AI-pulse/**

## What it shows

- **Today:** a cited daily brief when available, recent releases and searchable news.
- **Models:** explained evaluations, two-to-three-model comparisons, local hardware
  filters, releases and community discussion.
- **Ecosystem:** searchable entity list or map, real activity ranges, and precisely
  defined chatbot referral share.
- **Markets:** an accessible stock table, separate business/correlation networks,
  and GPU rental offers.
- **Learn AI:** searchable plain-language definitions.

The landing gives a compact preview using the same data and shared visual system.
Direct query links, old section links, keyboard navigation and mobile views work.

## Automatic vs. curated data

Automatic snapshots include news, releases, community, stock prices, GPU offers
and entity activity. Collection dates are visible; older data is labeled.
Models, referral share and ecosystem relationships remain dated editorial
snapshots. A current AI-written brief requires complete citations; otherwise
recent source headlines appear. See the methodology for precise limitations.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data flow, files, principles.
- [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — scoring, waves, deltas, what we
  deliberately don't do.
- [docs/SCHEMA.md](docs/SCHEMA.md) — the JSON shapes.

## Local development

```
npm run build      # fetch feeds + quotes → data/latest.json + daily snapshot
npm run check      # validate schema + run unit tests
python -m http.server 8765 --bind 127.0.0.1  # open http://127.0.0.1:8765
```

No API keys or secrets. The page is fully functional with only `data/latest.json`.

## Automation

[`.github/workflows/update-data.yml`](.github/workflows/update-data.yml) runs at
:07 and :37 each hour: fetch → **validate + test** (bad data never commits) →
commit `data/latest.json` and the day's `data/history/*.json` if changed.
GitHub's built-in `GITHUB_TOKEN` handles the commit — no personal token needed.

## Deploying for free (GitHub Pages)

1. Push to a **public** repo.
2. **Settings → Actions → General → Workflow permissions** → **Read and write**.
3. **Settings → Pages** → Source **Deploy from a branch**, `main`, `/ (root)`.
4. Live at `https://<you>.github.io/<repo>/` within a minute or two.
5. Optionally trigger the first run: **Actions → Update AI Market Pulse data →
   Run workflow**.

GitHub Pages + Actions are free for public repos — no server, no bill.

## Known limitations

- History-based deltas (24H/7D/30D) only become meaningful once snapshots
  accumulate; until then the map shows current activity and labels the gap.
- Yahoo Finance's quote endpoint is unofficial/undocumented — fine for low
  traffic, could rate-limit.
- Categorization and entity matching are keyword heuristics and will
  occasionally misfile a headline.
- The ocean map is dense on very small screens; the always-present text summary
  is the accessible fallback.

## Phase 2 ideas

Visitor lenses (Builder/Investor/Researcher/Creator over the same data), spike
detection surfaced as "storms," per-entity history sparklines once enough
snapshots exist, and richer connection provenance.

## Language, motion, and video browsing

The header language selector switches between English and Thai and saves the choice locally. Navigation, controls, guidance, and all glossary definitions are translated; publisher headlines, model names, and source excerpts retain their original language. Translation catalogs live in `js/locales/`.

The motion control pauses ocean footage and decorative animations. Its preference is saved locally, and reduced-motion preferences are respected. Interactive cards remain usable with motion off.

`app.html?view=models&category=watch` opens the video collection for Claude, ChatGPT, and Gemini. It shows up to five valid videos from each collected snapshot, real thumbnails, selectable previews, and click-to-play YouTube embeds. Dates and short collections stay explicit. When a collection has fewer than five results, explicitly model-matching videos already collected in the same publication window can fill the remaining slots; those cards are labeled as related collections. Player frames are removed when their dialog closes. The existing YouTube updater requires `YOUTUBE_API_KEY`; a missing key leaves the last snapshot intact.
