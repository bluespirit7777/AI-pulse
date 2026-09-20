import { marketShare, CURATED_ASOF } from './curated.js';
export const adoptionMetric = {
  metricId: 'chatbot-referrals', label: 'AI chatbot referral share', unit: '%',
  definition: 'Share of referrals from AI chatbots to websites in the Statcounter sample.',
  sourceName: 'Statcounter', sourceUrl: 'https://gs.statcounter.com/ai-chatbot-market-share#monthly-202608-202608-bar',
  period: 'August 2026 · worldwide', updatedAt: CURATED_ASOF, method: 'curated',
  limitations: 'This measures outgoing referrals, not chatbot users, total conversations, or answer quality.',
};
export function formatShare(n) { return n > 0 && n < 0.1 ? '<0.1%' : `${Number(n.toFixed(2))}%`; }
export function adoptionSummary(rows = marketShare) {
  const top = [...rows].sort((a,b) => b.pct-a.pct)[0];
  return top ? `${top.name} accounts for ${formatShare(top.pct)} of the chatbot referrals in this snapshot.` : 'No referral data available.';
}
export function snapshotLabel(value, now = Date.now()) {
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return 'Update time unavailable';
  const date = new Date(at).toLocaleString('en-GB', { timeZone:'UTC', day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit' });
  return `${now - at > 36e5 * 2 ? 'Older snapshot' : 'Updated'} · ${date} UTC`;
}
