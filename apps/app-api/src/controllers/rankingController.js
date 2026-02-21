import { getModel } from '@buydy/se-db';
import { filterStocksByPriceRange } from './priceRangeController.js';
import {
  getMetricsMapByType,
  validateMetrics,
} from '@buydy/iso-business-types';
import { geometricMean, clamp } from '@buydy/iso-js';
import logger from '@buydy/se-logger';

/**
 * Ranking Controller
 *
 * Provides API endpoints for ranking companies based on weighted average scores.
 * Handles bulk operations: accepts symbols array and fetches data from database.
 */

const metricsMeta = getMetricsMapByType();
const INVERTED_CATEGORIES = new Set(['debt', 'leverage']);
const PRICE_PERFORMANCE_METRICS = new Set([
  'PriceChange1W',
  'PriceChange1M',
  'PriceChange3M',
  'PriceChange6M',
  'PriceChange1Y',
]);

function transformPercentile(metricKey, percentile) {
  if (
    percentile === null ||
    percentile === undefined ||
    Number.isNaN(percentile)
  ) {
    return null;
  }

  const metricConfig = metricsMeta[metricKey];
  if (metricConfig && INVERTED_CATEGORIES.has(metricConfig.category)) {
    const inverted = 1 - percentile;
    return Math.max(0, Math.min(1, inverted));
  }

  return percentile;
}

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(source, pathSegments) {
  return pathSegments.reduce((acc, key) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }
    return acc[key];
  }, source);
}

/**
 * Calculate weighted percentile score
 * Uses equal weighting (1/n for n metrics) if weights not provided
 */
