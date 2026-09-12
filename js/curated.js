// Curated datasets with no single free live source. Every panel renders with a
// Curated provenance chip; `asOf` is the retrieval/snapshot date shown in UI.
// Sources used for this refresh:
//   https://artificialanalysis.ai/leaderboards/models
//   https://artificialanalysis.ai/evaluations/humanitys-last-exam
//   https://artificialanalysis.ai/image/leaderboard/text-to-image
//   https://artificialanalysis.ai/video/leaderboard/text-to-video
//   https://gs.statcounter.com/ai-chatbot-market-share
//   https://huggingface.co/ (official model cards and quantized artifacts)

export const CURATED_ASOF = 'Sep 12 2026';

// Editorial reception summaries keyed to data.community[].key. These are
// qualitative context, not measured sentiment; live counts and threads sit
// beside them and auto-update.
export const RECEPTION_ASOF = 'Sep 12 2026';
export const modelReception = {
  claude: 'Claude has strong visible momentum in coding and agent workflows; broader developer evidence still says AI output needs careful human verification.',
  gpt: 'ChatGPT retains broad workplace and consumer adoption, though usage alone is not evidence that developers prefer its answers.',
  gemini: 'Gemini benefits from wide Google-product distribution and multimodal positioning; no current preference survey here establishes that overall reception is climbing.',
  grok: 'Reception remains polarised, with product attention accompanied by safety controversy and regulatory scrutiny around generated imagery.',
  llama: 'The current community sample is local-use and speed-led, with developers discussing open tooling, coding workflows and hardware fit.',
  deepseek: 'The current community sample is unusually high-volume around V4.1 Flash, coding, price and speed; treat discussion volume as attention, not quality proof.',
  qwen: 'Qwen is a prominent open-weight option for local and coding use; “best” or “community darling” claims are avoided without a dated comparative survey.',
};

// ---------- leaderboard: four scoped views, never one universal rank ----------
export const LEADERBOARD_SNAPSHOT = 'Sep 2026';
export const LEADERBOARD_OVERALL_DISCLAIMER = 'Editorial synthesis—not a universal benchmark ranking.';

// Overall balance uses the current Artificial Analysis Intelligence Index v4.3.
// Rows preserve the eight tracked families in this site; ranks are within this
// curated roster, and the underlying source values are named in each note.
export const leaderboardOverall = [
  { rank: 1, model: 'Claude Fable 5.1', org: 'Anthropic', score: 53.4, scoreUnit: ' AAII', stat: 'AAII 53 · #1', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 53.3738; max effort with default fallback` },
  { rank: 2, model: 'GPT-6 Astra', org: 'OpenAI', score: 52.8, scoreUnit: ' AAII', stat: 'AAII 53 · #2', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 52.8141; max effort` },
  { rank: 3, model: 'Claude Opus 5', org: 'Anthropic', score: 50.7, scoreUnit: ' AAII', stat: 'AAII 51 · #3', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 50.7002; max effort` },
  { rank: 4, model: 'GPT-5.6 Sol', org: 'OpenAI', score: 47.1, scoreUnit: ' AAII', stat: 'AAII 47 · #4', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 47.0614; max effort` },
  { rank: 5, model: 'Grok 4.6', org: 'xAI', score: 44.4, scoreUnit: ' AAII', stat: 'AAII 44 · #5', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 44.4050; high effort` },
  { rank: 6, model: 'Kimi K3', org: 'Moonshot AI', score: 43.8, scoreUnit: ' AAII', stat: 'AAII 44 · #6', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 43.7842; max effort` },
  { rank: 7, model: 'Qwen3.8 Max', org: 'Alibaba', score: 40.3, scoreUnit: ' AAII', stat: 'AAII 40 · #7', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 40.3049; max effort` },
  { rank: 8, model: 'Gemini 3.1 Pro Preview', org: 'Google DeepMind', score: 30.4, scoreUnit: ' AAII', stat: 'AAII 30 · #8', note: `Artificial Analysis Intelligence Index v4.3 (${LEADERBOARD_SNAPSHOT} snapshot), underlying 30.3597; preview, thinking-high configuration` },
];

// Reasoning uses Artificial Analysis's standardized Humanity's Last Exam run.
// All eight rows have a published value in the current model records.
export const leaderboardReasoning = [
  { rank: 1, model: 'Claude Fable 5.1', org: 'Anthropic', score: 59.1, scoreUnit: '% HLE', stat: "59.1% Humanity's Last Exam", note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), max effort with default fallback` },
  { rank: 2, model: 'Claude Opus 5', org: 'Anthropic', score: 54.9, scoreUnit: '% HLE', stat: "54.9% Humanity's Last Exam", note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 3, model: 'GPT-6 Astra', org: 'OpenAI', score: 54.7, scoreUnit: '% HLE', stat: "54.7% Humanity's Last Exam", note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 4, model: 'GPT-5.6 Sol', org: 'OpenAI', score: 49.5, scoreUnit: '% HLE', stat: "49.5% Humanity's Last Exam", note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 5, model: 'Gemini 3.1 Pro Preview', org: 'Google DeepMind', score: 47.0, scoreUnit: '% HLE', stat: "47.0% Humanity's Last Exam", note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), preview thinking-high configuration` },
  { rank: 6, model: 'Kimi K3', org: 'Moonshot AI', score: 46.9, scoreUnit: '% HLE', stat: `46.9% Humanity's Last Exam`, note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 7, model: 'Qwen3.8 Max', org: 'Alibaba', score: 43.0, scoreUnit: '% HLE', stat: `43.0% Humanity's Last Exam`, note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 8, model: 'Grok 4.6', org: 'xAI', score: 42.9, scoreUnit: '% HLE', stat: `42.9% Humanity's Last Exam`, note: `Artificial Analysis HLE result (${LEADERBOARD_SNAPSHOT} snapshot), high effort` },
];

