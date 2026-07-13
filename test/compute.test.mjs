#!/usr/bin/env node
// Unit tests for GPU pricing merge/trend logic. Run: node --test test/compute.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { GPU_CATALOG, mergeGpuPricing, formatRate, computeTrend } from '../scripts/lib/compute.mjs';

test('GPU_CATALOG has 6 tracked chips, each with both marketplace name lists', () => {
  assert.equal(GPU_CATALOG.length, 6);
  for (const c of GPU_CATALOG) {
    assert.ok(c.chip && c.segment);
    assert.ok(Array.isArray(c.vastNames) && c.vastNames.length > 0);
    assert.ok(Array.isArray(c.runpodIds) && c.runpodIds.length > 0);
  }
});

test('mergeGpuPricing merges real offers from both marketplaces into one range', () => {
  const h100 = GPU_CATALOG.find((c) => c.chip.startsWith('H100'));
  const vastOffers = [
    { gpu_name: 'H100 SXM', num_gpus: 1, dph_total: 2.10 },
    { gpu_name: 'H100 PCIE', num_gpus: 2, dph_total: 4.00 }, // per-GPU = 2.00
    { gpu_name: 'A100 SXM', num_gpus: 1, dph_total: 0.90 }, // different chip, must be ignored
  ];
  const runpodTypes = [
    { id: 'NVIDIA H100 80GB HBM3', communityPrice: 2.69, securePrice: 2.99 },
  ];
  const r = mergeGpuPricing(h100, vastOffers, runpodTypes);
  assert.equal(r.low, 2.00);
  assert.equal(r.high, 2.99);
  assert.equal(r.sampleSize, 4);
});

test('mergeGpuPricing divides multi-GPU Vast.ai bundles down to a per-GPU rate', () => {
  const b200 = GPU_CATALOG.find((c) => c.chip.startsWith('B200'));
  const r = mergeGpuPricing(b200, [{ gpu_name: 'B200', num_gpus: 4, dph_total: 24 }], []);
  assert.equal(r.low, 6); // 24 / 4, not the raw bundle total
  assert.equal(r.high, 6);
});

test('mergeGpuPricing treats $0 and implausibly-low prices as "no current offer", not a real rate', () => {
  const a100 = GPU_CATALOG.find((c) => c.chip.startsWith('A100'));
  const r = mergeGpuPricing(a100, [], [
    { id: 'NVIDIA A100-SXM4-40GB', communityPrice: 1.00, securePrice: 0 }, // secure=0 is a real placeholder seen live
  ]);
  assert.equal(r.low, 1.00);
  assert.equal(r.high, 1.00); // the $0 must not drag the range down to 0
});

test('mergeGpuPricing excludes RunPod\'s $0.50 placeholder price — confirmed live to recur identically across unrelated GPU types', () => {
  const h200 = GPU_CATALOG.find((c) => c.chip.startsWith('H200'));
  const r = mergeGpuPricing(h200, [], [
    { id: 'NVIDIA H200', communityPrice: 3.59, securePrice: 4.39 },
    { id: 'NVIDIA H200 NVL', communityPrice: 0.5, securePrice: 3.79 }, // 0.5 is the placeholder, not a real rate
  ]);
  assert.equal(r.low, 3.59);
  assert.equal(r.high, 4.39);
  assert.equal(r.sampleSize, 3, 'the placeholder 0.5 must be excluded from the sample');
});

test('mergeGpuPricing returns null (not a fabricated fallback) when neither marketplace lists the chip', () => {
  const mi300x = GPU_CATALOG.find((c) => c.chip.startsWith('MI300X'));
  assert.equal(mergeGpuPricing(mi300x, [], []), null);
});

test('mergeGpuPricing never matches an unrelated chip\'s offers', () => {
  const b300 = GPU_CATALOG.find((c) => c.chip.startsWith('B300'));
  // the MIG fractional-instance variant must not be matched to full B300 pricing
  const r = mergeGpuPricing(b300, [], [
    { id: 'NVIDIA B300 SXM6 AC MIG 1g.34gb', communityPrice: 0.50, securePrice: 0.50 },
  ]);
  assert.equal(r, null);
});

test('formatRate renders a range, or a single price when low === high', () => {
  assert.equal(formatRate(1.99, 2.89), '$1.99 – $2.89/hr');
  assert.equal(formatRate(5.98, 5.985), '$5.98/hr');
});

test('computeTrend: fewer than 2 snapshots is honestly "New", never a fabricated percentage', () => {
  const r0 = computeTrend([]);
  assert.equal(r0.trendClass, 'trend-new');
  assert.equal(r0.changePct, null);
  const r1 = computeTrend([{ date: '2026-07-01', mid: 2.5 }]);
  assert.equal(r1.trendClass, 'trend-new');
});

test('computeTrend: real percentage change vs the closest snapshot at or before the lookback window', () => {
  const history = [
    { date: '2026-07-01', mid: 2.00 },
    { date: '2026-07-08', mid: 2.30 }, // +15% over 7 days
  ];
  const r = computeTrend(history, 7);
  assert.equal(r.trendClass, 'trend-up');
  assert.ok(r.changePct > 14 && r.changePct < 16);
  assert.match(r.trend, /↑ 15% vs 7d ago/);
});

test('computeTrend: small moves stay inside the dead-band and read as flat, not up/down', () => {
  const history = [
    { date: '2026-07-01', mid: 2.00 },
    { date: '2026-07-08', mid: 2.02 }, // +1%, inside the ±3% dead-band
  ];
  const r = computeTrend(history, 7);
  assert.equal(r.trendClass, 'trend-flat');
});

test('computeTrend: a real price drop reads as trend-down', () => {
  const history = [
    { date: '2026-07-01', mid: 3.00 },
    { date: '2026-07-08', mid: 2.55 }, // -15%
  ];
  const r = computeTrend(history, 7);
  assert.equal(r.trendClass, 'trend-down');
  assert.match(r.trend, /↓ 15%/);
});
