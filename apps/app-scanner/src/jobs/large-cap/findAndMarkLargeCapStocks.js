import { getModel } from "@buydy/se-db";
import logger from "@buydy/se-logger";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import {
  LARGE_CAP_THRESHOLD,
  CAP_DATA_FRESHNESS_DAYS,
  formatMarketCap,
} from "@buydy/se-db/src/utils/largeCapFilter.js";
import { normalizeCurrencyCode } from "@buydy/iso-business-types/src/metricsUtils.js";
import { isPositiveNumber, clamp } from "@buydy/iso-js";

// 🚀 DEV MODE: Set DEV_MODE_LIMIT env var to process only N exchanges (e.g., DEV_MODE_LIMIT=50)
const DEV_MODE_LIMIT = process.env.DEV_MODE_LIMIT ? parseInt(process.env.DEV_MODE_LIMIT, 10) : null;

// Configuration constants
const MAX_CONCURRENT_EXCHANGES = 3; // Process 3 exchanges in parallel (increased from 1)
const BULK_WRITE_BATCH_SIZE = 500; // Batch size for bulk operations
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FX_BASE_CURRENCY = "USD";
const FUNDAMENTALS_FRESHNESS_DAYS = 90; // Consider fundamentals fresh if less than 90 days old
const MIN_MARKET_CAP = 1000000; // $1M minimum (sanity check)
const MAX_MARKET_CAP = 10000000000000; // $10T maximum (sanity check)

/**
 * Find and Mark Large Cap Stocks Job
 *
 * This job analyzes fundamental data to find ALL stocks above $1B market cap
 * and marks them in the exchange_symbols collection.
 *
 * Should run AFTER syncFundamentalsAll job.
 * Runs daily and on release.
 * Finds ALL large cap stocks (no artificial limits).
 */

// No artificial limits - find ALL large cap stocks