function calculateWeightedRank(company, metrics, weights = {}) {
  let totalWeight = 0;
  let weightedSum = 0;

  metrics.forEach((metricKey) => {
    // Map metric key to dbField path (e.g., "ValuationDCF_Upside" -> "valuationDCF.upsidePct")
    const metricConfig = metricsMeta[metricKey];
    const dbField = metricConfig?.dbField || metricKey;
    const pathSegments = dbField.split('.');

    // Get percentile value using dbField path
    const percentileValue = getNestedValue(company.percentiles, pathSegments);

    // Company percentiles are already filtered by sector/industry
    const percentile = transformPercentile(metricKey, percentileValue);

    // Use provided weight or default to 1 (equal weighting)
    const weight = weights[metricKey] || 1;

    if (percentile !== null && percentile !== undefined && !isNaN(percentile)) {
      weightedSum += percentile * weight;
      totalWeight += weight;
    }
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate geometric mean percentile score
 * ACCURACY: If metric is selected but missing/null, it's treated as 0 (penalty)
 * ACCURACY: If any percentile is 0, geometric mean is 0 (mathematically correct)
 * ACCURACY: All selected metrics must be included in calculation
 *
 * @param {Object} company - Company object with percentiles
 * @param {Array<string>} metrics - Array of metric keys to include
 * @param {Object} _weights - Optional weights for each metric (not used in geometric mean, but kept for API compatibility)
 * @returns {number} Geometric mean score (0-1), or 0 if any metric is missing/zero
 */
function calculateGeometricMeanRank(company, metrics, _weights = {}) {
  if (!metrics || metrics.length === 0) {
    return 0;
  }

  // Collect all percentile values for selected metrics
  // CRITICAL: Include ALL selected metrics, even if null/undefined (treat as 0)
  const percentileValues = [];

  metrics.forEach((metricKey) => {
    // Map metric key to dbField path
    const metricConfig = metricsMeta[metricKey];
    const dbField = metricConfig?.dbField || metricKey;
    const pathSegments = dbField.split('.');

    // Get percentile value using dbField path
    const percentileValue = getNestedValue(company.percentiles, pathSegments);

    // Transform percentile (invert debt/leverage metrics)
    const percentile = transformPercentile(metricKey, percentileValue);

    // ACCURACY: If metric is selected but missing/null, treat as 0 (penalty)
    // This ensures companies with incomplete data are penalized
    let valueToUse = 0;

    if (
      percentile !== null &&
      percentile !== undefined &&
      !Number.isNaN(percentile) &&
      Number.isFinite(percentile)
    ) {
      // Clamp percentile to [0, 1] for safety
      valueToUse = clamp(percentile, 0, 1);
    }
    // else: valueToUse remains 0 (penalty for missing metric)

    percentileValues.push(valueToUse);
  });

  // ACCURACY: If any value is 0, geometric mean is 0 (mathematically correct)
  // This is the key property: one weak/missing metric zeros out the entire score
  if (percentileValues.some((v) => v === 0)) {
    return 0;
  }

  // ACCURACY: All values must be positive (> 0) for geometric mean
  // Use iso geometricMean function which handles the log-based calculation accurately
  const result = geometricMean(percentileValues, 0);

  // Ensure result is between 0 and 1
  return clamp(result, 0, 1);
}

/**
 * POST /api/v1/ranking/calculate
 *
 * Rank companies based on selected ranking method (weighted average or geometric mean)
 * Accepts symbols array and fetches companies from database in bulk
 * Supports optional price range filtering and groupBy (sector/industry)
 * Returns top 30 companies with company symbol and score
 */
export async function calculateRanking(req, res) {
  try {
    logger.debug('=== CALCULATE RANKING CALLED (BULK MODE) ===');
    const {
      symbols,
      metrics,
      weights,
      method = 'weighted', // 'weighted' | 'geometric' - ranking method
      groupBy = 'sector', // 'sector' | 'industry' - determines which percentiles to use
      priceRangeFilters,
    } = req.body;
    const requestedMetrics = Array.isArray(metrics) ? metrics : [];
    const excludedPriceMetrics = requestedMetrics.filter((metric) =>
      PRICE_PERFORMANCE_METRICS.has(metric),
    );
    const sanitizedMetrics = requestedMetrics.filter(
      (metric) => !PRICE_PERFORMANCE_METRICS.has(metric),
    );
    const sanitizedWeights =
      weights && typeof weights === 'object'
        ? Object.fromEntries(
            Object.entries(weights).filter(([metric]) =>
              sanitizedMetrics.includes(metric),
            ),
          )
        : {};

    // Validate method
    if (!['weighted', 'geometric'].includes(method)) {
      return res.status(400).json({
        error: "Invalid method parameter. Must be 'weighted' or 'geometric'",
      });
    }

    logger.debug('Request body', {
      symbolsCount: symbols?.length,
      requestedMetricsCount: requestedMetrics.length,
      sanitizedMetricsCount: sanitizedMetrics.length,
      excludedPriceMetricsCount: excludedPriceMetrics.length,
      method,
      groupBy,
      priceRangeFilters,
    });

    if (excludedPriceMetrics.length > 0) {
      logger.debug('Excluding price performance metrics from ranking request', {
        excludedPriceMetrics,
      });
    }

    // Validate input
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Invalid input: symbols array is required',
      });
    }

    if (sanitizedMetrics.length === 0) {
      return res.status(400).json({
        error:
          'Price performance metrics cannot be used for ranking. Please select at least one non-price metric.',
      });
    }

    // Validate groupBy
    if (!['sector', 'industry'].includes(groupBy)) {
      return res.status(400).json({
        error: "Invalid groupBy parameter. Must be 'sector' or 'industry'",
      });
    }

    // Validate metrics
    const validation = validateMetrics(sanitizedMetrics);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid metrics requested',
        invalidMetrics: validation.invalid,
      });
    }

    // Apply price range filtering first if provided
    let symbolsToProcess = symbols;
    let blacklistedSymbols = [];

    if (priceRangeFilters && Object.keys(priceRangeFilters).length > 0) {
      logger.debug(
        `Starting price range filtering for ${symbols.length} symbols`,
        {
          priceRangeFilters,
        },
      );

      try {
        const filterResult = await filterStocksByPriceRange(
          symbols,
          priceRangeFilters,
        );

        blacklistedSymbols = filterResult.blacklist;
        symbolsToProcess = filterResult.passed;

        logger.debug(
          `Price range filtering: ${filterResult.passed.length} passed, ${filterResult.blacklist.length} blacklisted`,
        );
      } catch (error) {
        logger.business('Error applying price range filters', {
          error: error.message,
        });
        // Continue without filtering if there's an error
      }
    }

    // Fetch companies from database with their metrics and percentiles IN BULK
    const Fundamentals = getModel('fundamentals');

    logger.debug(
      `Fetching ${symbolsToProcess.length} companies from database in bulk`,
    );

    const pipeline = [
      // Match companies by symbols - THIS FETCHES ALL AT ONCE
      {
        $match: {
          symbol: { $in: symbolsToProcess },
        },
      },
      // Join with metrics collection
      {
        $lookup: {
          from: 'metrics',
          localField: 'symbol',
          foreignField: 'symbol',
          as: 'metricsData',
        },
      },
      // Only keep companies that have metrics
      {
        $match: {
          'metricsData.0': { $exists: true },
        },
      },
      // Unwind metricsData to get single document
      {
        $unwind: '$metricsData',
      },
      // Project needed fields
      {
        $project: {
          symbol: 1,
          sector: '$fundamentals.General.Sector',
          industry: '$fundamentals.General.Industry',
          percentiles: '$metricsData.metrics.percentiles',
        },
      },
    ];

    const companies = await Fundamentals.aggregate(pipeline);

    logger.debug(
      `Fetched ${companies.length} companies from database in single query`,
    );

    // Calculate scores for each company using selected method
    const rankedCompanies = companies
      .map((company) => {
        // Extract percentiles based on groupBy
        const percentileSource =
          groupBy === 'industry'
            ? company.percentiles?.industry
            : company.percentiles?.sector;

        // Build company object in expected format
        const companyData = {
          symbol: company.symbol,
          percentiles: percentileSource || {},
        };

        // Calculate score using selected method
        let score;
        if (method === 'geometric') {
          score = calculateGeometricMeanRank(
            companyData,
            sanitizedMetrics,
            sanitizedWeights,
          );
        } else {
          // Default to weighted average
          score = calculateWeightedRank(
            companyData,
            sanitizedMetrics,
            sanitizedWeights,
          );
        }

        return {
          symbol: company.symbol,
          score: Math.round(score * 10000) / 10000, // Round to 4 decimal places for accuracy
        };
      })
      // Filter out companies with zero score (no valid percentiles)
      .filter((company) => company.score > 0)
      // Sort by score (descending)
      .sort((a, b) => b.score - a.score)
      // Take top 30 only
      .slice(0, 30);

    res.json({
      topCompanies: rankedCompanies,
      metrics: sanitizedMetrics,
      method,
      groupBy,
      filtering: {
        totalSymbols: symbols.length,
        processedSymbols: symbolsToProcess.length,
        companiesWithMetrics: companies.length,
        rankedCompanies: rankedCompanies.length,
        blacklistedSymbols: blacklistedSymbols.length,
        priceRangeFilters: priceRangeFilters || null,
      },
    });
  } catch (error) {
    logger.business('Error calculating ranking', { error: error.message });
    res.status(500).json({
      error: 'Failed to calculate ranking',
      message: error.message,
    });
  }
}
