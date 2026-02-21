/**
 * Debt and Profitability Calculator
 *
 * This module contains functions for calculating debt and profitability metrics
 * from quarterly financial data (balance sheet and income statement).
 */

const NEGATIVE_EQUITY_PENALTY = 100;
const NEGATIVE_EQUITY_CHANGE_PENALTY = 1000;

/**
 * Helper to merge quarterly balance sheet and income statement data
 * @param {Object|Array} balanceSheet - Quarterly balance sheet data (object with dates as keys or array)
 * @param {Object|Array} incomeStatement - Quarterly income statement data (object with dates as keys or array)
 * @param {Object|Array} cashFlow - Quarterly cash flow data (object with dates as keys or array)
 * @returns {Array} Merged and sorted quarterly data
 */
function mergeQuarterlyData(balanceSheet, incomeStatement, cashFlow) {
  const dataByDate = new Map();

  // Add balance sheet data
  // Handle both object format (date as key) and array format
  if (balanceSheet) {
    const balanceSheetEntries = Array.isArray(balanceSheet)
      ? balanceSheet.map((q) => [q.date, q])
      : Object.entries(balanceSheet);

    balanceSheetEntries.forEach(([date, data]) => {
      if (date && data) {
        // Try to get totalDebt from multiple possible field names
        // ACCURACY: Validate all parsed values are finite numbers
        let totalDebt = null;
        if (data.totalDebt !== undefined && data.totalDebt !== null) {
          const parsed = parseFloat(data.totalDebt);
          if (Number.isFinite(parsed)) {
            totalDebt = parsed;
          }
        } else if (
          data.shortLongTermDebtTotal !== undefined &&
          data.shortLongTermDebtTotal !== null
        ) {
          const parsed = parseFloat(data.shortLongTermDebtTotal);
          if (Number.isFinite(parsed)) {
            totalDebt = parsed;
          }
        } else {
          // Calculate total debt from components if direct field doesn't exist
          // Handle cases where one component might be null but the other has a value
          let longTerm = 0;
          let shortTerm = 0;
          let hasLongTerm = false;
          let hasShortTerm = false;

          // Check if longTermDebtTotal field exists (even if null, field exists)
          if (data.longTermDebtTotal !== undefined) {
            if (data.longTermDebtTotal !== null) {
              const parsed = parseFloat(data.longTermDebtTotal);
              if (Number.isFinite(parsed)) {
                longTerm = parsed;
                hasLongTerm = true;
              }
            } else {
              hasLongTerm = true; // Field exists but is null, treat as 0
            }
          } else if (data.longTermDebt !== undefined) {
            // Fallback to longTermDebt if longTermDebtTotal doesn't exist
            if (data.longTermDebt !== null) {
              const parsed = parseFloat(data.longTermDebt);
              if (Number.isFinite(parsed)) {
                longTerm = parsed;
                hasLongTerm = true;
              }
            } else {
              hasLongTerm = true; // Field exists but is null, treat as 0
            }
          }

          // Check if shortTermDebt field exists (even if null, field exists)
          if (data.shortTermDebt !== undefined) {
            if (data.shortTermDebt !== null) {
              const parsed = parseFloat(data.shortTermDebt);
              if (Number.isFinite(parsed)) {
                shortTerm = parsed;
                hasShortTerm = true;
              }
            } else {
              hasShortTerm = true; // Field exists but is null, treat as 0
            }
          }

          // Set totalDebt if at least one field exists (handles both null and zero values correctly)
          // ACCURACY: Only include components that actually exist in the data
          if (hasLongTerm || hasShortTerm) {
            // Only add components that exist in the data
            let calculated = 0;
            if (hasLongTerm) calculated += longTerm;
            if (hasShortTerm) calculated += shortTerm;

            // ACCURACY: Validate result is finite (0 is valid - means no debt)
            if (Number.isFinite(calculated)) {
              totalDebt = calculated;
            }
          }
        }

        // ACCURACY: Only set to 0 if we explicitly know debt is 0, otherwise keep null
        // Don't default null to 0 - null means "unknown", 0 means "no debt"
        if (totalDebt === null || totalDebt === undefined || !Number.isFinite(totalDebt)) {
          totalDebt = null; // Keep as null if invalid - don't assume 0
        }

        // Get cash - try multiple field names
        // ACCURACY: Validate all parsed values are finite numbers
        let cash = null;
        if (data.cash !== undefined && data.cash !== null) {
          const parsed = parseFloat(data.cash);
          if (Number.isFinite(parsed)) {
            cash = parsed;
          }
        } else if (data.cashAndEquivalents !== undefined && data.cashAndEquivalents !== null) {
          const parsed = parseFloat(data.cashAndEquivalents);
          if (Number.isFinite(parsed)) {
            cash = parsed;
          }
        } else if (
          data.cashAndShortTermInvestments !== undefined &&
          data.cashAndShortTermInvestments !== null
        ) {
          const parsed = parseFloat(data.cashAndShortTermInvestments);
          if (Number.isFinite(parsed)) {
            cash = parsed;
          }
        }

        // ACCURACY: Validate equity is a finite number
        let totalStockholderEquity = null;
        if (data.totalStockholderEquity !== undefined && data.totalStockholderEquity !== null) {
          const parsed = parseFloat(data.totalStockholderEquity);
          if (Number.isFinite(parsed)) {
            totalStockholderEquity = parsed;
          }
        }

        dataByDate.set(date, {
          date: date,
          totalDebt: totalDebt,
          cash: cash,
          totalStockholderEquity: totalStockholderEquity,
        });
      }
    });
  }

  // Add income statement data
  // Handle both object format (date as key) and array format
  if (incomeStatement) {
    const incomeStatementEntries = Array.isArray(incomeStatement)
      ? incomeStatement.map((q) => [q.date, q])
      : Object.entries(incomeStatement);

    incomeStatementEntries.forEach(([date, data]) => {
      if (date && data) {
        const existing = dataByDate.get(date) || { date: date };

        // Try to get EBITDA directly
        let ebitda =
          data.ebitda !== undefined && data.ebitda !== null ? parseFloat(data.ebitda) : null;

        // Store operating income for potential EBITDA calculation
        const operatingIncome =
          data.operatingIncome !== undefined && data.operatingIncome !== null
            ? parseFloat(data.operatingIncome)
            : null;
        existing.operatingIncome = operatingIncome;

        // Try to get depreciation from income statement (some APIs provide it here)
        // Check multiple possible field names
        let incomeStatementDepreciation = null;
        if (data.reconciledDepreciation !== undefined && data.reconciledDepreciation !== null) {
          incomeStatementDepreciation = parseFloat(data.reconciledDepreciation);
        } else if (data.depreciation !== undefined && data.depreciation !== null) {
          incomeStatementDepreciation = parseFloat(data.depreciation);
        } else if (
          data.depreciationAndAmortization !== undefined &&
          data.depreciationAndAmortization !== null
        ) {
          incomeStatementDepreciation = parseFloat(data.depreciationAndAmortization);
        }

        // Store income statement depreciation as fallback if cash flow doesn't have it
        if (incomeStatementDepreciation !== null) {
          existing.incomeStatementDepreciation = incomeStatementDepreciation;
        }

        existing.ebitda = ebitda;

        // If EBITDA is not set but we have operating income and depreciation from income statement,
        // calculate it now (before cash flow processing)
        if (
          existing.ebitda === null &&
          existing.operatingIncome !== null &&
          incomeStatementDepreciation !== null
        ) {
          existing.ebitda = existing.operatingIncome + incomeStatementDepreciation;
        }

        dataByDate.set(date, existing);
      }
    });
  }

  // Add cash flow data (for depreciation/amortization needed for EBITDA calculation)
  // Handle both object format (date as key) and array format
  if (cashFlow) {
    const cashFlowEntries = Array.isArray(cashFlow)
      ? cashFlow.map((q) => [q.date, q])
      : Object.entries(cashFlow);

    cashFlowEntries.forEach(([date, data]) => {
      if (date && data) {
        const existing = dataByDate.get(date) || { date: date };

        // Get depreciation and amortization from cash flow
        let depreciation = null;
        if (data.depreciation !== undefined && data.depreciation !== null) {
          depreciation = parseFloat(data.depreciation);
        }

        let amortization = null;
        if (data.amortization !== undefined && data.amortization !== null) {
          amortization = parseFloat(data.amortization);
        }

        let depreciationAndAmortization = null;
        if (
          data.depreciationAndAmortization !== undefined &&
          data.depreciationAndAmortization !== null
        ) {
          depreciationAndAmortization = parseFloat(data.depreciationAndAmortization);
        } else if (depreciation !== null || amortization !== null) {
          // Calculate sum if at least one component is available
          depreciationAndAmortization = (depreciation || 0) + (amortization || 0);
        }

        // Fallback to income statement depreciation if cash flow doesn't have it
        if (
          depreciationAndAmortization === null &&
          existing.incomeStatementDepreciation !== undefined
        ) {
          depreciationAndAmortization = existing.incomeStatementDepreciation;
        }

        // Store depreciation (could be null if not found anywhere)
        existing.depreciation = depreciationAndAmortization;

        // Calculate EBITDA from operating income + depreciation if EBITDA not already set
        // Only calculate if we have both operating income AND depreciation data
        if (
          existing.ebitda === null &&
          existing.operatingIncome !== null &&
          depreciationAndAmortization !== null
        ) {
          existing.ebitda = existing.operatingIncome + depreciationAndAmortization;
        }

        dataByDate.set(date, existing);
      }
    });
  }

  // Convert to array and sort by date (newest first)
  const mergedArray = Array.from(dataByDate.values()).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  for (let i = 0; i < mergedArray.length; i += 1) {
    const quarter = mergedArray[i];

    if (quarter.depreciation === null || quarter.depreciation === undefined) {
      const fallbackQuarter = mergedArray
        .slice(i + 1)
        .find((q) => q.depreciation !== null && q.depreciation !== undefined);
      if (fallbackQuarter) {
        quarter.depreciation = fallbackQuarter.depreciation;
      }
    }

    if (
      (quarter.ebitda === null || quarter.ebitda === undefined) &&
      quarter.operatingIncome !== null &&
      quarter.operatingIncome !== undefined &&
      quarter.depreciation !== null &&
      quarter.depreciation !== undefined
    ) {
      quarter.ebitda = quarter.operatingIncome + quarter.depreciation;
    }
  }

  return mergedArray;
}

