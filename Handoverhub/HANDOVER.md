# AI Pulse — Session Handover

**Last updated:** 2026-07-25 · **Head commit at writing:** `3026398`
**Live:** https://bluespirit7777.github.io/AI-pulse/ · **Repo:** https://github.com/bluespirit7777/AI-pulse

Read this top-to-bottom before touching anything. §5 (Caveats) is the part that
prevents breaking production; §4 (Known issues) prevents chasing ghosts.

---

## 0. TL;DR for a new session

- **Static site.** No backend, no framework, no bundler, **zero npm dependencies**.
  Native SVG + ES modules + static JSON. GitHub Pages serves it; GitHub Actions
  regenerates the JSON on a schedule.
- **Two pages:** `index.html` is the landing page (site root), `app.html` is the
  dashboard. Old root deep links forward automatically — see `js/deeplink.js`.
- **201 tests** (`npm run check` = validate + test). They must pass before any push.
- **Never hand-commit `data/*.json`** — CI owns those (one exception: `entities.json`, see §5).
- **The whole project's ethos is anti-fabrication.** Every number is either real
  and sourced, or explicitly labelled an estimate. Breaking that is the worst
  kind of regression here — worse than a visual bug.

```bash
npm run build      # regenerate data locally (writes data/*.json)
npm run validate   # schema/sanity gate
npm test           # unit tests
npm run check      # validate + test  ← the gate before every push
npx serve .        # any static server
```

---

## 1. Structure

```
+----------------------+  +----------------------+  +----------------------+
| [1] Live sources     |  | [2] Data build        |  | [3] YouTube build   |
| RSS/HN/Yahoo/GPU/HF  |  | scripts/update-data   |  | scripts/update-yt   |
+----------------------+  +----------------------+  +----------------------+
+----------------------+  +----------------------+  +----------------------+
| [4] Generated data   |  | [5] Curated data      |  | [6] CI gate         |
| data/*.json          |  | curated.js+entities   |  | validate.mjs, test/ |
+----------------------+  +----------------------+  +----------------------+
+----------------------+  +----------------------+
| [7] Frontend app     |  | [8] Live site         |
| index.html + js/     |  | GitHub Pages          |
+----------------------+  +----------------------+
```

**Counts:** `js/` 15 files · `scripts/lib/` 11 · `test/` 13 · `.github/workflows/` 2

### Key files

