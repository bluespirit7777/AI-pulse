# Thai content

The language selector translates interface copy and the current news, release,
community, video, ecosystem, GPU and model content. Original data, identifiers,
links and numerical values remain unchanged. English can be restored at any
time. Video audio and external source pages remain in their original language.
Thai news search matches the translated headlines and excerpts as well as English.

`js/locales/th.js` contains interface copy, `natural-th.js` contains editorial
wording improvements, and `content-th.js` maps exact source text to Thai. A source
edit invalidates its old translation. The DOM translator also handles content
inserted later, dialogs, tooltips and accessibility labels.

## Data refreshes

Run `npm run check:translations` to check full coverage. The data and YouTube
workflows refresh data on their existing schedules without calling Gemini. A
separate `translate-content.yml` workflow translates accumulated missing strings
once daily at 04:17 UTC (11:17 Bangkok time). New content may remain in English
in the Thai view until that batch runs. Translation requests are sent in batches
of 12 strings, so one daily job may make multiple Gemini API requests. The
collector in `scripts/lib/localization.mjs` selects reader-facing fields from all
currently served datasets and curated model data; it excludes historical event
files, machine identifiers, links and prices.

Configure `GEMINI_API_KEY` as a repository Actions secret.
`GEMINI_TRANSLATION_MODEL` is an optional repository Actions variable; the default
is `gemini-3.8-flash`. If the Gemini key is missing, a run needing new
translations fails rather than falling back to another provider. The key is
consumed only by the build-time translator, never by the browser. The translator
uses Gemini structured output and submits only new source text; already
translated content requires no API request.

A failed translation leaves the existing translation catalog unchanged; data
collection can continue, with pending strings falling back to English in the Thai
view. The two data-collection workflows share a concurrency group to prevent
simultaneous data writes. The translation workflow writes only the Thai catalog.
Reviewed manual translations can also be added directly to `content-th.js`.

Use natural, concise Thai. Preserve attribution, uncertainty, numbers and model
names. Do not turn an allegation or a community opinion into an established fact.
Translate excerpts as excerpts, retaining their truncation marks.