/**
 * Helper to get quarterly data sorted by date
 * @param {Object} fundamentals - Fundamentals data from EODHD API
 * @returns {Array} Sorted quarterly data (newest first)
 */
function getQuarterlyData(fundamentals) {
  if (!fundamentals) return [];

  // Handle both formats:
  // 1. MongoDB format: fundamentals.Financials.Balance_Sheet.quarterly
  // 2. Test/Direct format: fundamentals.Balance_Sheet.quarterly
  const balanceSheet =
    fundamentals?.Financials?.Balance_Sheet?.quarterly ||
    fundamentals?.Balance_Sheet?.quarterly ||
    [];
  const incomeStatement =
    fundamentals?.Financials?.Income_Statement?.quarterly ||
    fundamentals?.Income_Statement?.quarterly ||
    [];
  const cashFlow =
    fundamentals?.Financials?.Cash_Flow?.quarterly || fundamentals?.Cash_Flow?.quarterly || [];

  return mergeQuarterlyData(balanceSheet, incomeStatement, cashFlow);
}

/**
 * Calculate net debt (Total Debt - Cash)
 * @param {Object} quarter - Quarter data with totalDebt and cash
 * @returns {number|null} Net debt value
 */
function calculateNetDebt(quarter) {
  if (!quarter) return null;

  // ACCURACY: Strict validation - ensure both values are finite numbers
  if (
    quarter.totalDebt === null ||
    quarter.totalDebt === undefined ||
    !Number.isFinite(quarter.totalDebt)
  )
    return null;
  if (quarter.cash === null || quarter.cash === undefined || !Number.isFinite(quarter.cash))
    return null;

  // ACCURACY: Validate result is finite
  const netDebt = quarter.totalDebt - quarter.cash;
  return Number.isFinite(netDebt) ? netDebt : null;
}

