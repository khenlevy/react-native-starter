#!/usr/bin/env node

/**
 * Simple script to run syncDividendsLargeCap job only
 * This helps debug why no documents are being added to the database
 */

// Load environment variables FIRST
import { loadEnvironmentVariables } from "./config/envLoader.js";
loadEnvironmentVariables();

import { getDatabase } from "@buydy/se-db";
import { syncDividendsLargeCap } from "./jobs/large-cap/dividends/syncDividendsLargeCap.js";
import logger from "@buydy/se-logger";

async function runDividendsOnly() {
  logger.business("🚀 Starting syncDividendsLargeCap job");

  try {
    // Bootstrap database connection
    logger.debug("🔗 Connecting to database");
    await getDatabase();
    logger.debug("✅ Database connected");

    // Run the dividends job
    logger.debug("📊 Running syncDividendsLargeCap job");
    const results = await syncDividendsLargeCap({
      progress: (p) => {
        logger.debug(`📈 Progress: ${(p * 100).toFixed(1)}%`);
      },
      appendLog: (msg) => {
        logger.debug(`[DIVIDENDS] ${msg}`);
      },
    });

    logger.business("🎉 Job completed", { results });

    // Check database after job completion
    logger.debug("🔍 Checking database after job completion");
    const { getModel } = await import("@buydy/se-db");
    const ExchangeSymbols = getModel("exchange_symbols");

    // Count stocks with dividend data
    const stocksWithDividends = await ExchangeSymbols.countDocuments({
      "symbols.dividends": { $exists: true },
    });

    // Count stocks with dividendLastSync
    const stocksWithSync = await ExchangeSymbols.countDocuments({
      "symbols.dividendLastSync": { $exists: true },
    });

    logger.debug("📊 Database stats", { stocksWithDividends, stocksWithSync });

    // Get a sample of stocks with dividend data
    const sample = await ExchangeSymbols.findOne({
      "symbols.dividends": { $exists: true },
    }).select("exchangeCode symbols");

    if (sample) {
      const stockWithDividends = sample.symbols.find((s) => s.dividends);
      logger.debug("📋 Sample stock with dividends", {
        code: stockWithDividends.Code,
        exchange: stockWithDividends.Exchange,
        hasDividends: !!stockWithDividends.dividends,
        historyCount: stockWithDividends.dividends?.history?.length || 0,
        upcomingCount: stockWithDividends.dividends?.upcoming?.length || 0,
        dividendYield: stockWithDividends.dividends?.dividendYield,
        lastUpdated: stockWithDividends.dividendLastSync,
      });
    } else {
      logger.debug("❌ No stocks found with dividend data");
    }
  } catch (error) {
    logger.business("❌ Job failed", { error: error.message, stack: error.stack });
    process.exit(1);
  }

  logger.debug("✅ Script completed successfully");
  process.exit(0);
}

// Run the script
runDividendsOnly();
