/**
 * Time Series Utilities
 *
 * Pure functions for working with time series data (dates, rolling windows, validation)
 * Used by both dividend and price performance jobs
 */

import { safeDiv, isPositiveNumber, standardDeviation } from "./math.js";

/**
 * Parse and validate a date from various formats
 * @param {any} dateInput - Date input (Date object, string, timestamp, or object with date/Date property)
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateInput) {
  if (!dateInput) {
    return null;
  }

  // Handle Date object
  if (dateInput instanceof Date) {
    return isNaN(+dateInput) ? null : dateInput;
  }

  // Handle object with date/Date property
  if (typeof dateInput === "object" && dateInput !== null) {
    const dateValue = dateInput.date ?? dateInput.Date ?? dateInput.timestamp;
    if (dateValue) {
      const parsed = new Date(dateValue);
      return isNaN(+parsed) ? null : parsed;
    }
  }

  // Handle string or number
  const parsed = new Date(dateInput);
  return isNaN(+parsed) ? null : parsed;
}

/**
 * Sort array of objects by date property
 * @param {Array} items - Array of objects with date property
 * @param {string} dateKey - Key to access date (default: 'date')
 * @param {boolean} ascending - Sort ascending (default: true)
 * @returns {Array} Sorted array
 */
export function sortByDate(items = [], dateKey = "date", ascending = true) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const sorted = [...items].sort((a, b) => {
    const dateA = parseDate(a[dateKey] ?? a.Date ?? a.date);
    const dateB = parseDate(b[dateKey] ?? b.Date ?? b.date);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return ascending ? dateA - dateB : dateB - dateA;
  });

  return sorted;
}

/**
 * Calculate percentage change between two values
 * @param {number} startValue - Starting value
 * @param {number} endValue - Ending value
 * @param {number} defaultValue - Default value if calculation is invalid
 * @returns {number|null} Percentage change as decimal (e.g., 0.05 for 5%) or defaultValue
 */
export function calculatePercentageChange(startValue, endValue, defaultValue = null) {
  if (!isPositiveNumber(startValue)) {
    return defaultValue;
  }

  return safeDiv(endValue - startValue, startValue, defaultValue);
}

/**
 * Calculate rolling window sum/average from time series data
 * @param {Array} items - Array of objects with date and value properties
 * @param {Date} windowStartDate - Start date of rolling window
 * @param {Date} windowEndDate - End date of rolling window
 * @param {Object} options - Options
 * @param {string} options.dateKey - Key for date property (default: 'date')
 * @param {string} options.valueKey - Key for value property (default: 'value')
 * @param {string} options.operation - 'sum' or 'average' (default: 'sum')
 * @returns {number} Sum or average of values within window
 */
export function calculateRollingWindow(
  items = [],
  windowStartDate,
  windowEndDate,
  options = {}
) {
  const {
    dateKey = "date",
    valueKey = "value",
    operation = "sum",
  } = options;

  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  if (!(windowStartDate instanceof Date) || !(windowEndDate instanceof Date)) {
    return 0;
  }

  const valuesInWindow = items
    .map((item) => {
      const date = parseDate(item[dateKey] ?? item.Date ?? item.date);
      const value = Number(item[valueKey] ?? item.Value ?? item.value ?? 0);

      if (!date || !isPositiveNumber(value)) {
        return null;
      }

      if (date >= windowStartDate && date <= windowEndDate) {
        return value;
      }

      return null;
    })
    .filter((v) => v !== null);

  if (valuesInWindow.length === 0) {
    return 0;
  }

  if (operation === "average") {
    return valuesInWindow.reduce((sum, val) => sum + val, 0) / valuesInWindow.length;
  }

  return valuesInWindow.reduce((sum, val) => sum + val, 0);
}

/**
 * Calculate TTM (Trailing Twelve Months) from most recent date
 * @param {Array} items - Array of objects with date and value properties
 * @param {Object} options - Options
 * @param {string} options.dateKey - Key for date property (default: 'date')
 * @param {string} options.valueKey - Key for value property (default: 'value')
 * @param {number} options.months - Number of months for TTM (default: 12)
 * @returns {number} TTM sum
 */
