// Hand-maintained datasets that have no free live source. Every one renders
// with a "Curated" provenance chip in the UI. Bar lengths are ORDINAL (rank
// position), never implied to be linear scores — the panel notes say so.
//
// Update cadence: edit here, commit. `asOf` drives the date chip shown per panel.

export const CURATED_ASOF = 'Jul 30 2026';

// Editorial reception summaries for the top models, keyed to data.community[].key.
// A computed sentiment score has no free live source, so this qualitative read
// is hand-written and clearly chip-labelled "Curated" — it sits alongside the
// LIVE Hacker-News discussion volume/threads, which auto-update. Keep these to
// one defensible sentence each; edit and commit to update.
export const RECEPTION_ASOF = 'Jul 10 2026';
export const modelReception = {
  claude: 'A developer favourite for agentic coding and long-context work; some report a higher cost per task.',
  gpt: 'The broadest mainstream adoption and strong reasoning reviews, with mixed notes on verbosity in longer agentic runs.',
  gemini: 'Reception is climbing as Gemini 3 rolls into Search and Workspace; praised for multimodal and very long context.',
  grok: 'Polarising — fast-moving and competitive on some benchmarks, but reception is coloured by X-platform controversy.',
  qwen: 'The open-weight darling of the local-LLM crowd; widely called the best self-hostable option for coders.',
};

// ---------- leaderboard: 4 use-case-specific views, not one "objective" rank ----------
// A single blended ranking reads as more authoritative than the evidence
// supports — different benchmarks disagree about which model is "best"
// depending on the task. Rather than picking one synthesis and presenting it
// as universal, the leaderboard offers 4 views, each citing its own
// benchmark + snapshot date; "Overall balance" is explicitly labelled as
// editorial synthesis, not a benchmark result. See docs/METHODOLOGY.md.
export const LEADERBOARD_SNAPSHOT = 'Jul 2026';
export const LEADERBOARD_OVERALL_DISCLAIMER = 'Editorial synthesis—not a universal benchmark ranking.';

// "Overall balance" — every model scored on Artificial Analysis' Intelligence
// Index (AAII), a real 0–100 composite that weights agents, coding, general
// capability and scientific reasoning in four equal 25% blocks.
//
// Refreshed Jul 30 2026 against the public AAII leaderboard, cross-checked
// across two independent mirrors that agreed on both ordering and scores
// (integers here match Artificial Analysis' own display; the mirrors' one
// decimal place was 60.7/59.9/58.9/57.1/55.7/53.8/46.5/46.0). Two real
// changes since the Jul 11 snapshot:
//   • Claude Opus 5 is NEW and takes #1 — Fable 5 drops to #2.
//   • Kimi K3 (Moonshot AI) is NEW at #4, the first non-US-lab model to
//     break into the top five here.
// Gemini 3.1 Pro and Qwen 3.7 Max genuinely TIE at 46; rankRows renders a
// shared rank with a "T-" prefix rather than inventing a split.
//
// The blend is still an editorial framing (which index, which weighting),
// which is why this view alone carries the disclaimer — but no model is left
// unscored and every number here is a published measurement.
export const leaderboardOverall = [
  { rank: 1, model: 'Claude Opus 5', org: 'Anthropic', score: 61, scoreUnit: ' AAII', stat: 'New #1 on the intelligence index', note: `Tops Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot) at max reasoning effort — a 0–100 blend of agents, coding, general capability and science` },
  { rank: 2, model: 'Claude Fable 5', org: 'Anthropic', score: 60, scoreUnit: ' AAII', stat: 'Second, ~1pt back', note: `Second on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot), displaced from the lead by Opus 5; still tops the Humanity's Last Exam reasoning eval` },
  { rank: 3, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 59, scoreUnit: ' AAII', stat: 'Best-scoring non-Anthropic model', note: `Third on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot) and the top non-Anthropic entry; broadest mainstream reach and distribution` },
  { rank: 4, model: 'Kimi K3', org: 'Moonshot AI', score: 57, scoreUnit: ' AAII', stat: 'Highest-placed open-lab model', note: `New entrant at #4 on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot) — the strongest showing yet for a non-US lab on this index` },
  { rank: 5, model: 'Claude Opus 4.8', org: 'Anthropic', score: 56, scoreUnit: ' AAII', stat: 'Previous Anthropic flagship', note: `Fifth on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot), now behind both Opus 5 and Fable 5; still leads codebase-comprehension sub-scores` },
  { rank: 6, model: 'Grok 4.5', org: 'xAI', score: 54, scoreUnit: ' AAII', stat: '2M-token context', note: `Sixth on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot); reception still coloured by X-platform controversy` },
  { rank: 7, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 46, scoreUnit: ' AAII', stat: 'Frontier tier', note: `Mid-pack on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot) as newer entrants raised the bar; extended thinking on by default, huge reach via Search/Workspace/Android` },
  { rank: 7, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 46, scoreUnit: ' AAII', stat: 'Top open-weight model', note: `Ties Gemini 3.1 Pro on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot); still the top open-weight model on the index` },
];

