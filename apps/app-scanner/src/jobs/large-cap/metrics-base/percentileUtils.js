/**
 * Percentile Calculation Utilities
 *
 * This module provides functions for calculating percentile ranks of company metrics
 * relative to their industry or sector peers.
 */

/**
 * Calculate quartiles (Q1, Q3) and IQR for outlier detection
 * @param {Array<number>} sortedArray - Sorted array of values
 * @returns {Object} Object with q1, q3, iqr, lowerBound, upperBound
 */
function calculateIQR(sortedArray) {
  if (!Array.isArray(sortedArray) || sortedArray.length === 0) {
    return null;
  }

  const n = sortedArray.length;
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sortedArray[q1Index];
  const q3 = sortedArray[q3Index];
  const iqr = q3 - q1;

  return {
    q1,
    q3,
    iqr,
    lowerBound: q1 - 1.5 * iqr,
    upperBound: q3 + 1.5 * iqr,
  };
}

/**
 * Cap outliers using IQR method
 * @param {Array<{symbol: string, value: number}>} items - Array of items with symbol and value
 * @returns {Array<{symbol: string, value: number, wasCapped: boolean}>} Items with capped values
 */
function capOutliers(items) {
  if (items.length < 4) {
    // Need at least 4 values for meaningful IQR
    return items.map((item) => ({ ...item, wasCapped: false }));
  }

  const sortedValues = [...items]
    .map((item) => item.value)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  const iqrStats = calculateIQR(sortedValues);
  if (!iqrStats || iqrStats.iqr <= 0) {
    return items.map((item) => ({ ...item, wasCapped: false }));
  }

  const { lowerBound, upperBound } = iqrStats;

  const capped = items.map((item) => {
    const originalValue = item.value;
    if (!Number.isFinite(originalValue)) {
      return { ...item, wasCapped: false };
    }

    let cappedValue = originalValue;
    if (originalValue < lowerBound) {
      cappedValue = lowerBound;
    } else if (originalValue > upperBound) {
      cappedValue = upperBound;
    }

    return {
      ...item,
      value: cappedValue,
      wasCapped: cappedValue !== originalValue,
    };
  });

  return capped;
}

/**
 * Calculate percentile rank for a value in a sorted array using dense ranking
 * Handles ties correctly by giving same percentile to equal values
 *
 * CONSERVATIVE APPROACH: Returns null if percentile cannot be accurately calculated
 *
 * @param {number} value - The value to find percentile for
 * @param {Array<number>} sortedArray - Sorted array of values
 * @returns {number|null} Percentile rank as decimal (0-1), e.g., 0.72 = 72nd percentile, or null if cannot be calculated accurately
 */
export function calculatePercentileRank(value, sortedArray) {
  if (!Array.isArray(sortedArray) || sortedArray.length === 0) {
    return null;
  }

  // Handle null/undefined values
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }

  // CONSERVATIVE: For single value, cannot calculate meaningful percentile
  if (sortedArray.length === 1) {
    return null; // Not enough data for accurate percentile
  }

  // Find the rank using dense ranking (ties get same rank)
  let rank = 0;
  let uniqueRank = 0;
  let lastValue = null;

  for (let i = 0; i < sortedArray.length; i++) {
    const currentValue = sortedArray[i];

    // If this is a new unique value, increment the unique rank
    if (currentValue !== lastValue) {
      uniqueRank++;
      lastValue = currentValue;
    }

    // If we found our value, record its rank
    if (currentValue === value) {
      rank = uniqueRank;
    }
  }

  // Calculate percentile using formula: p = (rank - 1) / (uniqueValues - 1)
  // where uniqueValues is the number of unique values in the array
  const uniqueValues = [...new Set(sortedArray)].length;

  // CONSERVATIVE: Handle edge cases - return null if cannot calculate accurately
  if (uniqueValues === 1) {
    // All values are the same - cannot meaningfully rank (division by zero)
    // Return null instead of defaulting to 0.5
    return null;
  }

  if (uniqueValues === 2) {
    // Only 2 unique values - can calculate but be conservative
    // Only return percentile if we have enough samples (at least 5)
    if (sortedArray.length < 5) {
      return null; // Not enough data for accurate percentile with only 2 unique values
    }
    // Use simple binary ranking for 2 unique values with sufficient samples
    const sortedUnique = [...new Set(sortedArray)].sort((a, b) => a - b);
    return value === sortedUnique[0] ? 0.0 : 1.0;
  }

  // Standard formula for 3+ unique values
  // Additional safety check: ensure we have enough samples relative to unique values
  // Require at least 2 samples per unique value for accuracy
  if (sortedArray.length < uniqueValues * 2) {
    return null; // Not enough samples for accurate percentile calculation
  }

  return (rank - 1) / (uniqueValues - 1);
}

