import { getModel } from "@buydy/se-db";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
import { getJobConfig, JOB_CONFIG } from "@buydy/iso-business-types";
import { normalizeCurrencyCode } from "@buydy/iso-business-types/src/metricsUtils.js";
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
  cleanDividendHistory,
  calculateTTMDividends,
  calculateDividendYield,
  validateDividendYield,
  analyzeDividendFrequency,
  detectDividendIssues,
  buildDividendQualityFlags,
} from "../../../utils/dividendUtils.js";

const jobConfig = getJobConfig("dividends");
const maxAgeDays = jobConfig.maxAgeDays;
const DIVIDEND_HISTORY_YEARS = JOB_CONFIG.DIVIDEND_HISTORY_YEARS;
const FX_BASE_CURRENCY = "USD";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// 🚀 DEV MODE: Set DEV_MODE_LIMIT env var to process only N companies (e.g., DEV_MODE_LIMIT=50)
const DEV_MODE_LIMIT = getDevModeLimit();
const DEV_MODE_COMPANIES = parseDevModeCompany();

/**
 * Sync dividends for CONFIRMED large cap stocks using dedicated dividends collection
 *
 * This job finds all stocks that have been CONFIRMED as large cap (≥$1B) by the
 * findAndMarkLargeCapStocks job and fetches their dividend data from EODHD API.
 *
 * Should run AFTER findAndMarkLargeCapStocks job.
 * Skips API calls if data is less than 7 days old.
 * Fetches 10 years of dividend history for comprehensive analysis.
 */
