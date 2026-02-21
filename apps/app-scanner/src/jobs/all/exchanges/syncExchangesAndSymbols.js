import { getModel } from "@buydy/se-db";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import { getJobConfig, getMaxAgeCutoff } from "@buydy/iso-business-types";
import logger from "@buydy/se-logger";
import { withEODHDErrorHandling, safeEODHDCall } from "../../../utils/eodhdErrorHandler.js";

const jobConfig = getJobConfig("exchanges");
const maxAgeDays = jobConfig.maxAgeDays;

// 🚀 DEV MODE: Set DEV_MODE_LIMIT env var to process only N exchanges (e.g., DEV_MODE_LIMIT=50)
const DEV_MODE_LIMIT = process.env.DEV_MODE_LIMIT ? parseInt(process.env.DEV_MODE_LIMIT, 10) : null;

/**
 * Sync ALL exchanges and their symbols from EODHD
 *
 * This job:
 * 1. Fetches ALL exchanges from EODHD API
 * 2. Saves them to the exchanges collection
 * 3. For each exchange, fetches ALL symbols and saves to exchange_symbols collection
 * 4. Skips API calls if data is less than a week old
 */
async function _syncAllExchangesAndSymbols({ progress, appendLog } = {}) {
  const log = appendLog || ((msg) => logger.debug(msg));
  const progressCallback = progress;

  const results = {
    exchanges: { total: 0, success: 0, failed: 0, skipped: 0 },
    symbols: { total: 0, success: 0, failed: 0, skipped: 0 },
  };

  // Initialize client outside try block so it's accessible in finally
  let client = null;

  try {
    // Get Mongoose models (database connection should be bootstrapped at app startup)
    log("\x1b[36m🔗 [syncExchangesAndSymbols] Getting Mongoose models...\x1b[0m");
    const Exchange = getModel("exchanges");
    const ExchangeSymbols = getModel("exchange_symbols");

    // Test database connection with a simple query
    await Exchange.findOne({});
    log("\x1b[32m✅ [syncExchangesAndSymbols] Models validated\x1b[0m");

    client = new EODHDCacheClient({
      apiKey: process.env.API_EODHD_API_TOKEN,
      cacheExpirationHours: jobConfig.cacheExpirationHours,
    });

    // Report initial progress immediately when starting work (before any API calls)
    if (progressCallback) {
      await progressCallback(0.01); // Report 1% immediately to show job is working
    }

    const cutoff = getMaxAgeCutoff(maxAgeDays);
    // Step 1: Sync exchanges list
    log("\x1b[36m🔄 [syncExchanges] Starting exchanges sync...\x1b[0m");

    const exchangesData = await safeEODHDCall(
      () => client.search.getAvailableExchanges(),
      "syncExchangesAndSymbols.getAvailableExchanges"
    );

    results.exchanges.total = exchangesData.length;

    // 🚀 DEV MODE: Limit the number of exchanges to process
    let exchangesToProcess = exchangesData;
    if (DEV_MODE_LIMIT) {
      exchangesToProcess = exchangesData.slice(0, DEV_MODE_LIMIT);
      log(`🔧 DEV MODE: Processing only ${DEV_MODE_LIMIT} exchanges for quick testing`);
    }

    for (const exchange of exchangesToProcess) {
      try {
        // Check if exchange data is fresh
        const existingExchange = await Exchange.findOne({
          code: exchange.Code,
          fetchedAt: { $gte: cutoff },
        });

        if (existingExchange) {
          results.exchanges.skipped++;
          log(`\x1b[33m⚠️  [syncExchanges] SKIP ${exchange.Code} (fresh)\x1b[0m`);
          continue;
        }

        // Save/update exchange
        await Exchange.updateOne(
          { code: exchange.Code },
          {
            $set: {
              code: exchange.Code,
              name: exchange.Name,
              country: exchange.Country,
              currency: exchange.Currency,
              timezone: exchange.Timezone,
              updatedAt: new Date(),
              fetchedAt: new Date(),
            },
          },
          { upsert: true }
        );

        results.exchanges.success++;
        log(`\x1b[32m✅ [syncExchanges] OK ${exchange.Code}\x1b[0m`);
      } catch (err) {
        results.exchanges.failed++;
        log(`\x1b[31m❌ [syncExchanges] FAIL ${exchange.Code}: ${err.message}\x1b[0m`);
      }
    }

    // Step 2: Sync symbols for each exchange
    log("\x1b[36m🔄 [syncSymbols] Starting symbols sync...\x1b[0m");

    // Get all exchanges from database
    const exchanges = await Exchange.find({}).select("code");
    log(`\x1b[36m   Processing ${exchanges.length} exchanges\x1b[0m`);

    // Track progress for symbols sync
    let processedExchanges = 0;
    const totalExchanges = exchanges.length;
    const exchangesProgressStart = 0.5; // Symbols sync is ~50% of the job (after exchanges sync)

    // Helper function to process a single exchange
    const processExchange = async (exchange) => {
      try {
        const exchangeCode = exchange.code;

        // Check if symbols data is fresh for this exchange using Mongoose
        const existing = await ExchangeSymbols.findOne({ exchangeCode }).select("fetchedAt");

        if (existing?.fetchedAt && existing.fetchedAt > cutoff) {
          results.symbols.skipped++;
          log(`\x1b[33m⚠️  [syncSymbols] SKIP ${exchangeCode} (fresh)\x1b[0m`);
          return;
        }

        // Fetch symbols for this exchange
        const symbolsData = await safeEODHDCall(
          () => client.search.getSymbolsByExchange(exchangeCode),
          `syncExchangesAndSymbols.getSymbolsByExchange.${exchangeCode}`
        );

        if (!Array.isArray(symbolsData)) {
          results.symbols.skipped++;
          log(`\x1b[33m⚠️  [syncSymbols] SKIP ${exchangeCode} (no symbols data)\x1b[0m`);
          return;
        }

        results.symbols.total += symbolsData.length;

        // Save/update symbols for this exchange using Mongoose
        await ExchangeSymbols.updateOne(
          { exchangeCode },
          {
            $set: {
              exchangeCode,
              symbols: symbolsData,
              updatedAt: new Date(),
              fetchedAt: new Date(),
            },
          },
          { upsert: true }
        );

        results.symbols.success++;
        log(`\x1b[32m✅ [syncSymbols] OK ${exchangeCode} (${symbolsData.length} symbols)\x1b[0m`);

        // Update progress for symbols sync (50-100% of total job)
        processedExchanges++;
        if (progressCallback && totalExchanges > 0) {
          const symbolsProgress = processedExchanges / totalExchanges;
          const overallProgress = exchangesProgressStart + symbolsProgress * 0.5; // 50% + (symbols progress * 50%)
          await progressCallback(overallProgress);
        }
      } catch (err) {
        results.symbols.failed++;
        log(`\x1b[31m❌ [syncSymbols] FAIL ${exchange.code}: ${err.message}\x1b[0m`);
        log(`\x1b[31m   Error details: ${err.stack || "No stack trace available"}\x1b[0m`);

        // Still update progress even on failure
        processedExchanges++;
        if (progressCallback && totalExchanges > 0) {
          const symbolsProgress = processedExchanges / totalExchanges;
          const overallProgress = exchangesProgressStart + symbolsProgress * 0.5;
          await progressCallback(overallProgress);
        }

        // Check if it's a connection error
        if (
          err.message.includes("Client must be connected") ||
          err.message.includes("connection")
        ) {
          log(`\x1b[31m   ⚠️  This appears to be a database connection issue\x1b[0m`);
        }
      }
    };

    // Process all exchanges with client-side rate limiting
    await Promise.all(exchanges.map((exchange) => processExchange(exchange)));

    // Summary
    log("\x1b[36m📊 [syncExchangesAndSymbols] Summary:\x1b[0m");
    log(
      `\x1b[36m   Exchanges: ${results.exchanges.success}/${results.exchanges.total} success, ${results.exchanges.skipped} skipped, ${results.exchanges.failed} failed\x1b[0m`
    );
    log(
      `\x1b[36m   Symbols: ${results.symbols.success}/${results.exchanges.total} exchanges, ${results.symbols.skipped} skipped, ${results.symbols.failed} failed\x1b[0m`
    );
  } catch (error) {
    log(`\x1b[31m❌ [syncExchangesAndSymbols] Job failed: ${error.message}\x1b[0m`);
    log(`\x1b[31m   Error details: ${error.stack || "No stack trace available"}\x1b[0m`);

    // Check if it's a connection error
    if (
      error.message.includes("Client must be connected") ||
      error.message.includes("connection")
    ) {
      log(
        `\x1b[31m   ⚠️  This appears to be a database connection issue. Check your MongoDB connection settings.\x1b[0m`
      );
    }

    throw error;
  } finally {
    // Log cache summary
    if (client && client.logCacheSummary) {
      log("");
      client.logCacheSummary();
    }
    // No need to close connection as we're using the shared database connection
  }

  return results;
}

// Export the function wrapped with EODHD error handling
export const syncAllExchangesAndSymbols = withEODHDErrorHandling(
  _syncAllExchangesAndSymbols,
  "syncAllExchangesAndSymbols"
);
