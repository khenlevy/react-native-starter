import { getModel } from "@buydy/se-db";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import { getJobConfig, getMetricsConfigForJobs } from "@buydy/iso-business-types";
import logger from "@buydy/se-logger";
import {
  LARGE_CAP_THRESHOLD,
  getLargeCapStocksFromDatabase,
  countLargeCapStocks,
  extractLargeCapStocks,
} from "@buydy/se-db/src/utils/largeCapFilter.js";
import {
  getDevModeLimit,
  parseDevModeCompany,
  buildSymbolKey,
  prioritizeStocksAcrossExchanges,
} from "../../../utils/devModeFilter.js";
import {
  PriceChange1W,
  PriceChange1M,
  PriceChange3M,
  PriceChange6M,
  PriceChange1Y,
  fetchHistoricalPriceData,
} from "../../../calculators/priceChange.js";
import { calculateAllPriceChanges } from "../../../utils/priceChangeUtils.js";
import { normalizeCurrencyCode } from "@buydy/iso-business-types/src/metricsUtils.js";

const DEV_MODE_LIMIT = getDevModeLimit();
const DEV_MODE_COMPANIES = parseDevModeCompany();

const jobConfig = getJobConfig("price-performance");
const PRICE_PERFORMANCE_METRIC_IDS = new Set([
  "PriceChange1W",
  "PriceChange1M",
  "PriceChange3M",
  "PriceChange6M",
  "PriceChange1Y",
]);

const PRICE_CALCULATORS = {
  PriceChange1W,
  PriceChange1M,
  PriceChange3M,
  PriceChange6M,
  PriceChange1Y,
};

const PRICE_DATA_FRESHNESS_HOURS = 24;
const CHUNK_SIZE = 16; // Increased for better efficiency
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FX_BASE_CURRENCY = "USD";

/**
 * Sync price performance metrics (price change percentages) for large cap stocks.
 * Runs independently from the main metrics job so that price changes can refresh daily
 * without reprocessing all fundamentals-based metrics.
 */