export async function syncDividendsLargeCap({ progress, appendLog } = {}) {
  // Default appendLog to logger.business for visibility (logs both to logger and job record)
  const log = appendLog || ((msg) => logger.business(msg));

  // Get Mongoose models (database connection should be bootstrapped at app startup)
  const Dividends = getModel("dividends");

  const client = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
    cacheExpirationHours: jobConfig.cacheExpirationHours,
  });

  // FX rate cache for currency conversion
  const fxRateCache = new Map();
  const resolveFxRate = async (currencyCode) => {
    const normalizedCurrency = normalizeCurrencyCode(currencyCode);
    if (!normalizedCurrency) {
      return {
        rate: 1,
        sourceCurrency: FX_BASE_CURRENCY,
        targetCurrency: FX_BASE_CURRENCY,
        timestamp: new Date().toISOString(),
      };
    }

    if (normalizedCurrency === FX_BASE_CURRENCY) {
      return {
        rate: 1,
        sourceCurrency: FX_BASE_CURRENCY,
        targetCurrency: FX_BASE_CURRENCY,
        timestamp: new Date().toISOString(),
      };
    }

    const cacheKey = `${normalizedCurrency}->${FX_BASE_CURRENCY}`;
    if (fxRateCache.has(cacheKey)) {
      return fxRateCache.get(cacheKey);
    }

    if (!client?.eodhdClient?.forex) {
      return null;
    }

    try {
      const conversion = await client.eodhdClient.forex.convertCurrency(
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
          : null;

      if (!Number.isFinite(rateCandidate) || rateCandidate <= 0) {
        throw new Error("Invalid FX rate received");
      }

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
      return null;
    }
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

  const results = [];

  // Calculate 10-year date range
  const now = new Date();
  const tenYearsAgo = new Date(
    now.getFullYear() - DIVIDEND_HISTORY_YEARS,
    now.getMonth(),
    now.getDate()
  );
  const fromDate = tenYearsAgo.toISOString().split("T")[0];
  const toDate = now.toISOString().split("T")[0];

  log(
    `🔄 Starting dividends sync for large cap stocks (${DIVIDEND_HISTORY_YEARS} years: ${fromDate} to ${toDate})`
  );

  // 🚀 DEV MODE: Log if running in dev mode
  if (DEV_MODE_LIMIT) {
    log(`🔧 DEV MODE: Processing only ${DEV_MODE_LIMIT} companies for quick testing`);
  }
  if (DEV_MODE_COMPANIES && DEV_MODE_COMPANIES.length > 0) {
    log(`🔧 DEV MODE: Prioritizing companies: ${DEV_MODE_COMPANIES.join(", ")}`);
  }

  try {
    log(
      `🔍 Finding large cap stocks (>=$${LARGE_CAP_THRESHOLD.toLocaleString()}) from exchange_symbols...`
    );

    // Use the centralized large cap function
    const exchangeSymbolsDocs = await getLargeCapStocksFromDatabase(maxAgeDays);

    if (exchangeSymbolsDocs.length === 0) {
      log("⚠️  No large cap stocks found in exchange_symbols collection");
      return { success: true, message: "No large cap stocks to process" };
    }

    // Count total large cap stocks using centralized function
    const totalLargeCapStocks = countLargeCapStocks(exchangeSymbolsDocs, maxAgeDays);

    log(
      `📊 Found ${exchangeSymbolsDocs.length} exchanges with ${totalLargeCapStocks} total large cap stocks`
    );

    let processedStocks = 0;
    let totalProcessedForDevMode = 0; // Track total processed in dev mode

    // Report initial progress when starting work
    if (progress && totalLargeCapStocks > 0) {
      await progress(0.01); // Report 1% immediately to show job is working
    }

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
        log(`🏢 Processing ${exchangeCode}: ${largeCapStocks.length} large cap stocks (DEV MODE)`);

        const CHUNK_SIZE = 10;
        for (let i = 0; i < largeCapStocks.length; i += CHUNK_SIZE) {
          const chunk = largeCapStocks.slice(i, i + CHUNK_SIZE);

          const chunkPromises = chunk.map(async (symbol) => {
            let symbolKey = buildSymbolKey(symbol, exchangeCode);
            let eodhdSymbol = symbolKey;

            const existingDividend = await Dividends.findBySymbol(symbolKey);
            if (existingDividend && existingDividend.isDataFresh(maxAgeDays)) {
              results.push({ symbol: symbolKey, ok: true, skipped: true });
              return;
            }

            try {
              // Use retry logic for API calls
              const [dividendHistory, upcomingDividends, dividendYield] = await Promise.allSettled([
                retryApiCall(
                  () => client.dividends.getDividends(eodhdSymbol, fromDate, toDate),
                  symbolKey
                ),
                retryApiCall(() => client.dividends.getUpcomingDividends(eodhdSymbol), symbolKey),
                retryApiCall(
                  () => client.dividends.getDividendYield(eodhdSymbol).catch(() => null),
                  symbolKey
                ),
              ]);

              // Resolve currency with normalization
              let currencyRaw = null;
              if (dividendYield.status === "fulfilled" && dividendYield.value?.currency) {
                currencyRaw = dividendYield.value.currency;
              } else if (symbol.Currency) {
                currencyRaw = symbol.Currency;
              } else {
                currencyRaw =
                  exchangeCode === "US"
                    ? "USD"
                    : exchangeCode === "LSE"
                    ? "GBP"
                    : exchangeCode === "TO"
                    ? "CAD"
                    : "USD";
              }

              // Normalize currency code
              const currency = normalizeCurrencyCode(currencyRaw) || "USD";
              log(`   💰 Currency resolved for ${symbolKey}: ${currencyRaw} → ${currency}`);

              // Clean and validate dividend history
              const rawHistory =
                dividendHistory.status === "fulfilled" ? dividendHistory.value : [];
              const cleanedResult = cleanDividendHistory(rawHistory, {
                removeSpecials: true,
                removeOutliers: true,
                useAdjustedValues: true,
              });

              // Convert dividend values to USD using FX rates
              const fxInfo = await resolveFxRate(currency);
              const conversionRate = fxInfo?.rate || 1;
              const convertedHistory = cleanedResult.cleaned.map((entry) => ({
                ...entry,
                valueUSD: entry.value * conversionRate,
                originalValue: entry.value,
                originalCurrency: entry.currency || currency,
                fxRate: conversionRate,
                fxTimestamp: fxInfo?.timestamp || null,
              }));

              // Clean upcoming dividends (remove past dates)
              const rawUpcoming =
                upcomingDividends.status === "fulfilled" ? upcomingDividends.value : [];
              const now = new Date();
              const cleanedUpcoming = rawUpcoming
                .filter((d) => {
                  const date = new Date(d?.date || d?.Date || 0);
                  return !isNaN(+date) && date > now;
                })
                .map((d) => ({
                  date: new Date(d?.date || d?.Date),
                  value: Number(d?.value ?? d?.Value ?? 0),
                  currency: d?.currency || d?.Currency || currency,
                  period: d?.period || d?.Period || null,
                }))
                .filter((d) => !isNaN(+d.date) && d.value > 0)
                .sort((a, b) => a.date - b.date);

              // Calculate TTM dividends (use USD converted values for consistency)
              const ttmDividends = calculateTTMDividends(
                convertedHistory.map((e) => ({
                  date: e.date,
                  value: e.valueUSD || e.value,
                }))
              );
              const ttmDividendsOriginal = calculateTTMDividends(cleanedResult.cleaned);
              const apiYield =
                dividendYield.status === "fulfilled" ? dividendYield.value?.dividendYield : null;

              // Get current price for yield validation (if available)
              let calculatedYield = null;
              let yieldValidation = {
                isValid: true,
                difference: null,
                reason: "Price not available",
              };

              try {
                // Try to get current price for yield validation
                const priceData = await client.stocks
                  .getRealTimePrice(eodhdSymbol)
                  .catch(() => null);
                const currentPrice = priceData?.close || priceData?.price || null;

                if (currentPrice && ttmDividends > 0) {
                  calculatedYield = calculateDividendYield(ttmDividends, currentPrice);
                  if (calculatedYield !== null && apiYield !== null) {
                    yieldValidation = validateDividendYield(apiYield, calculatedYield, 0.05); // 5% tolerance
                  }
                }
              } catch (priceError) {
                // Price fetch failed - not critical, continue without validation
              }

              // Analyze dividend frequency and detect issues (use cleaned history, not converted)
              const frequencyAnalysis = analyzeDividendFrequency(cleanedResult.cleaned);
              const issueAnalysis = detectDividendIssues(cleanedResult.cleaned);

              // Build data quality flags
              const qualityFlags = buildDividendQualityFlags(
                cleanedResult,
                frequencyAnalysis,
                issueAnalysis,
                yieldValidation
              );

              // Use calculated yield if API yield is invalid or missing
              const finalYield =
                yieldValidation.isValid && apiYield !== null
                  ? apiYield
                  : calculatedYield !== null
                  ? calculatedYield
                  : apiYield;

              // Count split adjustment flags
              const splitAdjustmentIssues = convertedHistory.filter(
                (e) => e.splitAdjustmentFlagged
              ).length;

              const dividendsData = {
                history: convertedHistory, // Store with USD conversion
                upcoming: cleanedUpcoming,
                dividendYield: finalYield,
                currency: currency,
                metadata: {
                  cleaningStats: cleanedResult.stats,
                  qualityFlags: qualityFlags,
                  frequencyAnalysis: frequencyAnalysis,
                  issueAnalysis: issueAnalysis,
                  yieldValidation: yieldValidation,
                  ttmDividends: ttmDividends,
                  ttmDividendsOriginal: ttmDividendsOriginal,
                  calculatedYield: calculatedYield,
                  apiYield: apiYield,
                  fxConversion: {
                    baseCurrency: FX_BASE_CURRENCY,
                    sourceCurrency: currency,
                    rate: conversionRate,
                    timestamp: fxInfo?.timestamp || null,
                  },
                  splitAdjustmentIssues: splitAdjustmentIssues,
                  timestamp: new Date(),
                },
              };

              if (existingDividend) {
                log(
                  `   🔄 Updating existing dividend for ${symbolKey} (quality: ${qualityFlags.qualityScore.toFixed(
                    2
                  )}, ${cleanedResult.stats.finalCount} cleaned entries)`
                );
                await existingDividend.updateDividendData(dividendsData);
              } else {
                log(
                  `   💾 Creating new dividend for ${symbolKey} (quality: ${qualityFlags.qualityScore.toFixed(
                    2
                  )}, ${cleanedResult.stats.finalCount} cleaned entries)`
                );
                const newDividend = new Dividends({
                  symbol: symbolKey,
                  exchange: exchangeCode,
                  currency: dividendsData.currency,
                  dividendYield: dividendsData.dividendYield,
                  history: dividendsData.history,
                  upcoming: dividendsData.upcoming,
                  metadata: dividendsData.metadata,
                });
                await newDividend.save();
              }

              results.push({ symbol: symbolKey, ok: true, skipped: false });
            } catch (error) {
              log(`   ❌ FAIL ${symbolKey}: ${error.message}`);
              results.push({ symbol: symbolKey, ok: false, error: error.message });
            }
          });

          await Promise.allSettled(chunkPromises);
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

        log(`🏢 Processing ${exchangeDoc.exchangeCode}: ${largeCapStocks.length} large cap stocks`);

        const CHUNK_SIZE = 10; // Process stocks in smaller chunks
        let exchangeProcessed = 0;
        let lastExchangeProgress = 0;

        for (let i = 0; i < largeCapStocks.length; i += CHUNK_SIZE) {
          const chunk = largeCapStocks.slice(i, i + CHUNK_SIZE);

          // Process chunk in parallel
          const chunkPromises = chunk.map(async (symbol) => {
            let symbolKey = `${symbol.Code}.${exchangeDoc.exchangeCode}`;
            let eodhdSymbol = symbolKey;

            // Handle US exchanges specially
            if (exchangeDoc.exchangeCode === "US") {
              symbolKey = `${symbol.Code}.US`;
            }

            // Check if we already have fresh dividend data in dividends collection
            const existingDividend = await Dividends.findBySymbol(symbolKey);
            if (existingDividend && existingDividend.isDataFresh(maxAgeDays)) {
              results.push({ symbol: symbolKey, ok: true, skipped: true });
              return;
            }

            try {
              // Use retry logic for API calls
              const [dividendHistory, upcomingDividends, dividendYield] = await Promise.allSettled([
                retryApiCall(
                  () => client.dividends.getDividends(eodhdSymbol, fromDate, toDate),
                  symbolKey
                ),
                retryApiCall(() => client.dividends.getUpcomingDividends(eodhdSymbol), symbolKey),
                retryApiCall(
                  () => client.dividends.getDividendYield(eodhdSymbol).catch(() => null),
                  symbolKey
                ),
              ]);

              // Resolve currency with normalization
              let currencyRaw = null;
              if (dividendYield.status === "fulfilled" && dividendYield.value?.currency) {
                currencyRaw = dividendYield.value.currency;
              } else if (symbol.Currency) {
                currencyRaw = symbol.Currency;
              } else {
                currencyRaw =
                  exchangeDoc.exchangeCode === "US"
                    ? "USD"
                    : exchangeDoc.exchangeCode === "LSE"
                    ? "GBP"
                    : exchangeDoc.exchangeCode === "TO"
                    ? "CAD"
                    : "USD";
              }

              // Normalize currency code
              const currency = normalizeCurrencyCode(currencyRaw) || "USD";
              log(`   💰 Currency resolved for ${symbolKey}: ${currencyRaw} → ${currency}`);

              // Clean and validate dividend history
              const rawHistory =
                dividendHistory.status === "fulfilled" ? dividendHistory.value : [];
              const cleanedResult = cleanDividendHistory(rawHistory, {
                removeSpecials: true,
                removeOutliers: true,
                useAdjustedValues: true,
              });

              // Convert dividend values to USD using FX rates
              const fxInfo = await resolveFxRate(currency);
              const conversionRate = fxInfo?.rate || 1;
              const convertedHistory = cleanedResult.cleaned.map((entry) => ({
                ...entry,
                valueUSD: entry.value * conversionRate,
                originalValue: entry.value,
                originalCurrency: entry.currency || currency,
                fxRate: conversionRate,
                fxTimestamp: fxInfo?.timestamp || null,
              }));

              // Clean upcoming dividends (remove past dates)
              const rawUpcoming =
                upcomingDividends.status === "fulfilled" ? upcomingDividends.value : [];
              const now = new Date();
              const cleanedUpcoming = rawUpcoming
                .filter((d) => {
                  const date = new Date(d?.date || d?.Date || 0);
                  return !isNaN(+date) && date > now;
                })
                .map((d) => ({
                  date: new Date(d?.date || d?.Date),
                  value: Number(d?.value ?? d?.Value ?? 0),
                  currency: d?.currency || d?.Currency || currency,
                  period: d?.period || d?.Period || null,
                }))
                .filter((d) => !isNaN(+d.date) && d.value > 0)
                .sort((a, b) => a.date - b.date);

              // Calculate TTM dividends (use USD converted values for consistency)
              const ttmDividends = calculateTTMDividends(
                convertedHistory.map((e) => ({
                  date: e.date,
                  value: e.valueUSD || e.value,
                }))
              );
              const ttmDividendsOriginal = calculateTTMDividends(cleanedResult.cleaned);
              const apiYield =
                dividendYield.status === "fulfilled" ? dividendYield.value?.dividendYield : null;

              // Get current price for yield validation (if available)
              let calculatedYield = null;
              let yieldValidation = {
                isValid: true,
                difference: null,
                reason: "Price not available",
              };

              try {
                // Try to get current price for yield validation
                const priceData = await client.stocks
                  .getRealTimePrice(eodhdSymbol)
                  .catch(() => null);
                const currentPrice = priceData?.close || priceData?.price || null;

                if (currentPrice && ttmDividends > 0) {
                  calculatedYield = calculateDividendYield(ttmDividends, currentPrice);
                  if (calculatedYield !== null && apiYield !== null) {
                    yieldValidation = validateDividendYield(apiYield, calculatedYield, 0.05); // 5% tolerance
                  }
                }
              } catch (priceError) {
                // Price fetch failed - not critical, continue without validation
              }

              // Analyze dividend frequency and detect issues (use cleaned history, not converted)
              const frequencyAnalysis = analyzeDividendFrequency(cleanedResult.cleaned);
              const issueAnalysis = detectDividendIssues(cleanedResult.cleaned);

              // Build data quality flags
              const qualityFlags = buildDividendQualityFlags(
                cleanedResult,
                frequencyAnalysis,
                issueAnalysis,
                yieldValidation
              );

              // Use calculated yield if API yield is invalid or missing
              const finalYield =
                yieldValidation.isValid && apiYield !== null
                  ? apiYield
                  : calculatedYield !== null
                  ? calculatedYield
                  : apiYield;

              // Count split adjustment flags
              const splitAdjustmentIssues = convertedHistory.filter(
                (e) => e.splitAdjustmentFlagged
              ).length;

              const dividendsData = {
                history: convertedHistory, // Store with USD conversion
                upcoming: cleanedUpcoming,
                dividendYield: finalYield,
                currency: currency,
                metadata: {
                  cleaningStats: cleanedResult.stats,
                  qualityFlags: qualityFlags,
                  frequencyAnalysis: frequencyAnalysis,
                  issueAnalysis: issueAnalysis,
                  yieldValidation: yieldValidation,
                  ttmDividends: ttmDividends,
                  ttmDividendsOriginal: ttmDividendsOriginal,
                  calculatedYield: calculatedYield,
                  apiYield: apiYield,
                  fxConversion: {
                    baseCurrency: FX_BASE_CURRENCY,
                    sourceCurrency: currency,
                    rate: conversionRate,
                    timestamp: fxInfo?.timestamp || null,
                  },
                  splitAdjustmentIssues: splitAdjustmentIssues,
                  timestamp: new Date(),
                },
              };

              // Save to dedicated dividends collection
              if (existingDividend) {
                log(
                  `   🔄 Updating existing dividend for ${symbolKey} (quality: ${qualityFlags.qualityScore.toFixed(
                    2
                  )}, ${cleanedResult.stats.finalCount} cleaned entries)`
                );
                await existingDividend.updateDividendData(dividendsData);
              } else {
                log(
                  `   💾 Creating new dividend for ${symbolKey} (quality: ${qualityFlags.qualityScore.toFixed(
                    2
                  )}, ${cleanedResult.stats.finalCount} cleaned entries)`
                );
                const newDividend = new Dividends({
                  symbol: symbolKey,
                  exchange: exchangeDoc.exchangeCode,
                  currency: dividendsData.currency,
                  dividendYield: dividendsData.dividendYield,
                  history: dividendsData.history,
                  upcoming: dividendsData.upcoming,
                  metadata: dividendsData.metadata,
                });
                await newDividend.save();
              }

              results.push({ symbol: symbolKey, ok: true, skipped: false });
            } catch (error) {
              log(`   ❌ FAIL ${symbolKey}: ${error.message}`);
              results.push({ symbol: symbolKey, ok: false, error: error.message });
            }
          });

          await Promise.allSettled(chunkPromises);

          exchangeProcessed += chunk.length;
          processedStocks += chunk.length;
          totalProcessedForDevMode += chunk.length; // Update dev mode counter

          // Log exchange progress every 10%
          const currentExchangeProgress = exchangeProcessed / largeCapStocks.length;
          const exchangeProgressIncrease = currentExchangeProgress - lastExchangeProgress;
          if (exchangeProgressIncrease >= 0.1 || exchangeProcessed === largeCapStocks.length) {
            const overallProgress = processedStocks / totalLargeCapStocks;
            log(
              `   📊 ${exchangeDoc.exchangeCode} Progress: ${(
                currentExchangeProgress * 100
              ).toFixed(1)}% (${exchangeProcessed}/${largeCapStocks.length}) | Overall: ${(
                overallProgress * 100
              ).toFixed(1)}%`
            );
            lastExchangeProgress = currentExchangeProgress;
          }

          // Simple progress: processed / total
          const overallProgress = processedStocks / totalLargeCapStocks;
          if (progress) {
            await progress(overallProgress);
          }

          // Small delay between chunks to avoid overwhelming the system
          if (i + CHUNK_SIZE < largeCapStocks.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
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

    // Print dividend statistics
    const stocksWithDividends = results.filter((r) => r.ok && !r.skipped).length;
    log(`\n💰 Dividend Statistics:`);
    log(`   Stocks with dividend data: ${stocksWithDividends}`);
    log(`   Data range: ${DIVIDEND_HISTORY_YEARS} years (${fromDate} to ${toDate})`);

    return {
      success: true,
      totalStocks: totalLargeCapStocks,
      processed: successCount,
      skipped: skippedCount,
      failed: failedCount,
      exchanges: exchangeSymbolsDocs.length,
    };
  } catch (error) {
    log(`❌ Job failed: ${error.message}`);
    throw error;
  } finally {
    // No need to close connection as we're using the shared database connection
  }
}
