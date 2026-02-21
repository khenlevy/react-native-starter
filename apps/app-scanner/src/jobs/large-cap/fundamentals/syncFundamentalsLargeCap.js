import { getModel } from "@buydy/se-db";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import { getMaxConcurrentRequests } from "../../../config/concurrency.js";
import { getJobConfig, getMaxAgeCutoff } from "@buydy/iso-business-types";
import logger from "@buydy/se-logger";
import { withEODHDErrorHandling } from "../../../utils/eodhdErrorHandler.js";

const jobConfig = getJobConfig("fundamentals");
const maxAgeDays = jobConfig.maxAgeDays;

/**
 * Sync fundamentals for top stocks to discover large cap stocks
 *
 * This job fetches fundamental data for the top stocks from exchange_symbols collection
 * (limited to prevent database explosion). The fundamental data contains market cap
 * information, which is needed to determine which stocks are large cap.
 *
 * This should run BEFORE findAndMarkLargeCapStocks job.
 * Skips API calls if data is less than 7 days old.
 *
 * Default: 400 stocks per exchange (configurable via FUNDAMENTALS_STOCKS_PER_EXCHANGE env var)
 */
async function _syncFundamentalsLargeCap({ progress, appendLog } = {}) {
  // Default appendLog to logger.debug if not provided
  const log = appendLog || ((msg) => logger.debug(msg));

  // Get Mongoose models (database connection should be bootstrapped at app startup)
  const Fundamentals = getModel("fundamentals");
  const ExchangeSymbols = getModel("exchange_symbols");

  const client = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
    cacheExpirationHours: jobConfig.cacheExpirationHours,
  });

  // Streamed counters to avoid accumulating large arrays in memory
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const cutoff = getMaxAgeCutoff(maxAgeDays);

  try {
    // Configurable limit to prevent database explosion
    const TARGET_STOCKS_PER_EXCHANGE =
      parseInt(process.env.FUNDAMENTALS_STOCKS_PER_EXCHANGE) || 400;

    // Exchanges with poor/no EODHD fundamental data coverage - skip these
    const SKIP_EXCHANGES = new Set([
      "OTC",
      "PINK",
      "NMFQS", // OTC markets - limited/no fundamental data
      "FOREX",
      "CC",
      "MONEY",
      "GBOND",
      "EUFUND", // Not stock exchanges
    ]);

    log(`🔍 Finding ALL stocks to sync fundamentals (discover market cap)...`);

    // Get ALL exchange symbols, excluding known problem exchanges
    const allExchangeSymbolsDocs = await ExchangeSymbols.find({
      exchangeCode: { $nin: Array.from(SKIP_EXCHANGES) },
    }).select("exchangeCode symbols");

    let totalStocks = 0;
    const exchangesToProcess = [];

    // For each exchange, get top symbols to check for fundamentals (limited to prevent DB explosion)
    for (const doc of allExchangeSymbolsDocs) {
      // Get top symbols - prioritize Common Stock, then by order in array (usually volume)
      const topSymbols = doc.symbols
        .filter((s) => s.Type) // Filter out symbols without type
        .sort((a, b) => {
          // Priority: Common Stock > Others
          const aIsCommon = a.Type === "Common Stock" ? 0 : 1;
          const bIsCommon = b.Type === "Common Stock" ? 0 : 1;
          return aIsCommon - bIsCommon;
        })
        .slice(0, TARGET_STOCKS_PER_EXCHANGE);

      exchangesToProcess.push({
        exchangeCode: doc.exchangeCode,
        symbols: topSymbols,
      });
      totalStocks += topSymbols.length;
    }

    const MAX_CONCURRENT_REQUESTS = getMaxConcurrentRequests();
    log(
      `📊 Found ${exchangesToProcess.length} exchanges with ${totalStocks} total stocks to check`
    );
    log(`   Max concurrent requests: ${MAX_CONCURRENT_REQUESTS}`);

    let processedStocks = 0;

    // Report initial progress when starting work
    if (progress && totalStocks > 0) {
      await progress(0.01); // Report 1% immediately to show job is working
    }

    // Process each exchange
    for (const exchange of exchangesToProcess) {
      log(`\n🏢 Processing ${exchange.exchangeCode}: ${exchange.symbols.length} stocks`);

      const CHUNK_SIZE = 10; // Process stocks in smaller chunks
      let exchangeProcessed = 0;
      let lastExchangeProgress = 0;

      for (let i = 0; i < exchange.symbols.length; i += CHUNK_SIZE) {
        const chunk = exchange.symbols.slice(i, i + CHUNK_SIZE);

        // Process chunk in parallel
        const chunkPromises = chunk.map(async (symbol) => {
          const fullSymbol = `${symbol.Code}.${exchange.exchangeCode}`;

          try {
            // Check if we already have fresh fundamental data
            const existingFundamental = await Fundamentals.findOne({
              symbol: fullSymbol,
              fetchedAt: { $gte: cutoff },
            });

            if (existingFundamental) {
              skippedCount++;
              return { ok: true, skipped: true, symbol: fullSymbol };
            }

            // Fetch fundamental data from EODHD
            const fundamentalData = await client.stocks.getFundamentalData(fullSymbol);

            if (!fundamentalData || !fundamentalData.General) {
              return { ok: false, error: "No fundamental data", symbol: fullSymbol };
            }

            // Save to database
            await Fundamentals.findOneAndUpdate(
              { symbol: fullSymbol },
              {
                symbol: fullSymbol,
                market: exchange.exchangeCode,
                fundamentals: fundamentalData,
                fetchedAt: new Date(),
                updatedAt: new Date(),
              },
              { upsert: true, new: true }
            );

            successCount++;
            return { ok: true, symbol: fullSymbol };
          } catch (error) {
            failedCount++;
            return {
              ok: false,
              error: error.message,
              symbol: fullSymbol,
            };
          }
        });

        await Promise.all(chunkPromises);
        exchangeProcessed += chunk.length;
        processedStocks += chunk.length;

        // Log progress for this exchange
        const exchangeProgress = (exchangeProcessed / exchange.symbols.length) * 100;
        if (exchangeProgress - lastExchangeProgress >= 10) {
          log(
            `   📊 ${exchange.exchangeCode}: ${exchangeProcessed}/${
              exchange.symbols.length
            } (${exchangeProgress.toFixed(1)}%)`
          );
          lastExchangeProgress = exchangeProgress;
        }

        // Simple progress: processed / total
        const overallProgress = processedStocks / totalStocks;
        if (progress) {
          await progress(overallProgress);
        }

        // Small delay between chunks to be respectful to the API
        if (i + CHUNK_SIZE < exchange.symbols.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      log(`   ✅ ${exchange.exchangeCode}: ${exchangeProcessed} stocks processed`);
    }

    // Print final summary
    log(`\n🎉 Final Summary:`);
    log(`   Total stocks processed: ${processedStocks}`);
    log(`   Successfully fetched: ${successCount}`);
    log(`   Skipped (fresh data): ${skippedCount}`);
    log(`   Failed: ${failedCount}`);
    log(`   Exchanges processed: ${exchangesToProcess.length}`);

    return {
      success: true,
      totalStocks: processedStocks,
      successCount,
      skippedCount,
      failedCount,
      exchanges: exchangesToProcess.length,
    };
  } catch (error) {
    log(`❌ Job failed: ${error.message}`);
    throw error;
  } finally {
    // Log cache summary
    if (client && client.logCacheSummary) {
      log("");
      client.logCacheSummary();
    }
  }
}

// Export the function wrapped with EODHD error handling
export const syncFundamentalsLargeCap = withEODHDErrorHandling(
  _syncFundamentalsLargeCap,
  "syncFundamentalsLargeCap"
);
