/**
 * Dividend Utilities
 *
 * Enhanced utilities for cleaning, validating, and analyzing dividend data
 */

import {
  detectOutliers,
  safeDiv,
  clamp,
  isPositiveNumber,
  calculateTTM,
  calculateCoefficientOfVariation,
  calculateDateIntervals,
  sortByDate,
  parseDate,
} from "@buydy/iso-js";

/**
 * Enhanced dividend history cleaning with better special dividend detection and outlier handling
 * @param {Array} history - Raw dividend history array from API
 * @param {Object} options - Cleaning options
 * @param {boolean} options.removeSpecials - Remove special dividends (default: true)
 * @param {boolean} options.removeOutliers - Remove outliers using IQR (default: true)
 * @param {boolean} options.useAdjustedValues - Prefer adjusted values when available (default: true)
 * @returns {Object} Object with {cleaned: array, stats: object, flags: object}
 */
export function cleanDividendHistory(history = [], options = {}) {
  const { removeSpecials = true, removeOutliers = true, useAdjustedValues = true } = options;

  if (!Array.isArray(history) || history.length === 0) {
    return {
      cleaned: [],
      stats: {
        originalCount: 0,
        removedSpecials: 0,
        removedOutliers: 0,
        removedInvalid: 0,
        finalCount: 0,
      },
      flags: {
        hasSpecials: false,
        hasOutliers: false,
        hasCurrencyMismatch: false,
      },
    };
  }

  const seen = new Set();
  const cleaned = [];
  let removedSpecials = 0;
  let removedInvalid = 0;
  const values = [];

  // First pass: clean and collect values
  for (const d of history) {
    // Parse date using shared function
    const date = parseDate(d?.date ?? d?.Date ?? d);
    if (!date) {
      removedInvalid++;
      continue;
    }

    const dateKey = date.toISOString().slice(0, 10);

    // Check for duplicates (by date + value to catch true duplicates)
    const val = Number(d?.value ?? d?.Value ?? 0);
    const adjustedVal =
      useAdjustedValues && Number.isFinite(d?.adjustedValue) ? Number(d.adjustedValue) : val;
    const finalValue = useAdjustedValues && Number.isFinite(adjustedVal) ? adjustedVal : val;

    const duplicateKey = `${dateKey}_${finalValue}`;
    if (seen.has(duplicateKey)) {
      removedInvalid++;
      continue;
    }
    seen.add(duplicateKey);

    // Check for special dividends (expanded detection)
    if (removeSpecials) {
      const period = String(d?.period || d?.Period || "").toLowerCase();
      const isSpecial =
        period.includes("special") ||
        period.includes("extra") ||
        period.includes("one-time") ||
        period.includes("onetime") ||
        period.includes("extraordinary") ||
        (d?.type && String(d.type).toLowerCase().includes("special")) ||
        (d?.Type && String(d.Type).toLowerCase().includes("special"));

      if (isSpecial) {
        removedSpecials++;
        continue;
      }
    }

    // Validate value
    if (!Number.isFinite(finalValue) || finalValue <= 0) {
      removedInvalid++;
      continue;
    }

    // Verify stock split adjustment consistency
    let splitAdjustmentFlagged = false;
    if (Number.isFinite(d?.unadjustedValue) && Number.isFinite(d?.adjustedValue)) {
      const unadj = Number(d.unadjustedValue);
      const adj = Number(d.adjustedValue);
      if (unadj > 0 && adj > 0) {
        const ratio = safeDiv(adj, unadj, 1);
        // Flag if adjustment ratio is extreme (>2x or <0.5x) - likely indicates data issue
        if (ratio > 2 || ratio < 0.5) {
          splitAdjustmentFlagged = true;
        }
      }
    }

    // Store cleaned entry
    cleaned.push({
      date: dateKey,
      value: finalValue,
      period: d?.period || d?.Period || null,
      currency: d?.currency || d?.Currency || null,
      unadjustedValue: Number.isFinite(d?.unadjustedValue) ? d.unadjustedValue : null,
      adjustedValue: Number.isFinite(d?.adjustedValue) ? d.adjustedValue : null,
      splitAdjustmentFlagged: splitAdjustmentFlagged,
    });

    values.push(finalValue);
  }

  // Sort by date using shared function
  const sortedCleaned = sortByDate(cleaned, "date", true);
  cleaned.length = 0;
  cleaned.push(...sortedCleaned);

  // Outlier detection
  let removedOutliers = 0;
  let hasOutliers = false;
  if (removeOutliers && values.length >= 4) {
    const outlierResult = detectOutliers(values);
    if (outlierResult.outliers.length > 0) {
      hasOutliers = true;
      // Remove outliers from cleaned array (in reverse order to maintain indices)
      const outlierIndices = new Set(outlierResult.outliers);
      for (let i = cleaned.length - 1; i >= 0; i--) {
        if (outlierIndices.has(i)) {
          cleaned.splice(i, 1);
          removedOutliers++;
        }
      }
    }
  }

  return {
    cleaned,
    stats: {
      originalCount: history.length,
      removedSpecials,
      removedOutliers,
      removedInvalid,
      finalCount: cleaned.length,
    },
    flags: {
      hasSpecials: removedSpecials > 0,
      hasOutliers: hasOutliers,
      hasCurrencyMismatch: false, // Will be checked separately
    },
  };
}

