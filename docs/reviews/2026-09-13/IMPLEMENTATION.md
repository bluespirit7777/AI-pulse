# AI Pulse overhaul — implementation and verification

Implemented September 15–16, 2026 against `IMPROVEMENT-PLAN.md`. Static HTML,
CSS and ES modules retained; no dependency installation, live-data rebuild,
commit, push or deployment performed.

## Delivered

| Plan | Implementation |
| --- | --- |
| T00 Baseline | Original desktop/mobile evidence in `screenshots/`; baseline suite passed 256 tests. |
| T01 Trust | Shared Statcounter referral metric, computed narrative, explicit observation/curation dates, removed unsupported totals, accurate compute collection label. |
| T02 Foundations | Shared header, type, buttons, cards, focus, spacing and reading surfaces. Photography confined to the landing hero. |
| T03 Navigation | Today, Models, Ecosystem, Markets and Learn AI. Query routes, legacy aliases, Back/Forward, persistent mobile menu. Inactive views use `hidden`. |
| T04 First-use experience | Compact landing, recent headlines/brief, task links and category previews. Today is the data-page default. Both pages use one brief renderer. |
| T05 News | Search and aliases, intersecting optional filters, URL persistence, loaded-coverage dates, counts, empty recovery, incremental reveal, staged refresh. |
| T06 Models | Four explained text evaluations, image/video arenas, model details, compatible two-to-three-model comparisons, local device/RAM filtering and hardware assumptions. |
| T07 Content integrity | Conservative release filtering/deduplication, regression fixtures, embedded summary citations, preparation helper and schema/procedure updates. Missing citations cause source-headline fallback. |
| T08 Exploration | Mobile defaults to entity List, searchable facts/source links and ranges, optional scrollable map. Stocks table retains all ten records independently of the stock network. |
| T09 Resilience/access | Independent data loading, 15-second request timeout, per-section recovery, native detail dialogs, synchronous drawer background inertness, Escape/focus return, reduced-motion styles. |
| T10 Handoff | Checks below, before/after evidence, README/architecture/methodology/schema updated. Full assistive-technology certification is not claimed. |

## Verification evidence

- `npm run check`: **227 passed, zero failed** after implementation. Existing
  data/calculation tests retained. The total changed because obsolete tests
  asserting the former continuous-page layout were replaced with focused-view,
  routing and shared-content checks. New behavior coverage includes news filters,
  malformed inputs, citation rollover/fallback, release rejection and deduplication.
- `git diff --check`: no whitespace errors; Git reports only line-ending notices.
- Browser: desktop landing, Today, Models, comparison modal, local hardware view,
  Ecosystem, Markets and glossary inspected. Native comparison Escape restores
  focus to Compare. Data Health opening sets background `inert`; Escape removes
  it and restores focus to the Data Health button.
- Browser history: Models → Image → Back → Forward restores the correct category
  and visible panel. Direct query/search routes restore their selected state.
- Mobile: 390px menu exposes all five destinations; Escape closes it. Ecosystem
  defaults to List. The 320/390/768px layout matrix checked landing, Models,
  Ecosystem Map, Markets, Community and glossary without page-level horizontal
  overflow. Desktop 1440px landing/Models/Map/Markets were also checked during
  the implementation pass. Tables/maps and the community selector have local
  horizontal scrolling where needed.
- Individual simulated HTTP failures for `latest.json`, `entities.json`,
  `range.json`, `stock-network.json`, `youtube-trending.json` and `ai-summary.json`
  left other views available. Stock-network failure preserved ten fallback rows;
  missing news preserved curated models and the independent stocks dataset;
  missing summary showed source headlines. Missing range history is distinguished
  from zero activity.
- Release sample reviewed: unrelated journalism/Frontline Defenders announcements
  are removed, duplicate bare Opus announcements merge, and distinct model-feature
  announcements remain. This heuristic still needs ongoing editorial review.

## Evidence and remaining validation boundaries

After screenshots: `after/landing-desktop.png`, `after/today-desktop.png`,
`after/landing-mobile.png`, `after/local-mobile.png`, and
`after/ecosystem-mobile.png`. Original screenshots remain in `screenshots/`.

This was a Chrome desktop/emulated-mobile pass. Real iOS/Android, screen-reader
testing, 200% text-only zoom, 400% browser zoom and a timed ten-minute offline
refresh soak were not completed; responsive narrow-viewport checks are not a
substitute for those. No accessibility-conformance claim is made.

Existing data snapshots were preserved. Some source publication dates extend
beyond the dataset's collection timestamp; this pre-existing upstream issue
was not silently corrected. The UI shows collection and publication dates
separately. A current brief is only displayed if every citation resolves; the
next summary-writing run should embed the helper's source archive.

## Reproduce locally

Run `python -m http.server 8765 --bind 127.0.0.1` from the repository, then open
`http://127.0.0.1:8765/` and `http://127.0.0.1:8765/app.html`. Run `npm run check`
before release. For failure checks, use browser request blocking for one dataset
at a time, reload, inspect that view and verify other destinations still work.

Deployment remains a separate release action.

## September 16 visual revision — restore the ocean identity

User feedback supersedes the original restrained visual direction. Restored the
existing ocean video on the landing and data-page masthead, with a visible
pause/play control, session-persistent pause preference, static poster fallback,
and reduced-motion handling. No new imagery or data values were generated.

The landing now introduces a five-row interactive leaderboard beside its main
message. Category switches update rows and destination links; clicking a model
opens context and a path to full comparisons. Score bars are relative to the
selected category's leader and explicitly labeled. Local picks retain hardware
fit labels instead of artificial scores. The full Models view keeps its details,
benchmark selector and compatible comparisons, with visual bars and ranking
accents. Dark ocean chrome, sea-glass surfaces and warmer accent colors restore
character while retaining focused navigation and readable data panels.

Verified video playback, pause, model details, loaded brief, and no console
errors in Chrome. Responsive landing/Models checks at 320, 390 and 768px;
1440px desktop visual inspection. Automated suite remains 227 passing tests.

## Compact leaderboard revision

Replaced tall text/image/video model cards with semantic ranking tables. All eight
text models fit in a 1366×768 desktop viewport (dashboard bottom measured at
705px) and a 1440×900 viewport. The toolbar uses plain-language evaluation labels;
a short side panel explains the score, leader, source and date. Longer notes are
available via model buttons and About the score. Existing comparison selection
and category routing remain intact. Bars animate briefly on entry; selected rows
have a clear highlight, with reduced-motion support. No fabricated rank changes
or live measurements were added.

Verified comparison dialog contents, evaluation changes clearing selection,
all eight rows present, and no page overflow at 320/390px mobile widths.
The automated suite passed 227 tests. Screenshot: `after/compact-rankings.png`.