export function calculateTTM(items = [], options = {}) {
  const { dateKey = "date", valueKey = "value", months = 12 } = options;

  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }

  // Sort by date descending (most recent first)
  const sorted = sortByDate(items, dateKey, false);

  // Find most recent valid date
  const mostRecent = sorted.find((item) => {
    const date = parseDate(item[dateKey] ?? item.Date ?? item.date);
    const value = Number(item[valueKey] ?? item.Value ?? item.value ?? 0);
    return date && isPositiveNumber(value);
  });

  if (!mostRecent) {
    return 0;
  }

  const mostRecentDate = parseDate(
    mostRecent[dateKey] ?? mostRecent.Date ?? mostRecent.date
  );
  if (!mostRecentDate) {
    return 0;
  }

  // Calculate cutoff date
  const cutoffDate = new Date(mostRecentDate);
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  return calculateRollingWindow(sorted, cutoffDate, mostRecentDate, {
    dateKey,
    valueKey,
    operation: "sum",
  });
}

/**
 * Validate time series data quality
 * @param {Array} items - Array of objects with date and value properties
 * @param {Object} options - Options
 * @param {string} options.dateKey - Key for date property (default: 'date')
 * @param {string} options.valueKey - Key for value property (default: 'value')
 * @param {number} options.maxGapDays - Maximum allowed gap in days (default: 3)
 * @returns {Object} Validation result with flags and stats
 */
export function validateTimeSeriesData(items = [], options = {}) {
  const {
    dateKey = "date",
    valueKey = "value",
    maxGapDays = 3,
  } = options;

  if (!Array.isArray(items) || items.length === 0) {
    return {
      isValid: false,
      flags: {
        noData: true,
        hasGaps: false,
        hasZeroValues: false,
        insufficientData: true,
      },
      stats: {
        totalItems: 0,
        validItems: 0,
        gaps: 0,
        zeroValues: 0,
      },
    };
  }

  const validItems = [];
  const values = [];
  let gaps = 0;
  let zeroValues = 0;
  let lastDate = null;

  // Sort by date first
  const sorted = sortByDate(items, dateKey, true);

  for (const item of sorted) {
    const date = parseDate(item[dateKey] ?? item.Date ?? item.date);
    const value = Number(item[valueKey] ?? item.Value ?? item.value ?? 0);

    if (date && isPositiveNumber(value)) {
      validItems.push(item);
      values.push(value);

      // Check for gaps
      if (lastDate) {
        const daysDiff = (date - lastDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > maxGapDays) {
          gaps++;
        }
      }
      lastDate = date;
    } else if (value === 0) {
      zeroValues++;
    }
  }

  return {
    isValid: validItems.length >= 2,
    flags: {
      noData: validItems.length === 0,
      hasGaps: gaps > 0,
      hasZeroValues: zeroValues > 0,
      insufficientData: validItems.length < 2,
    },
    stats: {
      totalItems: items.length,
      validItems: validItems.length,
      gaps: gaps,
      zeroValues: zeroValues,
    },
  };
}

/**
 * Calculate coefficient of variation (CV) for a dataset
 * CV = standardDeviation / mean
 * Used to measure relative variability
 * @param {Array<number>} values - Array of numbers
 * @returns {number|null} Coefficient of variation or null if invalid
 */
export function calculateCoefficientOfVariation(values = []) {
  const filtered = values.filter((v) => Number.isFinite(v));

  if (filtered.length === 0) {
    return null;
  }

  const mean = filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
  if (mean === 0) {
    return null;
  }

  const stdDev = standardDeviation(filtered);
  return safeDiv(stdDev, mean, null);
}

/**
 * Calculate intervals between consecutive dates
 * @param {Array} items - Array of objects with date property
 * @param {string} dateKey - Key for date property (default: 'date')
 * @param {Object} options - Options
 * @param {number} options.minDays - Minimum days to include (default: 0)
 * @param {number} options.maxDays - Maximum days to include (default: Infinity)
 * @returns {Array<number>} Array of intervals in days
 */