export async function syncPricePerformanceLargeCap({ progress, appendLog } = {}) {
  const log = appendLog || ((msg) => logger.business(msg));

  const metricsConfig = getMetricsConfigForJobs();
  const performanceMetrics = metricsConfig.metrics.filter((metric) =>
    PRICE_PERFORMANCE_METRIC_IDS.has(metric.id)
  );

  if (performanceMetrics.length === 0) {
    log("⚠️  No performance metrics enabled in configuration");
    return {
      success: true,
      processed: 0,
      updated: 0,
      skipped: 0,
      metricsProcessed: 0,
    };
  }

  if (DEV_MODE_LIMIT) {
    log(`🔧 DEV MODE: Processing only ${DEV_MODE_LIMIT} companies for quick testing`);
  }
  if (DEV_MODE_COMPANIES?.length) {
    log(`🔧 DEV MODE: Prioritizing companies: ${DEV_MODE_COMPANIES.join(", ")}`);
  }

  const Metrics = getModel("metrics");

  const eodhdClient = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
    cacheExpirationHours: jobConfig.cacheExpirationHours || 12,
  });

  const resolveFxRate = async (currencyCode) => {
    const normalizedCurrency = normalizeCurrencyCode(currencyCode);
    if (!normalizedCurrency || normalizedCurrency === FX_BASE_CURRENCY) {
      return { rate: 1, sourceCurrency: FX_BASE_CURRENCY, targetCurrency: FX_BASE_CURRENCY };
    }
    // For now, price changes are percentages so don't need conversion
    // But we can add FX conversion if needed for cross-currency comparisons
    return { rate: 1, sourceCurrency: normalizedCurrency, targetCurrency: FX_BASE_CURRENCY };
  };

  // Retry wrapper for API calls
  const retryApiCall = async (apiCall, symbolKey, retries = MAX_RETRIES) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
        log(
          `   ⚠️  ${symbolKey}: API call failed (attempt ${attempt + 1}/${
            retries + 1
          }), retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

  log(
    `🔄 Starting price performance sync for large cap stocks (>=$${LARGE_CAP_THRESHOLD.toLocaleString()})`
  );

  const priceFreshnessCutoff = new Date(Date.now() - PRICE_DATA_FRESHNESS_HOURS * 60 * 60 * 1000);
  const results = [];

  try {
    const exchangeSymbolsDocs = await getLargeCapStocksFromDatabase(jobConfig.maxAgeDays);

    if (exchangeSymbolsDocs.length === 0) {
      log("⚠️  No large cap stocks found in exchange_symbols collection");
      return {
        success: true,
        message: "No large cap stocks to process",
        processed: 0,
        updated: 0,
        skipped: 0,
        metricsProcessed: performanceMetrics.length,
      };
    }

    const totalLargeCapStocks = countLargeCapStocks(exchangeSymbolsDocs, jobConfig.maxAgeDays);
    log(
      `📊 Found ${exchangeSymbolsDocs.length} exchanges with ${totalLargeCapStocks} total large cap stocks`
    );

    let processedStocks = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    if (progress && totalLargeCapStocks > 0) {
      await progress(0.01);
    }

    const largeCapExchanges = extractLargeCapStocks(exchangeSymbolsDocs, jobConfig.maxAgeDays);
    const prioritizedStocks = prioritizeStocksAcrossExchanges(largeCapExchanges, log);

    const processSymbol = async (symbol, exchangeCode) => {
      const symbolKey = buildSymbolKey(symbol, exchangeCode);

      try {
        const existingMetrics = await Metrics.findBySymbol(symbolKey);
        const lastPerformanceCalc =
          existingMetrics?.metrics?._pricePerformanceLastCalculated || null;

        if (lastPerformanceCalc && new Date(lastPerformanceCalc) >= priceFreshnessCutoff) {
          results.push({ symbol: symbolKey, status: "skipped", reason: "fresh" });
          skippedCount++;
          return;
        }

        // Fetch historical data once (1 year) and calculate all periods
        const historicalData = await retryApiCall(
          () => fetchHistoricalPriceData(symbolKey, eodhdClient, 365),
          symbolKey
        );

        if (!historicalData || historicalData.length < 2) {
          results.push({ symbol: symbolKey, status: "skipped", reason: "no_data" });
          skippedCount++;
          return;
        }

        // Calculate all price changes from single dataset
        const priceChangesResult = calculateAllPriceChanges(historicalData, {
          useAdjustedPrices: true,
        });

        // Extract price change values
        const performanceValues = {};
        for (const metric of performanceMetrics) {
          const value = priceChangesResult[metric.id];
          if (value !== null && value !== undefined) {
            performanceValues[metric.dbField] = value;
          }
        }

        if (Object.keys(performanceValues).length === 0) {
          results.push({ symbol: symbolKey, status: "skipped", reason: "insufficient_data" });
          skippedCount++;
          return;
        }

        // Normalize currency
        const currencyRaw = symbol.Currency || "USD";
        const currency = normalizeCurrencyCode(currencyRaw) || "USD";
        const fxInfo = await resolveFxRate(currency);

        // Build metadata
        const metadata = {
          dataQuality: priceChangesResult.metadata.dataQuality,
          tradingDaysAvailable: priceChangesResult.metadata.tradingDaysAvailable,
          mostRecentDate: priceChangesResult.metadata.mostRecentDate,
          oldestDate: priceChangesResult.metadata.oldestDate,
          flags: priceChangesResult.metadata.flags,
          currency: currency,
          fxRate: fxInfo.rate,
          timestamp: new Date(),
        };

        const metricsPayload = {
          ...performanceValues,
          _pricePerformanceLastCalculated: new Date(),
          _pricePerformanceMetadata: metadata,
        };

        if (existingMetrics) {
          await existingMetrics.updateMetricsData(metricsPayload);
        } else {
          const newMetricsDoc = new Metrics({
            symbol: symbolKey,
            exchange: exchangeCode,
            currency,
            metrics: metricsPayload,
            lastUpdated: new Date(),
            fetchedAt: new Date(),
          });
          await newMetricsDoc.save();
        }

        updatedCount++;
        results.push({ symbol: symbolKey, status: "updated" });
      } catch (error) {
        results.push({ symbol: symbolKey, status: "failed", error: error.message });
        log(`   ❌ Failed ${symbolKey}: ${error.message}`);
      }
    };

    const iterateExchangeStocks = async (exchangeCode, stocks) => {
      for (let i = 0; i < stocks.length; i += CHUNK_SIZE) {
        const chunk = stocks.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map((stock) => processSymbol(stock, exchangeCode)));

        processedStocks += chunk.length;

        if (progress) {
          await progress(Math.min(processedStocks / totalLargeCapStocks, 0.99));
        }
      }
    };

    if (prioritizedStocks) {
      const stocksByExchange = {};
      prioritizedStocks.forEach(({ stock, exchangeCode }) => {
        stocksByExchange[exchangeCode] = stocksByExchange[exchangeCode] || [];
        stocksByExchange[exchangeCode].push(stock);
      });

      for (const [exchangeCode, stocks] of Object.entries(stocksByExchange)) {
        log(`🏢 Processing ${exchangeCode}: ${stocks.length} large cap stocks (DEV MODE priority)`);
        await iterateExchangeStocks(exchangeCode, stocks);
        if (DEV_MODE_LIMIT && processedStocks >= DEV_MODE_LIMIT) {
          log(`🔧 DEV MODE: Reached limit of ${DEV_MODE_LIMIT} companies, stopping`);
          break;
        }
      }
    } else {
      for (const exchangeDoc of largeCapExchanges) {
        let stocks = exchangeDoc.symbols;

        if (DEV_MODE_LIMIT && processedStocks >= DEV_MODE_LIMIT) {
          log(`🔧 DEV MODE: Reached limit of ${DEV_MODE_LIMIT} companies, stopping`);
          break;
        }

        if (DEV_MODE_LIMIT) {
          const remaining = DEV_MODE_LIMIT - processedStocks;
          stocks = stocks.slice(0, Math.max(remaining, 0));
          log(
            `🔧 DEV MODE: Processing ${stocks.length} stocks from ${exchangeDoc.exchangeCode} (${remaining} remaining)`
          );
        }

        if (!stocks.length) {
          continue;
        }

        log(`🏢 Processing ${exchangeDoc.exchangeCode}: ${stocks.length} large cap stocks`);
        await iterateExchangeStocks(exchangeDoc.exchangeCode, stocks);
      }
    }

    if (progress) {
      await progress(1);
    }

    log(`\n🎯 Price Performance Summary:`);
    log(`   Total large cap stocks: ${totalLargeCapStocks}`);
    log(`   Updated: ${updatedCount}`);
    log(`   Skipped (fresh/no data): ${skippedCount}`);
    log(`   Failed: ${results.filter((r) => r.status === "failed").length}`);

    return {
      success: true,
      totalStocks: totalLargeCapStocks,
      processed: processedStocks,
      updated: updatedCount,
      skipped: skippedCount,
      failed: results.filter((r) => r.status === "failed").length,
      metricsProcessed: performanceMetrics.length,
    };
  } catch (error) {
    log(`❌ Price performance job failed: ${error.message}`);
    throw error;
  }
}

/**
 * @deprecated Use calculateAllPriceChanges() instead for better efficiency
 * This function is kept for backward compatibility but is no longer used
 */
// eslint-disable-next-line no-unused-vars
async function calculatePerformanceMetrics(symbolKey, metrics, eodhdClient) {
  const values = {};

  for (const metric of metrics) {
    const calculator = PRICE_CALCULATORS[metric.id];
    if (!calculator) {
      continue;
    }

    try {
      const value = await calculator(symbolKey, eodhdClient);
      if (value !== null && value !== undefined) {
        values[metric.dbField] = value;
      }
    } catch (error) {
      logger.debug(`⚠️  Error calculating ${metric.id} for ${symbolKey}: ${error.message}`);
    }
  }

  return values;
}

export default syncPricePerformanceLargeCap;