// "Reasoning" — Humanity's Last Exam (HLE %), as run by ARTIFICIAL ANALYSIS.
//
// Source correction (Jul 30 2026): these figures were previously attributed to
// "Scale Labs". HLE is Scale Labs'/CAIS' benchmark, but the numbers this view
// shows are Artificial Analysis' own standardized run of it, and Scale Labs'
// own board reports materially different values on a different harness (e.g.
// it puts Gemini 3.1 Pro at 46.4, not 44.4) while not listing the newest
// frontier models at all. The attribution now names the party that actually
// produced these numbers.
//
// Methodology note worth keeping straight: aggregator boards that pool
// VENDOR-SELF-REPORTED HLE results show a much higher spread (Opus 5 at 64.7,
// Fable 5 at 64.5) because those runs are tool-assisted and best-effort. This
// view deliberately stays on the independently-run, no-tools numbers — a
// lower but comparable scale. Mixing the two would be the dishonest option.
//
// Published (Artificial Analysis): Opus 5, Fable 5, Sol, Opus 4.8, Gemini 3.1
// Pro. Artificial Analysis has NOT published an HLE figure for Kimi K3, Grok
// 4.5 or Qwen 3.7 Max, so those three carry an editorial estimate DISCLOSED
// as such — every model gets a number, but an estimate is never dressed up as
// a measurement.
//
// Note the genuine divergence from the Overall view: Fable 5 still leads HLE
// even though Opus 5 leads the composite index.
export const leaderboardReasoning = [
  { rank: 1, model: 'Claude Fable 5', org: 'Anthropic', score: 53.3, scoreUnit: '% HLE', stat: "53.3% on Humanity's Last Exam", note: `Top score on Artificial Analysis' run of Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot) — still ahead of Opus 5 on this eval` },
  { rank: 2, model: 'Claude Opus 5', org: 'Anthropic', score: 52.6, scoreUnit: '% HLE', stat: "52.6% on Humanity's Last Exam", note: `Second on Artificial Analysis' run of Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot) at max reasoning effort, just behind Fable 5` },
  { rank: 3, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 47.2, scoreUnit: '% HLE', stat: "47.2% on Humanity's Last Exam", note: `Third on Artificial Analysis' run of Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot) — clearly ahead of Gemini on this eval` },
  { rank: 4, model: 'Kimi K3', org: 'Moonshot AI', score: 46.0, scoreUnit: '% HLE', stat: "~46% on Humanity's Last Exam", note: `Editorial estimate — Artificial Analysis hasn't published a Kimi K3 Humanity's Last Exam figure as of the ${LEADERBOARD_SNAPSHOT} snapshot; placed from its #4 standing on the same site's Intelligence Index` },
  { rank: 5, model: 'Claude Opus 4.8', org: 'Anthropic', score: 45.7, scoreUnit: '% HLE', stat: "45.7% on Humanity's Last Exam", note: `Fifth on Artificial Analysis' run of Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 6, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 44.4, scoreUnit: '% HLE', stat: "44.4% on Humanity's Last Exam", note: `Sixth on Artificial Analysis' run of Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot); Scale Labs' own harness scores it higher, at 46.4` },
  { rank: 7, model: 'Grok 4.5', org: 'xAI', score: 41.0, scoreUnit: '% HLE', stat: "~41% on Humanity's Last Exam", note: `Editorial estimate — Artificial Analysis hasn't published a Grok 4.5 Humanity's Last Exam figure as of the ${LEADERBOARD_SNAPSHOT} snapshot; vendor-reported 4.5 figures remain unverified by third parties` },
  { rank: 8, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 39.5, scoreUnit: '% HLE', stat: "~40% on Humanity's Last Exam", note: `Editorial estimate — Artificial Analysis hasn't published a Qwen 3.7 Max Humanity's Last Exam figure as of the ${LEADERBOARD_SNAPSHOT} snapshot; strongest open-weight model but below the frontier tier` },
];

// "Agentic coding" — SWE-bench Verified (%).
//
// Substantially rebuilt Jul 30 2026. The previous numbers (82.5 / 79.0 down to
// 66.5) were badly stale: the frontier has moved to the mid-90s and the
// benchmark is now openly described by the boards that track it as "nearing
// saturation for frontier models" — the top three sit within ~1 point. That
// saturation is itself the story, so the caveat is carried in the notes rather
// than hidden.
//
// PUBLISHED figures: Opus 5 (96.0), Fable 5 (95.0) and Opus 4.8 (88.6) are
// corroborated across two independent leaderboards; Gemini 3.1 Pro (80.6) and
// Qwen 3.7 Max (80.4) come from a board that flags its results as
// vendor-self-reported, which their notes disclose.
//
// ESTIMATED: neither ChatGPT Sol nor Grok 4.5 nor Kimi K3 has a published
// SWE-bench Verified score. Sol and Grok are instead anchored to Artificial
// Analysis' Coding Agent Index — a DIFFERENT metric on a different scale,
// where Sol actually ranks #1 (80.0) and Grok #3 (76.0) — so their placement
// here is a cross-metric inference, not a measurement, and says so. Note the
// tension this exposes and does not paper over: Claude leads SWE-bench while
// OpenAI leads Artificial Analysis' agentic-coding index.
export const leaderboardAgentic = [
  { rank: 1, model: 'Claude Opus 5', org: 'Anthropic', score: 96.0, scoreUnit: '% SWE', stat: '96.0% SWE-bench Verified', note: `Leads SWE-bench Verified (${LEADERBOARD_SNAPSHOT} snapshot, independently verified); the top three are within ~1pt, so treat this benchmark as near-saturated` },
  { rank: 2, model: 'Claude Fable 5', org: 'Anthropic', score: 95.0, scoreUnit: '% SWE', stat: '95.0% SWE-bench Verified', note: `Second on SWE-bench Verified (${LEADERBOARD_SNAPSHOT} snapshot), corroborated across two independent public leaderboards` },
  { rank: 3, model: 'Claude Opus 4.8', org: 'Anthropic', score: 88.6, scoreUnit: '% SWE', stat: '88.6% SWE-bench Verified', note: `Third on SWE-bench Verified (${LEADERBOARD_SNAPSHOT} snapshot), corroborated across two independent public leaderboards` },
  { rank: 4, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 82.0, scoreUnit: '% SWE', stat: '~82% SWE-bench Verified', note: `Editorial estimate — no published SWE-bench Verified score as of the ${LEADERBOARD_SNAPSHOT} snapshot; inferred from its #1 placement on Artificial Analysis' Coding Agent Index, a different metric` },
  { rank: 5, model: 'Kimi K3', org: 'Moonshot AI', score: 81.0, scoreUnit: '% SWE', stat: '~81% SWE-bench Verified', note: `Editorial estimate — no published SWE-bench Verified score as of the ${LEADERBOARD_SNAPSHOT} snapshot; anchored to predecessor Kimi K2.6's published 80.2%` },
  { rank: 6, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 80.6, scoreUnit: '% SWE', stat: '80.6% SWE-bench Verified', note: `Published on a public SWE-bench Verified leaderboard (${LEADERBOARD_SNAPSHOT} snapshot) that flags its entries as vendor-self-reported rather than independently re-run` },
  { rank: 7, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 80.4, scoreUnit: '% SWE', stat: '80.4% SWE-bench Verified', note: `Published on a public SWE-bench Verified leaderboard (${LEADERBOARD_SNAPSHOT} snapshot) that flags its entries as vendor-self-reported; strongest open-weight coder` },
  { rank: 8, model: 'Grok 4.5', org: 'xAI', score: 79.0, scoreUnit: '% SWE', stat: '~79% SWE-bench Verified', note: `Editorial estimate — no published SWE-bench Verified score as of the ${LEADERBOARD_SNAPSHOT} snapshot; inferred from its #3 placement on Artificial Analysis' Coding Agent Index, a different metric` },
];

// "Cost efficiency" — a 0–100 editorial index (higher = more cost-efficient),
// deliberately NOT precise $/token figures: exact provider pricing changes too
// often and varies by tier/region for a hand-maintained rate to stay honest.
// Ranked by public pricing-tier (budget/mid/premium) and whether the model is
// self-hostable at zero marginal API cost — the number is a directional index,
// which the note makes explicit, not a fabricated per-token rate.
export const leaderboardCost = [
  { rank: 1, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 95, scoreUnit: ' /100', stat: 'Open-weight, self-hostable', note: `Open weights — no per-token API cost when self-hosted (public model card, ${LEADERBOARD_SNAPSHOT} snapshot); most cost-efficient by a wide margin` },
  { rank: 2, model: 'Kimi K3', org: 'Moonshot AI', score: 80, scoreUnit: ' /100', stat: 'Frontier capability, sub-frontier price', note: `Directional placement — Moonshot lists K3 below the US frontier labs' bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot), which is what makes its #4 index placement notable` },
  { rank: 3, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 72, scoreUnit: ' /100', stat: 'Cheap via Flash tiers', note: `Flash-tier pricing sits well below the frontier bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot); the Pro tier is priced at the frontier bracket` },
  { rank: 4, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 62, scoreUnit: ' /100', stat: 'Frontier tier', note: `Priced in the frontier bracket across providers (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot); mid cost-efficiency` },
  { rank: 5, model: 'Grok 4.5', org: 'xAI', score: 58, scoreUnit: ' /100', stat: 'Frontier tier', note: `Priced in the frontier bracket across providers (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 6, model: 'Claude Fable 5', org: 'Anthropic', score: 50, scoreUnit: ' /100', stat: 'Premium tier', note: `Priced at the premium end of the frontier bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 7, model: 'Claude Opus 4.8', org: 'Anthropic', score: 48, scoreUnit: ' /100', stat: 'Premium tier', note: `Priced at the premium end of the frontier bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot); some report a higher cost per completed task` },
  { rank: 8, model: 'Claude Opus 5', org: 'Anthropic', score: 45, scoreUnit: ' /100', stat: 'Premium tier, newest flagship', note: `Priced at the premium end of the frontier bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot); tops the capability views, so this is the explicit capability-vs-cost trade` },
];

export const LEADERBOARD_VIEWS = [
  { id: 'overall', label: 'Overall balance', data: leaderboardOverall, disclaimer: LEADERBOARD_OVERALL_DISCLAIMER },
  { id: 'reasoning', label: 'Reasoning', data: leaderboardReasoning, disclaimer: null },
  { id: 'agentic', label: 'Agentic coding', data: leaderboardAgentic, disclaimer: null },
  { id: 'cost', label: 'Cost efficiency', data: leaderboardCost, disclaimer: null },
];

// Back-compat alias — some call sites may still reference the single default view.
export const leaderboard = leaderboardOverall;

// Elo scores from Artificial Analysis' real Image Arena Quality leaderboard
// (artificialanalysis.ai/text-to-image) — the same source already cited below.
// Elo is a real, published score (Artificial Analysis Image Arena), so every
// row here gets `score` and the bar is scaled to it — not an ordinal ranking.
// Refreshed Jul 30 2026 from Artificial Analysis' Image Arena quality board.
// GPT Image 2 holds #1 and stretched its lead (1337 → 1340), but the whole
// chasing pack turned over: Reve 2.1, MAI-Image-2.5 and HiDream are new
// entrants, Google's Nano Banana line moved to the Gemini-3.1-based "2"
// generation, Seedream stepped up a whole version, and FLUX.2 [max] and
// Nano Banana Pro have both dropped out of the top five entirely.
export const imageAI = [
  { rank: 1, model: 'GPT Image 2', org: 'OpenAI', score: 1340, scoreUnit: ' Elo', stat: 'Elo 1340', note: 'Elo 1340 on Artificial Analysis Image Arena — clear #1, ~41pts ahead of the field' },
  { rank: 2, model: 'Reve 2.1', org: 'Reve', score: 1299, scoreUnit: ' Elo', stat: 'Elo 1299', note: 'Elo 1299 on Artificial Analysis Image Arena; new entrant, now the strongest non-OpenAI model' },
  { rank: 3, model: 'MAI-Image-2.5', org: 'Microsoft AI', score: 1270, scoreUnit: ' Elo', stat: 'Elo 1270', note: "Elo 1270 on Artificial Analysis Image Arena; Microsoft's first in-house image model to reach the top tier" },
  { rank: 4, model: 'Nano Banana 2', org: 'Google · Gemini 3.1 Flash', score: 1263, scoreUnit: ' Elo', stat: 'Elo 1263', note: 'Elo 1263 on Artificial Analysis Image Arena; Gemini-3.1-Flash-powered successor to Nano Banana Pro' },
  { rank: 5, model: 'GPT Image 1.5', org: 'OpenAI', score: 1263, scoreUnit: ' Elo', stat: 'Elo 1263', note: 'Elo 1263 on Artificial Analysis Image Arena — ties Nano Banana 2; OpenAI holds two of the top five' },
];

// Local AI you can actually run on a PERSONAL PC — one solid open-weight pick
// per realistic consumer RAM tier, from an 8GB laptop up to a 64GB desktop.
// Deliberately NOT the "biggest/best open models" (those are 200B–670B and
// need workstations/servers) — this list answers "what can I run on my own
// machine". Ordered by tier (entry → high-end), ordinal, no fabricated score.
// Refreshed Jul 30 2026. The previous ladder had gone badly stale — every rung
// was a 2024-era model (Llama 3.x, Qwen 2.5, Gemma 2). Rebuilt from current
// VRAM-tier guidance: the Gemma 4 and Qwen3.6 generations now occupy the
// consumer tiers, and an 8B-class model (ZAYA1) fits where a 3B used to.
// The 64GB "run a 70B at home" rung is deliberately gone: at this snapshot the
// genuinely-better-than-27B open models (GLM-5.2, Kimi K2.6) are 700B–1T MoE
// requiring 8× H100, which is not a personal PC — so the ladder honestly tops
// out at a single 24GB consumer GPU rather than implying otherwise.
// `specTier` (1-4, green→yellow→orange→red in rankRows' rendering) is a
// separate axis from `rank`: it colors the "Runs on…" stat by how demanding
// the hardware requirement actually is, low to high, so a reader can scan
// for "what fits my machine" at a glance rather than reading every row's
// RAM figure. Hand-assigned from each row's own requirement, not computed.
export const localAI = [
  { rank: 1, model: 'Gemma 3 4B', org: 'Google', w: 100, stat: 'Runs on 8GB RAM', specTier: 1, note: 'Entry laptops · quick chat, summarizing, simple coding help — CPU-only is fine' },
  { rank: 2, model: 'ZAYA1-8B', org: 'Zyphra', w: 88, stat: 'Runs on 16GB RAM', specTier: 2, note: 'Mainstream laptops · a capable general assistant with light coding' },
  { rank: 3, model: 'Gemma 4 12B', org: 'Google', w: 76, stat: 'Runs on 16–24GB RAM', specTier: 3, note: 'Enthusiast laptops/desktops · noticeably stronger reasoning + coding' },
  { rank: 4, model: 'Qwen3.6-27B', org: 'Alibaba', w: 66, stat: 'Runs on 32GB RAM or a 24GB GPU', specTier: 3, note: 'Enthusiast desktops · fits a single RTX 4090 at 4-bit with a very long context window' },
  { rank: 5, model: 'Gemma 4 31B', org: 'Google', w: 58, stat: 'Runs on 32–48GB RAM or a 24GB GPU', specTier: 4, note: 'High-end desktops · the largest model that still fits one consumer GPU at 4-bit' },
];

// Hardware tiers for the 5 personal-PC models above, entry → high-end.
// `approxSize` is CALCULATED — each model's published parameter count at a
// standard 4-bit quantization (~0.6GB per billion parameters, the common
// GGUF/AWQ ballpark) — not a benchmarked or vendor-published figure, so it's
// labelled as an editorial estimate. These are all dense models that run on
// ordinary consumer hardware: system RAM for CPU inference (slower) or a
// consumer GPU's VRAM (faster) — no data-center cards required.
export const LOCAL_AI_SPECS_ASOF = 'Jul 2026';
export const LOCAL_AI_SPECS_METHODOLOGY = 'Sizes are the published 4-bit (Q4) footprint from each model card where one exists, otherwise estimated as parameters × ~0.6GB/billion. Runs on system RAM (CPU, slower) or a consumer GPU (faster). Not a benchmarked figure.';
export const localAiPcSpecs = [
  { model: 'Gemma 3 4B', params: '4B', approxSize: '~2.9GB', tier: 1, tierLabel: 'Entry laptop', setup: '8GB RAM · CPU is fine, any modern laptop' },
  { model: 'ZAYA1-8B', params: '8B', approxSize: '~5GB', tier: 2, tierLabel: 'Mainstream laptop', setup: '16GB RAM, or an 8GB GPU' },
  { model: 'Gemma 4 12B', params: '12B', approxSize: '~7GB', tier: 3, tierLabel: 'Enthusiast laptop/desktop', setup: '16–24GB RAM, or a 12GB GPU' },
  { model: 'Qwen3.6-27B', params: '27B', approxSize: '~15GB', tier: 4, tierLabel: 'Enthusiast desktop', setup: '32GB RAM, or a 24GB GPU (RTX 4090)' },
  { model: 'Gemma 4 31B', params: '31B', approxSize: '~18GB', tier: 5, tierLabel: 'High-end desktop', setup: '32–48GB RAM, or a 24GB GPU (RTX 4090)' },
];

// Top 5 self-hostable models actually sized for phones/tablets — a distinct
// list from the PC-class table above, not a subset of it. Real, current
// small open-weight model families, picked for on-device fit (not
// benchmarked against the PC-class models above — different use case
// entirely). Ordinal, same as localAI — no fabricated score.
// Refreshed Jul 30 2026 — same staleness problem as the PC list: every entry
// was a 2024-era model. Sizes below are published Q4_K_M footprints.
// Stat text shows the RAM requirement (matching localAiPcSpecs' figures for
// the same model) rather than a "best pick" blurb, so it can be colored by
// specTier the same way as the PC list above — the "why this rank" framing
// still lives in each row's note. specTier is hand-assigned from the actual
// RAM figure, low to high; nothing here reaches specTier 4 (red) because
// none of these five phone-class picks are the heaviest tier this site
// tracks (localAiMobileSpecs tops out one rung lower than the PC list).
export const localAiMobile = [
  { rank: 1, model: 'Gemma 4 E2B', org: 'Google', w: 100, stat: 'Runs on 6GB+ RAM', specTier: 2, note: 'Multimodal at the 2B scale — unusual for a phone-class model, and the current default pick for on-device' },
  { rank: 2, model: 'Gemma 3 4B', org: 'Google', w: 90, stat: 'Runs on 8GB+ RAM', specTier: 3, note: 'Fastest measured throughput on an iPhone 16 Pro (~27 tok/s via the Google AI Edge SDK) with best-in-class instruction following' },
  { rank: 3, model: 'Phi-4 Mini', org: 'Microsoft', w: 80, stat: 'Runs on 8GB+ RAM', specTier: 3, note: 'Punches above its weight on reasoning benchmarks; the pick when answer quality matters more than latency' },
  { rank: 4, model: 'Qwen 3 1.7B', org: 'Alibaba', w: 72, stat: 'Runs on 4GB+ RAM', specTier: 1, note: 'Around 1.1GB at 4-bit · the strongest non-English handling in the sub-2B class' },
  { rank: 5, model: 'SmolLM 2 1.7B', org: 'Hugging Face', w: 64, stat: 'Runs on 4GB+ RAM', specTier: 1, note: 'Around 1.1GB at 4-bit · built for speed on constrained devices where the others may struggle' },
];

export const localAiMobileSpecs = [
  { model: 'Gemma 3 1B', params: '1B', approxSize: '~720MB', tier: 1, tierLabel: 'Older / entry phone', setup: '3GB+ RAM · the fallback rung below the five ranked above' },
  { model: 'SmolLM 2 1.7B', params: '1.7B', approxSize: '~1.1GB', tier: 1, tierLabel: 'Entry-level phone', setup: '4GB+ RAM · most 2021+ Android/iOS devices' },
  { model: 'Qwen 3 1.7B', params: '1.7B', approxSize: '~1.1GB', tier: 2, tierLabel: 'Entry–mid phone', setup: '4GB+ RAM · multilingual' },
  { model: 'Gemma 4 E2B', params: '~2B effective', approxSize: '~1.4GB', tier: 2, tierLabel: 'Entry–mid phone', setup: '6GB+ RAM · multimodal (vision + text)' },
  { model: 'Phi-4 Mini', params: '3.8B', approxSize: '~2.7GB', tier: 3, tierLabel: 'Mid-range phone', setup: '8GB+ RAM' },
  { model: 'Gemma 3 4B', params: '4B', approxSize: '~2.9GB', tier: 3, tierLabel: 'Mid-range phone', setup: '8GB+ RAM' },
];

// Rebuilt Jul 30 2026 — the most-changed list on the site. Two structural
// shifts since the Jul 11 snapshot:
//   • SORA 2 IS GONE, not merely outranked: OpenAI deprecated it on Apr 26
//     2026 with the API shutting down Sep 24 2026. Leaving a model a reader
//     can no longer adopt on a "best of" list would be actively misleading,
//     so it is removed rather than demoted.
//   • The top of the arena is now entirely Chinese-lab models (Kuaishou,
//     Alibaba, ByteDance). Veo 3.1 is the top Western option and still leads
//     the with-audio board, which is why it keeps a place here.
// The top three carry real TrueSkill arena scores from blind human votes;
// Veo 3.1 and Pika 2.5's positions have no single comparable number on that
// scale, so neither carries an invented arena score — both instead get the
// same 0–100 editorial composite index used elsewhere on the site (`w`), and
// this list now renders with showIndex on (js/sections.js renderCurated())
// so that index still draws a bar instead of falling back to a bare
// "Editorial ranking" tag. Caveat worth knowing: the arena had only ~1,380
// blind votes at this snapshot, so treat the top-three gaps as provisional.
//
// Rank 5 restores the list to a genuine top FIVE (it briefly ran 4-deep after
// Sora 2's removal, below). Pika Labs hasn't submitted Pika 2.5 to the blind
// arena, so its placement is editorial, ranked below Veo on independent
// quality review — same honesty treatment as Veo, not a fabricated score.
export const videoAI = [
  { rank: 1, model: 'Kling v3', org: 'Kuaishou', score: 1934, scoreUnit: ' arena', stat: 'Arena 1934', note: 'Tops the blind-vote text-to-video arena (Jul 2026 snapshot) on a TrueSkill rating from human comparisons' },
  { rank: 2, model: 'Happy Horse 1.0', org: 'Alibaba', score: 1816, scoreUnit: ' arena', stat: 'Arena 1816', note: 'Second on the blind-vote text-to-video arena (Jul 2026 snapshot); limited availability at this snapshot' },
  { rank: 3, model: 'Seedance 2.0 Fast', org: 'ByteDance', score: 1747, scoreUnit: ' arena', stat: 'Arena 1747', note: 'Third on the blind-vote text-to-video arena (Jul 2026 snapshot); the fast tier of ByteDance\'s Seedance 2 line' },
  { rank: 4, model: 'Veo 3.1', org: 'Google DeepMind', w: 70, stat: 'Top Western model; leads with-audio', note: 'Highest-placed non-Chinese model and still first on the text-to-video-WITH-AUDIO board (Jul 2026 snapshot); no directly comparable score on the text-only arena scale, so no number is invented here' },
  { rank: 5, model: 'Pika 2.5', org: 'Pika Labs', w: 55, stat: 'Independent studio, fast iteration', note: 'Not yet submitted to the blind-vote text-to-video arena as of the Jul 2026 snapshot; placed here on editorial quality review relative to the four ranked above, not a measured score' },
];

// Percentages must sum to ~100. The donut gradient is DERIVED from this array
// (see donutGradient) so the wedges can never disagree with the legend.
export const marketShare = [
  { name: 'ChatGPT', pct: 53.9, color: 'var(--deep)' },
  { name: 'Gemini', pct: 27.9, color: 'var(--sea)' },
  { name: 'Claude', pct: 9.2, color: 'var(--teal)' },
  { name: 'Perplexity', pct: 4.0, color: 'var(--sand)' },
  { name: 'DeepSeek', pct: 3.0, color: 'var(--coral)' },
  { name: 'Other', pct: 2.0, color: 'var(--ink-dim)' },
];

// Build the conic-gradient string from marketShare so wedges === legend.
export function donutGradient(rows = marketShare) {
  let acc = 0;
  const stops = rows.map((r) => {
    const start = acc;
    acc += r.pct;
    return `${r.color} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

// Compute pricing moved to a LIVE source (Vast.ai + RunPod public marketplace
// APIs, no key required) — see scripts/lib/compute.mjs and data.compute in
// latest.json. No curated fallback here on purpose: the panel shows an
// honest "unavailable" empty state on a fetch failure rather than silently
// falling back to a stale hand-typed number that looks live but isn't.

export const stats = [
  { num: '357+', lbl: 'Models tracked across public leaderboards' },
  { num: '$47B', lbl: 'Anthropic annualized revenue, now ahead of OpenAI' },
  { num: '+855%', lbl: 'Claude web-visit growth, year over year' },
  { num: '1.6T', lbl: 'Param open model trained on domestic Chinese chips' },
  { num: '$4.7T', lbl: 'Nvidia market cap — largest AI compute stack' },
];
