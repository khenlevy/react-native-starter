// Price Data Service
// Loads and caches price range data for all stocks using EODHD API with queuing

const API_BASE_URL = 'http://localhost:3001/api/v1';

/**
 * Load price range data for multiple stocks using queued API calls
 * @param {Array<string>} symbols - Array of stock symbols
 * @returns {Promise<Object>} Price data for each symbol with ranges
 */
export async function loadPriceRangeData(symbols) {
  console.log(
    `🔄 [PRICE DATA SERVICE] Loading price range data for ${symbols.length} stocks:`,
    symbols,
  );

  const priceData = {};
  const errors = [];

  try {
    console.log(
      `🌐 [PRICE DATA SERVICE] Making API call to: ${API_BASE_URL}/metrics/heatmap/price-range/bulk`,
    );

    // Use the API endpoint that handles queued requests
    const response = await fetch(
      `${API_BASE_URL}/metrics/heatmap/price-range/bulk`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols,
          periods: ['1D', '1W', '1M', '3M', '1Y'],
        }),
      },
    );

    console.log(
      `📡 [PRICE DATA SERVICE] API response status: ${response.status}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      // Process the results
      Object.entries(result.priceData).forEach(([symbol, data]) => {
        if (data.error) {
          errors.push({ symbol, error: data.error });
        } else {
          priceData[symbol] = {
            currentPrice: data.currentPrice,
            ranges: data.ranges,
            lastUpdated: data.lastUpdated,
          };
        }
      });

      console.log(
        `✅ Loaded price data for ${Object.keys(priceData).length} stocks`,
      );
      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} stocks failed to load price data`);
      }
    } else {
      throw new Error(result.error || 'Failed to load price data');
    }
  } catch (error) {
    console.error('❌ Error loading price range data:', error.message);
    throw error;
  }

  return {
    priceData,
    errors,
    summary: {
      total: symbols.length,
      loaded: Object.keys(priceData).length,
      failed: errors.length,
    },
  };
}

/**
 * Apply price range filters to stocks using price change percentages from metrics
 * @param {Array<Object>} companies - Array of company objects with metrics
 * @param {Object} filters - Price range filters { '1W': [min, max], ... }
 * @returns {Object} Filtered results
 */
export function applyPriceRangeFilters(companies, filters) {
  console.log('🔍 [PRICE DATA SERVICE] Applying price range filters:', {
    companiesCount: companies.length,
    filters,
  });

  const passed = [];
  const blacklisted = [];
  const errors = [];

  // Map period names to metric names
  const periodToMetricMap = {
    '1W': 'PriceChange1W',
    '1M': 'PriceChange1M',
    '3M': 'PriceChange3M',
    '6M': 'PriceChange6M',
    '1Y': 'PriceChange1Y',
  };

  companies.forEach((company) => {
    const symbol = company.symbol;
    let shouldExclude = false;
    const exclusionReasons = [];

    // Check each filter period
    for (const [period, [minPct, maxPct]] of Object.entries(filters)) {
      // Skip if filter is set to full range (-100 to 100)
      if (minPct <= -100 && maxPct >= 100) {
        continue;
      }

      const metricName = periodToMetricMap[period];
      if (!metricName) {
        console.warn(`Unknown period: ${period}`);
        continue;
      }

      // Get price change percentage from company metrics
      const priceChange = company.raw?.[metricName];

      if (priceChange === null || priceChange === undefined) {
        shouldExclude = true;
        exclusionReasons.push(`${period}: No price change data`);
        break;
      }

      // Convert to percentage (price change is already a decimal)
      const priceChangePct = priceChange * 100;

      // Check if price change is within filter range
      if (priceChangePct < minPct || priceChangePct > maxPct) {
        shouldExclude = true;
        exclusionReasons.push(
          `${period}: Price change ${priceChangePct.toFixed(
            1,
          )}% outside range [${minPct}-${maxPct}]%`,
        );
        break;
      }
    }

    if (shouldExclude) {
      blacklisted.push(symbol);
      console.log(`❌ ${symbol} excluded: ${exclusionReasons.join(', ')}`);
    } else {
      passed.push(company);
      console.log(`✅ ${symbol} passed all filters`);
    }
  });

  console.log(
    `📊 Filter results: ${passed.length} passed, ${blacklisted.length} blacklisted`,
  );

  return {
    passed,
    blacklisted,
    errors,
    summary: {
      total: companies.length,
      passed: passed.length,
      blacklisted: blacklisted.length,
      errors: errors.length,
    },
  };
}

/**
 * Get price range position for a specific stock and period
 * @param {string} symbol - Stock symbol
 * @param {string} period - Time period (1D, 1W, 1M, 3M, 1Y)
 * @returns {Promise<Object>} Position data
 */
export async function getSymbolPricePosition(symbol, period) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/metrics/heatmap/price-range/position/${symbol}?period=${period}`,
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(
      `Error getting price position for ${symbol} (${period}):`,
      error,
    );
    throw error;
  }
}