// Agentic coding uses Artificial Analysis Terminal-Bench v4.0. This replaces
// the old SWE-bench estimates: the current official SWE-bench board does not
// publish comparable results for these eight current model configurations.
export const leaderboardAgentic = [
  { rank: 1, model: 'GPT-6 Astra', org: 'OpenAI', score: 59.1, scoreUnit: '% TB4.0', stat: '59.1% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 2, model: 'Claude Fable 5.1', org: 'Anthropic', score: 52.0, scoreUnit: '% TB4.0', stat: '52.0% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), max effort with default fallback` },
  { rank: 3, model: 'Claude Opus 5', org: 'Anthropic', score: 49.0, scoreUnit: '% TB4.0', stat: '49.0% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 4, model: 'GPT-5.6 Sol', org: 'OpenAI', score: 39.9, scoreUnit: '% TB4.0', stat: '39.9% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 5, model: 'Grok 4.6', org: 'xAI', score: 21.2, scoreUnit: '% TB4.0', stat: '21.2% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), high effort` },
  { rank: 6, model: 'Qwen3.8 Max', org: 'Alibaba', score: 18.7, scoreUnit: '% TB4.0', stat: '18.7% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 7, model: 'Kimi K3', org: 'Moonshot AI', score: 12.6, scoreUnit: '% TB4.0', stat: '12.6% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), max effort` },
  { rank: 8, model: 'Gemini 3.1 Pro Preview', org: 'Google DeepMind', score: 4.0, scoreUnit: '% TB4.0', stat: '4.0% Terminal-Bench 4.0', note: `Artificial Analysis Terminal-Bench 4.0 result (${LEADERBOARD_SNAPSHOT} snapshot), preview thinking-high configuration` },
];

// Cost efficiency is normalized from Artificial Analysis cost-per-task values
// for this eight-model roster: 100 × (max cost − model cost) / (max cost −
// min cost). It is relative to this roster, not a provider quote or per-token
// promise. The source estimates are retained in each note for auditability.
export const leaderboardCost = [
  { rank: 1, model: 'Gemini 3.1 Pro Preview', org: 'Google DeepMind', score: 100.0, scoreUnit: ' /100', stat: '$0.67/task · 100/100', note: `Artificial Analysis cost-per-task estimate ($0.67; ${LEADERBOARD_SNAPSHOT} snapshot), lowest in this roster` },
  { rank: 2, model: 'Grok 4.6', org: 'xAI', score: 82.9, scoreUnit: ' /100', stat: '$1.86/task · 82.9/100', note: `Artificial Analysis cost-per-task estimate ($1.86; ${LEADERBOARD_SNAPSHOT} snapshot), normalized against this roster` },
  { rank: 3, model: 'GPT-5.6 Sol', org: 'OpenAI', score: 81.1, scoreUnit: ' /100', stat: '$1.99/task · 81.1/100', note: `Artificial Analysis cost-per-task estimate ($1.99; ${LEADERBOARD_SNAPSHOT} snapshot), normalized against this roster` },
  { rank: 4, model: 'Kimi K3', org: 'Moonshot AI', score: 80.9, scoreUnit: ' /100', stat: '$2.00/task · 80.9/100', note: `Artificial Analysis cost-per-task estimate ($2.00; ${LEADERBOARD_SNAPSHOT} snapshot), normalized against this roster` },
  { rank: 5, model: 'Qwen3.8 Max', org: 'Alibaba', score: 71.3, scoreUnit: ' /100', stat: '$2.67/task · 71.3/100', note: `Artificial Analysis cost-per-task estimate ($2.67; ${LEADERBOARD_SNAPSHOT} snapshot), normalized against this roster` },
  { rank: 6, model: 'GPT-6 Astra', org: 'OpenAI', score: 62.8, scoreUnit: ' /100', stat: '$3.26/task · 62.8/100', note: `Artificial Analysis cost-per-task estimate ($3.26; ${LEADERBOARD_SNAPSHOT} snapshot), normalized against this roster` },
  { rank: 7, model: 'Claude Opus 5', org: 'Anthropic', score: 25.5, scoreUnit: ' /100', stat: '$5.86/task · 25.5/100', note: `Artificial Analysis cost-per-task estimate ($5.86; ${LEADERBOARD_SNAPSHOT} snapshot), normalized against this roster` },
  { rank: 8, model: 'Claude Fable 5.1', org: 'Anthropic', score: 0.0, scoreUnit: ' /100', stat: '$7.63/task · 0/100', note: `Artificial Analysis cost-per-task estimate ($7.63; ${LEADERBOARD_SNAPSHOT} snapshot), highest in this roster` },
];

export const LEADERBOARD_VIEWS = [
  { id: 'overall', label: 'Overall balance', data: leaderboardOverall, disclaimer: LEADERBOARD_OVERALL_DISCLAIMER },
  { id: 'reasoning', label: 'Reasoning', data: leaderboardReasoning, disclaimer: null },
  { id: 'agentic', label: 'Agentic coding', data: leaderboardAgentic, disclaimer: null },
  { id: 'cost', label: 'Cost efficiency', data: leaderboardCost, disclaimer: null },
];

export const leaderboard = leaderboardOverall;

// Artificial Analysis Image Arena, current text-to-image board.
export const imageAI = [
  { rank: 1, model: 'GPT Image 2.5 Flare (max)', org: 'OpenAI', score: 1187, scoreUnit: ' Elo', stat: 'Elo 1187 · 5,236 samples', note: `Artificial Analysis Image Arena text-to-image board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1175.87–1197.87; released Sep 2026` },
  { rank: 2, model: 'GPT Image 2.5 Sunburst (max)', org: 'OpenAI', score: 1179, scoreUnit: ' Elo', stat: 'Elo 1179 · 5,159 samples', note: `Artificial Analysis Image Arena text-to-image board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1168.19–1190.19; released Sep 2026` },
  { rank: 3, model: 'GPT Image 2 (high)', org: 'OpenAI', score: 1171, scoreUnit: ' Elo', stat: 'Elo 1171 · 15,419 samples', note: `Artificial Analysis Image Arena text-to-image board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1162.16–1180.16; released Apr 2026` },
  { rank: 4, model: 'MAI-Image-2.6', org: 'Microsoft AI', score: 1144, scoreUnit: ' Elo', stat: 'Elo 1144 · 7,345 samples', note: `Artificial Analysis Image Arena text-to-image board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1133.31–1155.31; released Aug 2026` },
  { rank: 5, model: 'Reve 2.1', org: 'Reve', score: 1127, scoreUnit: ' Elo', stat: 'Elo 1127 · 16,045 samples', note: `Artificial Analysis Image Arena text-to-image board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1117.59–1135.59; released Jul 2026` },
];

// Local AI PC ladder. These are editorial hardware-fit recommendations, not
// benchmark ranks. Q4 footprints below use retrieved artifacts where available.
export const localAI = [
  { rank: 1, model: 'Gemma 4 E2B', org: 'Google', w: 100, stat: 'Runs on 8GB RAM', specTier: 1, note: 'Entry laptop · 2.3B effective / 5.1B total parameters; Q4_K_M is about 2.9 GiB' },
  { rank: 2, model: 'ZAYA1-8B', org: 'Zyphra', w: 88, stat: 'Runs on 16GB RAM', specTier: 2, note: 'Small MoE with 8.4B total / 760M active parameters; vendor positions it for on-device deployment' },
  { rank: 3, model: 'Gemma 4 12B', org: 'Google', w: 76, stat: 'Runs on 16–24GB RAM', specTier: 3, note: 'Multimodal local model with 11.95B parameters and 256K context; practical context depends on available memory' },
  { rank: 4, model: 'Qwen3.6-27B', org: 'Alibaba', w: 66, stat: 'Runs on 32GB RAM or a 24GB GPU', specTier: 4, note: 'Dense 27B model; Q4_K_M is about 15.7 GiB, but full 262K context does not fit beside weights on a 24GB GPU' },
  { rank: 5, model: 'Gemma 4 31B', org: 'Google', w: 58, stat: 'Runs on 32–48GB RAM or a 24GB GPU', specTier: 4, note: 'Dense 30.7B multimodal model; Q4_K_M is about 17.1 GiB, leaving limited 24GB-GPU headroom for cache and context' },
];

export const LOCAL_AI_SPECS_ASOF = 'Sep 12 2026';
export const LOCAL_AI_SPECS_METHODOLOGY = 'Official model cards establish model identity, parameters and capabilities. Q4_K_M sizes are retrieved artifact sizes where cited, otherwise conservative estimates; actual runtime memory also depends on context, KV cache, runtime and offload. CPU inference is slower than GPU inference.';
export const localAiPcSpecs = [
  { model: 'Gemma 4 E2B', params: '2.3B effective / 5.1B total', approxSize: '~2.9 GiB Q4_K_M', tier: 1, tierLabel: 'Entry laptop', setup: '8GB RAM · CPU inference, or a GPU with sufficient shared/VRAM headroom' },
  { model: 'ZAYA1-8B', params: '8.4B total / 760M active', approxSize: '~5.2 GiB Q4_K_M', tier: 2, tierLabel: 'Mainstream laptop', setup: '16GB RAM, or an 8GB GPU at modest context' },
  { model: 'Gemma 4 12B', params: '11.95B', approxSize: '~6.3 GiB Q4', tier: 3, tierLabel: 'Enthusiast laptop/desktop', setup: '16–24GB RAM, or a 12GB+ GPU at modest context' },
  { model: 'Qwen3.6-27B', params: '27B', approxSize: '~15.7 GiB Q4_K_M', tier: 4, tierLabel: 'Enthusiast desktop', setup: '32GB RAM, or a 24GB GPU with context constrained to available cache' },
  { model: 'Gemma 4 31B', params: '30.7B', approxSize: '~17.1 GiB Q4_K_M', tier: 5, tierLabel: 'High-end desktop', setup: '32–48GB RAM, or a 24GB GPU with constrained context' },
];

// Local AI mobile/tablet ladder. This is a fit ladder, not a performance
// leaderboard; entries are backed by maintained official model cards.
export const localAiMobile = [
  { rank: 1, model: 'Gemma 4 E2B', org: 'Google', w: 100, stat: 'Runs on 6GB+ RAM', specTier: 2, note: 'Designed for mobile and edge deployment; supports text, image, audio and video input' },
  { rank: 2, model: 'Gemma 3 4B', org: 'Google', w: 90, stat: 'Runs on 8GB+ RAM', specTier: 3, note: 'Compact multimodal option; allow additional memory for the vision projector and context cache' },
  { rank: 3, model: 'Phi-4 Mini', org: 'Microsoft', w: 80, stat: 'Runs on 8GB+ RAM', specTier: 3, note: '3.8B text model with 128K context, intended in part for memory- and compute-constrained environments' },
  { rank: 4, model: 'Qwen3-1.7B', org: 'Alibaba', w: 72, stat: 'Runs on 4GB+ RAM', specTier: 1, note: 'About 1.2 GiB at Q4_K_M; model card documents support for more than 100 languages and dialects' },
  { rank: 5, model: 'SmolLM2-1.7B', org: 'Hugging Face', w: 64, stat: 'Runs on 4GB+ RAM', specTier: 1, note: 'About 1.0 GiB at Q4_K_M; explicitly designed to be lightweight enough for on-device use' },
];

export const localAiMobileSpecs = [
  { model: 'SmolLM2-1.7B', params: '1.7B', approxSize: '~1.0 GiB Q4_K_M', tier: 1, tierLabel: 'Entry phone', setup: '4GB+ RAM · short context recommended' },
  { model: 'Qwen3-1.7B', params: '1.7B published', approxSize: '~1.2 GiB Q4_K_M', tier: 1, tierLabel: 'Entry–mid phone', setup: '4GB+ RAM · short context recommended' },
  { model: 'Gemma 4 E2B', params: '2.3B effective / 5.1B total', approxSize: '~2.9 GiB Q4_K_M', tier: 2, tierLabel: 'Mid-range phone/tablet', setup: '6GB+ RAM · memory rises with modalities and context' },
  { model: 'Phi-4 Mini', params: '3.8B', approxSize: '~2.3 GiB Q4', tier: 3, tierLabel: 'Mid-range phone/tablet', setup: '8GB+ RAM' },
  { model: 'Gemma 3 4B', params: '4B class', approxSize: '~2.3 GiB text Q4', tier: 3, tierLabel: 'Mid-range phone/tablet', setup: '8GB+ RAM · vision projector adds memory' },
];

// Artificial Analysis text-to-video arena, explicitly the page's With Audio
// board. Do not mix these measured rows with an editorial no-audio ranking.
export const videoAI = [
  { rank: 1, model: 'Wan 3.0', org: 'Alibaba', score: 1242, scoreUnit: ' Elo', stat: 'Elo 1242 · 5,745 samples', note: `Artificial Analysis Video Arena text-to-video With Audio board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1232.87–1250.87; released Aug 2026` },
  { rank: 2, model: 'Gemini Omni Flash', org: 'Google', score: 1238, scoreUnit: ' Elo', stat: 'Elo 1238 · 16,367 samples', note: `Artificial Analysis Video Arena text-to-video With Audio board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1232.18–1244.18; released May 2026` },
  { rank: 3, model: 'Minimax H3 Max (post-trained by fal)', org: 'Fal', score: 1231, scoreUnit: ' Elo', stat: 'Elo 1231 · 5,479 samples', note: `Artificial Analysis Video Arena text-to-video With Audio board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1221.97–1239.97; released Aug 2026` },
  { rank: 4, model: 'MiniMax H3', org: 'MiniMax', score: 1225, scoreUnit: ' Elo', stat: 'Elo 1225 · 8,852 samples', note: `Artificial Analysis Video Arena text-to-video With Audio board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1217.59–1231.59; released Jul 2026` },
  { rank: 5, model: 'Dreamina Seedance 2.0 720p', org: 'ByteDance Seed', score: 1220, scoreUnit: ' Elo', stat: 'Elo 1220 · 22,625 samples', note: `Artificial Analysis Video Arena text-to-video With Audio board (${LEADERBOARD_SNAPSHOT} snapshot), 95% CI 1213.54–1225.54; released Mar 2026` },
];

// StatCounter's current worldwide AI-chatbot table (August 2026). Values sum
// to 99.99 because of source rounding; the donut uses this same array.
export const marketShare = [
  { name: 'ChatGPT', pct: 79.4, color: 'var(--deep)' },
  { name: 'Gemini', pct: 10.9, color: 'var(--sea)' },
  { name: 'Perplexity', pct: 4.31, color: 'var(--sand)' },
  { name: 'Microsoft Copilot', pct: 2.79, color: 'var(--ink-soft)' },
  { name: 'Claude', pct: 2.57, color: 'var(--coral)' },
  { name: 'DeepSeek', pct: 0.02, color: 'var(--teal)' },
];

export function donutGradient(rows = marketShare) {
  let acc = 0;
  const stops = rows.map((r) => {
    const start = acc;
    acc += r.pct;
    return `${r.color} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

// Compute pricing is live (Vast.ai + RunPod); there is intentionally no stale
// curated fallback for that panel.
export const stats = [
  { num: '147', lbl: 'Models ranked on Artificial Analysis LLM leaderboard · v4.3' },
  { num: '$65B', lbl: 'Anthropic revenue run rate in July 2026 · Reuters reported Aug 17' },
  { num: '79.4%', lbl: 'ChatGPT worldwide AI-chatbot share · StatCounter Aug 2026' },
  { num: '1.6T', lbl: 'LongCat-2.0 total parameters · ~48B active per token' },
  { num: '$5T', lbl: 'Nvidia valuation milestone reached Oct 29 2025 · Reuters' },
];
