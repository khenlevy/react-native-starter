/**
 * Price Change Utilities
 *
 * Enhanced utilities for calculating price changes with accuracy improvements
 */

import {
  clamp,
  detectOutliers,
  isPositiveNumber,
  calculatePercentageChange,
  validateTimeSeriesData,
  sortByDate,
  findMostRecentValidPoint,
  findValidPointNPointsAgo,
} from "@buydy/iso-js";

/**
 * Find the most recent trading day in historical data
 * Skips weekends and holidays by finding the latest date
 * @param {Array} historicalData - Array of price data sorted by date
 * @returns {Object|null} Most recent trading day data or null
 */
export function findMostRecentTradingDay(historicalData = []) {
  return findMostRecentValidPoint(historicalData, {
    valueKeys: ["adjusted_close", "close"],
    isValid: isPositiveNumber,
  });
}

/**
 * Find trading day N days ago (trading days, not calendar days)
 * @param {Array} historicalData - Array of price data sorted by date
 * @param {number} tradingDaysBack - Number of trading days to look back
 * @param {number} fromIndex - Starting index (most recent trading day)
 * @returns {Object|null} Trading day data or null
 */
export function findTradingDayNDaysAgo(historicalData = [], tradingDaysBack, fromIndex) {
  return findValidPointNPointsAgo(historicalData, tradingDaysBack, fromIndex, {
    valueKeys: ["adjusted_close", "close"],
    isValid: isPositiveNumber,
  });
}

/**
 * Calculate price change between two trading days
 * @param {Object} startDay - Starting day data
 * @param {Object} endDay - Ending day data
 * @returns {number|null} Price change as decimal or null if invalid
 */
export function calculatePriceChange(startDay, endDay) {
  if (!startDay || !endDay) {
    return null;
  }

  // Prefer adjusted_close for accuracy (accounts for splits/dividends)
  const startPrice = startDay?.adjusted_close ?? startDay?.close ?? null;
  const endPrice = endDay?.adjusted_close ?? endDay?.close ?? null;

  if (!isPositiveNumber(startPrice) || !isPositiveNumber(endPrice)) {
    return null;
  }

  // Use shared percentage change calculation
  return calculatePercentageChange(startPrice, endPrice, null);
}

/**
 * Validate price data quality
 * @param {Array} historicalData - Array of price data
 * @returns {Object} Validation result with flags and stats
 */
export function validatePriceDataQuality(historicalData = []) {
  // Normalize data to have consistent valueKey for validation
  const normalized = historicalData.map((day) => ({
    ...day,
    value: day?.adjusted_close ?? day?.close ?? null,
  }));

  // Use shared time series validation
  const baseValidation = validateTimeSeriesData(normalized, {
    dateKey: "date",
    valueKey: "value",
    maxGapDays: 3,
  });

  // Enhance with price-specific outlier detection
  const prices = normalized.map((day) => day.value).filter(isPositiveNumber);

  let hasOutliers = false;
  if (prices.length >= 4) {
    const priceChanges = [];
    for (let i = 1; i < prices.length; i++) {
      const change = calculatePercentageChange(prices[i - 1], prices[i], null);
      if (change !== null) {
        priceChanges.push(Math.abs(change));
      }
    }

    if (priceChanges.length >= 4) {
      const outlierResult = detectOutliers(priceChanges);
      hasOutliers = outlierResult.outliers.length > 0;
    }
  }

  return {
    ...baseValidation,
    flags: {
      ...baseValidation.flags,
      hasOutliers: hasOutliers,
    },
  };
}

/**
 * Calculate all price change periods from a single historical dataset
 * More efficient than fetching separately for each period
 * @param {string} symbol - Stock symbol
 * @param {Array} historicalData - Historical price data (1 year recommended)
 * @param {Object} options - Calculation options
 * @returns {Object} Price changes for all periods with metadata
 */
export function calculateAllPriceChanges(historicalData = [], options = {}) {
  const {
    useAdjustedPrices = true,
    minTradingDays = {
      "1W": 4, // At least 4 trading days for 1 week
      "1M": 18, // At least 18 trading days for 1 month
      "3M": 55, // At least 55 trading days for 3 months
      "6M": 110, // At least 110 trading days for 6 months
      "1Y": 220, // At least 220 trading days for 1 year
    },
  } = options;

  const result = {
    PriceChange1W: null,
    PriceChange1M: null,
    PriceChange3M: null,
    PriceChange6M: null,
    PriceChange1Y: null,
    metadata: {
      dataQuality: null,
      tradingDaysAvailable: 0,
      mostRecentDate: null,
      oldestDate: null,
      flags: {},
    },
  };

  // Validate data quality
  const qualityCheck = validatePriceDataQuality(historicalData);
  result.metadata.dataQuality = qualityCheck;
  result.metadata.flags = qualityCheck.flags;

  if (!qualityCheck.isValid) {
    return result;
  }

  // Normalize and prepare data
  const normalized = historicalData.map((day) => ({
    ...day,
    date: day?.date ?? day?.Date ?? day.date,
    close: Number(day?.close ?? 0),
    adjusted_close:
      useAdjustedPrices && Number.isFinite(day?.adjusted_close)
        ? Number(day.adjusted_close)
        : Number(day?.close ?? 0),
  }));

  // Use shared sortByDate function
  const sorted = sortByDate(normalized, "date", true).filter((day) =>
    isPositiveNumber(day.adjusted_close)
  );

  if (sorted.length < 2) {
    return result;
  }

  result.metadata.tradingDaysAvailable = sorted.length;
  result.metadata.mostRecentDate = sorted[sorted.length - 1].date.toISOString().split("T")[0];
  result.metadata.oldestDate = sorted[0].date.toISOString().split("T")[0];

  // Find most recent trading day
  const mostRecent = sorted[sorted.length - 1];
  const mostRecentIndex = sorted.length - 1;

  // Calculate each period
  const periods = [
    { key: "PriceChange1W", tradingDays: 5, minDays: minTradingDays["1W"] },
    { key: "PriceChange1M", tradingDays: 20, minDays: minTradingDays["1M"] },
    { key: "PriceChange3M", tradingDays: 60, minDays: minTradingDays["3M"] },
    { key: "PriceChange6M", tradingDays: 120, minDays: minTradingDays["6M"] },
    { key: "PriceChange1Y", tradingDays: 250, minDays: minTradingDays["1Y"] },
  ];

  for (const period of periods) {
    if (sorted.length < period.minDays) {
      continue; // Insufficient data
    }

    const startDay = findTradingDayNDaysAgo(sorted, period.tradingDays, mostRecentIndex);
    if (startDay && mostRecent) {
      const change = calculatePriceChange(startDay, mostRecent);
      if (change !== null) {
        // Cap extreme values (-90% to +1000%)
        result[period.key] = clamp(change, -0.9, 10.0);
      }
    }
  }

  return result;
}

/**
 * Convert price changes to USD if needed
 * @param {Object} priceChanges - Price changes object
 * @param {string} currency - Original currency code
 * @param {number} fxRate - FX conversion rate (1 if same currency)
 * @returns {Object} Price changes with USD conversion info
 */
export function normalizePriceChangesCurrency(priceChanges, currency, fxRate = 1) {
  // Price changes are percentages, so they don't need conversion
  // But we store FX info for reference
  return {
    ...priceChanges,
    metadata: {
      ...priceChanges.metadata,
      currency: currency,
      fxRate: fxRate,
      baseCurrency: "USD",
    },
  };
}