/**
 * Calculate trailing twelve months (TTM) dividends using rolling window from most recent dividend
 * @param {Array} history - Cleaned dividend history array (sorted by date, most recent first)
 * @returns {number} TTM dividend amount
 */
export function calculateTTMDividends(history = []) {
  // Use shared TTM calculation function
  return calculateTTM(history, {
    dateKey: "date",
    valueKey: "value",
    months: 12,
  });
}

/**
 * Calculate dividend yield from history vs API yield
 * @param {number} ttmDividends - TTM dividends from history
 * @param {number} currentPrice - Current stock price
 * @returns {number|null} Calculated dividend yield or null if invalid
 */
export function calculateDividendYield(ttmDividends, currentPrice) {
  if (!isPositiveNumber(currentPrice) || !isPositiveNumber(ttmDividends)) {
    return null;
  }
  return safeDiv(ttmDividends, currentPrice, null);
}

/**
 * Validate API dividend yield against calculated yield
 * @param {number|null} apiYield - Dividend yield from API
 * @param {number|null} calculatedYield - Calculated yield from history
 * @param {number} tolerance - Maximum allowed difference (default: 0.05 = 5%)
 * @returns {Object} Validation result with {isValid: boolean, difference: number, reason: string}
 */
export function validateDividendYield(apiYield, calculatedYield, tolerance = 0.05) {
  if (apiYield === null && calculatedYield === null) {
    return { isValid: true, difference: 0, reason: "Both null" };
  }

  if (apiYield === null) {
    return { isValid: true, difference: null, reason: "API yield missing, using calculated" };
  }

  if (calculatedYield === null) {
    return { isValid: true, difference: null, reason: "Calculated yield missing, using API" };
  }

  const difference = Math.abs(apiYield - calculatedYield);
  const isValid = difference <= tolerance;

  return {
    isValid,
    difference,
    reason: isValid
      ? "Within tolerance"
      : `Difference ${(difference * 100).toFixed(2)}% exceeds tolerance ${(tolerance * 100).toFixed(
          2
        )}%`,
  };
}

/**
 * Analyze dividend payment frequency
 * @param {Array} history - Cleaned dividend history array
 * @returns {Object} Frequency analysis with {frequency: string, averageDaysBetween: number, isRegular: boolean}
 */
export function analyzeDividendFrequency(history = []) {
  if (!Array.isArray(history) || history.length < 2) {
    return {
      frequency: "unknown",
      averageDaysBetween: null,
      isRegular: false,
    };
  }

  // Use shared function to calculate date intervals
  const intervals = calculateDateIntervals(history, "date", {
    minDays: 0,
    maxDays: 400, // Reasonable range (0-400 days)
  });

  if (intervals.length === 0) {
    return {
      frequency: "irregular",
      averageDaysBetween: null,
      isRegular: false,
    };
  }

  const avgDays = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const coefficientOfVariation = calculateCoefficientOfVariation(intervals);

  // Determine frequency
  let frequency = "irregular";
  if (avgDays >= 85 && avgDays <= 95) {
    frequency = "quarterly";
  } else if (avgDays >= 175 && avgDays <= 185) {
    frequency = "semi-annual";
  } else if (avgDays >= 360 && avgDays <= 370) {
    frequency = "annual";
  }

  // Regular if coefficient of variation < 0.2 (20%)
  const isRegular = coefficientOfVariation !== null && coefficientOfVariation < 0.2;

  return {
    frequency,
    averageDaysBetween: avgDays,
    isRegular,
    coefficientOfVariation: coefficientOfVariation ?? Infinity,
  };
}

