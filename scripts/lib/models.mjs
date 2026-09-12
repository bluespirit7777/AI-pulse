// Canonical model registry — the single source of truth for each tracked
// model family's display name, organization and CURRENT flagship version.
// Pure data, no I/O, importable directly from both build-time Node scripts
// (scripts/update-data.mjs) and browser ES modules (js/*.js) exactly like
// scripts/lib/signals.mjs already is — no bundler, no framework.
//
// Before this existed, model versions in entities.json, the curated
// leaderboard, and Community Pulse could drift apart; this registry keeps
// those surfaces synchronized.
//
// `brand` is the consumer-facing PRODUCT name where it differs from the
// model FAMILY name (the GPT family ships as the ChatGPT product) — Frontier
// Releases uses `brand`; everywhere else uses `name`.

export const MODEL_REGISTRY = {
  gpt: {
    key: 'gpt', name: 'GPT', brand: 'ChatGPT', org: 'OpenAI',
    version: 'GPT-6 Astra', versionLabel: 'GPT-6 Astra',
    hnQuery: 'ChatGPT', ytQuery: 'ChatGPT', entityId: 'gpt',
  },
  claude: {
    key: 'claude', name: 'Claude', brand: 'Claude', org: 'Anthropic',
    version: 'Claude Fable 5.1', versionLabel: 'Claude Fable 5.1',
    hnQuery: 'Claude', ytQuery: 'Claude AI', entityId: 'claude',
  },
  gemini: {
    key: 'gemini', name: 'Gemini', brand: 'Gemini', org: 'Google DeepMind',
    version: 'Gemini 3.1 Pro Preview', versionLabel: 'Gemini 3.1 Pro Preview',
    hnQuery: 'Gemini', ytQuery: 'Gemini AI', entityId: 'gemini',
  },
  grok: {
    key: 'grok', name: 'Grok', brand: 'Grok', org: 'xAI',
    version: 'Grok 4.6', versionLabel: 'Grok 4.6',
    hnQuery: 'Grok', entityId: 'grok',
  },
  llama: {
    key: 'llama', name: 'Llama', brand: 'Llama', org: 'Meta',
    version: 'Llama 4 Maverick', versionLabel: 'Llama 4 Maverick',
    hnQuery: 'Llama', entityId: 'llama',
  },
  deepseek: {
    key: 'deepseek', name: 'DeepSeek', brand: 'DeepSeek', org: 'DeepSeek',
    version: 'DeepSeek V4.1 Flash', versionLabel: 'DeepSeek V4.1 Flash',
    hnQuery: 'DeepSeek', entityId: 'deepseek',
  },
  qwen: {
    key: 'qwen', name: 'Qwen', brand: 'Qwen', org: 'Alibaba',
    version: 'Qwen3.8 Max', versionLabel: 'Qwen3.8 Max',
    hnQuery: 'Qwen', entityId: 'qwen',
  },
};

export const MODEL_KEYS = Object.keys(MODEL_REGISTRY);

export function modelByEntityId(entityId) {
  return Object.values(MODEL_REGISTRY).find((m) => m.entityId === entityId) || null;
}