/**
 * Validate percentile value before storage
 * @param {number} percentile - Percentile value to validate
 * @param {string} symbol - Company symbol (for logging)
 * @param {string} metricName - Metric name (for logging)
 * @param {Function} log - Logging function
 * @returns {number|null} Validated percentile or null if invalid
 */
function validatePercentile(percentile, symbol, metricName, log) {
  if (percentile === null || percentile === undefined) {
    return null;
  }

  if (!Number.isFinite(percentile)) {
    log(`   ⚠️  Invalid percentile for ${symbol}.${metricName}: ${percentile} (not finite)`);
    return null;
  }

  if (percentile < 0 || percentile > 1) {
    log(
      `   ⚠️  Out-of-range percentile for ${symbol}.${metricName}: ${percentile}, clamping to [0, 1]`
    );
    return Math.max(0, Math.min(1, percentile));
  }

  return percentile;
}

/**
 * Compute dense percentile ranks for an array of values
 * Handles ties by giving same percentile to equal values
 * @param {Array<{symbol: string, value: number}>} items - Array of items with symbol and value
 * @param {Object} options - Options for percentile calculation
 * @param {number} options.minSampleSize - Minimum sample size required (default: 10)
 * @param {boolean} options.capOutliers - Whether to cap outliers using IQR (default: true)
 * @param {Function} options.log - Logging function (optional)
 * @param {string} options.metricName - Metric name for logging (optional)
 * @returns {Map<string, number>} Map of symbol -> percentile rank
 */
export function computePercentiles(values, options = {}) {
  const {
    minSampleSize = 10, // Increased from 5 to 10 for more stable percentiles
    capOutliers: shouldCapOutliers = true,
    log = null,
    metricName = null,
  } = options;

  if (!Array.isArray(values) || values.length === 0) {
    return new Map();
  }

  // Filter out invalid values and sort
  let validItems = values.filter(
    (item) => item && typeof item.value === "number" && !isNaN(item.value) && item.symbol
  );

  if (validItems.length === 0) {
    return new Map();
  }

  // CONSERVATIVE: Minimum sample size check - be strict about accuracy
  if (validItems.length < minSampleSize) {
    if (log && metricName) {
      log(
        `   ⚠️  ${metricName}: Insufficient sample size (${validItems.length} < ${minSampleSize}) - skipping percentile calculation for accuracy`
      );
    }
    return new Map(); // Return empty map - not enough data for accurate percentiles
  }

  // CONSERVATIVE: Additional check - ensure we have enough unique values
  // Need at least 3 unique values for meaningful percentile distribution
  const uniqueValueCount = new Set(validItems.map((item) => item.value)).size;
  if (uniqueValueCount < 3) {
    if (log && metricName) {
      log(
        `   ⚠️  ${metricName}: Insufficient unique values (${uniqueValueCount} < 3) - skipping percentile calculation for accuracy`
      );
    }
    return new Map(); // Return empty map - not enough variation for accurate percentiles
  }

  // CRITICAL FIX: Cap outliers FIRST, then use full distribution (no trimming needed)
  // This ensures consistency: capped values are used throughout
  if (shouldCapOutliers && validItems.length >= 4) {
    const capped = capOutliers(validItems);
    const cappedCount = capped.filter((item) => item.wasCapped).length;
    if (cappedCount > 0 && log && metricName) {
      log(`   📊 ${metricName}: Capped ${cappedCount} outliers using IQR method`);
    }
    // Use capped values consistently throughout
    validItems = capped.map((item) => ({
      ...item,
      value: item.value, // Use capped value consistently
    }));
  }

  // Use full distribution (no trimming) since outliers are already capped
  // Sort by value in ascending order
  const sortedValues = validItems.map((item) => item.value).sort((a, b) => a - b);

  // Create unique sorted values for percentile calculation
  const uniqueValues = [...new Set(sortedValues)].sort((a, b) => a - b);

  const result = new Map();

  // Calculate percentile for each item using the full distribution
  validItems.forEach((item) => {
    const percentile = calculatePercentileRank(item.value, uniqueValues);
    if (percentile !== null) {
      // Validate percentile before storing
      const validated = validatePercentile(
        percentile,
        item.symbol,
        metricName || "unknown",
        log || (() => {})
      );
      if (validated !== null) {
        result.set(item.symbol, validated);
      }
    }
  });

  return result;
}