export function calculateDateIntervals(items = [], dateKey = "date", options = {}) {
  const { minDays = 0, maxDays = Infinity } = options;

  if (!Array.isArray(items) || items.length < 2) {
    return [];
  }

  const sorted = sortByDate(items, dateKey, true);
  const intervals = [];

  for (let i = 1; i < sorted.length; i++) {
    const date1 = parseDate(sorted[i - 1][dateKey] ?? sorted[i - 1].Date ?? sorted[i - 1].date);
    const date2 = parseDate(sorted[i][dateKey] ?? sorted[i].Date ?? sorted[i].date);

    if (date1 && date2) {
      const daysBetween = (date2 - date1) / (1000 * 60 * 60 * 24);
      if (daysBetween >= minDays && daysBetween <= maxDays) {
        intervals.push(daysBetween);
      }
    }
  }

  return intervals;
}

/**
 * Find the most recent valid data point in a time series
 * Validates that the data point has a valid value (e.g., price > 0)
 * @param {Array} items - Array of objects with date and value properties
 * @param {Object} options - Options
 * @param {string} options.dateKey - Key for date property (default: 'date')
 * @param {string} options.valueKey - Key for value property (default: 'value')
 * @param {Array<string>} options.valueKeys - Alternative value keys to check (e.g., ['adjusted_close', 'close'])
 * @param {Function} options.isValid - Custom validation function (default: isPositiveNumber)
 * @returns {Object|null} Most recent valid data point with index or null
 */
export function findMostRecentValidPoint(items = [], options = {}) {
  const {
    dateKey = "date",
    valueKey = "value",
    valueKeys = null,
    isValid = isPositiveNumber,
  } = options;

  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  // Check from end (most recent) to beginning
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    
    // Try valueKeys first if provided, otherwise use valueKey
    let value = null;
    if (valueKeys && Array.isArray(valueKeys)) {
      for (const key of valueKeys) {
        const candidate = item?.[key] ?? null;
        if (isValid(candidate)) {
          value = candidate;
          break;
        }
      }
    } else {
      value = item?.[valueKey] ?? null;
    }

    if (isValid(value)) {
      return { ...item, index: i, value };
    }
  }

  return null;
}

/**
 * Find data point N valid points ago in a time series
 * Counts only valid data points (e.g., trading days with valid prices)
 * @param {Array} items - Array of objects with date and value properties
 * @param {number} pointsBack - Number of valid points to look back
 * @param {number} fromIndex - Starting index (most recent valid point)
 * @param {Object} options - Options
 * @param {string} options.valueKey - Key for value property (default: 'value')
 * @param {Array<string>} options.valueKeys - Alternative value keys to check (e.g., ['adjusted_close', 'close'])
 * @param {Function} options.isValid - Custom validation function (default: isPositiveNumber)
 * @returns {Object|null} Data point N points ago or null
 */
export function findValidPointNPointsAgo(
  items = [],
  pointsBack,
  fromIndex,
  options = {}
) {
  const {
    valueKey = "value",
    valueKeys = null,
    isValid = isPositiveNumber,
  } = options;

  if (!Array.isArray(items) || items.length === 0 || fromIndex < 0) {
    return null;
  }

  // Count back valid points (skip entries without valid values)
  let validPointsCounted = 0;
  for (let i = fromIndex; i >= 0; i--) {
    const item = items[i];
    
    // Try valueKeys first if provided, otherwise use valueKey
    let value = null;
    if (valueKeys && Array.isArray(valueKeys)) {
      for (const key of valueKeys) {
        const candidate = item?.[key] ?? null;
        if (isValid(candidate)) {
          value = candidate;
          break;
        }
      }
    } else {
      value = item?.[valueKey] ?? null;
    }

    if (isValid(value)) {
      if (validPointsCounted === pointsBack) {
        return { ...item, index: i, value };
      }
      validPointsCounted++;
    }
  }

  return null;
}

