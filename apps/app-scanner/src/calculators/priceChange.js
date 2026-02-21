/**
 * Price Change Calculator
 *
 * This module contains functions for calculating price percentage changes
 * over various time periods using EODHD API historical price data.
 *
 * NOTE: For efficiency, use calculateAllPriceChanges() which fetches data once
 * and calculates all periods. These individual functions are kept for backward compatibility.
 */

import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import { safeDiv, isPositiveNumber } from "@buydy/iso-js";

/**
 * Calculate price change percentage over a specified period
 * @deprecated Use calculateAllPriceChanges() for better efficiency
 * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
 * @param {number} days - Number of days to look back
 * @param {Object} client - EODHD client instance (optional, will create if not provided)
 * @returns {Promise<number|null>} Price change as decimal (e.g., 0.05 for 5%) or null if insufficient data
 */
async function calcPriceChange(symbol, days, client) {
  try {
    // Create client if not provided
    const eodhdClient =
      client ||
      new EODHDCacheClient({
        apiKey: process.env.API_EODHD_API_TOKEN,
        cacheExpirationHours: 24,
      });

    const today = new Date();
    const fromDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

    // Get historical data
    const historicalData = await eodhdClient.stocks.getEODData(
      symbol,
      fromDate.toISOString().split("T")[0],
      today.toISOString().split("T")[0]
    );

    if (!historicalData || historicalData.length < 2) {
      return null;
    }

    // Use adjusted close if available, otherwise use close
    // Prefer most recent trading day (last element with valid price)
    let latestPrice = null;
    let latestIndex = historicalData.length - 1;
    for (let i = historicalData.length - 1; i >= 0; i--) {
      const price = historicalData[i]?.adjusted_close ?? historicalData[i]?.close ?? null;
      if (isPositiveNumber(price)) {
        latestPrice = price;
        latestIndex = i;
        break;
      }
    }

    // Find oldest valid price
    let oldestPrice = null;
    for (let i = 0; i <= latestIndex; i++) {
      const price = historicalData[i]?.adjusted_close ?? historicalData[i]?.close ?? null;
      if (isPositiveNumber(price)) {
        oldestPrice = price;
        break;
      }
    }

    if (!oldestPrice || !latestPrice || oldestPrice <= 0) {
      return null;
    }

    // Calculate percentage change
    return safeDiv(latestPrice - oldestPrice, oldestPrice, null);
  } catch (error) {
    // Silent failure - calculator functions should not log
    return null;
  }
}

/**
 * Calculate 1-week (7 days) price change
 * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
 * @param {Object} client - EODHD client instance (optional)
 * @returns {Promise<number|null>} 1-week price change as decimal or null if insufficient data
 */
export async function PriceChange1W(symbol, client) {
  return calcPriceChange(symbol, 7, client);
}

/**
 * Calculate 1-month (30 days) price change
 * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
 * @param {Object} client - EODHD client instance (optional)
 * @returns {Promise<number|null>} 1-month price change as decimal or null if insufficient data
 */
export async function PriceChange1M(symbol, client) {
  return calcPriceChange(symbol, 30, client);
}

/**
 * Calculate 3-month (90 days) price change
 * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
 * @param {Object} client - EODHD client instance (optional)
 * @returns {Promise<number|null>} 3-month price change as decimal or null if insufficient data
 */
export async function PriceChange3M(symbol, client) {
  return calcPriceChange(symbol, 90, client);
}

/**
 * Calculate 6-month (180 days) price change
 * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
 * @param {Object} client - EODHD client instance (optional)
 * @returns {Promise<number|null>} 6-month price change as decimal or null if insufficient data
 */
export async function PriceChange6M(symbol, client) {
  return calcPriceChange(symbol, 180, client);
}

/**
 * Calculate 1-year (365 days) price change
 * @param {string} symbol - Stock symbol (e.g., 'AAPL.US')
 * @param {Object} client - EODHD client instance (optional)
 * @returns {Promise<number|null>} 1-year price change as decimal or null if insufficient data
 */
export async function PriceChange1Y(symbol, client) {
  return calcPriceChange(symbol, 365, client);
}

/**
 * Fetch historical price data for a symbol (1 year recommended)
 * @param {string} symbol - Stock symbol
 * @param {Object} client - EODHD client instance
 * @param {number} days - Number of days to fetch (default: 365)
 * @returns {Promise<Array|null>} Historical price data or null if error
 */
export async function fetchHistoricalPriceData(symbol, client, days = 365) {
  try {
    const today = new Date();
    const fromDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

    const historicalData = await client.stocks.getEODData(
      symbol,
      fromDate.toISOString().split("T")[0],
      today.toISOString().split("T")[0]
    );

    return Array.isArray(historicalData) ? historicalData : null;
  } catch (error) {
    return null;
  }
}