/**
 * Assign percentile ranks for a specific metric within a group
 * @param {Array} items - Array of company items with metrics
 * @param {string} metricName - Name of the metric to calculate percentiles for
 * @param {Function} log - Logging function
 * @returns {Map<string, number>} Map of symbol -> percentile rank
 */
export function assignPercentiles(items, metricName, log) {
  // Collect valid values for the metric
  const values = [];

  const getMetricValue = (metrics, name) => {
    if (!metrics || typeof metrics !== "object") return undefined;

    if (!name.includes(".")) {
      return metrics[name];
    }

    return name.split(".").reduce((acc, segment) => {
      if (acc === null || acc === undefined) return undefined;
      const next = acc[segment];
      return next;
    }, metrics);
  };

  items.forEach((item) => {
    const { symbol, metrics } = item;
    const value = getMetricValue(metrics, metricName);

    // ACCURACY: Strict validation - only include finite numbers
    // Exclude null, undefined, NaN, Infinity, and -Infinity
    if (value !== null && value !== undefined) {
      const numValue = Number(value);

      // ACCURACY: Must be a finite number (excludes NaN, Infinity, -Infinity)
      if (!Number.isFinite(numValue)) {
        return; // Skip invalid values
      }

      // For valuation metrics, check quality flag - exclude N/A quality (uncertain metrics)
      if (metricName.includes("valuation")) {
        // Extract the valuation namespace (e.g., "valuationDCF" from "valuationDCF.upsidePct")
        const namespaceMatch = metricName.match(/^(valuation\w+)\./);
        if (namespaceMatch) {
          const namespace = namespaceMatch[1];
          const qualityPath = `${namespace}.quality`;
          const quality = getMetricValue(metrics, qualityPath);

          // Exclude if quality is N/A (uncertain) - only include HIGH, MEDIUM, or LOW
          if (quality === "N/A" || quality === null || quality === undefined) {
            return; // Skip this company for this metric - not certain enough
          }
        }
      }

      // ACCURACY: Additional validation for debt metrics
      // Exclude extreme outliers that are likely data errors
      if (metricName.includes("Debt") || metricName.includes("NetDebt")) {
        // For debt ratios, exclude values > 1000 (likely data error)
        // For net debt values, exclude values > 1 trillion (likely data error)
        if (metricName.includes("Ratio") || metricName.includes("Equity")) {
          if (Math.abs(numValue) > 1000) {
            return; // Skip extreme outliers - likely data error
          }
        } else if (Math.abs(numValue) > 1e12) {
          // Net debt in absolute terms - exclude values > 1 trillion
          return; // Skip extreme outliers - likely data error
        }
      }

      values.push({
        symbol,
        value: numValue,
      });
    }
  });

  if (values.length === 0) {
    log(`   ⚠️  No valid values found for ${metricName}`);
    return new Map();
  }

  // Determine if this metric should have outlier capping applied
  // ACCURACY: Debt change metrics also benefit from outlier capping
  // Growth metrics, price changes, and debt changes can have extreme outliers
  const shouldCapOutliers =
    metricName.includes("Growth") ||
    metricName.includes("Change") ||
    metricName.includes("PriceChange") ||
    (metricName.includes("Debt") && metricName.includes("Change"));

  // Use the optimized computePercentiles function with outlier capping for growth metrics
  const percentiles = computePercentiles(values, {
    minSampleSize: 10, // Increased from 5 to 10 for more stable percentiles
    capOutliers: shouldCapOutliers,
    log,
    metricName,
  });

  if (percentiles.size === 0 && values.length > 0) {
    log(
      `   ⚠️  ${metricName}: Insufficient sample size (${values.length} < 10) for meaningful percentiles`
    );
    return new Map();
  }

  log(
    `   📈 ${metricName}: ${values.length} valid values, ${percentiles.size} percentiles computed`
  );

  return percentiles;
}

