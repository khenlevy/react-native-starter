import { getModel } from '@buydy/se-db';
import logger from '@buydy/se-logger';

/**
 * Price Range Controller
 *
 * Handles multi-period price range filtering using metrics from the metrics collection
 * Supports 1W, 1M, 3M, 6M, 1Y price change percentage filters
 */

// Map filter period names to metric field names in the metrics collection
const PERIOD_TO_METRIC_MAP = {
  '1W': 'PriceChange1W',
  '1M': 'PriceChange1M',
  '3M': 'PriceChange3M',
  '6M': 'PriceChange6M',
  '1Y': 'PriceChange1Y',
};

/**
 * Filter stocks based on price change percentage criteria
 * @param {Array<string>} symbols - Array of stock symbols
 * @param {Object} filters - Price change filters (e.g., { "1W": [0, 50], "1M": [-10, 10] })
 * @returns {Promise<Object>} Filtered results with passed and blacklisted symbols
 */
export async function filterStocksByPriceRange(symbols, filters) {
  logger.debug(
    `filterStocksByPriceRange called with ${symbols.length} symbols`,
    { filters },
  );

  try {
    const Metrics = getModel('metrics');

    // Fetch metrics for all symbols
    const metricsDocs = await Metrics.find({
      symbol: { $in: symbols },
    }).select('symbol metrics');

    // Create a map for quick lookup
    const metricsMap = new Map();
    metricsDocs.forEach((doc) => {
      metricsMap.set(doc.symbol, doc.metrics);
    });

    const passed = [];
    const blacklist = [];
    const errors = [];

    // Filter each symbol
    symbols.forEach((symbol) => {
      try {
        const metrics = metricsMap.get(symbol);

        // If no metrics document exists for this symbol, blacklist it
        if (!metrics) {
          logger.debug(`❌ ${symbol} blacklisted - no metrics data found`);
          blacklist.push(symbol);
          return;
        }

        let shouldExclude = false;

        // Check each filter period
        for (const [period, [minPct, maxPct]] of Object.entries(filters)) {
          // Skip if filter is set to full range (covers all values)
          // Note: For price changes, we allow negative values, so we check -100 to 100 range
          if (minPct <= -100 && maxPct >= 100) {
            continue;
          }

          // Get the metric field name for this period
          const metricField = PERIOD_TO_METRIC_MAP[period];
          if (!metricField) {
            logger.debug(`⚠️  Unknown period: ${period}`);
            continue;
          }

          // Get the price change value for this period
          const priceChange = metrics[metricField];

          // If metric value is missing or null, blacklist the symbol
          if (priceChange === null || priceChange === undefined) {
            logger.debug(
              `❌ ${symbol} blacklisted - missing ${metricField} data`,
            );
            shouldExclude = true;
            break;
          }

          // Convert price change to percentage (it's stored as decimal)
          const priceChangePct = priceChange * 100;

          // Check if price change is within the allowed range
          if (priceChangePct < minPct || priceChangePct > maxPct) {
            logger.debug(
              `❌ ${symbol} excluded by ${period} filter (${metricField}: ${priceChangePct.toFixed(
                1,
              )}%, range: ${minPct}-${maxPct}%)`,
            );
            shouldExclude = true;
            break;
          } else {
            logger.debug(
              `✅ ${symbol} passed ${period} filter (${metricField}: ${priceChangePct.toFixed(
                1,
              )}%, range: ${minPct}-${maxPct}%)`,
            );
          }
        }

        if (shouldExclude) {
          blacklist.push(symbol);
        } else {
          passed.push(symbol);
        }
      } catch (error) {
        logger.debug(`Error processing ${symbol}`, { error: error.message });
        errors.push({ symbol, error: error.message });
        blacklist.push(symbol); // Exclude on error
      }
    });

    logger.debug(
      `Filtering result: ${passed.length} passed, ${blacklist.length} blacklisted`,
    );

    return {
      passed,
      blacklist,
      errors,
      summary: {
        total: symbols.length,
        passed: passed.length,
        blacklisted: blacklist.length,
        errors: errors.length,
      },
    };
  } catch (error) {
    logger.business('Error in filterStocksByPriceRange', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * POST /api/v1/metrics/heatmap/price-range/filter
 *
 * Filter stocks based on multi-period price range criteria
 */
export async function filterPriceRange(req, res) {
  try {
    const { symbols, filters } = req.body;

    // Validate input
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        error: 'Invalid input: symbols array is required',
      });
    }

    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({
        error: 'Invalid input: filters object is required',
      });
    }

    // Validate filter periods (removed '1D' as we don't have daily metrics)
    const validPeriods = ['1W', '1M', '3M', '6M', '1Y'];
    const filterPeriods = Object.keys(filters);
    const invalidPeriods = filterPeriods.filter(
      (period) => !validPeriods.includes(period),
    );

    if (invalidPeriods.length > 0) {
      return res.status(400).json({
        error: 'Invalid filter periods',
        invalidPeriods,
        validPeriods,
      });
    }

    // Validate filter ranges
    for (const [period, range] of Object.entries(filters)) {
      if (!Array.isArray(range) || range.length !== 2) {
        return res.status(400).json({
          error: `Invalid filter range for ${period}: must be [minPct, maxPct] array`,
        });
      }

      const [minPct, maxPct] = range;
      if (
        typeof minPct !== 'number' ||
        typeof maxPct !== 'number' ||
        minPct < -100 ||
        maxPct > 100 ||
        minPct > maxPct
      ) {
        return res.status(400).json({
          error: `Invalid filter range for ${period}: minPct and maxPct must be numbers between -100 and 100, with minPct <= maxPct`,
        });
      }
    }

    // Filter stocks
    const result = await filterStocksByPriceRange(symbols, filters);

    res.json({
      success: true,
      ...result,
      filters,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.business('Error in price range filtering', { error: error.message });
    res.status(500).json({
      error: 'Failed to filter stocks by price range',
      message: error.message,
    });
  }
}

/**
 * GET /api/v1/metrics/heatmap/price-range/position/:symbol
 *
 * Get price change percentage for a specific symbol and period
 */
export async function getSymbolPricePosition(req, res) {
  try {
    const { symbol } = req.params;
    const { period } = req.query;

    if (!symbol) {
      return res.status(400).json({
        error: 'Symbol parameter is required',
      });
    }

    const validPeriods = ['1W', '1M', '3M', '1Y'];
    if (!period || !validPeriods.includes(period)) {
      return res.status(400).json({
        error: 'Valid period parameter is required',
        validPeriods,
      });
    }

    // Get metric field name
    const metricField = PERIOD_TO_METRIC_MAP[period];
    if (!metricField) {
      return res.status(400).json({
        error: 'Invalid period',
        period,
      });
    }

    // Fetch metrics for the symbol
    const Metrics = getModel('metrics');
    const metricsDoc = await Metrics.findOne({ symbol }).select(
      'symbol metrics',
    );

    if (!metricsDoc || !metricsDoc.metrics) {
      return res.status(404).json({
        error: 'No metrics data found for symbol',
        symbol,
      });
    }

    const priceChange = metricsDoc.metrics[metricField];

    if (priceChange === null || priceChange === undefined) {
      return res.status(404).json({
        error: 'Price change data not available for this period',
        symbol,
        period,
        metricField,
      });
    }

    res.json({
      symbol,
      period,
      metricField,
      priceChange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.business(`Error getting price change for ${req.params.symbol}`, {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to get price change',
      message: error.message,
    });
  }
}
