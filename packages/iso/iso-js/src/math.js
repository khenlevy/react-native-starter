/**
 * Mathematical utility functions for isomorphic use
 */

/**
 * Calculate geometric mean of an array of positive numbers
 * @param {number[]} values - Array of positive numbers
 * @param {number|null} defaultValue - Default value if array is empty or contains no positive numbers
 * @returns {number|null} Geometric mean or defaultValue
 */
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
 * Calculate standard deviation of an array of numbers
 * @param {number[]} values - Array of numbers
 * @returns {number} Standard deviation (0 if array is empty)
 */
export function standardDeviation(values = []) {
  const filtered = values.filter((v) => Number.isFinite(v));
  if (filtered.length === 0) {
    return 0;
  }

  const mean = filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
  const variance =
    filtered.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / filtered.length;
  return Math.sqrt(variance);
}

/**
 * Calculate quartiles (Q1, Q3) and IQR for outlier detection
 * @param {number[]} sortedArray - Sorted array of numbers
 * @returns {Object|null} Object with q1, q3, iqr, lowerBound, upperBound or null if invalid
 */
export function calculateIQR(sortedArray) {
  if (!Array.isArray(sortedArray) || sortedArray.length === 0) {
    return null;
  }

  const n = sortedArray.length;
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sortedArray[q1Index];
  const q3 = sortedArray[q3Index];
  const iqr = q3 - q1;

  if (iqr <= 0 || !Number.isFinite(q1) || !Number.isFinite(q3)) {
    return null;
  }

  return {
    q1,
    q3,
    iqr,
    lowerBound: q1 - 1.5 * iqr,
    upperBound: q3 + 1.5 * iqr,
  };
}

/**
 * Detect outliers using IQR method
 * @param {number[]} values - Array of numbers
 * @returns {Object} Object with {values: cleaned array, outliers: array of outlier indices, stats: IQR stats}
 */
export function detectOutliers(values = []) {
  const validValues = values
    .map((v, i) => ({ value: Number(v), index: i }))
    .filter((item) => Number.isFinite(item.value));

  if (validValues.length < 4) {
    return {
      values: validValues.map((item) => item.value),
      outliers: [],
      stats: null,
    };
  }

  const sorted = [...validValues].sort((a, b) => a.value - b.value);
  const sortedValues = sorted.map((item) => item.value);
  const iqrStats = calculateIQR(sortedValues);

  if (!iqrStats) {
    return {
      values: validValues.map((item) => item.value),
      outliers: [],
      stats: null,
    };
  }

  const outliers = [];
  validValues.forEach((item) => {
    if (item.value < iqrStats.lowerBound || item.value > iqrStats.upperBound) {
      outliers.push(item.index);
    }
  });

  return {
    values: validValues.map((item) => item.value),
    outliers,
    stats: iqrStats,
  };
}

/**
 * Safe division with default value
 * @param {number} numerator - Numerator
 * @param {number} denominator - Denominator
 * @param {number} defaultValue - Default value if division is invalid
 * @returns {number} Result of division or defaultValue
 */
export function safeDiv(numerator, denominator, defaultValue = 0) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < Number.EPSILON) {
    return defaultValue;
  }
  return num / den;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min = -Infinity, max = Infinity) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return Math.max(min, Math.min(max, num));
}

/**
 * Check if a value is a positive finite number
 * @param {any} value - Value to check
 * @returns {boolean} True if value is positive and finite
 */
export function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