/**
 * Compute percentile ranks for a group of companies (optimized version)
 * @param {string} groupKey - Group identifier (industry or sector name)
 * @param {Array} items - Array of company items with metrics
 * @param {Array<string>} metricsList - List of metric names to calculate percentiles for
 * @param {Function} log - Logging function
 * @returns {Object} Object mapping company symbols to their percentile ranks
 */
export function computePercentilesForGroup(groupKey, items, metricsList, log) {
  log(`📊 Computing percentiles for ${groupKey} (${items.length} companies)`);

  const results = {};

  // Calculate percentiles for each metric using optimized function
  metricsList.forEach((metric) => {
    const percentiles = assignPercentiles(items, metric, log);

    // Store results
    percentiles.forEach((percentile, symbol) => {
      if (!results[symbol]) {
        results[symbol] = {};
      }
      results[symbol][metric] = percentile;
    });
  });

  const companiesWithPercentiles = Object.keys(results).length;
  log(`   ✅ Computed percentiles for ${companiesWithPercentiles} companies in ${groupKey}`);

  return results;
}

/**
 * Get all companies in a specific group (industry or sector)
 * @param {Object} Fundamentals - Fundamentals model
 * @param {Object} Metrics - Metrics model
 * @param {string} groupBy - 'industry' or 'sector'
 * @param {string} groupKey - Group name (e.g., 'Technology', 'Software - Application')
 * @param {Function} log - Logging function
 * @returns {Array} Array of company items with metrics
 */
export async function getCompaniesInGroup(Fundamentals, Metrics, groupBy, groupKey, log) {
  log(`🔍 Finding companies in ${groupBy}: ${groupKey}`);

  // Get all companies in this group from fundamentals
  const fundamentalsQuery = {};
  const field =
    groupBy === "industry" ? "fundamentals.General.Industry" : "fundamentals.General.Sector";

  if (groupKey === "Unknown") {
    // Query for companies with missing or empty sector/industry
    fundamentalsQuery["$or"] = [
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: "" },
    ];
  } else {
    // Regular query for specific sector/industry
    if (groupBy === "industry") {
      fundamentalsQuery["fundamentals.General.Industry"] = groupKey;
    } else if (groupBy === "sector") {
      fundamentalsQuery["fundamentals.General.Sector"] = groupKey;
    }
  }

  const companiesInGroup = await Fundamentals.find(fundamentalsQuery).select("symbol");

  if (!companiesInGroup.length) {
    log(`   ⚠️  No companies found in ${groupBy}: ${groupKey}`);
    return [];
  }

  const symbols = companiesInGroup.map((c) => c.symbol);
  log(`   📋 Found ${symbols.length} companies in ${groupBy}: ${groupKey}`);

  // Get metrics for these companies
  const metricsDocs = await Metrics.find({ symbol: { $in: symbols } });

  const items = metricsDocs.map((doc) => ({
    symbol: doc.symbol,
    metrics: doc.metrics,
    lastUpdated: doc.lastUpdated,
  }));

  const companiesWithMetrics = items.filter(
    (item) => item.metrics && typeof item.metrics === "object"
  ).length;
  log(`   📊 Found metrics for ${companiesWithMetrics}/${symbols.length} companies`);

  return items;
}