/**
 * Calculate percentage change between two values
 * @param {number} oldValue - Starting value
 * @param {number} newValue - Ending value
 * @returns {number|null} Percentage change (as percentage, not decimal)
 */
function calculatePercentageChange(oldValue, newValue) {
  // ACCURACY: Strict validation - ensure both values are finite numbers
  if (oldValue === null || oldValue === undefined || !Number.isFinite(oldValue)) return null;
  if (newValue === null || newValue === undefined || !Number.isFinite(newValue)) return null;

  // ACCURACY: Handle division by zero more accurately
  // For debt metrics: going from 0 to non-zero is a meaningful change
  if (oldValue === 0) {
    if (newValue === 0) return 0;
    // ACCURACY: For debt changes, use absolute change approach when starting from 0
    // Return a large but finite percentage change (1000% = 10x) instead of infinite
    // This is more meaningful for percentile calculations
    return newValue > 0 ? 1000 : -1000; // 10x change or -10x change
  }

  // ACCURACY: Validate result is finite
  const percentageChange = ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  return Number.isFinite(percentageChange) ? percentageChange : null;
}

/**
 * Calculate the number of full months between two dates (later minus earlier)
 * @param {Date} laterDate - The newer date
 * @param {Date} earlierDate - The older date
 * @returns {number} Number of months difference
 */
