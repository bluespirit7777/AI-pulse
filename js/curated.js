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

// "Overall balance" — a hand-weighted blend across reasoning, agentic coding,
// adoption and reception. Rank order is cross-checked against Scale Labs'
// public leaderboard (https://labs.scale.com/leaderboard) — a real,
// third-party evaluator, not house benchmarks from any one lab — but the
// BLEND itself (how reasoning is weighed against agentic coding, adoption,
// etc.) is an editorial judgment call, which is why this view carries the
// disclaimer above rather than being presented as a benchmark result.
export const leaderboardOverall = [
  { rank: 1, model: 'Gemini 3.5 Pro', org: 'Google DeepMind', w: 100, stat: 'Leads frontier reasoning', note: `Tops Humanity's Last Exam & EnigmaEval among tracked models (Scale Labs, ${'Jul 2026'} snapshot) · native computer-use in 3.5 Flash` },
  { rank: 2, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', w: 95, stat: 'Near-tied for top reasoning', note: `Trails Gemini by ~2pts on Humanity's Last Exam (Scale Labs, ${'Jul 2026'} snapshot); broadest mainstream reach` },
  { rank: 3, model: 'Claude Fable 5', org: 'Anthropic', w: 88, stat: 'Leads agentic coding execution', note: `Beats Opus 4.8 on Scale Labs' SWE Atlas Refactoring (54.8 vs 46.7) and Remote Labor Index (16.1 vs 8.3) — ${'Jul 2026'} snapshot; the stronger Claude tier on hands-on dev-agent work specifically, not a claim about every task` },
  { rank: 4, model: 'Claude Opus 4.8', org: 'Anthropic', w: 84, stat: 'Leads codebase comprehension', note: `#1 on Scale Labs' SWE Atlas Codebase QnA (57.3, ${'Jul 2026'} snapshot) — its one edge over Fable 5 among the metrics checked` },
  { rank: 5, model: 'Grok 4.5', org: 'xAI', w: 74, stat: '2M-token context', note: `Mid-pack on Scale Labs' tracked reasoning and agentic evals (${'Jul 2026'} snapshot); reception coloured by X-platform controversy` },
  { rank: 6, model: 'Qwen 3.7 Max', org: 'Alibaba', w: 66, stat: 'Top open/Chinese model', note: `Highest-ranked open-weight model on Scale Labs' public leaderboard (${'Jul 2026'} snapshot)` },
];

// "Reasoning" — Scale Labs' Humanity's Last Exam + EnigmaEval specifically.
// Only Gemini and GPT have a published score tracked here; the rest are
// listed for comparison but are honestly marked as not separately
// benchmarked on THESE two evals in this snapshot, rather than assigning
// them an invented number.
// `score` is set ONLY where a real published number exists (Humanity's Last
// Exam %); the 4 rows below it have no published score on this eval and
// deliberately carry no `score` — the renderer shows them as a plain
// numbered/tied entry with no bar, rather than a fabricated width.
export const leaderboardReasoning = [
  { rank: 1, model: 'Gemini 3.5 Pro', org: 'Google DeepMind', score: 46.44, scoreUnit: '% HLE', stat: "46.44% on Humanity's Last Exam", note: `Highest tracked score on Humanity's Last Exam & EnigmaEval (Scale Labs, ${'Jul 2026'} snapshot)` },
  { rank: 2, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', score: 44.32, scoreUnit: '% HLE', stat: "44.32% on Humanity's Last Exam", note: `Narrowly behind Gemini on Humanity's Last Exam (Scale Labs, ${'Jul 2026'} snapshot)` },
  { rank: 3, model: 'Claude Opus 4.8', org: 'Anthropic', stat: 'Not separately tracked here', note: `Not among Scale Labs' published Humanity's Last Exam / EnigmaEval scorers as of the ${'Jul 2026'} snapshot — see Agentic coding view for its strongest benchmark result` },
  { rank: 3, model: 'Claude Fable 5', org: 'Anthropic', stat: 'Not separately tracked here', note: `Not among Scale Labs' published Humanity's Last Exam / EnigmaEval scorers as of the ${'Jul 2026'} snapshot — see Agentic coding view for its strongest benchmark result` },
  { rank: 5, model: 'Grok 4.5', org: 'xAI', stat: 'Not separately tracked here', note: `Not among Scale Labs' published Humanity's Last Exam / EnigmaEval scorers as of the ${'Jul 2026'} snapshot` },
  { rank: 6, model: 'Qwen 3.7 Max', org: 'Alibaba', stat: 'Not separately tracked here', note: `Not among Scale Labs' published Humanity's Last Exam / EnigmaEval scorers as of the ${'Jul 2026'} snapshot` },
];

// "Agentic coding" — Scale Labs' SWE Atlas suite + Remote Labor Index.
// Claude is the only family with published per-metric scores tracked here.
export const leaderboardAgentic = [
  { rank: 1, model: 'Claude Fable 5', org: 'Anthropic', w: 100, stat: 'Leads Refactoring & Remote Labor Index', note: `SWE Atlas Refactoring 54.8 vs Opus 4.8's 46.7; Remote Labor Index 16.1 vs 8.3 (Scale Labs, ${'Jul 2026'} snapshot)` },
  { rank: 2, model: 'Claude Opus 4.8', org: 'Anthropic', w: 92, stat: 'Leads Codebase QnA', note: `SWE Atlas Codebase QnA 57.3 — its one edge over Fable 5 among the metrics checked (Scale Labs, ${'Jul 2026'} snapshot)` },
  { rank: 3, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', w: 55, stat: 'Not separately tracked here', note: `Not among Scale Labs' published SWE Atlas / Remote Labor Index scorers as of the ${'Jul 2026'} snapshot` },
  { rank: 3, model: 'Gemini 3.5 Pro', org: 'Google DeepMind', w: 55, stat: 'Not separately tracked here', note: `Not among Scale Labs' published SWE Atlas / Remote Labor Index scorers as of the ${'Jul 2026'} snapshot — see Reasoning view for its strongest benchmark result` },
  { rank: 5, model: 'Grok 4.5', org: 'xAI', w: 42, stat: 'Not separately tracked here', note: `Not among Scale Labs' published SWE Atlas / Remote Labor Index scorers as of the ${'Jul 2026'} snapshot` },
  { rank: 6, model: 'Qwen 3.7 Max', org: 'Alibaba', w: 40, stat: 'Not separately tracked here', note: `Not among Scale Labs' published SWE Atlas / Remote Labor Index scorers as of the ${'Jul 2026'} snapshot` },
];

// "Cost efficiency" — deliberately QUALITATIVE/directional, not precise
// $/token figures: exact provider pricing changes too often and varies by
// tier/region for a single hand-maintained number to stay honest for long.
// Ranked by public pricing-page TIER (budget/mid/premium) and whether the
// model is self-hostable at zero marginal API cost, not a fabricated rate.
export const leaderboardCost = [
  { rank: 1, model: 'Qwen 3.7 Max', org: 'Alibaba', w: 100, stat: 'Open-weight, self-hostable', note: `Apache-2.0 weights — no per-token API cost when self-hosted (public model card, ${'Jul 2026'} snapshot)` },
  { rank: 2, model: 'Gemini 3.5 Pro', org: 'Google DeepMind', w: 70, stat: 'Mid tier via Flash variants', note: `Flash-tier pricing sits below the top frontier bracket (public pricing page, ${'Jul 2026'} snapshot); Pro tier is priced at the frontier bracket` },
  { rank: 3, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', w: 60, stat: 'Frontier tier', note: `Priced in the top frontier bracket across providers (public pricing page, ${'Jul 2026'} snapshot)` },
  { rank: 4, model: 'Grok 4.5', org: 'xAI', w: 55, stat: 'Frontier tier', note: `Priced in the top frontier bracket across providers (public pricing page, ${'Jul 2026'} snapshot)` },
  { rank: 5, model: 'Claude Opus 4.8', org: 'Anthropic', w: 48, stat: 'Premium tier', note: `Priced at the premium end of the frontier bracket (public pricing page, ${'Jul 2026'} snapshot); some report a higher cost per completed task` },
  { rank: 6, model: 'Claude Fable 5', org: 'Anthropic', w: 48, stat: 'Premium tier', note: `Priced at the premium end of the frontier bracket (public pricing page, ${'Jul 2026'} snapshot)` },
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

// Top self-hostable / open-weight models — the "run it yourself today" tier.
// Rank blends open-model leaderboards + real-world local-LLM adoption. Ordinal.
export const localAI = [
  { rank: 1, model: 'Qwen 3.7 (235B/A22B)', org: 'Alibaba', w: 100, stat: 'Best all-round self-hostable', note: 'Apache-2.0 · the local-LLM community favourite for coding + agents' },
  { rank: 2, model: 'DeepSeek V3.2', org: 'DeepSeek', w: 90, stat: 'Best value / reasoning', note: 'MIT-licensed weights · strong math + code at low inference cost' },
  { rank: 3, model: 'Llama 4 Maverick', org: 'Meta', w: 80, stat: 'Broadest ecosystem', note: 'Llama community licence · the default base for fine-tuned pipelines' },
  { rank: 4, model: 'GLM-4.6', org: 'Zhipu AI', w: 72, stat: 'Strong agentic open model', note: 'Open weights · competitive tool-use and coding for its size' },
  { rank: 5, model: 'Mistral Large 3', org: 'Mistral AI', w: 64, stat: 'Efficient European option', note: 'Open weights · solid multilingual quality on modest hardware' },
];

// Hardware tiers for the 5 models above. `approxSize` is CALCULATED — each
// model's published total parameter count at a standard 4-bit quantization
// (~0.6GB per billion parameters, the common GGUF/AWQ ballpark) — not a
// benchmarked or vendor-published figure, so it's labelled as an editorial
// estimate, never as measured/live data. MoE models (Qwen/DeepSeek/Llama 4/
// GLM) need their FULL parameter count resident in memory even though only
// a smaller "active" subset computes per token — that's why total, not
// active, params drive the tier. Ranked least-to-most demanding among these
// specific 5 — even the lightest genuinely needs prosumer-class hardware,
// not a typical consumer laptop, and the table says so rather than
// pretending otherwise.
export const LOCAL_AI_SPECS_ASOF = 'Jul 2026';
export const LOCAL_AI_SPECS_METHODOLOGY = 'Editorial estimate: memory need = published total parameters × ~0.6GB/billion (typical 4-bit quantization). Not a benchmarked or vendor-published figure.';
export const localAiPcSpecs = [
  { model: 'Mistral Large 3', params: '123B dense', approxSize: '~74GB', tier: 1, tierLabel: 'Prosumer workstation', setup: '1× 80–96GB GPU, or a 128GB+ unified-memory Mac' },
  { model: 'Qwen 3.7 (235B/A22B)', params: '235B total · 22B active', approxSize: '~141GB', tier: 2, tierLabel: 'High-end workstation', setup: '2× 80GB GPUs, or 192GB+ system RAM with CPU offload' },
  { model: 'GLM-4.6', params: '355B total · 32B active', approxSize: '~213GB', tier: 3, tierLabel: 'Multi-GPU workstation', setup: '3–4× 80GB GPUs, or 256GB+ RAM with heavy offload' },
  { model: 'Llama 4 Maverick', params: '400B total · 17B active', approxSize: '~240GB', tier: 4, tierLabel: 'Small server', setup: '4× 80GB GPUs, or a 256–384GB RAM server' },
  { model: 'DeepSeek V3.2', params: '671B total · 37B active', approxSize: '~403GB', tier: 5, tierLabel: 'Multi-node server', setup: '6–8× 80GB GPUs, or a 512GB+ RAM server' },
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