/**
 * Update company metrics with percentile ranks (single company)
 * @param {Object} Metrics - Metrics model
 * @param {string} symbol - Company symbol
 * @param {string} groupBy - 'industry' or 'sector'
 * @param {Object} percentiles - Percentile ranks for each metric
 * @param {Function} log - Logging function
 * @returns {boolean} Success status
 */
export async function updateCompanyPercentiles(Metrics, symbol, groupBy, percentiles, log) {
  try {
    // Use $set with dot notation to merge percentiles instead of replacing
    // This ensures we only update the percentiles that were calculated, preserving others
    const updateQuery = {
      $set: {
        lastUpdated: new Date(),
      },
    };

    // Set each percentile individually using dot notation to merge with existing percentiles
    Object.keys(percentiles).forEach((metric) => {
      updateQuery.$set[`metrics.percentiles.${groupBy}.${metric}`] = percentiles[metric];
    });

    const result = await Metrics.updateOne({ symbol }, updateQuery);

    if (result.matchedCount === 0) {
      log(`   ⚠️  No metrics document found for ${symbol}`);
      return false;
    }

    if (result.modifiedCount > 0) {
      log(`   ✅ Updated percentiles for ${symbol} (${groupBy})`);
      return true;
    } else {
      log(`   ℹ️  No changes needed for ${symbol} (${groupBy})`);
      return true;
    }
  } catch (error) {
    log(`   ❌ Failed to update percentiles for ${symbol}: ${error.message}`);
    return false;
  }
}

/**
 * Update multiple companies' percentiles using bulk write (more efficient)
 * @param {Object} Metrics - Metrics model
 * @param {string} groupBy - 'industry' or 'sector'
 * @param {Object} percentileResults - Object mapping symbols to their percentile ranks
 * @param {Function} log - Logging function
 * @param {number} batchSize - Batch size for bulk operations (default: 500)
 * @returns {Object} Results with { updated: number, failed: number }
 */
export async function updateCompanyPercentilesBulk(
  Metrics,
  groupBy,
  percentileResults,
  log,
  batchSize = 500
) {
  const bulkOps = [];
  const symbols = Object.keys(percentileResults);

  // Build bulk operations
  symbols.forEach((symbol) => {
    const percentiles = percentileResults[symbol];
    if (!percentiles || Object.keys(percentiles).length === 0) {
      return; // Skip if no percentiles
    }

    const updateQuery = {
      $set: {
        lastUpdated: new Date(),
      },
    };

    // Set each percentile individually using dot notation
    Object.keys(percentiles).forEach((metric) => {
      updateQuery.$set[`metrics.percentiles.${groupBy}.${metric}`] = percentiles[metric];
    });

    bulkOps.push({
      updateOne: {
        filter: { symbol },
        update: updateQuery,
      },
    });
  });

  if (bulkOps.length === 0) {
    log(`   ⚠️  No bulk operations to execute`);
    return { updated: 0, failed: 0 };
  }

  let totalUpdated = 0;
  let totalFailed = 0;

  // Execute in batches
  for (let i = 0; i < bulkOps.length; i += batchSize) {
    const batch = bulkOps.slice(i, i + batchSize);
    try {
      const result = await Metrics.bulkWrite(batch, { ordered: false });
      totalUpdated += result.modifiedCount || 0;
      totalFailed += result.writeErrors?.length || 0;

      if (result.writeErrors && result.writeErrors.length > 0) {
        log(
          `   ⚠️  Bulk write batch ${Math.floor(i / batchSize) + 1}: ${
            result.writeErrors.length
          } errors`
        );
        result.writeErrors.forEach((error) => {
          log(`      ❌ ${error.op?.filter?.symbol}: ${error.errmsg}`);
        });
      }
    } catch (error) {
      log(`   ❌ Bulk write batch ${Math.floor(i / batchSize) + 1} failed: ${error.message}`);
      totalFailed += batch.length;
    }
  }

  log(`   ✅ Bulk updated ${totalUpdated} companies, ${totalFailed} failed`);
  return { updated: totalUpdated, failed: totalFailed };
}