function getMonthDifference(laterDate, earlierDate) {
  return (
    (laterDate.getFullYear() - earlierDate.getFullYear()) * 12 +
    (laterDate.getMonth() - earlierDate.getMonth())
  );
}

/**
 * Generic helper to find a historical quarter that is roughly the target number of months old
 * and has a valid value for a provided metric extractor. If an exact match is not found within
 * the tolerance window, the closest match is returned. If still not found, the first older quarter
 * with a valid value is used.
 * @param {Array} quarters - Sorted quarterly data (newest first)
 * @param {number} targetMonths - Desired age in months (e.g., 24 for 2 years)
 * @param {Function} metricExtractor - Function that returns the metric value for a quarter
 * @param {number} toleranceMonths - Allowed deviation in months from the target
 * @returns {Object|null} Matching quarter data or null if none found
 */
function findQuarterWithMetricValue(quarters, targetMonths, metricExtractor, toleranceMonths = 3) {
  if (!quarters || quarters.length === 0) return null;

  const currentQuarter = quarters[0];
  if (!currentQuarter || !currentQuarter.date) return null;

  const currentDate = new Date(currentQuarter.date);
  let bestMatch = null;
  let bestDiff = Infinity;

  for (let i = 1; i < quarters.length; i += 1) {
    const candidate = quarters[i];
    if (!candidate || !candidate.date) continue;

    const candidateDate = new Date(candidate.date);
    const monthsDiff = getMonthDifference(currentDate, candidateDate);
    if (monthsDiff < targetMonths - toleranceMonths) {
      continue;
    }

    const value = metricExtractor(candidate);
    if (value === null || value === undefined) {
      continue;
    }

    const diffFromTarget = Math.abs(monthsDiff - targetMonths);
    if (diffFromTarget < bestDiff) {
      bestMatch = candidate;
      bestDiff = diffFromTarget;
      if (bestDiff === 0) {
        break;
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  for (let i = 1; i < quarters.length; i += 1) {
    const candidate = quarters[i];
    if (!candidate) continue;

    const value = metricExtractor(candidate);
    if (value !== null && value !== undefined) {
      return candidate;
    }
  }

  return null;
}

function findQuarterWithNetDebt(quarters, targetMonths, toleranceMonths = 3) {
  return findQuarterWithMetricValue(quarters, targetMonths, calculateNetDebt, toleranceMonths);
}

function findQuarterWithEbitda(quarters, targetMonths, toleranceMonths = 3) {
  return findQuarterWithMetricValue(
    quarters,
    targetMonths,
    (quarter) => (quarter.ebitda === null || quarter.ebitda === undefined ? null : quarter.ebitda),
    toleranceMonths
  );
}

function findQuarterWithNetDebtAndEbitda(quarters, targetMonths, toleranceMonths = 3) {
  return findQuarterWithMetricValue(
    quarters,
    targetMonths,
    (quarter) => {
      const netDebt = calculateNetDebt(quarter);
      if (netDebt === null) return null;

      const ebitda = quarter.ebitda;
      if (ebitda === null || ebitda === undefined || ebitda === 0) return null;

      return { netDebt, ebitda };
    },
    toleranceMonths
  );
}

function calculateDebtToEquityRatio(quarter) {
  if (!quarter) return null;
  const { totalDebt, totalStockholderEquity } = quarter;

  // ACCURACY: Strict validation - ensure both values are finite numbers
  if (totalDebt === null || totalDebt === undefined || !Number.isFinite(totalDebt)) return null;
  if (
    totalStockholderEquity === null ||
    totalStockholderEquity === undefined ||
    !Number.isFinite(totalStockholderEquity)
  )
    return null;

  // ACCURACY: Handle negative equity (company insolvency)
  if (totalStockholderEquity <= 0) return NEGATIVE_EQUITY_PENALTY;

  // ACCURACY: Validate result is finite
  const ratio = totalDebt / totalStockholderEquity;
  return Number.isFinite(ratio) ? ratio : null;
}

function findQuarterWithDebtEquity(quarters, targetMonths, toleranceMonths = 3) {
  return findQuarterWithMetricValue(
    quarters,
    targetMonths,
    (quarter) => calculateDebtToEquityRatio(quarter),
    toleranceMonths
  );
}

/**
 * Calculate CAGR (Compound Annual Growth Rate)
 * @param {number} startValue - Starting value
 * @param {number} endValue - Ending value
 * @param {number} years - Number of years
 * @returns {number|null} CAGR as percentage
 */
function calculateCAGR(startValue, endValue, years) {
  if (
    startValue === null ||
    startValue === undefined ||
    endValue === null ||
    endValue === undefined
  ) {
    return null;
  }

  if (startValue <= 0 || endValue <= 0 || years <= 0) {
    return null;
  }

  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

/**
 * Get quarter data at specific index
 * @param {Array} quarters - Array of quarterly data
 * @param {number} quartersBack - Number of quarters to go back (0 = current)
 * @returns {Object|null} Quarter data or null
 */
function getQuarter(quarters, quartersBack) {
  if (!quarters || !Array.isArray(quarters)) return null;
  if (quartersBack < 0 || quartersBack >= quarters.length) return null;
  return quarters[quartersBack];
}

/**
 * Find the first quarter with valid debt/equity data
 * (income statement/cash flow may have dates that don't match balance sheet)
 * @param {Array} quarters - Array of quarterly data (sorted newest first)
 * @returns {Object|null} First quarter with valid debt/equity data or null
 */
function findFirstQuarterWithDebtEquity(quarters) {
  if (!quarters || !Array.isArray(quarters)) return null;
  return quarters.find(
    (q) =>
      q &&
      q.totalDebt !== null &&
      q.totalDebt !== undefined &&
      q.totalStockholderEquity !== null &&
      q.totalStockholderEquity !== undefined
  );
}

/**
 * Find a quarter N positions back from the first valid debt/equity quarter
 * @param {Array} quarters - Array of quarterly data (sorted newest first)
 * @param {number} quartersBack - Number of quarters to go back from first valid quarter
 * @returns {Object|null} Quarter data or null
 */
function getQuarterWithDebtEquity(quarters, quartersBack) {
  const firstValidIndex = quarters.findIndex(
    (q) =>
      q &&
      q.totalDebt !== null &&
      q.totalDebt !== undefined &&
      q.totalStockholderEquity !== null &&
      q.totalStockholderEquity !== undefined
  );

  if (firstValidIndex === -1) return null;

  const targetIndex = firstValidIndex + quartersBack;
  if (targetIndex < 0 || targetIndex >= quarters.length) return null;

  const targetQuarter = quarters[targetIndex];
  // Verify target quarter also has valid debt/equity data
  if (
    !targetQuarter ||
    targetQuarter.totalDebt === null ||
    targetQuarter.totalDebt === undefined ||
    targetQuarter.totalStockholderEquity === null ||
    targetQuarter.totalStockholderEquity === undefined
  ) {
    return null;
  }

  return targetQuarter;
}

/**
 * Find the first quarter with valid debt/cash data
 * (income statement/cash flow may have dates that don't match balance sheet)
 * @param {Array} quarters - Array of quarterly data (sorted newest first)
 * @returns {Object|null} First quarter with valid debt/cash data or null
 */
function findFirstQuarterWithNetDebt(quarters) {
  if (!quarters || !Array.isArray(quarters)) return null;
  return quarters.find(
    (q) =>
      q &&
      q.totalDebt !== null &&
      q.totalDebt !== undefined &&
      q.cash !== null &&
      q.cash !== undefined
  );
}

/**
 * Find a quarter N positions back from the first valid net debt quarter
 * @param {Array} quarters - Array of quarterly data (sorted newest first)
 * @param {number} quartersBack - Number of quarters to go back from first valid quarter
 * @returns {Object|null} Quarter data or null
 */
function getQuarterWithNetDebt(quarters, quartersBack) {
  const firstValidIndex = quarters.findIndex(
    (q) =>
      q &&
      q.totalDebt !== null &&
      q.totalDebt !== undefined &&
      q.cash !== null &&
      q.cash !== undefined
  );

  if (firstValidIndex === -1) return null;

  const targetIndex = firstValidIndex + quartersBack;
  if (targetIndex < 0 || targetIndex >= quarters.length) return null;

  const targetQuarter = quarters[targetIndex];
  // Verify target quarter also has valid debt/cash data
  if (
    !targetQuarter ||
    targetQuarter.totalDebt === null ||
    targetQuarter.totalDebt === undefined ||
    targetQuarter.cash === null ||
    targetQuarter.cash === undefined
  ) {
    return null;
  }

  return targetQuarter;
}

// ============================================================================
// DEBT-TO-EQUITY METRICS
// ============================================================================

/**
 * Calculate current Debt-to-Equity ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} Current D/E ratio
 */
export function DebtToEquityCurrent(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);

  // Find the first quarter with valid debt/equity data
  // (income statement/cash flow may have dates that don't match balance sheet)
  const current = quarters.find(
    (q) =>
      q &&
      q.totalDebt !== null &&
      q.totalDebt !== undefined &&
      q.totalStockholderEquity !== null &&
      q.totalStockholderEquity !== undefined
  );

  if (!current) return null;

  return calculateDebtToEquityRatio(current);
}

/**
 * Calculate 3-month change in Debt-to-Equity ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 3-month D/E change %
 */
export function DebtToEquityChange3M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithDebtEquity(quarters);
  const previous = getQuarterWithDebtEquity(quarters, 1); // 1 quarter back = ~3 months

  if (!current || !previous) return null;

  const currentDE = calculateDebtToEquityRatio(current);
  const previousDE = calculateDebtToEquityRatio(previous);

  if (currentDE === NEGATIVE_EQUITY_PENALTY || previousDE === NEGATIVE_EQUITY_PENALTY) {
    return NEGATIVE_EQUITY_CHANGE_PENALTY;
  }

  if (currentDE === null || previousDE === null) return null;

  return calculatePercentageChange(previousDE, currentDE);
}

/**
 * Calculate 6-month change in Debt-to-Equity ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 6-month D/E change %
 */
export function DebtToEquityChange6M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithDebtEquity(quarters);
  const previous = getQuarterWithDebtEquity(quarters, 2); // 2 quarters back = ~6 months

  if (!current || !previous) return null;

  const currentDE = calculateDebtToEquityRatio(current);
  const previousDE = calculateDebtToEquityRatio(previous);

  if (currentDE === NEGATIVE_EQUITY_PENALTY || previousDE === NEGATIVE_EQUITY_PENALTY) {
    return NEGATIVE_EQUITY_CHANGE_PENALTY;
  }

  if (currentDE === null || previousDE === null) return null;

  return calculatePercentageChange(previousDE, currentDE);
}

/**
 * Calculate 1-year change in Debt-to-Equity ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 1-year D/E change %
 */
export function DebtToEquityChange1Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithDebtEquity(quarters);
  const previous = getQuarterWithDebtEquity(quarters, 4); // 4 quarters back = 1 year

  if (!current || !previous) return null;

  const currentDE = calculateDebtToEquityRatio(current);
  const previousDE = calculateDebtToEquityRatio(previous);

  if (currentDE === NEGATIVE_EQUITY_PENALTY || previousDE === NEGATIVE_EQUITY_PENALTY) {
    return NEGATIVE_EQUITY_CHANGE_PENALTY;
  }

  if (currentDE === null || previousDE === null) return null;

  return calculatePercentageChange(previousDE, currentDE);
}

