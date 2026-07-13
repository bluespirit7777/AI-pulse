// Shared, pure, deterministic GPU-pricing logic — imported by
// scripts/update-data.mjs (build time) and test/compute.test.mjs. No I/O.
//
// Matches live marketplace offers (Vast.ai + RunPod) to our tracked chip
// catalog, merges them into a real low/high $/hr range, and computes a real
// trend from a small rolling snapshot history — never a fabricated "vs 2023
// peak" narrative with no way to verify or refresh it.

// `segment` is curated CLASSIFICATION (what the chip is typically used for),
// not a price — the kind of context that doesn't go stale the way a dollar
// figure does. vastNames/runpodIds are the exact identifiers each API uses
// for that chip, confirmed against live API responses.
export const GPU_CATALOG = [
  { chip: 'H100 (Hopper)', segment: 'Mainstream training/inference',
    vastNames: ['H100 SXM', 'H100 PCIE', 'H100 NVL'],
    runpodIds: ['NVIDIA H100 80GB HBM3', 'NVIDIA H100 PCIe', 'NVIDIA H100 NVL'] },
  { chip: 'H200 (Hopper)', segment: 'Inference / long context',
    vastNames: ['H200', 'H200 NVL'],
    runpodIds: ['NVIDIA H200', 'NVIDIA H200 NVL'] },
  { chip: 'B200 (Blackwell)', segment: 'Frontier training',
    vastNames: ['B200'],
    runpodIds: ['NVIDIA B200'] },
  { chip: 'B300 (Blackwell Ultra)', segment: 'Frontier training',
    vastNames: ['B300'],
    // deliberately excludes the "...MIG 1g.34gb" fractional-instance variant —
    // that's a slice of a card, not comparable to a full-GPU rental rate.
    runpodIds: ['NVIDIA B300 SXM6 AC'] },
  { chip: 'MI300X (AMD)', segment: 'Nvidia alternative',
    vastNames: ['MI300X'],
    runpodIds: ['AMD Instinct MI300X OAM'] },
  { chip: 'A100 (legacy)', segment: 'Budget / fine-tuning',
    vastNames: ['A100 PCIE', 'A100 SXM4', 'A100 SXM'],
    runpodIds: ['NVIDIA A100 80GB PCIe', 'NVIDIA A100-SXM4-40GB', 'NVIDIA A100-SXM4-80GB'] },
];

// Prices at or below this are RunPod/Vast.ai's placeholder for "no current
// inventory in this tier" rather than a real rate — confirmed against a live
// RunPod response where exactly $0 AND exactly $0.50 each recur identically
// across more than a dozen otherwise-unrelated GPU types (a GTX 1050 and an
// H200 NVL do not really rent for the same $0.50/hr). Both are excluded, not
// just $0.
const MIN_PLAUSIBLE_RATE = 0.15;
const RUNPOD_PLACEHOLDER_PRICE = 0.5;

function isRealRunpodPrice(p) {
  return p != null && p > MIN_PLAUSIBLE_RATE && p !== RUNPOD_PLACEHOLDER_PRICE;
}

// vastOffers: raw Vast.ai bundle offers ({gpu_name, num_gpus, dph_total}).
// runpodTypes: raw RunPod gpuTypes ({id, communityPrice, securePrice}).
// Returns null when neither source currently lists this chip (never a
// fabricated/carried-over price) — the caller decides how to handle that.
export function mergeGpuPricing(catalogEntry, vastOffers, runpodTypes) {
  const prices = [];
  for (const o of vastOffers || []) {
    if (catalogEntry.vastNames.includes(o.gpu_name)) {
      const perGpu = o.dph_total / (o.num_gpus || 1);
      if (perGpu > MIN_PLAUSIBLE_RATE) prices.push(perGpu);
    }
  }
  for (const t of runpodTypes || []) {
    if (catalogEntry.runpodIds.includes(t.id)) {
      if (isRealRunpodPrice(t.communityPrice)) prices.push(t.communityPrice);
      if (isRealRunpodPrice(t.securePrice)) prices.push(t.securePrice);
    }
  }
  if (!prices.length) return null;
  return { low: Math.min(...prices), high: Math.max(...prices), sampleSize: prices.length };
}

export function formatRate(low, high) {
  const fmt = (n) => '$' + n.toFixed(2);
  if (Math.abs(high - low) < 0.01) return `${fmt(low)}/hr`;
  return `${fmt(low)} – ${fmt(high)}/hr`;
}

// Real day-over-day trend from a rolling snapshot history, in the same spirit
// as range.json's previousWindowComplete gating: no comparison point yet →
// say so honestly ("New"), never synthesize a "vs 2023 peak" narrative that
// can't be verified or refreshed. Dead-band mirrors stocks.mjs's direction().
export function computeTrend(history, lookbackDays = 7) {
  if (!history || history.length < 2) {
    return { trend: 'New — building history', trendClass: 'trend-new', changePct: null };
  }
  const latest = history[history.length - 1];
  const targetMs = new Date(latest.date).getTime() - lookbackDays * 86400000;
  let compare = history[0];
  for (let i = history.length - 2; i >= 0; i--) {
    if (new Date(history[i].date).getTime() <= targetMs) { compare = history[i]; break; }
  }
  if (compare === latest) {
    return { trend: 'New — building history', trendClass: 'trend-new', changePct: null };
  }
  const changePct = ((latest.mid - compare.mid) / compare.mid) * 100;
  const days = Math.max(1, Math.round((new Date(latest.date) - new Date(compare.date)) / 86400000));
  let trendClass = 'trend-flat', arrow = '→';
  if (changePct > 3) { trendClass = 'trend-up'; arrow = '↑'; }
  else if (changePct < -3) { trendClass = 'trend-down'; arrow = '↓'; }
  return { trend: `${arrow} ${Math.abs(changePct).toFixed(0)}% vs ${days}d ago`, trendClass, changePct };
}