/**
 * Get all unique groups (industries or sectors) from fundamentals
 * @param {Object} Fundamentals - Fundamentals model
 * @param {string} groupBy - 'industry' or 'sector'
 * @param {Function} log - Logging function
 * @returns {Array<string>} Array of unique group names
 */
export async function getAllGroups(Fundamentals, groupBy, log) {
  const { getModel } = await import("@buydy/se-db");
  const Metrics = getModel("metrics");
  const field =
    groupBy === "industry" ? "fundamentals.General.Industry" : "fundamentals.General.Sector";

  const groups = await Fundamentals.distinct(field);

  // Filter out null, undefined, and empty values but keep "Unknown" if it exists
  const validGroups = groups.filter(
    (group) => group && typeof group === "string" && group.trim() !== ""
  );

  // Check if there are companies with missing sector/industry that have metrics
  const companiesWithoutGroup = await Fundamentals.find({
    $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }],
  }).select("symbol");

  if (companiesWithoutGroup.length > 0) {
    const symbolsWithoutGroup = companiesWithoutGroup.map((c) => c.symbol);

    // Check if any of these symbols have metrics
    const metricsCount = await Metrics.countDocuments({
      symbol: { $in: symbolsWithoutGroup },
    });

    // Add "Unknown" if there are companies with metrics but missing sector/industry
    if (metricsCount > 0 && !validGroups.includes("Unknown")) {
      validGroups.push("Unknown");
      log(
        `   ℹ️  Added "Unknown" ${groupBy} (${metricsCount} companies with missing ${groupBy} data)`
      );
    }
  }

  log(`📋 Found ${validGroups.length} unique ${groupBy}s`);
  return validGroups;
}

/**
 * Check if a group needs percentile recalculation based on freshness
 * @param {Array} items - Array of company items with lastUpdated timestamps
 * @param {Date} lastRunTime - When the percentile job last ran
 * @param {Function} log - Logging function
 * @returns {boolean} True if group needs recalculation
 */
export function needsRecalculation(items, lastRunTime, log) {
  if (!lastRunTime) {
    return true; // No previous run, need to calculate
  }

  // Check if any company has updated metrics since last run
  const hasUpdates = items.some((item) => {
    const lastUpdated = item.lastUpdated || item.metrics?.lastCalculated;
    return lastUpdated && new Date(lastUpdated) > lastRunTime;
  });

  if (hasUpdates) {
    log(`   🔄 Group needs recalculation: companies updated since last run`);
    return true;
  }

  log(`   ⏭️  Group is fresh: no updates since last run`);
  return false;
}

/**
 * Process groups in batches with concurrency control
 * @param {Array} groups - Array of group names to process
 * @param {Function} processGroup - Function to process each group
 * @param {number} concurrency - Number of concurrent groups to process
 * @param {Function} log - Logging function
 * @returns {Array} Array of results from processing groups
 */
export async function processGroupsInBatches(groups, processGroup, concurrency = 10, log) {
  const results = [];

  for (let i = 0; i < groups.length; i += concurrency) {
    const batch = groups.slice(i, i + concurrency);
    log(
      `📦 Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(
        groups.length / concurrency
      )} (${batch.length} groups)`
    );

    const batchPromises = batch.map(async (group) => {
      try {
        return await processGroup(group);
      } catch (error) {
        log(`   ❌ Failed to process group ${group}: ${error.message}`, "error");
        return { group, ok: false, error: error.message };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    results.push(
      ...batchResults.map((result) =>
        result.status === "fulfilled" ? result.value : { ok: false, error: result.reason }
      )
    );
  }

  return results;
}
