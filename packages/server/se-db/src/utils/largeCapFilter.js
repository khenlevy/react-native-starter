/**
 * Large Cap Filter Utilities
 *
 * Centralized logic for determining large cap stocks based on market capitalization.
 * Uses the 1B threshold consistently across the application.
 */

// Large cap threshold: $1B market capitalization
export const LARGE_CAP_THRESHOLD = 1000000000; // $1B

// Freshness threshold for cap data: 30 days
export const CAP_DATA_FRESHNESS_DAYS = 30;

/**
 * Determines if a symbol is a large cap stock based on its market cap
 * @param {Object} symbol - Symbol object with cap property
 * @param {number} symbol.cap - Market capitalization in USD
 * @returns {boolean} True if market cap >= $1B
 */
export function isLargeCapSymbol(symbol) {
  return symbol && symbol.cap && symbol.cap >= LARGE_CAP_THRESHOLD;
}

/**
 * Determines if a symbol has fresh cap data
 * @param {Object} symbol - Symbol object with capLastSync property
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {boolean} True if cap data is fresh
 */
export function isCapDataFresh(symbol, freshnessDays = CAP_DATA_FRESHNESS_DAYS) {
  if (!symbol || !symbol.capLastSync) return false;

  const cutoffDate = new Date(Date.now() - freshnessDays * 24 * 60 * 60 * 1000);
  return symbol.capLastSync > cutoffDate;
}

/**
 * Determines if a symbol is a large cap stock with fresh data
 * @param {Object} symbol - Symbol object with cap and capLastSync properties
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {boolean} True if symbol is large cap with fresh data
 */
export function isLargeCapWithFreshData(symbol, freshnessDays = CAP_DATA_FRESHNESS_DAYS) {
  return isLargeCapSymbol(symbol) && isCapDataFresh(symbol, freshnessDays);
}

/**
 * Creates a MongoDB query filter for large cap stocks
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {Object} MongoDB query object
 */
export function getLargeCapQuery(freshnessDays = CAP_DATA_FRESHNESS_DAYS) {
  const cutoffDate = new Date(Date.now() - freshnessDays * 24 * 60 * 60 * 1000);

  return {
    "symbols.cap": { $gte: LARGE_CAP_THRESHOLD },
    "symbols.capLastSync": { $gte: cutoffDate },
  };
}

/**
 * Creates a MongoDB aggregation pipeline stage to filter large cap stocks
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {Object} MongoDB aggregation stage
 */
export function getLargeCapAggregationStage(freshnessDays = CAP_DATA_FRESHNESS_DAYS) {
  const cutoffDate = new Date(Date.now() - freshnessDays * 24 * 60 * 60 * 1000);

  return {
    $match: {
      "symbols.cap": { $gte: LARGE_CAP_THRESHOLD },
      "symbols.capLastSync": { $gte: cutoffDate },
    },
  };
}

/**
 * Filters an array of symbols to return only large cap stocks
 * @param {Array} symbols - Array of symbol objects
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {Array} Filtered array of large cap symbols
 */
export function filterLargeCapSymbols(symbols, freshnessDays = CAP_DATA_FRESHNESS_DAYS) {
  if (!Array.isArray(symbols)) return [];

  return symbols.filter((symbol) => isLargeCapWithFreshData(symbol, freshnessDays));
}

/**
 * Formats market cap for display
 * @param {number} cap - Market capitalization in USD
 * @returns {string} Formatted market cap string
 */
export function formatMarketCap(cap) {
  if (!cap) return "N/A";
  if (cap >= 1000000000) return `$${(cap / 1000000000).toFixed(1)}B`;
  if (cap >= 1000000) return `$${(cap / 1000000).toFixed(1)}M`;
  return `$${cap.toLocaleString()}`;
}

/**
 * Gets market cap category based on value
 * @param {number} cap - Market capitalization in USD
 * @returns {string} Category name
 */
export function getMarketCapCategory(cap) {
  if (!cap) return "Unknown";
  if (cap >= LARGE_CAP_THRESHOLD) return "Large Cap";
  if (cap >= 200000000) return "Mid Cap"; // $200M - $1B
  return "Small Cap"; // < $200M
}

/**
 * Gets all large cap stocks from the database using consistent logic
 * This is the SINGLE SOURCE OF TRUTH for large cap filtering across all jobs
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {Promise<Array>} Array of exchange documents with large cap stocks
 */
export async function getLargeCapStocksFromDatabase(freshnessDays = CAP_DATA_FRESHNESS_DAYS) {
  const { getModel } = await import("../index.js");
  const ExchangeSymbols = getModel("exchange_symbols");

  // Use the centralized query
  const largeCapQuery = getLargeCapQuery(freshnessDays);
  const exchangeSymbolsDocs = await ExchangeSymbols.find(largeCapQuery).select(
    "exchangeCode symbols"
  );

  return exchangeSymbolsDocs;
}

/**
 * Counts large cap stocks from exchange documents using consistent logic
 * This is the SINGLE SOURCE OF TRUTH for large cap counting across all jobs
 * @param {Array} exchangeSymbolsDocs - Array of exchange documents
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {number} Total count of large cap stocks
 */
export function countLargeCapStocks(exchangeSymbolsDocs, freshnessDays = CAP_DATA_FRESHNESS_DAYS) {
  let totalCount = 0;
  for (const doc of exchangeSymbolsDocs) {
    const largeCapCount = filterLargeCapSymbols(doc.symbols, freshnessDays).length;
    totalCount += largeCapCount;
  }
  return totalCount;
}

/**
 * Gets large cap stocks from exchange documents using consistent logic
 * This is the SINGLE SOURCE OF TRUTH for large cap extraction across all jobs
 * @param {Array} exchangeSymbolsDocs - Array of exchange documents
 * @param {number} [freshnessDays=CAP_DATA_FRESHNESS_DAYS] - Number of days to consider data fresh
 * @returns {Array} Array of objects with exchangeCode and largeCapSymbols
 */
export function extractLargeCapStocks(
  exchangeSymbolsDocs,
  freshnessDays = CAP_DATA_FRESHNESS_DAYS
) {
  const result = [];
  for (const doc of exchangeSymbolsDocs) {
    const largeCapSymbols = filterLargeCapSymbols(doc.symbols, freshnessDays);
    if (largeCapSymbols.length > 0) {
      result.push({
        exchangeCode: doc.exchangeCode,
        symbols: largeCapSymbols,
      });
    }
  }
  return result;
}
