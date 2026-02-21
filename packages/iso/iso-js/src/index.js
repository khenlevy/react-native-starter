/**
 * Isomorphic JavaScript Utility Functions
 * 
 * This package contains utility functions that can be used
 * in both client and server environments.
 */

// Re-export math utilities
export {
  geometricMean,
  standardDeviation,
  calculateIQR,
  detectOutliers,
  safeDiv,
  clamp,
  isPositiveNumber,
} from "./math.js";

// Re-export time series utilities
export {
  parseDate,
  sortByDate,
  calculatePercentageChange,
  calculateRollingWindow,
  calculateTTM,
  validateTimeSeriesData,
  calculateCoefficientOfVariation,
  calculateDateIntervals,
  findMostRecentValidPoint,
  findValidPointNPointsAgo,
} from "./timeSeries.js";

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the specified time
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely convert a value to a number, returning null if invalid
 * @param {any} x - Value to convert to number
 * @returns {number|null} Number if valid, null if invalid
 */
export function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Create empty metrics object with null values
 * @returns {Object} Empty metrics object
 */
export function emptyMetrics() {
  return {
    DividendGrowth3Y: null,
    DividendGrowth5Y: null,
    DividendGrowth10Y: null,
    DividendYieldCurrent: null,
  };
}

/**
 * Calculate quantile of a sorted numeric array (0..1). Uses linear interpolation.
 * @param {number[]} sorted - Sorted array of numbers
 * @param {number} q - Quantile (0 to 1)
 * @returns {number|null} Quantile value or null if array is empty
 */
export function quantileSorted(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Build comprehensive statistics for an array of value-weight pairs
 * @param {Array} arr - Array of objects with {v: value, w: weight, s: symbol}
 * @returns {Object} Statistics object with avg, median, wavg, and percentiles
 */
export function buildStats(arr) {
  if (!arr.length) {
    return {
      avg: null,
      median: null,
      wavg: null,
      percentiles: { p10: null, p25: null, p50: null, p75: null, p90: null },
    };
  }
  
  const vals = arr.map((x) => x.v).filter((v) => v != null).sort((a, b) => a - b);
  
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const median = quantileSorted(vals, 0.5);
  
  // Cap-weighted average (normalize zero weights away)
  const totalW = arr.reduce((s, x) => s + (Number(x.w) || 0), 0);
  const wavg =
    totalW > 0
      ? arr.reduce((s, x) => s + (x.v ?? 0) * (Number(x.w) || 0), 0) / totalW
      : avg;
  
  const percentiles = {
    p10: quantileSorted(vals, 0.1),
    p25: quantileSorted(vals, 0.25),
    p50: median,
    p75: quantileSorted(vals, 0.75),
    p90: quantileSorted(vals, 0.9),
  };

  return {
    avg,
    median,
    wavg,
    percentiles,
  };
}
