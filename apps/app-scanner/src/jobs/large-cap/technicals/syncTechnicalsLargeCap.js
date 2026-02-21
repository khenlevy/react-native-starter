import { getModel } from "@buydy/se-db";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import { getMaxConcurrentRequests } from "../../../config/concurrency.js";
import { getJobConfig } from "@buydy/iso-business-types";
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
  prioritizeStocksAcrossExchanges,
} from "../../../utils/devModeFilter.js";

const jobConfig = getJobConfig("technicals");
const maxAgeDays = jobConfig.maxAgeDays;

// 🚀 DEV MODE: Set DEV_MODE_LIMIT env var to process only N companies (e.g., DEV_MODE_LIMIT=50)
const DEV_MODE_LIMIT = getDevModeLimit();
const DEV_MODE_COMPANIES = parseDevModeCompany();

/**
 * Sync technical indicators for CONFIRMED large cap stocks from exchange_symbols collection
 *
 * This job finds all stocks that have been CONFIRMED as large cap (≥$1B) by the
 * findAndMarkLargeCapStocks job and fetches their technical indicator data from EODHD API.
 *
 * Should run AFTER findAndMarkLargeCapStocks job.
 * Skips API calls if data is less than 7 days old.
 */
export async function syncTechnicalsLargeCap({ progress, appendLog } = {}) {
  // Default appendLog to logger.business for visibility (logs both to logger and job record)
  const log = appendLog || ((msg) => logger.business(msg));

  // Get Mongoose models (database connection should be bootstrapped at app startup)
  const Technicals = getModel("technicals");

  const client = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
    cacheExpirationHours: jobConfig.cacheExpirationHours,
  });

  const results = [];

  // 🚀 DEV MODE: Log if running in dev mode
  if (DEV_MODE_LIMIT) {
    log(`🔧 DEV MODE: Processing only ${DEV_MODE_LIMIT} companies for quick testing`);
  }
  if (DEV_MODE_COMPANIES && DEV_MODE_COMPANIES.length > 0) {
    log(`🔧 DEV MODE: Prioritizing companies: ${DEV_MODE_COMPANIES.join(", ")}`);
  }

  // Global queue is automatically used via EODHD client singleton

  try {
    log(
      `🔍 Finding large cap stocks (>=$${LARGE_CAP_THRESHOLD.toLocaleString()}) from exchange_symbols collection...`
    );

    // Use centralized function to get large cap stocks
    const exchangeSymbolsDocs = await getLargeCapStocksFromDatabase(maxAgeDays);

    // Count total large cap stocks using centralized function
    const totalLargeCapStocks = countLargeCapStocks(exchangeSymbolsDocs, maxAgeDays);
    let processedStocks = 0;
    let totalProcessedForDevMode = 0; // Track total processed in dev mode

    const MAX_CONCURRENT_REQUESTS = getMaxConcurrentRequests();
    log(
      `📊 Found ${totalLargeCapStocks} large cap stocks across ${exchangeSymbolsDocs.length} exchanges (max ${MAX_CONCURRENT_REQUESTS} concurrent requests)`
    );

    // Report initial progress when starting work
    if (progress && totalLargeCapStocks > 0) {
      await progress(0.01); // Report 1% immediately to show job is working
    }

    // Helper function to process a single symbol (defined outside loop for reuse)
    const processSymbol = async (symbol, exchangeCode) => {
      try {
        // Build EODHD symbol format: Code.Exchange
        const eodhdSymbol = `${symbol.Code}.${symbol.Exchange}`;

        // For US stocks, use .US format instead of specific exchange
        let symbolKey = eodhdSymbol;
        if (symbol.Country === "USA" || exchangeCode === "US") {
          symbolKey = `${symbol.Code}.US`;
        }

        // Check if we already have fresh technical data in dedicated collection
        const existingTechnical = await Technicals.findBySymbol(symbolKey);
        if (existingTechnical && existingTechnical.isDataFresh(maxAgeDays)) {
          results.push({ symbol: symbolKey, ok: true, skipped: true });
          log(`   \x1b[32m✅ SKIP ${symbolKey} (fresh technical data)\x1b[0m`);
          return;
        }

        // Fetch technical indicators from EODHD API
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const fromDate = oneYearAgo.toISOString().split("T")[0];

        // Get comprehensive technical indicators in parallel (using correct function names)
        const technicalPromises = [
          // Moving Averages
          {
            name: "sma20",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "sma", {
              period: 20,
              from: fromDate,
            }),
          },
          {
            name: "sma50",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "sma", {
              period: 50,
              from: fromDate,
            }),
          },
          {
            name: "sma200",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "sma", {
              period: 200,
              from: fromDate,
            }),
          },
          {
            name: "ema20",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "ema", {
              period: 20,
              from: fromDate,
            }),
          },
          {
            name: "ema50",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "ema", {
              period: 50,
              from: fromDate,
            }),
          },
          {
            name: "ema200",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "ema", {
              period: 200,
              from: fromDate,
            }),
          },
          {
            name: "wma20",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "wma", {
              period: 20,
              from: fromDate,
            }),
          },

          // Momentum Indicators
          {
            name: "rsi",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "rsi", {
              period: 14,
              from: fromDate,
            }),
          },
          {
            name: "macd",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "macd", { from: fromDate }),
          },
          {
            name: "stochastic",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "stochastic", {
              from: fromDate,
            }),
          },
          {
            name: "stochrsi",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "stochrsi", {
              from: fromDate,
            }),
          },
          {
            name: "williamsr",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "williamsr", {
              period: 14,
              from: fromDate,
            }),
          },
          {
            name: "cci",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "cci", {
              period: 20,
              from: fromDate,
            }),
          },
          {
            name: "adx",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "adx", {
              period: 14,
              from: fromDate,
            }),
          },

          // Volume Indicators
          {
            name: "ad",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "ad", { from: fromDate }),
          },
          {
            name: "obv",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "obv", { from: fromDate }),
          },

          // Volatility Indicators
          {
            name: "atr",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "atr", {
              period: 14,
              from: fromDate,
            }),
          },
          {
            name: "bbands",
            promise: client.stocks.getTechnicalIndicator(symbolKey, "bbands", {
              period: 20,
              from: fromDate,
            }),
          },
        ];

        // Execute all technical indicator requests in parallel
        const technicalResults = await Promise.allSettled(technicalPromises.map((p) => p.promise));

        // Build indicators object from results
        const indicators = {};
        technicalResults.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            indicators[technicalPromises[index].name] = result.value;
          }
        });

        // Get currency from symbol
        const currency = symbol.Currency || "USD";

        // Save to dedicated technicals collection
        if (existingTechnical) {
          log(`   🔄 Updating existing technical for ${symbolKey}`);
          await existingTechnical.updateTechnicalData({
            indicators,
            currency,
          });
        } else {
          log(`   💾 Creating new technical for ${symbolKey}`);
          const newTechnical = new Technicals({
            symbol: symbolKey,
            exchange: exchangeCode,
            currency,
            indicators,
          });
          await newTechnical.save();
        }

        results.push({ symbol: symbolKey, ok: true, skipped: false });
        log(`   \x1b[32m✅ OK ${symbolKey}\x1b[0m`);
      } catch (error) {
        const symbolKey =
          symbol.Country === "USA" || exchangeCode === "US"
            ? `${symbol.Code}.US`
            : `${symbol.Code}.${symbol.Exchange}`;
        log(`   \x1b[31m❌ FAIL ${symbolKey}: ${error.message}\x1b[0m`);
        results.push({ symbol: symbolKey, ok: false, error: error.message });
      }
    };

    // Process each exchange using centralized extraction
    const largeCapExchanges = extractLargeCapStocks(exchangeSymbolsDocs, maxAgeDays);

    // 🚀 DEV MODE: Reorganize stocks if DEV_MODE_COMPANY is specified
    const prioritizedStocks = prioritizeStocksAcrossExchanges(largeCapExchanges, log);

    if (prioritizedStocks) {
      // Process prioritized stocks (grouped by exchange)
      const stocksByExchange = {};
      for (const { stock, exchangeCode } of prioritizedStocks) {
        if (!stocksByExchange[exchangeCode]) {
          stocksByExchange[exchangeCode] = [];
        }
        stocksByExchange[exchangeCode].push(stock);
      }

      for (const exchangeCode of Object.keys(stocksByExchange)) {
        const largeCapStocks = stocksByExchange[exchangeCode];
        log(
          `\n🏢 Processing ${exchangeCode}: ${largeCapStocks.length} large cap stocks (DEV MODE)`
        );

        // Process stocks in chunks with concurrency control
        for (let i = 0; i < largeCapStocks.length; i += MAX_CONCURRENT_REQUESTS) {
          const chunk = largeCapStocks.slice(i, i + MAX_CONCURRENT_REQUESTS);
          await Promise.allSettled(chunk.map((symbol) => processSymbol(symbol, exchangeCode)));
          processedStocks += chunk.length;
          totalProcessedForDevMode += chunk.length;

          if (progress) {
            await progress(processedStocks / totalLargeCapStocks);
          }
        }
      }
    } else {
      // Normal processing (no DEV_MODE_COMPANY)
      for (const exchangeDoc of largeCapExchanges) {
        let largeCapStocks = exchangeDoc.symbols;

        // 🚀 DEV MODE: Limit the number of stocks to process
        if (DEV_MODE_LIMIT && totalProcessedForDevMode >= DEV_MODE_LIMIT) {
          log(`🔧 DEV MODE: Reached limit of ${DEV_MODE_LIMIT} companies, stopping`);
          break;
        }
        if (DEV_MODE_LIMIT) {
          const remaining = DEV_MODE_LIMIT - totalProcessedForDevMode;
          largeCapStocks = largeCapStocks.slice(0, remaining);
          log(
            `🔧 DEV MODE: Processing ${largeCapStocks.length} stocks from ${exchangeDoc.exchangeCode} (${remaining} remaining)`
          );
        }

        if (largeCapStocks.length === 0) continue;

        log(
          `\n🏢 Processing ${exchangeDoc.exchangeCode}: ${largeCapStocks.length} large cap stocks`
        );

        // Process stocks in chunks with concurrency control
        for (let i = 0; i < largeCapStocks.length; i += MAX_CONCURRENT_REQUESTS) {
          const chunk = largeCapStocks.slice(i, i + MAX_CONCURRENT_REQUESTS);
          await Promise.allSettled(
            chunk.map((symbol) => processSymbol(symbol, exchangeDoc.exchangeCode))
          );
          processedStocks += chunk.length;
          totalProcessedForDevMode += chunk.length;

          if (progress) {
            await progress(processedStocks / totalLargeCapStocks);
          }
        }
      }
    }

    // Print summary
    const successCount = results.filter((r) => r.ok && !r.skipped).length;
    const skippedCount = results.filter((r) => r.ok && r.skipped).length;
    const failedCount = results.filter((r) => !r.ok).length;

    log(`\n🎉 Final Summary:`);
    log(`   Total large cap stocks: ${totalLargeCapStocks}`);
    log(`   Successfully processed: ${successCount}`);
    log(`   Skipped (fresh data): ${skippedCount}`);
    log(`   Failed: ${failedCount}`);
    log(`   Exchanges processed: ${exchangeSymbolsDocs.length}`);

    // Print technical statistics
    const stocksWithTechnicals = results.filter((r) => r.ok && !r.skipped).length;
    log(`\n📈 Technical Statistics:`);
    log(`   Stocks with technical data: ${stocksWithTechnicals}`);
  } catch (error) {
    log(`❌ Job failed: ${error.message}`);
    throw error;
  } finally {
    // No need to close connection as we're using the shared database connection
  }

  return results;
}
