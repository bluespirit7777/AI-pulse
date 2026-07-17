// Hand-maintained datasets that have no free live source. Every one renders
// with a "Curated" provenance chip in the UI. Bar lengths are ORDINAL (rank
// position), never implied to be linear scores — the panel notes say so.
//
// Update cadence: edit here, commit. `asOf` drives the date chip shown per panel.

export const CURATED_ASOF = 'Jul 11 2026';

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
// capability and scientific reasoning at 25% each. Order is grounded in the
// public Jul 2026 leaderboard: Claude Fable 5 leads (~60), GPT-5.6 Sol ~1pt
// behind (~59), then Opus 4.8 and Gemini 3.1 Pro, with Qwen 3.7 Max the top
// open/Chinese model at #5 and Grok 4.5 mid-pack. The blend itself is still an
// editorial framing (which index, which weighting), which is why this view
// carries the disclaimer — but no model is left unscored.
export const leaderboardOverall = [
  { rank: 1, model: 'Claude Fable 5', org: 'Anthropic', score: 60, scoreUnit: ' AAII', stat: 'Leads the intelligence index', note: `Tops Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot) — a 0–100 blend of agents, coding, general capability and science` },
  { rank: 2, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 59, scoreUnit: ' AAII', stat: 'Second, ~1pt back', note: `Within ~1pt of the lead on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot); broadest mainstream reach and distribution` },
  { rank: 3, model: 'Claude Opus 4.8', org: 'Anthropic', score: 56, scoreUnit: ' AAII', stat: 'Frontier tier', note: `High on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot); leads codebase-comprehension sub-scores` },
  { rank: 4, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 55, scoreUnit: ' AAII', stat: 'Frontier tier', note: `Just behind the leaders on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot); extended thinking on by default, huge reach via Search/Workspace/Android` },
  { rank: 5, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 52, scoreUnit: ' AAII', stat: 'Top open/Chinese model', note: `Highest-ranked open-weight / Chinese model on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 6, model: 'Grok 4.5', org: 'xAI', score: 50, scoreUnit: ' AAII', stat: '2M-token context', note: `Mid-pack on Artificial Analysis' Intelligence Index (${LEADERBOARD_SNAPSHOT} snapshot); reception coloured by X-platform controversy` },
];

// "Reasoning" — Scale Labs' Humanity's Last Exam (HLE %). The top four carry
// Scale Labs' published figures (Fable 5 53.3, Sol 47.2, Opus 4.8 45.7, Gemini
// 3.1 Pro 44.4 — GPT-5.6 Sol clearly ahead of Gemini here). Scale Labs hasn't
// published a Grok 4.5 or Qwen 3.7 Max HLE figure, so those two carry an
// editorial estimate aligned to their tier, DISCLOSED as such in the note —
// the user wants every model scored, so we give a number but never dress an
// estimate up as a published measurement.
export const leaderboardReasoning = [
  { rank: 1, model: 'Claude Fable 5', org: 'Anthropic', score: 53.3, scoreUnit: '% HLE', stat: "53.3% on Humanity's Last Exam", note: `Top published score on Scale Labs' Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 2, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 47.2, scoreUnit: '% HLE', stat: "47.2% on Humanity's Last Exam", note: `Second on Scale Labs' Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot) — clearly ahead of Gemini on this eval` },
  { rank: 3, model: 'Claude Opus 4.8', org: 'Anthropic', score: 45.7, scoreUnit: '% HLE', stat: "45.7% on Humanity's Last Exam", note: `Third on Scale Labs' Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 4, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 44.4, scoreUnit: '% HLE', stat: "44.4% on Humanity's Last Exam", note: `Fourth on Scale Labs' Humanity's Last Exam (${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 5, model: 'Grok 4.5', org: 'xAI', score: 41.0, scoreUnit: '% HLE', stat: "~41% on Humanity's Last Exam", note: `Editorial estimate — Scale Labs hasn't published a Grok 4.5 Humanity's Last Exam figure as of the ${LEADERBOARD_SNAPSHOT} snapshot; aligned to Grok 4's public tool-assisted range` },
  { rank: 6, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 39.5, scoreUnit: '% HLE', stat: "~40% on Humanity's Last Exam", note: `Editorial estimate — Scale Labs hasn't published a Qwen 3.7 Max Humanity's Last Exam figure as of the ${LEADERBOARD_SNAPSHOT} snapshot; strongest open-weight model but below the frontier tier` },
];

// "Agentic coding" — Scale Labs' SWE Atlas / SWE-bench Verified (%). Claude's
// two tiers carry Scale Labs' published SWE Atlas figures (Fable 5 leads, Opus
// 4.8 second); the other four carry editorial estimates aligned to their
// public coding-arena standing, each DISCLOSED as an estimate in the note.
export const leaderboardAgentic = [
  { rank: 1, model: 'Claude Fable 5', org: 'Anthropic', score: 82.5, scoreUnit: '% SWE', stat: '82.5% SWE-bench Verified', note: `Leads agentic coding on Scale Labs' SWE Atlas / SWE-bench Verified (${LEADERBOARD_SNAPSHOT} snapshot); also tops the LMArena coding arena` },
  { rank: 2, model: 'Claude Opus 4.8', org: 'Anthropic', score: 79.0, scoreUnit: '% SWE', stat: '79.0% SWE-bench Verified', note: `Second on Scale Labs' SWE Atlas / SWE-bench Verified (${LEADERBOARD_SNAPSHOT} snapshot); leads codebase-comprehension sub-tasks` },
  { rank: 3, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 77.5, scoreUnit: '% SWE', stat: '~77.5% SWE-bench Verified', note: `Editorial estimate — not among Scale Labs' published SWE Atlas scorers as of the ${LEADERBOARD_SNAPSHOT} snapshot; placed on its strong general-coding reputation` },
  { rank: 4, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 74.0, scoreUnit: '% SWE', stat: '~74% SWE-bench Verified', note: `Editorial estimate — not among Scale Labs' published SWE Atlas scorers as of the ${LEADERBOARD_SNAPSHOT} snapshot` },
  { rank: 5, model: 'Grok 4.5', org: 'xAI', score: 68.0, scoreUnit: '% SWE', stat: '~68% SWE-bench Verified', note: `Editorial estimate — not among Scale Labs' published SWE Atlas scorers as of the ${LEADERBOARD_SNAPSHOT} snapshot; aligned to its mid-pack agentic standing` },
  { rank: 6, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 66.5, scoreUnit: '% SWE', stat: '~66% SWE-bench Verified', note: `Editorial estimate — not among Scale Labs' published SWE Atlas scorers as of the ${LEADERBOARD_SNAPSHOT} snapshot; strongest open-weight coder` },
];

// "Cost efficiency" — a 0–100 editorial index (higher = more cost-efficient),
// deliberately NOT precise $/token figures: exact provider pricing changes too
// often and varies by tier/region for a hand-maintained rate to stay honest.
// Ranked by public pricing-tier (budget/mid/premium) and whether the model is
// self-hostable at zero marginal API cost — the number is a directional index,
// which the note makes explicit, not a fabricated per-token rate.
export const leaderboardCost = [
  { rank: 1, model: 'Qwen 3.7 Max', org: 'Alibaba', score: 95, scoreUnit: ' /100', stat: 'Open-weight, self-hostable', note: `Apache-2.0 weights — no per-token API cost when self-hosted (public model card, ${LEADERBOARD_SNAPSHOT} snapshot); most cost-efficient by a wide margin` },
  { rank: 2, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', score: 72, scoreUnit: ' /100', stat: 'Cheap via Flash tiers', note: `Flash-tier pricing sits well below the frontier bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot); the Pro tier is priced at the frontier bracket` },
  { rank: 3, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 62, scoreUnit: ' /100', stat: 'Frontier tier', note: `Priced in the frontier bracket across providers (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot); mid cost-efficiency` },
  { rank: 4, model: 'Grok 4.5', org: 'xAI', score: 58, scoreUnit: ' /100', stat: 'Frontier tier', note: `Priced in the frontier bracket across providers (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 5, model: 'Claude Fable 5', org: 'Anthropic', score: 50, scoreUnit: ' /100', stat: 'Premium tier', note: `Priced at the premium end of the frontier bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot)` },
  { rank: 6, model: 'Claude Opus 4.8', org: 'Anthropic', score: 48, scoreUnit: ' /100', stat: 'Premium tier', note: `Priced at the premium end of the frontier bracket (public provider pricing, ${LEADERBOARD_SNAPSHOT} snapshot); some report a higher cost per completed task` },
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
export const imageAI = [
  { rank: 1, model: 'GPT Image 2', org: 'OpenAI', score: 1337, scoreUnit: ' Elo', stat: 'Elo 1337', note: 'Elo 1337 on Artificial Analysis — clear #1, well ahead of the field' },
  { rank: 2, model: 'GPT Image 1.5', org: 'OpenAI', score: 1258, scoreUnit: ' Elo', stat: 'Elo 1258', note: 'Elo 1258 — OpenAI holds both #1 and #2 on quality Elo' },
  { rank: 3, model: 'Nano Banana Pro', org: 'Google · Gemini 3', score: 1216, scoreUnit: ' Elo', stat: 'Elo 1216', note: 'Gemini-3-powered; Elo 1216, strongest prompt adherence among non-OpenAI models' },
  { rank: 4, model: 'FLUX.2 [max]', org: 'Black Forest Labs', score: 1190, scoreUnit: ' Elo', stat: 'Elo 1190', note: 'Elo 1190; frontier tier of the open-weight-rooted FLUX line' },
  { rank: 5, model: 'Seedream 4.0', org: 'ByteDance', score: 1188, scoreUnit: ' Elo', stat: 'Elo 1188', note: 'Elo 1188; strong photoreal output and Asian-language prompt handling' },
];

// Local AI you can actually run on a PERSONAL PC — one solid open-weight pick
// per realistic consumer RAM tier, from an 8GB laptop up to a 64GB desktop.
// Deliberately NOT the "biggest/best open models" (those are 200B–670B and
// need workstations/servers) — this list answers "what can I run on my own
// machine". Ordered by tier (entry → high-end), ordinal, no fabricated score.
export const localAI = [
  { rank: 1, model: 'Llama 3.2 3B', org: 'Meta', w: 100, stat: 'Runs on 8GB RAM', note: 'Entry laptops · quick chat, summarizing, simple coding help — CPU-only is fine' },
  { rank: 2, model: 'Llama 3.1 8B', org: 'Meta', w: 88, stat: 'Runs on 16GB RAM', note: 'Mainstream laptops · a capable general assistant with light coding' },
  { rank: 3, model: 'Qwen 2.5 14B', org: 'Alibaba', w: 76, stat: 'Runs on 16–24GB RAM', note: 'Enthusiast laptops/desktops · noticeably stronger reasoning + coding' },
  { rank: 4, model: 'Gemma 2 27B', org: 'Google', w: 66, stat: 'Runs on 32GB RAM', note: 'Enthusiast desktops · near-frontier quality for its size' },
  { rank: 5, model: 'Llama 3.3 70B', org: 'Meta', w: 58, stat: 'Runs on 64GB RAM', note: 'High-end desktops (or a 24–48GB GPU) · the best local quality you can self-host at home' },
];

// Hardware tiers for the 5 personal-PC models above, entry → high-end.
// `approxSize` is CALCULATED — each model's published parameter count at a
// standard 4-bit quantization (~0.6GB per billion parameters, the common
// GGUF/AWQ ballpark) — not a benchmarked or vendor-published figure, so it's
// labelled as an editorial estimate. These are all dense models that run on
// ordinary consumer hardware: system RAM for CPU inference (slower) or a
// consumer GPU's VRAM (faster) — no data-center cards required.
export const LOCAL_AI_SPECS_ASOF = 'Jul 2026';
export const LOCAL_AI_SPECS_METHODOLOGY = 'Editorial estimate: memory need = published parameters × ~0.6GB/billion (typical 4-bit quantization). Runs on system RAM (CPU, slower) or a consumer GPU (faster). Not a benchmarked figure.';
export const localAiPcSpecs = [
  { model: 'Llama 3.2 3B', params: '3B', approxSize: '~2GB', tier: 1, tierLabel: 'Entry laptop', setup: '8GB RAM · CPU is fine, any modern laptop' },
  { model: 'Llama 3.1 8B', params: '8B', approxSize: '~5GB', tier: 2, tierLabel: 'Mainstream laptop', setup: '16GB RAM, or a 6–8GB GPU' },
  { model: 'Qwen 2.5 14B', params: '14B', approxSize: '~9GB', tier: 3, tierLabel: 'Enthusiast laptop/desktop', setup: '16–24GB RAM, or a 12GB GPU' },
  { model: 'Gemma 2 27B', params: '27B', approxSize: '~16GB', tier: 4, tierLabel: 'Enthusiast desktop', setup: '32GB RAM, or a 24GB GPU (RTX 3090/4090)' },
  { model: 'Llama 3.3 70B', params: '70B', approxSize: '~40GB', tier: 5, tierLabel: 'High-end desktop', setup: '64GB RAM (CPU, slower), or a 48GB GPU / dual 24GB' },
];

// Top 5 self-hostable models actually sized for phones/tablets — a distinct
// list from the PC-class table above, not a subset of it. Real, current
// small open-weight model families, picked for on-device fit (not
// benchmarked against the PC-class models above — different use case
// entirely). Ordinal, same as localAI — no fabricated score.
export const localAiMobile = [
  { rank: 1, model: 'Gemma 3n E4B', org: 'Google', w: 100, stat: 'Best all-round on-device model', note: 'Apache-2.0 · MatFormer architecture built specifically for phones and tablets' },
  { rank: 2, model: 'MiniCPM-V 2.6', org: 'OpenBMB', w: 90, stat: 'Best for on-device vision + chat', note: 'Apache-2.0 · sees images/video, runs natively in the MiniCPM mobile app' },
  { rank: 3, model: 'Phi-3.5-mini', org: 'Microsoft', w: 80, stat: 'Strong reasoning for its size', note: 'MIT-licensed · punches above its weight on reasoning benchmarks' },
  { rank: 4, model: 'Llama 3.2 3B', org: 'Meta', w: 72, stat: 'Broadest mobile tooling support', note: 'Llama community licence · widest support across on-device runtimes (MLC, ExecuTorch)' },
  { rank: 5, model: 'Qwen 2.5 1.5B', org: 'Alibaba', w: 64, stat: 'Smallest footprint, entry phones', note: 'Apache-2.0 · runs on 4GB-RAM phones where the others may struggle' },
];

export const localAiMobileSpecs = [
  { model: 'Qwen 2.5 1.5B', params: '1.5B', approxSize: '~1GB', tier: 1, tierLabel: 'Entry-level phone', setup: '4GB+ RAM · most 2021+ Android/iOS devices' },
  { model: 'Llama 3.2 3B', params: '3B', approxSize: '~2GB', tier: 2, tierLabel: 'Entry–mid phone', setup: '6GB+ RAM' },
  { model: 'Phi-3.5-mini', params: '3.8B', approxSize: '~2.3GB', tier: 3, tierLabel: 'Mid-range phone', setup: '8GB+ RAM' },
  { model: 'Gemma 3n E4B', params: '~4B effective', approxSize: '~2.4GB', tier: 3, tierLabel: 'Mid-range phone', setup: '8GB+ RAM' },
  { model: 'MiniCPM-V 2.6', params: '~8B', approxSize: '~4.8GB', tier: 5, tierLabel: 'High-end phone', setup: '12GB+ RAM · multimodal (vision + text)' },
];

export const videoAI = [
  { rank: 1, model: 'Veo 3.1', org: 'Google DeepMind', w: 100, stat: 'Tops the video arena', note: 'Native synced audio, strong physics & long-shot coherence' },
  { rank: 2, model: 'Sora 2', org: 'OpenAI', w: 90, stat: 'Cinematic prompt control', note: 'Standalone app; excels at complex multi-shot scene direction' },
  { rank: 3, model: 'Kling 2.5', org: 'Kuaishou', w: 82, stat: 'Adoption leader in Asia', note: 'Fast generation with reliable motion; popular for social content' },
  { rank: 4, model: 'Runway Gen-4', org: 'Runway', w: 74, stat: 'Pro creative toolchain', note: 'Deep editing controls favored by studios and VFX workflows' },
  { rank: 5, model: 'Hailuo 02', org: 'MiniMax', w: 66, stat: 'Best value tier', note: 'Strong image-to-video quality at a fraction of frontier pricing' },
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
