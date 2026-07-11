// Canonical model registry — the single source of truth for each tracked
// model family's display name, organization and CURRENT flagship version.
// Pure data, no I/O, importable directly from both build-time Node scripts
// (scripts/update-data.mjs) and browser ES modules (js/*.js) exactly like
// scripts/lib/signals.mjs already is — no bundler, no framework.
//
// Every section that names a model version — the Ocean Map (entities.json),
// Community Pulse, Frontier Releases, the Leaderboard, and entity drawers —
// reads from here so a version bump only has to happen in ONE place. Before
// this existed, "Gemini 3.1" (entities.json) and "Gemini 3.5 Pro" (curated
// leaderboard) disagreed about Google's current flagship, and "Grok 4"
// (entities.json/community) disagreed with "Grok 4.5" (leaderboard) — both
// real inconsistencies this fixes.
//
// `brand` is the consumer-facing PRODUCT name where it differs from the
// model FAMILY name (the GPT family ships as the ChatGPT product) — Frontier
// Releases uses `brand`; everywhere else uses `name`.

export const MODEL_REGISTRY = {
  gpt: {
    key: 'gpt', name: 'GPT', brand: 'ChatGPT', org: 'OpenAI',
    version: 'GPT-5.6', versionLabel: 'ChatGPT Sol (GPT-5.6)',
    hnQuery: 'ChatGPT', entityId: 'gpt',
  },
  claude: {
    key: 'claude', name: 'Claude', brand: 'Claude', org: 'Anthropic',
    version: 'Claude Opus 4.8', versionLabel: 'Claude Opus 4.8',
    hnQuery: 'Claude', entityId: 'claude',
  },
  gemini: {
    key: 'gemini', name: 'Gemini', brand: 'Gemini', org: 'Google DeepMind',
    version: 'Gemini 3.5 Pro', versionLabel: 'Gemini 3.5 Pro',
    hnQuery: 'Gemini', entityId: 'gemini',
  },
  grok: {
    key: 'grok', name: 'Grok', brand: 'Grok', org: 'xAI',
    version: 'Grok 4.5', versionLabel: 'Grok 4.5',
    hnQuery: 'Grok', entityId: 'grok',
  },
  llama: {
    key: 'llama', name: 'Llama', brand: 'Llama', org: 'Meta',
    version: 'Llama 4 Maverick', versionLabel: 'Llama 4 Maverick',
    hnQuery: 'Llama', entityId: 'llama',
  },
  deepseek: {
    key: 'deepseek', name: 'DeepSeek', brand: 'DeepSeek', org: 'DeepSeek',
    version: 'DeepSeek V3.2', versionLabel: 'DeepSeek V3.2',
    hnQuery: 'DeepSeek', entityId: 'deepseek',
  },
  qwen: {
    key: 'qwen', name: 'Qwen', brand: 'Qwen', org: 'Alibaba',
    version: 'Qwen 3.7 Max', versionLabel: 'Qwen 3.7 Max',
    hnQuery: 'Qwen', entityId: 'qwen',
  },
};

export const MODEL_KEYS = Object.keys(MODEL_REGISTRY);

export function modelByEntityId(entityId) {
  return Object.values(MODEL_REGISTRY).find((m) => m.entityId === entityId) || null;
}