| Path | Role |
|---|---|
| `index.html` | **Landing page (site root).** Self-contained styles; every figure rendered from real data |
| `app.html` | **The dashboard** (was `index.html`). Page shell, design tokens in `:root`, CSP meta tag |
| `js/landing.js` | Landing controller — previews the dashboard from `curated.js` + `latest.json` |
| `js/deeplink.js` | Forwards legacy root deep links to `app.html`; blocking script, runs pre-paint |
| `css/app.css` | Component styles (dashboard only — the landing's CSS is inline) |
| `js/main.js` | Orchestrator — loads data, calls every renderer |
| `js/nav.js` | one-page scroll nav (Top/Models/Ecosystem/News Wave/Markets) + scroll-spy depth rail |
| `js/curated.js` | **Hand-maintained** datasets (leaderboard, image/video/local AI) |
| `scripts/lib/models.mjs` | **`MODEL_REGISTRY` — single source of truth for model names/versions** |
| `scripts/lib/signals.mjs` | Clustering, scoring, categorization, topics, `isReleaseDiscussion` |
| `scripts/update-data.mjs` | Main pipeline: feeds → cluster → score → Community Pulse → write |
| `scripts/validate.mjs` | CI gate — bad data never commits |

### Data files

| File | Owner | Notes |
|---|---|---|
| `data/latest.json` | CI | Main payload. Site works with only this. |
| `data/range.json` | CI | 24H/7D/30D real stats |
| `data/stock-network.json` | CI | Nodes + correlations |
| `data/youtube-trending.json` | CI | Optional — absent until `YOUTUBE_API_KEY` set |
| `data/compute-history.json` | CI | Rolling GPU prices |
| `data/history/events/*.json` | CI | 60-day retention |
| **`data/entities.json`** | **HAND-MAINTAINED** | Ocean Map config. Edit by hand; keep versions in sync with `MODEL_REGISTRY`. |

---

## 2. Important data

### Automation

| Workflow | Cron (UTC) | Trigger reality |
|---|---|---|
| `update-data.yml` | `'7,37 * * * *'` | **Actually driven by cron-job.org every 15 min** via `workflow_dispatch`. The native cron is effectively dead (starved). |
| `update-youtube.yml` | `'22 3,15 * * *'` | Twice daily |

### cron-job.org (external, critical)

GitHub's native scheduler proved unreliable on this free public repo, so an
external pinger was set up deliberately:

- Hits `POST https://api.github.com/repos/bluespirit7777/AI-pulse/actions/workflows/update-data.yml/dispatches`
- Body `{"ref":"main"}`, headers `Authorization: Bearer <fine-grained PAT>` + `Accept: application/vnd.github+json`
- **PAT lives on cron-job.org only — never in this repo.**
- Gotcha: cron-job.org's own **Basic Auth toggle must be OFF** or it conflicts with the custom `Authorization` header.

### Secrets

| Name | Where | Needed for |
|---|---|---|
| `YOUTUBE_API_KEY` | Repo secret | YouTube trending. Absent = graceful skip. |
| `GITHUB_TOKEN` | Auto-injected by Actions | GitHub Discussions (Community Pulse) |
| Fine-grained PAT | cron-job.org | Dispatching `update-data.yml` |

### Deploy sequence (follow exactly)

```bash
npm run check                       # must pass
git add <source files only>         # NEVER `git add -A`; never data/*.json
git commit -m "..."                 # + Co-Authored-By trailer
git fetch origin
git log HEAD..origin/main --oneline # expect ONLY "chore: refresh ..." commits
git rebase origin/main
npm run check                       # re-verify on rebased tree
git push origin main
```

---

## 3. What's been fixed

### Data correctness
- **Fabricated model name.** "Gemini 3.5 Pro" didn't exist. Researched real
  leaderboards → **Gemini 3.1 Pro**. Fixed in `models.mjs`, `curated.js` (×4),
  `entities.json`, and tests. *Root lesson: don't invent version strings.*
- **Leaderboard had unscored rows + wrong ranking.** Every model in all 4 views
  now carries a real sourced score; ChatGPT Sol correctly ranks **above** Gemini
  on Overall/Reasoning/Agentic (was inverted). Unpublished figures are labelled
  "Editorial estimate". Guard test prevents regression.
- **Local AI list was workstation-class** (74–403 GB). Replaced with genuinely
  consumer 8→64 GB tiers.

### Pipeline / CI
- **Git push race.** Concurrent pushes to `main` rejected non-fast-forward.
  Added fetch+rebase retry (5 attempts) to all workflows.
- **exit-128 crash.** Two compounding bugs: (a) `git add` list omitted
  `data/compute-history.json`, leaving the tree dirty so `git rebase` refused to
  start; (b) the fallback's unguarded `git rebase --abort` then errored "no
  rebase in progress" and killed the step under `set -e`. Fixed with
  `git add data/` and `|| true` guards. *Reproduced in an isolated bare-repo
  harness before/after.*

### Features shipped
- **Landing page + two-page split.** The dashboard moved to `app.html`; a new
  ocean-themed landing page took over the site root. Every figure on it is
  rendered at runtime from the *same* sources the dashboard uses (`curated.js`,
  `data/latest.json`) — the mockup it was built from shipped invented model
  names and scores, and none of those survived. `test/landing.test.mjs` (9
  tests) enforces that: no model/version string in the markup, no static rows
  in any data container, provenance shown for every panel, no inline script,
  and full deep-link coverage. Legacy root links (`/#panel-*`, `/#tab-*`,
  `/#sec-*`, `/#full`) forward to `app.html` via `js/deeplink.js`.
- **Community Pulse → 3 sources.** Was HN-only. Added official Discourse forums
  (OpenAI, Google) and GitHub Discussions (Claude, Grok, Qwen, Gemini).
- **Community Pulse → release-focused.** `isReleaseDiscussion()` gate: only new
  models/features/discoveries count, not support/pricing/comparison chatter.
- **Ocean Map drawer** now lists the actual signals mentioning each node.
- **YouTube:** English-only filter; search pool 15→50 (Shorts were starving the
  top-5 — ChatGPT once returned 0 videos).
- **Nav:** top-level sections show all subsections stacked.
- **Security:** CSP meta tag (verified nothing blocked).
- **Removed:** Briefing section. **Launch Radar retired entirely** — the panel
  came out first (mostly noise: internal dev-repo names from the HuggingFace
  scan, not notable releases), then the whole backend (workflow, both scripts,
  test, `data/launch-radar.json`) on the judgment that it was information bloat
  for a normal reader. Recoverable from git history if that call ever changes;
  **do not rebuild it without a fresh decision** — the former "Launch Radar is
  starving, fix its cron" known-issue and the next-step that referenced it are
  moot, not pending, and were removed with it.
- **Simplified the IA to 4 items.** Tide removed (both pages — "didn't offer
  anything concrete"); Waves and River merged into one "News Wave" section
  (both pages — they were "basically both news about AI"); Research removed
  (both pages — its one card, Breakthrough signals, was a literal subset of
  items already in River/Waves via the research category, not merely
  thematically similar). Backend `data.breakthroughs` computation and
  `dailyCategoryHistory`/`range.json` generation are both untouched —
  unconsumed but harmless, easy to resume either if that changes. The
  dashboard's ocean photo (removed for contrast in the prior continuity
  branch) came back by explicit request, paired with its original legibility
  veil, scoped to `app.html` only — the shared gradient in `css/shell.css`
  and the landing are unaffected.
- **Dashboard is now one continuous page.** The panel-switching IA (one
  `.topsection` visible at a time, plus an opt-in "Full page" mode) is gone —
  Full page *is* the page, the pills are scroll anchors, and `js/nav.js` never
  sets `hidden`. Order and labels are **Top / Models / Ecosystem / News Wave /
  Markets** (`data-panel` ids are unchanged — `today` is still `today`, only
  its label reads "News Wave"). The depth rail became a scroll-spy, since
  there is no longer a single "activated" panel to read a depth from. Image AI
  and Video AI now share one row. Also fixed a long-standing bug where flip
  cards measured while hidden kept a 360px fallback height, clipping the Local
  AI top-5 lists by ~500px.

### Frontend gotchas solved
- `requestAnimationFrame` **never fires** in the automated test browser → use
  `setTimeout(fn, 0)`. **`IntersectionObserver` never delivers either**, and
  `loading="lazy"` images are never fetched — the pane doesn't composite
  frames (same root cause as the screenshot timeouts, §4.7). Any scroll-driven
  reveal therefore needs a `setTimeout` backstop or it is invisible in tests.
- CSS Grid `min-width: auto` caused silent horizontal overflow → explicit
  `min-width: 0` on grid children.
- **Media queries add no specificity.** `.split.flip` (0,2,0) silently beat the
  mobile `.split{grid-template-columns:1fr}` (0,1,0), leaving two of the
  landing's sections two-column on a 375px screen and crushing a progress bar
  to 24px. Reset the *more specific* selector by name inside the query.

---

## 4. Known issues & possible bugs

### 4.1 GitHub runner-acquisition failures (external, transient)
Errors like *"The job was not acquired by Runner of type hosted"* / *"Internal
server error. Correlation ID: …"* are **GitHub infrastructure, not this code** —
verified: the failing job was `cancelled` with an **empty steps array** after
~15 min queued, i.e. nothing of ours ever ran. ~7 % historical rate. Remedy:
re-run; if persistent, contact GitHub Support with the Correlation ID.

### 4.2 GitHub Discussions source — happy path never verified
GraphQL needs auth for **every** call, even public repos, and no token was
available locally. **Verified only the failure modes** (no token → clean skip;
invalid token → per-model 401, caught, build unaffected, no phantom source).
The success path first runs in Actions. If the live response shape differs,
it surfaces as a per-model error in the run log — non-fatal by design.

### 4.3 Data lags code after a deploy
Frontend changes ship instantly; `data/latest.json` keeps the **old shape** until
the next pipeline run. All renderers must degrade gracefully (they currently do,
e.g. the Sources row is guarded by `m.sources && m.sources.length`). Don't
"fix" an apparent data mismatch right after deploying — wait one cycle.

### 4.4 Excerpt windowing can look off-topic
`sanitizeExcerpt` windows around the **model mention**, not the matched
release keyword. So a correctly-filtered comment can *display* a snippet that
doesn't obviously read as release news. Cosmetic, pre-existing; the counting
logic is correct.

### 4.5 Small samples after the release filter
Narrowing to release/discovery talk shrank counts (Claude 1074→122, GPT 190+43→31+2).
Qwen fell to 6 and correctly flips to the existing **"Limited sample"** badge.
That's honest behaviour, not a bug — don't "fix" it by loosening the filter
without a real reason.

### 4.6 Yahoo Finance is unofficial
Undocumented endpoint. Fine at this volume, could rate-limit or change shape.

### 4.7 Testing environment quirks
- **ES module caching**: an edited module may not reload in an open tab. Open a
  fresh tab, or verify via `fetch(url+'?bust='+Date.now())` / cache-busted `import()`.
- **Screenshots time out** in this environment. JS-level DOM assertions are the
  reliable verification path.

---

## 5. Critical caveats

1. **Anti-fabrication is the prime directive.** Never invent a model name,
   score, or benchmark. If a number isn't published, either omit it or label it
   an estimate *in the visible note*. Tests enforce parts of this
   (`test/leaderboard.test.mjs`).
2. **`MODEL_REGISTRY` (`scripts/lib/models.mjs`) is the single source of truth**
   for model names/versions. It exists *because* versions drifted between
   sections before. Update it, not the copies. Keep `data/entities.json` in sync
   (a test checks this).
3. **Never `git add -A`.** Stage named source files. Hand-committing generated
   `data/*.json` fights CI. `entities.json` is the one hand-edited data file.
4. **Always rebase before push.** Expect dozens–hundreds of intervening
   `chore: refresh …` commits. If you see anything else in
   `git log HEAD..origin/main`, stop and investigate.
5. **Ask before deploying.** The standing convention all session: implement →
   verify → summarize → *wait for explicit go-ahead* → push.
6. **Graceful degradation everywhere.** Every source must fail per-item without
   killing the build, and every panel must hide/show an honest unavailable state
   rather than break.
7. **No new dependencies.** Zero npm deps is a deliberate security property
   (no supply-chain surface). Node built-ins only.

---

## 6. Dead ends — already researched, don't redo

| Source | Verdict |
|---|---|
| **X / Twitter** | No free tier since Feb 2026. ~$0.005/post read, no free credits. Not viable. |
| **Reddit** | `.json` endpoints returned 403 since May 2026; datacenter IPs blocked (so Actions fails regardless). Official OAuth needs 2–4 week manual approval, self-service closed. RSS survives but throttled to ~1 req/min. |
| **Facebook** | Pages need "Page Public Content Access" + App Review (weeks) + Business Verification. Groups need a **logged-in member token** — impossible unattended. Coverage thin anyway (OpenAI has a Page; Anthropic/DeepMind apparently not). |
| **n8n for X** | Doesn't bypass anything — same paid API underneath, or ToS-violating scrapers. |
| **MCP for data ingest** | Wrong layer. The pipeline is plain Node cron scripts with `fetch()`; there's no agent at runtime for MCP to serve. |

---

## 7. Open / next steps

1. **Optionally strip the dead `schedule:` blocks** from the workflows now that
   cron-job.org drives dispatch (they're starved and redundant). Was offered,
   not yet decided.
2. **Confirm GitHub Discussions works in Actions** (§4.2) on the next run.
3. **Tier-2 "be first" upgrade** (documented, not built): diff each lab's
   `/v1/models` endpoint + machine-readable API changelogs. Needs free API keys
   for OpenAI/Anthropic/Google stored as repo secrets. ⚠️ Note: this is the same
   "be first to know" idea Launch Radar served, which was retired as information
   bloat — revisit the premise before building it.
4. **Scheduled maintenance task exists**: `ai-pulse-daily-maintenance`, 19:00
   local daily — checks pipeline health + reviews leaderboard staleness.