/**
 * Calculate 2-year change in Debt-to-Equity ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 2-year D/E change %
 */
export function DebtToEquityChange2Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  const previous = findQuarterWithDebtEquity(quarters, 24);

  if (!current || !previous) return null;

  const currentDE = calculateDebtToEquityRatio(current);
  const previousDE = calculateDebtToEquityRatio(previous);

  if (currentDE === NEGATIVE_EQUITY_PENALTY || previousDE === NEGATIVE_EQUITY_PENALTY) {
    return NEGATIVE_EQUITY_CHANGE_PENALTY;
  }

  if (currentDE === null || previousDE === null) return null;

  return calculatePercentageChange(previousDE, currentDE);
}

// ============================================================================
// NET DEBT / EBITDA METRICS
// ============================================================================

/**
 * Calculate current Net Debt / EBITDA ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} Current Net Debt / EBITDA ratio
 */
export function NetDebtToEBITDACurrent(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);

  if (!current) return null;
  if (current.ebitda === null || current.ebitda === undefined) return null;

  const netDebt = calculateNetDebt(current);
  if (netDebt === null) return null;

  if (current.ebitda === 0) return null;

  return netDebt / Math.abs(current.ebitda);
}

/**
 * Calculate 3-month change in Net Debt / EBITDA ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 3-month Net Debt / EBITDA change %
 */