/**
 * Detect dividend cuts and suspensions
 * @param {Array} history - Cleaned dividend history array (sorted by date)
 * @returns {Object} Analysis with {hasCuts: boolean, hasSuspension: boolean, consecutiveZeros: number, cuts: array}
 */
export function detectDividendIssues(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      hasCuts: false,
      hasSuspension: false,
      consecutiveZeros: 0,
      cuts: [],
    };
  }

  // Use shared sortByDate function
  // Note: Don't filter out zero values here - we need them to detect suspensions
  const sorted = sortByDate(
    history.map((d) => ({
      date: d.date,
      value: Number(d.value) || 0,
    })),
    "date",
    true
  );

  if (sorted.length < 2) {
    return {
      hasCuts: false,
      hasSuspension: sorted.length === 1 && sorted[0].value === 0,
      consecutiveZeros: sorted.length === 1 && sorted[0].value === 0 ? 1 : 0,
      cuts: [],
    };
  }

  const cuts = [];
  let consecutiveZeros = 0;
  let maxConsecutiveZeros = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];

    // Track consecutive zeros
    if (current.value === 0) {
      consecutiveZeros++;
      maxConsecutiveZeros = Math.max(maxConsecutiveZeros, consecutiveZeros);
    } else {
      consecutiveZeros = 0;
    }

    // Detect cuts (decrease > 20%)
    if (prev.value > 0 && current.value > 0) {
      const change = safeDiv(current.value, prev.value, 1) - 1;
      if (change < -0.2) {
        // Cut of more than 20%
        cuts.push({
          date: current.date.toISOString().slice(0, 10),
          previousValue: prev.value,
          currentValue: current.value,
          changePercent: change * 100,
        });
      }
    } else if (prev.value > 0 && current.value === 0) {
      // Suspension
      cuts.push({
        date: current.date.toISOString().slice(0, 10),
        previousValue: prev.value,
        currentValue: 0,
        changePercent: -100,
        isSuspension: true,
      });
    }
  }

  return {
    hasCuts: cuts.length > 0,
    hasSuspension: maxConsecutiveZeros >= 2, // 2+ consecutive zeros = suspension
    consecutiveZeros: maxConsecutiveZeros,
    cuts,
  };
}

/**
 * Build data quality flags for dividend data
 * @param {Object} cleanedResult - Result from cleanDividendHistory
 * @param {Object} frequencyAnalysis - Result from analyzeDividendFrequency
 * @param {Object} issueAnalysis - Result from detectDividendIssues
 * @param {Object} yieldValidation - Result from validateDividendYield
 * @returns {Object} Data quality flags
 */
export function buildDividendQualityFlags(
  cleanedResult,
  frequencyAnalysis,
  issueAnalysis,
  yieldValidation
) {
  const flags = {
    hasSpecials: cleanedResult?.flags?.hasSpecials || false,
    hasOutliers: cleanedResult?.flags?.hasOutliers || false,
    isIrregularFrequency: !frequencyAnalysis?.isRegular || false,
    hasCuts: issueAnalysis?.hasCuts || false,
    hasSuspension: issueAnalysis?.hasSuspension || false,
    yieldMismatch: !yieldValidation?.isValid || false,
    insufficientHistory: (cleanedResult?.cleaned?.length || 0) < 4,
  };

  // Calculate quality score (0-1, higher is better)
  const issues = Object.values(flags).filter((v) => v === true).length;
  const maxIssues = Object.keys(flags).length;
  const qualityScore = 1 - issues / maxIssues;

  return {
    ...flags,
    qualityScore: clamp(qualityScore, 0, 1),
    issueCount: issues,
  };
}
