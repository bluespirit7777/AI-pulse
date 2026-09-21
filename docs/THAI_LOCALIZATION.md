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

Run `npm run check:translations` to check coverage and `npm run translate` to
translate new prose. The collector in `scripts/lib/localization.mjs` selects
reader-facing fields from all currently served datasets and curated model data;
it excludes historical event files, machine identifiers, links and prices.

The data and YouTube workflows translate before publishing. Configure the
repository Actions secret `OPENAI_API_KEY`; optionally set the Actions variable
`TRANSLATION_MODEL` (default `gpt-5.5`). The key is used only during the build,
never in the browser. The translator uses the
[OpenAI Responses API](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create)
with structured output and `store: false`. Only new source text is submitted.
No API requests are needed for already translated content.

Missing credentials or failed translations stop a refresh before it is committed,
keeping the last complete bilingual snapshot published. Both workflows share a
concurrency group to prevent simultaneous writes to the translation catalog.
Reviewed manual translations can also be added directly to `content-th.js`.

Use natural, concise Thai. Preserve attribution, uncertainty, numbers and model
names. Do not turn an allegation or a community opinion into an established fact.
Translate excerpts as excerpts, retaining their truncation marks.
