/**
 * Utility math helpers for valuation calculations.
 */

export function clamp(value, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(value)) return value;
  return Math.max(min, Math.min(max, value));
}

export function sum(values = []) {
  return values.reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0);
}

export function average(values = []) {
  const filtered = values.filter(Number.isFinite);
  if (filtered.length === 0) {
    return 0;
  }
  return sum(filtered) / filtered.length;
}

export function safeDiv(numerator, denominator, defaultValue = 0) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < Number.EPSILON) {
    return defaultValue;
  }
  return num / den;
}

export function geometricMean(values = [], defaultValue = null) {
  const filtered = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (filtered.length === 0) {
    return defaultValue;
  }

  const logSum = filtered.reduce((acc, value) => acc + Math.log(value), 0);
  return Math.exp(logSum / filtered.length);
}

/**
 * Returns the trimmed mean of an array.
 * @param {number[]} values
 * @param {number} trimFraction value between 0 and 0.5
 */
export function trimmedMean(values = [], trimFraction = 0.1) {
  const filtered = values.filter(Number.isFinite);
  if (filtered.length === 0) {
    return 0;
  }

  const fraction = clamp(trimFraction, 0, 0.49);
  const sorted = [...filtered].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * fraction);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);

  if (trimmed.length === 0) {
    return average(sorted);
  }

  return average(trimmed);
}

export function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

export function standardDeviation(values = []) {
  const filtered = values.filter(Number.isFinite);
  if (filtered.length === 0) {
    return 0;
  }
  const mean = average(filtered);
  const variance = filtered.reduce((acc, val) => acc + (val - mean) ** 2, 0) / filtered.length;
  return Math.sqrt(variance);
}
