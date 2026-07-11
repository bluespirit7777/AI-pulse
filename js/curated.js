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

// Rank order is cross-checked against Scale Labs' public leaderboard
// (https://labs.scale.com/leaderboard) — a real, third-party evaluator, not
// house benchmarks from any one lab. Scale shows a genuine split: Gemini/GPT
// lead broad frontier reasoning (Humanity's Last Exam, EnigmaEval), while
// Claude leads agentic coding specifically — and within Claude, Fable 5 beats
// Opus 4.8 on hands-on dev-agent tasks (SWE Atlas Refactoring: 54.8 vs 46.7;
// Test Writing: 58.5 vs 49.6; Remote Labor Index: 16.1 vs 8.3), while Opus 4.8
// leads codebase comprehension (SWE Atlas Codebase QnA: 57.3, #1). So Fable
// is the faster tier, not a strictly weaker one — see its note below.
export const leaderboard = [
  { rank: 1, model: 'Gemini 3.5 Pro', org: 'Google DeepMind', w: 100, stat: 'Leads frontier reasoning', note: 'Tops Humanity’s Last Exam & EnigmaEval among tracked models (Scale Labs) · native computer-use in 3.5 Flash' },
  { rank: 2, model: 'ChatGPT Sol (GPT-5.6)', org: 'OpenAI', w: 95, stat: 'Near-tied for top reasoning', note: 'GPT-5.4/5.5-class trails Gemini by ~2pts on Humanity’s Last Exam (Scale Labs); broadest mainstream reach' },
  { rank: 3, model: 'Claude Opus 4.8', org: 'Anthropic', w: 88, stat: 'Leads codebase comprehension', note: '#1 on Scale Labs’ SWE Atlas Codebase QnA (57.3); flagship Claude tier' },
  { rank: 4, model: 'Claude Fable 5', org: 'Anthropic', w: 84, stat: 'Leads agentic coding execution', note: 'Beats Opus 4.8 on Scale Labs’ SWE Atlas Refactoring (54.8 vs 46.7) & Test Writing (58.5 vs 49.6) — faster tier, not a weaker one' },
  { rank: 5, model: 'Grok 4.5', org: 'xAI', w: 74, stat: '2M-token context', note: 'Competitive on some benchmarks; reception coloured by X-platform controversy' },
  { rank: 6, model: 'Qwen 3.7 Max', org: 'Alibaba', w: 66, stat: 'Top open/Chinese model', note: 'Highest index placement of any open-origin model' },
];

export const imageAI = [
  { rank: 1, model: 'Nano Banana Pro', org: 'Google · Gemini 3', w: 100, stat: 'Tops the image arena', note: 'Gemini-3-powered; strongest prompt adherence & text rendering' },
  { rank: 2, model: 'GPT-Image-1', org: 'OpenAI', w: 90, stat: 'Native ChatGPT image gen', note: 'Best-in-class instruction following and in-image typography' },
  { rank: 3, model: 'Seedream 4.0', org: 'ByteDance', w: 82, stat: 'Top open-access contender', note: 'High-fidelity photoreal output; strong on Asian-language prompts' },
  { rank: 4, model: 'Midjourney v7', org: 'Midjourney', w: 74, stat: 'Aesthetic favorite', note: 'Leads on artistic style and coherence; community-driven tuning' },
  { rank: 5, model: 'FLUX1.1 Pro', org: 'Black Forest Labs', w: 66, stat: 'Open-weight leader', note: 'Self-hostable; the default base for many fine-tuned pipelines' },
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

export const compute = [
  { chip: 'H100 (Hopper)', segment: 'Mainstream training/inference', rate: '$1.4 – $7.5/hr', trend: '↓ 64–75% vs 2023 peak', trendClass: 'trend-down', note: 'Still the default workhorse; used cards resell $12k–$22k' },
  { chip: 'H200 (Hopper)', segment: 'Inference / long context', rate: '$0.6 – $13.8/hr', trend: '↑ ~13% since Jul 2025', trendClass: 'trend-up', note: '141GB VRAM fits 70B-class models on a single card' },
  { chip: 'B200 (Blackwell)', segment: 'Frontier training', rate: '$2.1 – $18/hr', trend: '↑ 24% in one month', trendClass: 'trend-up', note: 'Hyperscaler listings run 2–3x neocloud rates' },
  { chip: 'B300 (Blackwell Ultra)', segment: 'Frontier training', rate: '$4.95 – $18/hr, spot ~$2.90', trend: 'New, Jan 2026', trendClass: 'trend-new', note: 'Doubles HBM to 288GB per GPU' },
  { chip: 'MI300X (AMD)', segment: 'Nvidia alternative', rate: 'from $1.57/hr', trend: 'Thin coverage', trendClass: 'trend-new', note: '1.8x memory vs H100, only a handful of providers list it' },
  { chip: 'A100 (legacy)', segment: 'Budget / fine-tuning', rate: '$1.29 – $2.50/hr', trend: '↓ toward commodity', trendClass: 'trend-down', note: 'Still solid for LoRA/QLoRA fine-tuning jobs' },
];

export const stats = [
  { num: '357+', lbl: 'Models tracked across public leaderboards' },
  { num: '$47B', lbl: 'Anthropic annualized revenue, now ahead of OpenAI' },
  { num: '+855%', lbl: 'Claude web-visit growth, year over year' },
  { num: '1.6T', lbl: 'Param open model trained on domestic Chinese chips' },
  { num: '$4.7T', lbl: 'Nvidia market cap — largest AI compute stack' },
];