export async function findAndMarkLargeCapStocks({ progress, appendLog } = {}) {
  const startTime = Date.now();

  // Default appendLog to logger.debug if not provided
  const log = appendLog || ((msg) => logger.debug(msg));

  try {
    const oneMonthAgo = new Date(Date.now() - CAP_DATA_FRESHNESS_DAYS * 24 * 60 * 60 * 1000);

    log(
      `🔍 Finding ALL large cap stocks (>$${LARGE_CAP_THRESHOLD.toLocaleString()}) from fundamentals data...`
    );

    // Get Mongoose models (database connection should be bootstrapped at app startup)
    const Exchange = getModel("exchanges");
    const ExchangeSymbols = getModel("exchange_symbols");

    // Get all exchanges
    const exchanges = await Exchange.find({}).select("code Name Country Currency");

    // 🚀 DEV MODE: Limit the number of exchanges to process
    let exchangesToProcess = exchanges;
    if (DEV_MODE_LIMIT) {
      exchangesToProcess = exchanges.slice(0, DEV_MODE_LIMIT);
      log(`🔧 DEV MODE: Processing only ${DEV_MODE_LIMIT} exchanges for quick testing`);
    }

    log(`📊 Found ${exchangesToProcess.length} exchanges to process`);

    // Report initial progress when starting work
    if (progress && exchangesToProcess.length > 0) {
      await progress(0.01); // Report 1% immediately to show job is working
    }

    const results = {
      total: 0,
      updated: 0,
      skipped: 0,
      exchanges: {},
      startTime,
      endTime: null,
    };

    // Initialize EODHD client for FX conversion (if needed)
    const eodhdClient = new EODHDCacheClient({
      apiKey: process.env.API_EODHD_API_TOKEN,
      cacheExpirationHours: 24,
    });

    // FX rate cache
    const fxRateCache = new Map();
    const resolveFxRate = async (currencyCode) => {
      const normalizedCurrency = normalizeCurrencyCode(currencyCode);
      if (!normalizedCurrency || normalizedCurrency === FX_BASE_CURRENCY) {
        return { rate: 1, sourceCurrency: FX_BASE_CURRENCY, targetCurrency: FX_BASE_CURRENCY };
      }

      const cacheKey = `${normalizedCurrency}->${FX_BASE_CURRENCY}`;
      if (fxRateCache.has(cacheKey)) {
        return fxRateCache.get(cacheKey);
      }

      if (!eodhdClient?.eodhdClient?.forex) {
        return { rate: 1, sourceCurrency: normalizedCurrency, targetCurrency: FX_BASE_CURRENCY };
      }

      try {
        const conversion = await eodhdClient.eodhdClient.forex.convertCurrency(
          1,
          normalizedCurrency,
          FX_BASE_CURRENCY
        );
        const exchangeRate = Number(conversion?.exchangeRate);
        const convertedAmount = Number(conversion?.convertedAmount);
        const rateCandidate =
          Number.isFinite(exchangeRate) && exchangeRate > 0
            ? exchangeRate
            : Number.isFinite(convertedAmount) && convertedAmount > 0
            ? convertedAmount
            : 1;

        const info = {
          rate: rateCandidate,
          sourceCurrency: normalizedCurrency,
          targetCurrency: FX_BASE_CURRENCY,
          timestamp: conversion?.timestamp || new Date().toISOString(),
        };
        fxRateCache.set(cacheKey, info);
        return info;
      } catch (error) {
        log(`   ⚠️  Failed to resolve FX rate for ${normalizedCurrency}: ${error.message}`);
        return { rate: 1, sourceCurrency: normalizedCurrency, targetCurrency: FX_BASE_CURRENCY };
      }
    };

    // Retry wrapper for exchange processing
    const retryProcessExchange = async (exchange, retries = MAX_RETRIES) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await processExchange(exchange, oneMonthAgo, log, ExchangeSymbols, resolveFxRate);
        } catch (error) {
          if (attempt === retries) {
            throw error;
          }
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          log(
            `   ⚠️  ${exchange.code}: Processing failed (attempt ${attempt + 1}/${
              retries + 1
            }), retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    // Process exchanges in parallel with concurrency control
    const exchangeChunks = [];
    for (let i = 0; i < exchangesToProcess.length; i += MAX_CONCURRENT_EXCHANGES) {
      exchangeChunks.push(exchangesToProcess.slice(i, i + MAX_CONCURRENT_EXCHANGES));
    }

    for (const chunk of exchangeChunks) {
      const chunkPromises = chunk.map((exchange) =>
        retryProcessExchange(exchange).catch((error) => {
          log(`   ❌ Failed to process ${exchange.code}: ${error.message}`);
          return { error: error.message, found: 0, updated: 0, skipped: 0 };
        })
      );
      const chunkResults = await Promise.allSettled(chunkPromises);

      // Aggregate results
      chunkResults.forEach((result, index) => {
        const exchange = chunk[index];
        const exchangeResult =
          result.status === "fulfilled"
            ? result.value
            : { error: result.reason?.message || "Unknown error" };
        results.exchanges[exchange.code] = exchangeResult;
        if (!exchangeResult.error) {
          results.total += exchangeResult.found || 0;
          results.updated += exchangeResult.updated || 0;
          results.skipped += exchangeResult.skipped || 0;
        }
      });

      // Simple progress: processed / total
      if (progress) {
        const processed = Object.keys(results.exchanges).length;
        await progress(processed / exchangesToProcess.length);
      }
    }

    results.endTime = Date.now();
    const duration = Math.round((results.endTime - results.startTime) / 1000);

    // Print final summary
    log(`\n🎉 Final Summary:`);
    log(`   Total large cap stocks found: ${results.total}`);
    log(`   Updated: ${results.updated}`);
    log(`   Skipped (fresh data): ${results.skipped}`);
    log(`   Exchanges processed: ${Object.keys(results.exchanges).length}`);
    log(`   Duration: ${duration}s`);

    // Print top stocks by market cap
    log(`\n🏆 Top Large Cap Stocks by Exchange:`);
    for (const [exchangeCode, exchangeResult] of Object.entries(results.exchanges)) {
      if (exchangeResult.stocks && exchangeResult.stocks.length > 0) {
        log(`\n   ${exchangeCode}:`);
        exchangeResult.stocks
          .sort((a, b) => b.cap - a.cap)
          .slice(0, 5)
          .forEach((stock, index) => {
            log(`     ${index + 1}. ${stock.code}: ${stock.name} - ${formatMarketCap(stock.cap)}`);
          });
      }
    }

    return results;
  } catch (error) {
    log(`❌ Job failed: ${error.message}`);
    throw error;
  } finally {
    // No need to close connection as we're using the shared database connection
  }
}

// OPTIMIZATION 2: Extract exchange processing into separate function for parallel execution
async function processExchange(exchange, oneMonthAgo, log, ExchangeSymbols, resolveFxRate) {
  try {
    log(`\n🏢 Processing ${exchange.code}: ${exchange.Name} (${exchange.Country})`);

    const exchangeResults = {
      found: 0,
      updated: 0,
      skipped: 0,
      stocks: [],
    };

    // OPTIMIZATION 3: Use optimized aggregation pipeline
    // Use indexed queries and check fundamentals freshness
    const fundamentalsCutoff = new Date(
      Date.now() - FUNDAMENTALS_FRESHNESS_DAYS * 24 * 60 * 60 * 1000
    );

    const aggregationResult = await ExchangeSymbols.aggregate([
      { $match: { exchangeCode: exchange.code } },
      {
        $lookup: {
          from: "fundamentals",
          let: { exchangeCode: exchange.code },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $regexMatch: { input: "$symbol", regex: `\\.${exchange.code}$` } },
                    { $gte: ["$fetchedAt", fundamentalsCutoff] }, // Only fresh fundamentals
                  ],
                },
              },
            },
            {
              $project: {
                symbol: 1,
                marketCap: "$fundamentals.Highlights.MarketCapitalization",
                marketCapMln: "$fundamentals.Highlights.MarketCapitalizationMln",
                companyName: "$fundamentals.General.Name",
                sector: "$fundamentals.General.Sector",
                industry: "$fundamentals.General.Industry",
                currency: "$fundamentals.General.CurrencyCode",
                fetchedAt: 1,
              },
            },
          ],
          as: "fundamentals",
        },
      },
    ]);

    if (!aggregationResult.length || !aggregationResult[0]?.symbols?.length) {
      log(`   ⚠️  No symbols found for ${exchange.code}`);
      return exchangeResults;
    }

    const exchangeSymbols = aggregationResult[0];
    if (!exchangeSymbols.symbols || exchangeSymbols.symbols.length === 0) {
      log(`   ⚠️  No symbols found for ${exchange.code}`);
      return exchangeResults;
    }
    log(`   📈 Found ${exchangeSymbols.symbols.length} symbols`);

    // Resolve exchange currency for FX conversion
    const exchangeCurrency = normalizeCurrencyCode(exchange.Currency) || FX_BASE_CURRENCY;
    const fxInfo = await resolveFxRate(exchangeCurrency);

    // Create fundamentals map from aggregation result with currency normalization
    const fundamentalsMap = new Map();
    let invalidMarketCaps = 0;

    for (const fund of exchangeSymbols.fundamentals) {
      const symbolCode = fund.symbol.split(".")[0];

      // Get market cap (prefer absolute value, fallback to Mln * 1M)
      let marketCapRaw = fund.marketCap;
      if (!marketCapRaw && fund.marketCapMln) {
        marketCapRaw = Number(fund.marketCapMln) * 1_000_000;
      }

      // Validate market cap
      if (!isPositiveNumber(marketCapRaw)) {
        invalidMarketCaps++;
        continue;
      }

      // Sanity check: clamp to reasonable range
      marketCapRaw = clamp(marketCapRaw, MIN_MARKET_CAP, MAX_MARKET_CAP);

      // Normalize currency to USD
      const fundCurrency = normalizeCurrencyCode(fund.currency) || exchangeCurrency;
      const fundFxInfo =
        fundCurrency !== FX_BASE_CURRENCY ? await resolveFxRate(fundCurrency) : fxInfo;

      const marketCapUSD = marketCapRaw * fundFxInfo.rate;

      // Only include stocks with market cap >= threshold (in USD)
      if (marketCapUSD >= LARGE_CAP_THRESHOLD) {
        fundamentalsMap.set(symbolCode, {
          marketCap: marketCapUSD, // Store USD-normalized value
          marketCapOriginal: marketCapRaw,
          currency: fundCurrency,
          fxRate: fundFxInfo.rate,
          companyName: fund.companyName || "Unknown",
          sector: fund.sector || "Unknown",
          industry: fund.industry || "Unknown",
        });
      }
    }

    if (invalidMarketCaps > 0) {
      log(`   ⚠️  Skipped ${invalidMarketCaps} symbols with invalid market cap`);
    }

    log(`   💰 Found ${fundamentalsMap.size} large cap stocks in fundamentals`);

    // OPTIMIZATION 4: Use bulk operations for updates with batching
    const bulkOps = [];
    let symbolsChecked = 0;
    let symbolsWithoutFundamentals = 0;

    for (const symbol of exchangeSymbols.symbols) {
      symbolsChecked++;

      const fundamental = fundamentalsMap.get(symbol.Code);
      if (!fundamental) {
        symbolsWithoutFundamentals++;
        continue;
      }

      // Check if cap data already exists and is fresh
      const isLargeCap = symbol.cap && symbol.cap >= LARGE_CAP_THRESHOLD;
      const isFresh = symbol.capLastSync && symbol.capLastSync > oneMonthAgo;
      if (isLargeCap && isFresh) {
        exchangeResults.skipped++;
        continue;
      }

      // Prepare bulk update operation
      bulkOps.push({
        updateOne: {
          filter: {
            exchangeCode: exchange.code,
            "symbols.Code": symbol.Code,
          },
          update: {
            $set: {
              "symbols.$.cap": fundamental.marketCap,
              "symbols.$.capLastSync": new Date(),
            },
          },
        },
      });

      exchangeResults.found++;
      exchangeResults.updated++;
      exchangeResults.stocks.push({
        code: symbol.Code,
        name: symbol.Name,
        cap: fundamental.marketCap,
        capOriginal: fundamental.marketCapOriginal,
        currency: fundamental.currency,
        fxRate: fundamental.fxRate,
        companyName: fundamental.companyName,
        sector: fundamental.sector,
        industry: fundamental.industry,
      });

      log(
        `   ✅ [${exchangeResults.found}] ${symbol.Code}: ${symbol.Name} - ${formatMarketCap(
          fundamental.marketCap
        )} (${fundamental.sector})`
      );
    }

    // OPTIMIZATION 5: Execute bulk operations in batches
    if (bulkOps.length > 0) {
      for (let i = 0; i < bulkOps.length; i += BULK_WRITE_BATCH_SIZE) {
        const batch = bulkOps.slice(i, i + BULK_WRITE_BATCH_SIZE);
        await ExchangeSymbols.bulkWrite(batch, { ordered: false });
      }
    }

    // Clear large data structures from memory
    bulkOps.length = 0; // Clear bulk operations array
    fundamentalsMap.clear(); // Clear fundamentals map

    // Log search summary
    log(`   📊 Search Summary:`);
    log(`      - Symbols checked: ${symbolsChecked}/${exchangeSymbols.symbols.length}`);
    log(`      - Symbols without fundamentals: ${symbolsWithoutFundamentals}`);
    log(`      - Large cap stocks marked: ${exchangeResults.found}`);

    // Log if we found any large cap stocks
    if (exchangeResults.found > 0) {
      log(
        `   ✅ Found ${exchangeResults.found} large cap stocks with market cap ≥ $${(
          LARGE_CAP_THRESHOLD / 1000000000
        ).toFixed(1)}B`
      );
    } else if (exchangeSymbols.fundamentals?.length === 0) {
      log(`   ⚠️  No fundamental data available for ${exchange.code}`);
      log(`      Cannot determine market cap without fundamentals`);
      log(`      💡 Suggestion: Run syncFundamentalsLargeCap to fetch data from EODHD API`);
    }

    log(
      `   📊 Summary: ${exchangeResults.found} found, ${exchangeResults.updated} updated, ${exchangeResults.skipped} skipped`
    );

    return exchangeResults;
  } catch (error) {
    log(`   ❌ Error processing ${exchange.code}: ${error.message}`);
    return { error: error.message };
  }
}