export function NetDebtToEBITDAChange3M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  const previous = findQuarterWithNetDebtAndEbitda(quarters, 3);

  if (!current || !previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  const currentRatio =
    currentNetDebt !== null &&
    current.ebitda !== null &&
    current.ebitda !== undefined &&
    current.ebitda !== 0
      ? currentNetDebt / Math.abs(current.ebitda)
      : null;
  const previousRatio =
    previousNetDebt !== null &&
    previous.ebitda !== null &&
    previous.ebitda !== undefined &&
    previous.ebitda !== 0
      ? previousNetDebt / Math.abs(previous.ebitda)
      : null;

  return calculatePercentageChange(previousRatio, currentRatio);
}

/**
 * Calculate 6-month change in Net Debt / EBITDA ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 6-month Net Debt / EBITDA change %
 */
export function NetDebtToEBITDAChange6M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  const previous = findQuarterWithNetDebtAndEbitda(quarters, 6);

  if (!current || !previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  const currentRatio =
    currentNetDebt !== null &&
    current.ebitda !== null &&
    current.ebitda !== undefined &&
    current.ebitda !== 0
      ? currentNetDebt / Math.abs(current.ebitda)
      : null;
  const previousRatio =
    previousNetDebt !== null &&
    previous.ebitda !== null &&
    previous.ebitda !== undefined &&
    previous.ebitda !== 0
      ? previousNetDebt / Math.abs(previous.ebitda)
      : null;

  return calculatePercentageChange(previousRatio, currentRatio);
}

