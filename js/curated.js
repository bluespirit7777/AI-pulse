// Hand-maintained datasets that have no free live source. Every one renders
// with a "Curated" provenance chip in the UI. Bar lengths are ORDINAL (rank
// position), never implied to be linear scores — the panel notes say so.
//
// Update cadence: edit here, commit. `asOf` drives the date chip shown per panel.

export const CURATED_ASOF = 'Jul 09 2026';

export const leaderboard = [
  { rank: 1, model: 'Claude Opus 4.8', org: 'Anthropic', w: 100, stat: 'Tops Intelligence Index (61.4)', note: 'SWE-bench Pro 69.2% · computer-use 84% on Online-Mind2Web' },
  { rank: 2, model: 'GPT-5.5', org: 'OpenAI', w: 92, stat: 'Narrowly edged on the index', note: 'Strong agentic + math performance across evals' },
  { rank: 3, model: 'Gemini 3.1 Pro', org: 'Google DeepMind', w: 85, stat: 'GPQA Diamond 94.3%', note: 'Leads consumer models on science reasoning · 2M-token context' },
  { rank: 4, model: 'Grok 4 / 4.5', org: 'xAI', w: 76, stat: '2M-token context', note: '4.5 now in private beta at SpaceX & Tesla' },
  { rank: 5, model: 'Qwen 3.7 Max', org: 'Alibaba', w: 68, stat: 'Top-ranked Chinese model', note: 'Highest index placement of any open/Chinese-origin model' },
  { rank: 6, model: 'DeepSeek V3.2', org: 'DeepSeek', w: 60, stat: 'Best value tier', note: 'Speciale variant won gold at IMO, IOI & ICPC 2026' },
];

export const imageAI = [
  { rank: 1, model: 'Nano Banana Pro', org: 'Google · Gemini 3', w: 100, stat: 'Tops the image arena', note: 'Gemini-3-powered; strongest prompt adherence & text rendering' },
  { rank: 2, model: 'GPT-Image-1', org: 'OpenAI', w: 90, stat: 'Native ChatGPT image gen', note: 'Best-in-class instruction following and in-image typography' },
  { rank: 3, model: 'Seedream 4.0', org: 'ByteDance', w: 82, stat: 'Top open-access contender', note: 'High-fidelity photoreal output; strong on Asian-language prompts' },
  { rank: 4, model: 'Midjourney v7', org: 'Midjourney', w: 74, stat: 'Aesthetic favorite', note: 'Leads on artistic style and coherence; community-driven tuning' },
  { rank: 5, model: 'FLUX1.1 Pro', org: 'Black Forest Labs', w: 66, stat: 'Open-weight leader', note: 'Self-hostable; the default base for many fine-tuned pipelines' },
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
