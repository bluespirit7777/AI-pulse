import { isProductRelease, normalizeTitle } from './signals.mjs';
// Deliberately narrow event identity: bare model announcements only.
// Feature qualifiers must survive (e.g. voice vs images for the same model).
export function releaseIdentity(title, day = '') {
  const clean = normalizeTitle(title).replace(/^(introducing|anthropic releases new model|openai releases new model|google releases new model)\s+/, '').replace(/^claude\s+(?=opus|sonnet|haiku)/, '');
  const bare = /^(opus|sonnet|haiku) \d+(?: \d+)?$|^gpt \d+(?: \d+)?$|^gemini \d+(?: \d+)? (pro|flash)$/;
  return `${day}:${bare.test(clean) ? clean : normalizeTitle(title)}`;
}
export function cleanReleases(items, titleKey = 'h', dateKey = 'd') {
  const seen = new Set();
  return items.filter(item => {
    if (!isProductRelease(item[titleKey], item.desc || '')) return false;
    const date = String(item[dateKey] || '');
    const key = releaseIdentity(item[titleKey], date.includes('T') ? date.slice(0,10) : date);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