/**
 * Calculate 1-year change in Net Debt / EBITDA ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 1-year Net Debt / EBITDA change %
 */
export function NetDebtToEBITDAChange1Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  const previous = findQuarterWithNetDebtAndEbitda(quarters, 12);

  if (!current || !previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  const currentRatio =
    currentNetDebt !== null &&
    current.ebitda !== null &&
    current.ebitda !== undefined &&
    current.ebitda !== 0
      ? currentNetDebt / Math.abs(current.ebitda)
      : null;
  const previousRatio =
    previousNetDebt !== null &&
    previous.ebitda !== null &&
    previous.ebitda !== undefined &&
    previous.ebitda !== 0
      ? previousNetDebt / Math.abs(previous.ebitda)
      : null;

  return calculatePercentageChange(previousRatio, currentRatio);
}

/**
 * Calculate 2-year change in Net Debt / EBITDA ratio
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 2-year Net Debt / EBITDA change %
 */
export function NetDebtToEBITDAChange2Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  const previous = findQuarterWithNetDebtAndEbitda(quarters, 24);

  if (!current || !previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  const currentRatio =
    currentNetDebt !== null &&
    current.ebitda !== null &&
    current.ebitda !== undefined &&
    current.ebitda !== 0
      ? currentNetDebt / Math.abs(current.ebitda)
      : null;
  const previousRatio =
    previousNetDebt !== null &&
    previous.ebitda !== null &&
    previous.ebitda !== undefined &&
    previous.ebitda !== 0
      ? previousNetDebt / Math.abs(previous.ebitda)
      : null;

  return calculatePercentageChange(previousRatio, currentRatio);
}

// ============================================================================
// EBITDA METRICS
// ============================================================================

