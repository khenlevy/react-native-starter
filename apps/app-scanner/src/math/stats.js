// Generic math/stat helpers
import { quantileSorted } from "@buydy/iso-js";

export const clamp = (x, min = -1, max = 1) => Math.max(min, Math.min(max, x));
export const safe = (v, def = 0) => (Number.isFinite(v) ? v : def);

export function mean(arr) {
  if (!arr?.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stddev(arr) {
  if (!arr?.length) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) * (x - m)));
  return Math.sqrt(v);
}

export function zscore(x, arr) {
  if (!arr?.length) return 0;
  const m = mean(arr);
  const s = stddev(arr) || 1e-9;
  return (x - m) / s;
}

export function slope(arr) {
  const n = arr.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = mean(arr);
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (arr[i] - meanY);
    den += (i - meanX) * (i - meanX);
  }
  return den ? num / den : 0;
}

export function normalizeCenter(x, center = 0, scale = 1, limit = 3) {
  const z = (x - center) / (scale || 1e-9);
  return clamp(z / limit);
}

/**
 * Calculate median of an array
 * @param {number[]} arr - Array of numbers
 * @returns {number|null} Median value or null if array is empty
 */
export function median(arr) {
  if (!arr?.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return quantileSorted(sorted, 0.5);
}

/**
 * Calculate percentiles (p10, p25, p50, p75, p90) of an array
 * @param {number[]} arr - Array of numbers
 * @returns {Object} Object with percentile values
 */
export function percentiles(arr) {
  if (!arr?.length) {
    return { p10: null, p25: null, p50: null, p75: null, p90: null };
  }
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    p10: quantileSorted(sorted, 0.1),
    p25: quantileSorted(sorted, 0.25),
    p50: quantileSorted(sorted, 0.5),
    p75: quantileSorted(sorted, 0.75),
    p90: quantileSorted(sorted, 0.9),
  };
}

/**
 * Calculate weighted average
 * @param {Array} arr - Array of objects with value (v) and weight (w)
 * @returns {number|null} Weighted average or null if no valid data
 */
export function weightedAverage(arr) {
  if (!arr?.length) return null;

  const totalWeight = arr.reduce((sum, item) => sum + (Number(item.w) || 0), 0);
  if (totalWeight === 0) return null;

  const weightedSum = arr.reduce((sum, item) => {
    const value = Number(item.v) || 0;
    const weight = Number(item.w) || 0;
    return sum + value * weight;
  }, 0);

  return weightedSum / totalWeight;
}

/**
 * Aggregate industry metrics from a group of items
 * @param {Object} group - Group object with industry and items array
 * @returns {Object} Aggregated industry metrics
 */
export function aggregateIndustry(group) {
  const items = group.items || [];

  // Extract arrays per metric
  const mcap = items.map((x) => Number(x.marketCap) || 0);

  const arrYield = items
    .map((x) => ({ v: x.metrics.DividendYieldCurrent, w: x.marketCap, s: x.symbol }))
    .filter((x) => x.v != null);

  const arrG3 = items
    .map((x) => ({ v: x.metrics.DividendGrowth3Y, w: x.marketCap, s: x.symbol }))
    .filter((x) => x.v != null);

  const arrG5 = items
    .map((x) => ({ v: x.metrics.DividendGrowth5Y, w: x.marketCap, s: x.symbol }))
    .filter((x) => x.v != null);

  const arrG10 = items
    .map((x) => ({ v: x.metrics.DividendGrowth10Y, w: x.marketCap, s: x.symbol }))
    .filter((x) => x.v != null);

  // Helper function to build statistics for an array of values
  const buildStats = (arr) => {
    if (arr.length === 0) {
      return { avg: null, min: null, max: null, median: null };
    }

    const values = arr.map((item) => item.v).sort((a, b) => a - b);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = values[0];
    const max = values[values.length - 1];
    const median =
      values.length % 2 === 0
        ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
        : values[Math.floor(values.length / 2)];

    return { avg, min, max, median };
  };

  // Stats per metric
  const yieldStats = buildStats(arrYield);
  const g3Stats = buildStats(arrG3);
  const g5Stats = buildStats(arrG5);
  const g10Stats = buildStats(arrG10);

  // Top lists (limit to 20 to keep docs compact)
  const TOPN = 20;
  const topByYield = arrYield
    .slice()
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
    .slice(0, TOPN)
    .map(({ s, v }) => ({ symbol: s, value: v }));

  const topByG5 = arrG5
    .slice()
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
    .slice(0, TOPN)
    .map(({ s, v }) => ({ symbol: s, value: v }));

  const topByG10 = arrG10
    .slice()
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
    .slice(0, TOPN)
    .map(({ s, v }) => ({ symbol: s, value: v }));

  // Counts
  const counts = {
    total: items.length,
    withYield: arrYield.length,
    withGrowth3Y: arrG3.length,
    withGrowth5Y: arrG5.length,
    withGrowth10Y: arrG10.length,
  };

  // Totals (for reference)
  const totalMarketCap = mcap.reduce((a, b) => a + b, 0);

  return {
    industry: group.industry,
    counts,
    totals: { totalMarketCap },

    averages: {
      DividendYieldCurrent: yieldStats.avg,
      DividendGrowth3Y: g3Stats.avg,
      DividendGrowth5Y: g5Stats.avg,
      DividendGrowth10Y: g10Stats.avg,
    },

    medians: {
      DividendYieldCurrent: yieldStats.median,
      DividendGrowth3Y: g3Stats.median,
      DividendGrowth5Y: g5Stats.median,
      DividendGrowth10Y: g10Stats.median,
    },

    capWeightedAverages: {
      DividendYieldCurrent: yieldStats.wavg,
      DividendGrowth3Y: g3Stats.wavg,
      DividendGrowth5Y: g5Stats.wavg,
      DividendGrowth10Y: g10Stats.wavg,
    },

    percentiles: {
      DividendYieldCurrent: yieldStats.percentiles,
      DividendGrowth3Y: g3Stats.percentiles,
      DividendGrowth5Y: g5Stats.percentiles,
      DividendGrowth10Y: g10Stats.percentiles,
    },

    leaders: {
      byDividendYield: topByYield,
      byDivGrowth5Y: topByG5,
      byDivGrowth10Y: topByG10,
    },

    lastCalculated: new Date(),
  };
}
