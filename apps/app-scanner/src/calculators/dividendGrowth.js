/**
 * Dividend Growth Calculator
 *
 * This module contains functions for calculating dividend growth rates
 * from dividend history data using geometric mean for accuracy.
 */

import { groupByYear } from "../mappers/groupByYear.js";
import { geometricMean, safeDiv, clamp } from "@buydy/iso-js";

/**
 * Calculate dividend growth rate over a specified number of years using geometric mean
 * This provides more accurate growth rates for volatile dividend histories
 * @param {Array} history - Array of dividend history objects with date and value
 * @param {number} years - Number of years to calculate growth over
 * @returns {number|null} Annualized dividend growth rate as decimal (e.g., 0.05 for 5%) or null if insufficient data
 */
function calcDividendGrowth(history, years) {
  const perYear = groupByYear(history);
  const yearsSorted = Object.keys(perYear)
    .map(Number)
    .sort((a, b) => a - b);

  if (yearsSorted.length < 2) return null;

  const endYear = yearsSorted[yearsSorted.length - 1];
  const startYear = endYear - years + 1;

  // Need both start and end years
  if (!(startYear in perYear) || !(endYear in perYear)) return null;

  const dStart = perYear[startYear];
  const dEnd = perYear[endYear];
  if (dStart <= 0 || dEnd <= 0) return null;

  // If we have all years in the period, use geometric mean of year-over-year growth rates
  const requiredYears = [];
  for (let year = startYear; year <= endYear; year++) {
    if (!(year in perYear) || perYear[year] <= 0) {
      // Missing year or zero dividend - fall back to simple CAGR
      const simpleCagr = Math.pow(dEnd / dStart, 1 / years) - 1;
      return clamp(simpleCagr, -0.5, 2.0); // Cap extreme values
    }
    requiredYears.push(year);
  }

  // Calculate year-over-year growth rates
  const growthRates = [];
  for (let i = 1; i < requiredYears.length; i++) {
    const prevYear = requiredYears[i - 1];
    const currYear = requiredYears[i];
    const prevDiv = perYear[prevYear];
    const currDiv = perYear[currYear];

    if (prevDiv > 0 && currDiv > 0) {
      const growthFactor = safeDiv(currDiv, prevDiv, null);
      if (growthFactor !== null && growthFactor > 0) {
        growthRates.push(growthFactor);
      }
    }
  }

  // Use geometric mean if we have enough data points
  if (growthRates.length >= Math.max(2, Math.floor(years * 0.6))) {
    // Need at least 60% of years for reliable geometric mean
    const geoMean = geometricMean(growthRates, null);
    if (geoMean !== null && geoMean > 0) {
      const cagr = geoMean - 1;
      return clamp(cagr, -0.5, 2.0); // Cap extreme values (-50% to +200%)
    }
  }

  // Fallback to simple CAGR if geometric mean not available
  const simpleCagr = Math.pow(dEnd / dStart, 1 / years) - 1;
  return clamp(simpleCagr, -0.5, 2.0);
}

/**
 * Calculate 3-year dividend growth rate
 * @param {Array} history - Array of dividend history objects with date and value
 * @returns {number|null} 3-year annualized dividend growth rate as decimal or null if insufficient data
 */
export function DividendGrowth3Y(history) {
  return calcDividendGrowth(history, 3);
}

/**
 * Calculate 5-year dividend growth rate
 * @param {Array} history - Array of dividend history objects with date and value
 * @returns {number|null} 5-year annualized dividend growth rate as decimal or null if insufficient data
 */
export function DividendGrowth5Y(history) {
  return calcDividendGrowth(history, 5);
}

/**
 * Calculate 10-year dividend growth rate
 * @param {Array} history - Array of dividend history objects with date and value
 * @returns {number|null} 10-year annualized dividend growth rate as decimal or null if insufficient data
 */
export function DividendGrowth10Y(history) {
  return calcDividendGrowth(history, 10);
}

/**
 * Calculate current dividend yield based on trailing twelve months (TTM) dividends
 * Uses rolling 12-month window from most recent dividend for accuracy
 * @param {Array} history - Array of dividend history objects with date and value
 * @param {number} currentPrice - Current stock price
 * @returns {number|null} Current dividend yield as decimal (e.g., 0.05 for 5%) or null if no current price
 */
export function DividendYieldCurrent(history, currentPrice) {
  if (!Array.isArray(history) || history.length === 0 || !currentPrice) {
    return null;
  }

  // Sort by date descending (most recent first)
  const sorted = [...history]
    .map((d) => ({
      date: new Date(d.date),
      value: Number(d.value) || 0,
    }))
    .filter((d) => !isNaN(+d.date) && d.value > 0)
    .sort((a, b) => b.date - a.date);

  if (sorted.length === 0) {
    return null;
  }

  // Find most recent dividend date and calculate rolling 12-month window
  const mostRecentDate = sorted[0].date;
  const cutoffDate = new Date(mostRecentDate);
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);

  // Sum dividends within rolling 12-month window
  const ttmDivs = sorted.filter((d) => d.date >= cutoffDate).reduce((sum, d) => sum + d.value, 0);

  if (ttmDivs <= 0) {
    return null;
  }

  return safeDiv(ttmDivs, currentPrice, null);
}