/**
 * Calculate current EBITDA value
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} Current EBITDA value
 */
export function EBITDACurrent(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);

  if (!current) return null;
  if (current.ebitda === null || current.ebitda === undefined) return null;

  return current.ebitda;
}

/**
 * Calculate 3-month EBITDA growth
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 3-month EBITDA growth %
 */
export function EBITDAGrowth3M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  if (!current || current.ebitda === null || current.ebitda === undefined) return null;

  const previous = findQuarterWithEbitda(quarters, 3);
  if (!previous || previous.ebitda === null || previous.ebitda === undefined) return null;

  return calculatePercentageChange(previous.ebitda, current.ebitda);
}

/**
 * Calculate 6-month EBITDA growth
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 6-month EBITDA growth %
 */
export function EBITDAGrowth6M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  if (!current || current.ebitda === null || current.ebitda === undefined) return null;

  const previous = findQuarterWithEbitda(quarters, 6);
  if (!previous || previous.ebitda === null || previous.ebitda === undefined) return null;

  return calculatePercentageChange(previous.ebitda, current.ebitda);
}

/**
 * Calculate 1-year EBITDA growth
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 1-year EBITDA growth %
 */
export function EBITDAGrowth1Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  if (!current || current.ebitda === null || current.ebitda === undefined) return null;

  const previous = findQuarterWithEbitda(quarters, 12);
  if (!previous || previous.ebitda === null || previous.ebitda === undefined) return null;

  return calculatePercentageChange(previous.ebitda, current.ebitda);
}

/**
 * Calculate 2-year EBITDA CAGR
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 2-year EBITDA CAGR %
 */
export function EBITDAGrowth2Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = getQuarter(quarters, 0);
  if (!current || current.ebitda === null || current.ebitda === undefined) return null;

  const previous = findQuarterWithEbitda(quarters, 24);
  if (!previous || previous.ebitda === null || previous.ebitda === undefined) return null;

  const cagr = calculateCAGR(previous.ebitda, current.ebitda, 2);
  if (cagr !== null) {
    return cagr;
  }

  return calculatePercentageChange(previous.ebitda, current.ebitda);
}

// ============================================================================
// NET DEBT METRICS
// ============================================================================

/**
 * Calculate current Net Debt value
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} Current net debt value
 */
export function NetDebtCurrent(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithNetDebt(quarters);

  if (!current) return null;

  return calculateNetDebt(current);
}

/**
 * Calculate 3-month change in Net Debt
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 3-month Net Debt change %
 */
export function NetDebtChange3M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithNetDebt(quarters);
  const previous = getQuarterWithNetDebt(quarters, 1);

  if (!current || !previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  if (currentNetDebt === null || previousNetDebt === null) return null;

  return calculatePercentageChange(previousNetDebt, currentNetDebt);
}

/**
 * Calculate 6-month change in Net Debt
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 6-month Net Debt change %
 */
export function NetDebtChange6M(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithNetDebt(quarters);
  const previous = getQuarterWithNetDebt(quarters, 2);

  if (!current || !previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  if (currentNetDebt === null || previousNetDebt === null) return null;

  return calculatePercentageChange(previousNetDebt, currentNetDebt);
}

/**
 * Calculate 1-year change in Net Debt
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 1-year Net Debt change %
 */
export function NetDebtChange1Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithNetDebt(quarters);
  const previous = getQuarterWithNetDebt(quarters, 4);

  if (!current || !previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  if (currentNetDebt === null || previousNetDebt === null) return null;

  return calculatePercentageChange(previousNetDebt, currentNetDebt);
}

/**
 * Calculate 2-year change in Net Debt
 * @param {Object} fundamentals - Fundamentals data
 * @returns {number|null} 2-year Net Debt change %
 */
export function NetDebtChange2Y(fundamentals) {
  const quarters = getQuarterlyData(fundamentals);
  const current = findFirstQuarterWithNetDebt(quarters);
  if (!current) return null;

  const previous = findQuarterWithNetDebt(quarters, 24);
  if (!previous) return null;

  const currentNetDebt = calculateNetDebt(current);
  const previousNetDebt = calculateNetDebt(previous);

  if (currentNetDebt === null || previousNetDebt === null) return null;

  return calculatePercentageChange(previousNetDebt, currentNetDebt);
}
