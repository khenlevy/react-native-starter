import { getModel } from "@buydy/se-db";
import {
  getMetricsConfigForJobs,
  logMetricsConfiguration,
  getJobConfig,
} from "@buydy/iso-business-types";
import logger from "@buydy/se-logger";
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";
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
  DividendGrowth3Y,
  DividendGrowth5Y,
  DividendGrowth10Y,
  DividendYieldCurrent,
} from "../../../calculators/dividendGrowth.js";
import {
  DebtToEquityCurrent,
  DebtToEquityChange3M,
  DebtToEquityChange6M,
  DebtToEquityChange1Y,
  DebtToEquityChange2Y,
  NetDebtToEBITDACurrent,
  NetDebtToEBITDAChange3M,
  NetDebtToEBITDAChange6M,
  NetDebtToEBITDAChange1Y,
  NetDebtToEBITDAChange2Y,
  EBITDACurrent,
  EBITDAGrowth3M,
  EBITDAGrowth6M,
  EBITDAGrowth1Y,
  EBITDAGrowth2Y,
  NetDebtCurrent,
  NetDebtChange3M,
  NetDebtChange6M,
  NetDebtChange1Y,
  NetDebtChange2Y,
} from "../../../calculators/debtAndProfitability.js";
const jobConfig = getJobConfig("metrics");
const maxAgeDays = jobConfig.maxAgeDays;

// 🚀 DEV MODE: Set DEV_MODE_LIMIT env var to process only N companies (e.g., DEV_MODE_LIMIT=5)
const DEV_MODE_LIMIT = getDevModeLimit();
const DEV_MODE_COMPANIES = parseDevModeCompany();

// Map enum metric IDs to calculator functions
const METRIC_CALCULATORS = {
  DividendYieldCurrent: DividendYieldCurrent,
  DividendGrowth3Y: DividendGrowth3Y,
  DividendGrowth5Y: DividendGrowth5Y,
  DividendGrowth10Y: DividendGrowth10Y,
  // Debt-to-Equity
  DebtToEquityCurrent: DebtToEquityCurrent,
  DebtToEquityChange3M: DebtToEquityChange3M,
  DebtToEquityChange6M: DebtToEquityChange6M,
  DebtToEquityChange1Y: DebtToEquityChange1Y,
  DebtToEquityChange2Y: DebtToEquityChange2Y,
  // Net Debt/EBITDA
  NetDebtToEBITDACurrent: NetDebtToEBITDACurrent,
  NetDebtToEBITDAChange3M: NetDebtToEBITDAChange3M,
  NetDebtToEBITDAChange6M: NetDebtToEBITDAChange6M,
  NetDebtToEBITDAChange1Y: NetDebtToEBITDAChange1Y,
  NetDebtToEBITDAChange2Y: NetDebtToEBITDAChange2Y,
  // EBITDA
  EBITDACurrent: EBITDACurrent,
  EBITDAGrowth3M: EBITDAGrowth3M,
  EBITDAGrowth6M: EBITDAGrowth6M,
  EBITDAGrowth1Y: EBITDAGrowth1Y,
  EBITDAGrowth2Y: EBITDAGrowth2Y,
  // Net Debt
  NetDebtCurrent: NetDebtCurrent,
  NetDebtChange3M: NetDebtChange3M,
  NetDebtChange6M: NetDebtChange6M,
  NetDebtChange1Y: NetDebtChange1Y,
  NetDebtChange2Y: NetDebtChange2Y,
};

/**
 * Sync metrics for CONFIRMED large cap stocks using ISO business enum
 *
 * This job finds all stocks that have been CONFIRMED as large cap (≥$1B) by the
 * findAndMarkLargeCapStocks job and calculates their financial metrics using
 * the ISO business enum for consistent naming.
 *
 * Should run AFTER findAndMarkLargeCapStocks job.
 * Always calculates metrics (no skip logic) to ensure accuracy and propagate bug fixes.
 * Calculates all enabled metrics from enum in single iteration.
 *
 * This is the OPTIMAL approach - single job, single iteration, enum-based naming.
 */
export async function syncMetricsLargeCap({ progress, appendLog } = {}) {
  // Default appendLog to logger.business for visibility (logs both to logger and job record)
  const log = appendLog || ((msg) => logger.business(msg));

  // Get metrics configuration from shared utilities - single source of truth
  const metricsConfig = getMetricsConfigForJobs();
  const enabledMetrics = metricsConfig.metrics;
  const performanceMetrics = enabledMetrics.filter((metric) => metric.category === "performance");
  const metricsToCalculate = enabledMetrics.filter((metric) => metric.category !== "performance");

  if (metricsToCalculate.length === 0) {
    throw new Error("No enabled metrics found in ISO business enum");
  }

  if (performanceMetrics.length > 0) {
    log(
      `⏭️  Skipping ${performanceMetrics.length} performance metrics in syncMetricsLargeCap (processed by syncPricePerformanceLargeCap)`
    );
  }

  // Log metrics configuration for debugging
  logMetricsConfiguration("(Job)");

  // 🚀 DEV MODE: Log if running in dev mode
  if (DEV_MODE_LIMIT) {
    log(`🔧 DEV MODE: Processing only ${DEV_MODE_LIMIT} companies for quick testing`);
  }
  if (DEV_MODE_COMPANIES && DEV_MODE_COMPANIES.length > 0) {
    log(`🔧 DEV MODE: Prioritizing companies: ${DEV_MODE_COMPANIES.join(", ")}`);
  }

  // Get Mongoose models (database connection should be bootstrapped at app startup)
  const Metrics = getModel("metrics");
  const Dividends = getModel("dividends");
  const Fundamentals = getModel("fundamentals");

  // Initialize EODHD client for price data
  const eodhdClient = new EODHDCacheClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
    cacheExpirationHours: jobConfig.cacheExpirationHours || 24,
  });

  const results = [];

  log(
    `🔄 Starting enhanced metrics calculation for large cap stocks (>=$${LARGE_CAP_THRESHOLD.toLocaleString()})`
  );

  try {
    log(
      `🔍 Finding large cap stocks (>=$${LARGE_CAP_THRESHOLD.toLocaleString()}) from exchange_symbols...`
    );

    // Use the centralized large cap function
    const exchangeSymbolsDocs = await getLargeCapStocksFromDatabase(maxAgeDays);

    if (exchangeSymbolsDocs.length === 0) {
      log("⚠️  No large cap stocks found in exchange_symbols collection");
      return {
        success: true,
        message: "No large cap stocks to process",
        processed: 0,
        updated: 0,
        skipped: 0,
        metricsProcessed: metricsToCalculate.length,
      };
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

          // Process chunk in parallel (reuse existing logic)
          const chunkPromises = chunk.map(async (symbol) => {
            let symbolKey = buildSymbolKey(symbol, exchangeCode);

            // Check if we already have fresh metrics data using model method
            const existingMetrics = await Metrics.findBySymbol(symbolKey);

            // Force recalculation if:
            // 1. Data is stale (older than maxAgeDays)
            // 2. Missing critical metrics (all debt metrics are null)
            // 3. Missing NEW metrics (newly added to the system)
            // 4. Invalid values detected
            let shouldForceCalculation = false;
            let forceReason = "";

            if (existingMetrics) {
              const isDataFresh = existingMetrics.isDataFresh(maxAgeDays);

              // ACCURACY: Check if debt metrics are null (indicates incomplete calculation)
              // Check both: all critical metrics null OR debt-specific metrics null
              // This ensures we recalculate when debt metrics failed even if EBITDA succeeded
              const criticalDebtMetrics = [
                "DebtToEquityCurrent",
                "EBITDACurrent",
                "NetDebtCurrent",
              ];
              const allCriticalDebtMetricsNull = criticalDebtMetrics.every(
                (metric) =>
                  !existingMetrics.metrics ||
                  existingMetrics.metrics[metric] === null ||
                  existingMetrics.metrics[metric] === undefined
              );

              // ACCURACY: Also check if debt-specific metrics are null (even if EBITDA exists)
              // This catches cases where debt metrics failed to calculate but EBITDA succeeded
              const debtSpecificMetrics = ["DebtToEquityCurrent", "NetDebtCurrent"];
              const allDebtSpecificMetricsNull = debtSpecificMetrics.every(
                (metric) =>
                  !existingMetrics.metrics ||
                  existingMetrics.metrics[metric] === null ||
                  existingMetrics.metrics[metric] === undefined
              );

              // ACCURACY: Always recalculate metrics to ensure accuracy
              // Reasons:
              // 1. Bug fixes need to propagate to existing data
              // 2. Calculation improvements should apply immediately
              // 3. Data is read from our own DB (no API cost)
              // 4. Calculations are fast (pure math operations)
              // 5. Only performance metrics use API (handled separately)

              // Force recalculation if all critical metrics are null OR all debt-specific metrics are null
              const allDebtMetricsNull = allCriticalDebtMetricsNull || allDebtSpecificMetricsNull;

              // Check if any enabled metrics are missing (NEW metrics added to system)
              const missingMetrics = metricsToCalculate.filter(
                (metric) =>
                  !existingMetrics.metrics ||
                  existingMetrics.metrics[metric.dbField] === null ||
                  existingMetrics.metrics[metric.dbField] === undefined
              );
              const hasMissingMetrics = missingMetrics.length > 0;

              // ACCURACY: Always recalculate - removed skip logic for accuracy
              // Previous skip logic prevented bug fixes from being applied to existing data
              shouldForceCalculation = true;

              // Determine force calculation reason for logging
              if (allDebtMetricsNull) {
                forceReason = "missing debt metrics";
              } else if (hasMissingMetrics) {
                forceReason = `missing ${missingMetrics.length} new metrics (${missingMetrics
                  .slice(0, 3)
                  .map((m) => m.id)
                  .join(", ")}${missingMetrics.length > 3 ? "..." : ""})`;
              } else if (!isDataFresh) {
                forceReason = "stale data";
              } else {
                forceReason = "always recalculate for accuracy";
              }
            }

            if (shouldForceCalculation) {
              log(`   🔄 Processing ${symbolKey}... (force: ${forceReason})`);
            } else {
              log(`   🔄 Processing ${symbolKey}...`);
            }

            try {
              // Get dividend data for this symbol
              const dividendDoc = await Dividends.findOne({ symbol: symbolKey });

              // Get fundamentals data for this symbol
              // Use lean() to get plain JavaScript object instead of Mongoose document
              const fundamentalsDoc = await Fundamentals.findOne({
                symbol: symbolKey.toUpperCase(),
              }).lean();

              // Check if we have any data to work with
              // Note: Dividends schema has 'history' and 'upcoming' arrays, not 'dividends' field
              const hasDividendData =
                dividendDoc && dividendDoc.history && dividendDoc.history.length > 0;
              const hasFundamentalsData = fundamentalsDoc && fundamentalsDoc.fundamentals;

              log(
                `      📊 Data available - Dividends: ${
                  hasDividendData ? "✅" : "❌"
                }, Fundamentals: ${hasFundamentalsData ? "✅" : "❌"}`
              );

              if (!hasDividendData && !hasFundamentalsData) {
                log(`      ⚠️  No data found for ${symbolKey} - permanent issue (no source data)`);

                // Mark as permanently failed - no point retrying without source data
                if (existingMetrics) {
                  await existingMetrics.updateMetricsData({
                    _calculationStatus: "no_source_data",
                    _lastAttempt: new Date(),
                  });
                }

                results.push({
                  symbol: symbolKey,
                  status: "skipped",
                  reason: "no_data_permanent",
                });
                return;
              }

              // Calculate ALL metrics for this stock using enum-based approach
              // Note: Pass 'history' array (not 'dividends' field which doesn't exist)
              const fundamentalsData = fundamentalsDoc?.fundamentals;
              if (fundamentalsData) {
                log(
                  `      📋 Fundamentals data structure - Has Financials: ${!!fundamentalsData?.Financials}, Has Balance_Sheet: ${!!fundamentalsData
                    ?.Financials?.Balance_Sheet}, Has quarterly: ${!!fundamentalsData?.Financials
                    ?.Balance_Sheet?.quarterly}`
                );
              }

              const calculatedMetrics = await calculateAllMetricsFromEnum(
                dividendDoc?.history,
                fundamentalsData,
                symbolKey,
                metricsToCalculate,
                log,
                eodhdClient
              );

              const metricCount = Object.keys(calculatedMetrics).length;
              const metricNames = Object.keys(calculatedMetrics);

              // Count by category
              const dividendMetrics = metricNames.filter((m) =>
                [
                  "DividendYieldCurrent",
                  "DividendGrowth3Y",
                  "DividendGrowth5Y",
                  "DividendGrowth10Y",
                ].includes(m)
              );
              const debtMetrics = metricNames.filter((m) => m.includes("Debt"));
              const ebitdaMetrics = metricNames.filter((m) => m.includes("EBITDA"));
              const priceMetrics = metricNames.filter((m) => m.includes("PriceChange"));

              log(
                `      📈 Calculated ${metricCount} metrics - Dividend: ${dividendMetrics.length}, Debt: ${debtMetrics.length}, EBITDA: ${ebitdaMetrics.length}, Price: ${priceMetrics.length}`
              );

              if (metricCount === 0) {
                log(`      ⚠️  No metrics could be calculated for ${symbolKey} - skipping`);
                results.push({
                  symbol: symbolKey,
                  status: "skipped",
                  reason: "no_metrics_calculated",
                });
                return;
              }

              // Cap percentage change metrics at 1000% (schema limit)
              // Some extreme values can occur due to data quality issues or outliers
              const cappedMetrics = { ...calculatedMetrics };
              const percentageChangeMetrics = [
                "DividendGrowth3Y",
                "DividendGrowth5Y",
                "DividendGrowth10Y",
                "DebtToEquityChange3M",
                "DebtToEquityChange6M",
                "DebtToEquityChange1Y",
                "DebtToEquityChange2Y",
                "NetDebtToEBITDAChange3M",
                "NetDebtToEBITDAChange6M",
                "NetDebtToEBITDAChange1Y",
                "NetDebtToEBITDAChange2Y",
                "EBITDAGrowth3M",
                "EBITDAGrowth6M",
                "EBITDAGrowth1Y",
                "EBITDAGrowth2Y",
                "NetDebtChange3M",
                "NetDebtChange6M",
                "NetDebtChange1Y",
                "NetDebtChange2Y",
              ];

              for (const metricKey of percentageChangeMetrics) {
                if (cappedMetrics[metricKey] !== null && cappedMetrics[metricKey] !== undefined) {
                  if (cappedMetrics[metricKey] > 1000) {
                    log(
                      `      ⚠️  Capping ${metricKey} from ${cappedMetrics[metricKey]} to 1000 (schema limit)`
                    );
                    cappedMetrics[metricKey] = 1000;
                  } else if (cappedMetrics[metricKey] < -100) {
                    log(
                      `      ⚠️  Capping ${metricKey} from ${cappedMetrics[metricKey]} to -100 (schema limit)`
                    );
                    cappedMetrics[metricKey] = -100;
                  }
                }
              }

              // Save to dedicated metrics collection using model methods
              const metricsWithStatus = {
                ...cappedMetrics,
                _calculationStatus: "success",
                _lastAttempt: new Date(),
              };

              if (existingMetrics) {
                await existingMetrics.updateMetricsData(metricsWithStatus);
                log(`      ✅ Updated existing metrics document`);
              } else {
                const newMetrics = new Metrics({
                  symbol: symbolKey,
                  exchange: exchangeCode,
                  currency: dividendDoc?.currency || "USD",
                  metrics: metricsWithStatus,
                  lastUpdated: new Date(),
                  fetchedAt: new Date(),
                });
                await newMetrics.save();
                log(`      ✅ Created new metrics document`);
              }

              log(
                `   ✅ SUCCESS ${symbolKey} - ${metricCount} metrics saved (${dividendMetrics.length} dividend, ${debtMetrics.length} debt, ${ebitdaMetrics.length} EBITDA, ${priceMetrics.length} price)`
              );

              results.push({
                symbol: symbolKey,
                status: "updated",
                metricsCalculated: metricCount,
                updatedMetrics: Object.keys(calculatedMetrics),
              });
            } catch (error) {
              log(`   ❌ FAIL ${symbolKey}: ${error.message}`);
              results.push({
                symbol: symbolKey,
                status: "error",
                error: error.message,
              });
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

            // Handle US exchanges specially
            if (exchangeDoc.exchangeCode === "US") {
              symbolKey = `${symbol.Code}.US`;
            }

            log(
              `   🎯 Processing stock: ${symbolKey} (Code: ${symbol.Code}, Exchange: ${exchangeDoc.exchangeCode})`
            );

            // Check if we already have fresh metrics data using model method
            const existingMetrics = await Metrics.findBySymbol(symbolKey);

            // ACCURACY: Always calculate metrics - no skip logic
            // Reasons:
            // 1. Bug fixes need to propagate to existing data
            // 2. Calculation improvements should apply immediately
            // 3. Data is read from our own DB (no API cost)
            // 4. Calculations are fast (pure math operations)
            // 5. Only performance metrics use API (handled separately)
            let shouldForceCalculation = true;
            let forceReason = "always recalculate for accuracy";

            if (existingMetrics) {
              const isDataFresh = existingMetrics.isDataFresh(maxAgeDays);

              // ACCURACY: Check if debt metrics are null (for logging purposes)
              // Check both: all critical metrics null OR debt-specific metrics null
              const criticalDebtMetrics = [
                "DebtToEquityCurrent",
                "EBITDACurrent",
                "NetDebtCurrent",
              ];
              const allCriticalDebtMetricsNull = criticalDebtMetrics.every(
                (metric) =>
                  !existingMetrics.metrics ||
                  existingMetrics.metrics[metric] === null ||
                  existingMetrics.metrics[metric] === undefined
              );

              // ACCURACY: Also check if debt-specific metrics are null (even if EBITDA exists)
              const debtSpecificMetrics = ["DebtToEquityCurrent", "NetDebtCurrent"];
              const allDebtSpecificMetricsNull = debtSpecificMetrics.every(
                (metric) =>
                  !existingMetrics.metrics ||
                  existingMetrics.metrics[metric] === null ||
                  existingMetrics.metrics[metric] === undefined
              );

              const allDebtMetricsNull = allCriticalDebtMetricsNull || allDebtSpecificMetricsNull;

              // Check if any enabled metrics are missing (for logging purposes)
              const missingMetrics = metricsToCalculate.filter(
                (metric) =>
                  !existingMetrics.metrics ||
                  existingMetrics.metrics[metric.dbField] === null ||
                  existingMetrics.metrics[metric.dbField] === undefined
              );
              const hasMissingMetrics = missingMetrics.length > 0;

              // Determine force calculation reason for logging
              if (allDebtMetricsNull) {
                forceReason = "missing debt metrics";
              } else if (hasMissingMetrics) {
                forceReason = `missing ${missingMetrics.length} new metrics (${missingMetrics
                  .slice(0, 3)
                  .map((m) => m.id)
                  .join(", ")}${missingMetrics.length > 3 ? "..." : ""})`;
              } else if (!isDataFresh) {
                forceReason = "stale data";
              } else {
                forceReason = "always recalculate for accuracy";
              }
            }

            if (shouldForceCalculation) {
              log(`   🔄 Processing ${symbolKey}... (force: ${forceReason})`);
            } else {
              log(`   🔄 Processing ${symbolKey}...`);
            }

            log(`   📍 Starting metric calculation for ${symbolKey}`);

            try {
              // Get dividend data for this symbol
              log(`   🔍 Fetching dividend data for ${symbolKey}...`);
              const dividendDoc = await Dividends.findOne({ symbol: symbolKey });
              log(`   🔍 Fetching fundamentals data for ${symbolKey}...`);

              // Get fundamentals data for this symbol
              // Use lean() to get plain JavaScript object instead of Mongoose document
              const fundamentalsDoc = await Fundamentals.findOne({
                symbol: symbolKey.toUpperCase(),
              }).lean();

              // Check if we have any data to work with
              // Note: Dividends schema has 'history' and 'upcoming' arrays, not 'dividends' field
              const hasDividendData =
                dividendDoc && dividendDoc.history && dividendDoc.history.length > 0;
              const hasFundamentalsData = fundamentalsDoc && fundamentalsDoc.fundamentals;

              // Detailed logging for debugging
              if (dividendDoc) {
                log(
                  `      📊 Dividend doc found - history length: ${
                    dividendDoc.history?.length || 0
                  }, upcoming length: ${dividendDoc.upcoming?.length || 0}`
                );
              } else {
                log(`      📊 No dividend doc found for ${symbolKey}`);
              }

              if (fundamentalsDoc) {
                const hasQuarterlyData =
                  fundamentalsDoc.fundamentals?.Financials?.Balance_Sheet?.quarterly ||
                  fundamentalsDoc.fundamentals?.Balance_Sheet?.quarterly;
                log(
                  `      📊 Fundamentals doc found - has quarterly data: ${
                    hasQuarterlyData ? "✅" : "❌"
                  }`
                );
              } else {
                log(`      📊 No fundamentals doc found for ${symbolKey}`);
              }

              log(
                `      📊 Data available - Dividends: ${
                  hasDividendData ? "✅" : "❌"
                }, Fundamentals: ${hasFundamentalsData ? "✅" : "❌"}`
              );

              if (!hasDividendData && !hasFundamentalsData) {
                log(`      ⚠️  No data found for ${symbolKey} - permanent issue (no source data)`);

                // Mark as permanently failed - no point retrying without source data
                if (existingMetrics) {
                  await existingMetrics.updateMetricsData({
                    _calculationStatus: "no_source_data",
                    _lastAttempt: new Date(),
                  });
                }

                results.push({
                  symbol: symbolKey,
                  status: "skipped",
                  reason: "no_data_permanent",
                });
                return;
              }

              // Calculate ALL metrics for this stock using enum-based approach
              // Note: Pass 'history' array (not 'dividends' field which doesn't exist)
              const fundamentalsData = fundamentalsDoc?.fundamentals;
              if (fundamentalsData) {
                log(
                  `      📋 Fundamentals data structure - Has Financials: ${!!fundamentalsData?.Financials}, Has Balance_Sheet: ${!!fundamentalsData
                    ?.Financials?.Balance_Sheet}, Has quarterly: ${!!fundamentalsData?.Financials
                    ?.Balance_Sheet?.quarterly}`
                );
                log(
                  `      📋 Fundamentals keys: ${Object.keys(fundamentalsData || {})
                    .slice(0, 10)
                    .join(", ")}${Object.keys(fundamentalsData || {}).length > 10 ? "..." : ""}`
                );
                if (fundamentalsData?.Financials) {
                  log(
                    `      📋 Financials keys: ${Object.keys(
                      fundamentalsData.Financials || {}
                    ).join(", ")}`
                  );
                  if (fundamentalsData.Financials?.Balance_Sheet) {
                    log(
                      `      📋 Balance_Sheet has quarterly: ${!!fundamentalsData.Financials
                        .Balance_Sheet.quarterly}, quarterly keys count: ${
                        fundamentalsData.Financials.Balance_Sheet.quarterly
                          ? Object.keys(fundamentalsData.Financials.Balance_Sheet.quarterly).length
                          : 0
                      }`
                    );
                  }
                }
              } else {
                log(
                  `      📋 WARNING: fundamentalsData is ${fundamentalsData}, fundamentalsDoc is ${
                    fundamentalsDoc ? "exists" : "null"
                  }, fundamentalsDoc keys: ${
                    fundamentalsDoc ? Object.keys(fundamentalsDoc).join(", ") : "N/A"
                  }`
                );
              }

              const calculatedMetrics = await calculateAllMetricsFromEnum(
                dividendDoc?.history,
                fundamentalsData,
                symbolKey,
                metricsToCalculate,
                log,
                eodhdClient
              );

              const metricCount = Object.keys(calculatedMetrics).length;
              const metricNames = Object.keys(calculatedMetrics);

              // Count by category
              const dividendMetrics = metricNames.filter((m) =>
                [
                  "DividendYieldCurrent",
                  "DividendGrowth3Y",
                  "DividendGrowth5Y",
                  "DividendGrowth10Y",
                ].includes(m)
              );
              const debtMetrics = metricNames.filter((m) => m.includes("Debt"));
              const ebitdaMetrics = metricNames.filter((m) => m.includes("EBITDA"));
              const priceMetrics = metricNames.filter((m) => m.includes("PriceChange"));

              log(
                `      📈 Calculated ${metricCount} metrics - Dividend: ${dividendMetrics.length}, Debt: ${debtMetrics.length}, EBITDA: ${ebitdaMetrics.length}, Price: ${priceMetrics.length}`
              );

              if (metricCount === 0) {
                log(`      ⚠️  No metrics could be calculated for ${symbolKey} - skipping`);
                results.push({
                  symbol: symbolKey,
                  status: "skipped",
                  reason: "no_metrics_calculated",
                });
                return;
              }

              // Cap percentage change metrics at 1000% (schema limit)
              // Some extreme values can occur due to data quality issues or outliers
              const cappedMetrics = { ...calculatedMetrics };
              const percentageChangeMetrics = [
                "DividendGrowth3Y",
                "DividendGrowth5Y",
                "DividendGrowth10Y",
                "DebtToEquityChange3M",
                "DebtToEquityChange6M",
                "DebtToEquityChange1Y",
                "DebtToEquityChange2Y",
                "NetDebtToEBITDAChange3M",
                "NetDebtToEBITDAChange6M",
                "NetDebtToEBITDAChange1Y",
                "NetDebtToEBITDAChange2Y",
                "EBITDAGrowth3M",
                "EBITDAGrowth6M",
                "EBITDAGrowth1Y",
                "EBITDAGrowth2Y",
                "NetDebtChange3M",
                "NetDebtChange6M",
                "NetDebtChange1Y",
                "NetDebtChange2Y",
              ];

              for (const metricKey of percentageChangeMetrics) {
                if (cappedMetrics[metricKey] !== null && cappedMetrics[metricKey] !== undefined) {
                  if (cappedMetrics[metricKey] > 1000) {
                    log(
                      `      ⚠️  Capping ${metricKey} from ${cappedMetrics[metricKey]} to 1000 (schema limit)`
                    );
                    cappedMetrics[metricKey] = 1000;
                  } else if (cappedMetrics[metricKey] < -100) {
                    log(
                      `      ⚠️  Capping ${metricKey} from ${cappedMetrics[metricKey]} to -100 (schema limit)`
                    );
                    cappedMetrics[metricKey] = -100;
                  }
                }
              }

              // Save to dedicated metrics collection using model methods
              const metricsWithStatus = {
                ...cappedMetrics,
                _calculationStatus: "success",
                _lastAttempt: new Date(),
              };

              if (existingMetrics) {
                await existingMetrics.updateMetricsData(metricsWithStatus);
                log(`      ✅ Updated existing metrics document`);
              } else {
                const newMetrics = new Metrics({
                  symbol: symbolKey,
                  exchange: exchangeDoc.exchangeCode,
                  currency: dividendDoc.currency || "USD",
                  metrics: metricsWithStatus,
                  lastUpdated: new Date(),
                  fetchedAt: new Date(),
                });
                await newMetrics.save();
                log(`      ✅ Created new metrics document`);
              }

              log(
                `   ✅ SUCCESS ${symbolKey} - ${metricCount} metrics saved (${dividendMetrics.length} dividend, ${debtMetrics.length} debt, ${ebitdaMetrics.length} EBITDA, ${priceMetrics.length} price)`
              );

              results.push({
                symbol: symbolKey,
                status: "updated",
                metricsCalculated: metricCount,
                updatedMetrics: Object.keys(calculatedMetrics),
              });
            } catch (error) {
              log(`   ❌ FAIL ${symbolKey}: ${error.message}`);
              results.push({ symbol: symbolKey, status: "error", error: error.message });
            }
          });

          await Promise.allSettled(chunkPromises);

          exchangeProcessed += chunk.length;
          processedStocks += chunk.length;
          totalProcessedForDevMode += chunk.length; // Track for dev mode

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
    const successCount = results.filter((r) => r.status === "updated").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const failedCount = results.filter((r) => r.status === "error").length;

    log(`\n🎉 Final Summary:`);
    log(`   Total large cap stocks: ${totalLargeCapStocks}`);
    log(`   Successfully processed: ${successCount}`);
    log(`   Skipped (fresh data or no dividend data): ${skippedCount}`);
    log(`   Failed: ${failedCount}`);
    log(`   Exchanges processed: ${exchangeSymbolsDocs.length}`);

    // Print metrics statistics
    const totalMetricsCalculated = results
      .filter((r) => r.status === "updated")
      .reduce((sum, r) => sum + (r.metricsCalculated || 0), 0);

    log(`\n📈 Metrics Statistics:`);
    log(`   Stocks with calculated metrics: ${successCount}`);
    log(
      `   Total metrics calculated: ${totalMetricsCalculated} across ${metricsToCalculate.length} metric types`
    );

    // Log cache summary
    if (eodhdClient && eodhdClient.logCacheSummary) {
      log(``);
      eodhdClient.logCacheSummary();
    }

    return {
      success: true,
      message: `Metrics calculation completed successfully`,
      totalStocks: totalLargeCapStocks,
      processed: successCount,
      skipped: skippedCount,
      failed: failedCount,
      exchanges: exchangeSymbolsDocs.length,
      metricsProcessed: metricsToCalculate.length,
      totalMetricsCalculated,
    };
  } catch (error) {
    log(`❌ Job failed: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate all metrics from ISO business enum for a stock
 * @param {Array} dividends - Dividend history data
 * @param {Object} fundamentals - Fundamentals data
 * @param {string} symbol - Stock symbol
 * @param {Array} metricsToCalculate - Enabled metrics from enum
 * @param {Function} log - Logging function
 * @param {Object} eodhdClient - EODHD client for price data (optional)
 * @returns {Object} Calculated metrics with enum field names
 */
async function calculateAllMetricsFromEnum(
  dividends,
  fundamentals,
  symbol,
  metricsToCalculate,
  log,
  eodhdClient
) {
  const calculatedMetrics = {};

  for (const metric of metricsToCalculate) {
    try {
      // Get the calculator function for this metric
      const calculator = METRIC_CALCULATORS[metric.id];
      if (!calculator) {
        continue;
      }

      // Calculate the metric value based on metric category
      let metricValue;

      if (metric.category === "dividend") {
        // Dividend metrics need dividend data
        if (!dividends) {
          log(`         ⏭️  Skipping ${metric.displayName} - no dividend data`);
          continue; // Skip if no dividend data
        }
        if (dividends.length === 0) {
          log(`         ⏭️  Skipping ${metric.displayName} - dividend history array is empty`);
          continue;
        }

        if (metric.id === "DividendYieldCurrent") {
          // DividendYieldCurrent needs current price (placeholder for now)
          const currentPrice = null; // TODO: Get from fundamentals
          metricValue = calculator(dividends, currentPrice);
          log(
            `         ${metricValue !== null ? "✅" : "❌"} ${metric.displayName}: ${
              metricValue !== null ? metricValue : "null (no current price)"
            }`
          );
        } else {
          metricValue = calculator(dividends);
          log(
            `         ${metricValue !== null ? "✅" : "❌"} ${metric.displayName}: ${
              metricValue !== null ? metricValue : "null (insufficient data)"
            }`
          );
        }
      } else if (["debt", "profitability", "leverage"].includes(metric.category)) {
        // Debt, profitability, and leverage metrics need fundamentals data
        if (!fundamentals) {
          log(`         ⏭️  Skipping ${metric.displayName} - no fundamentals data`);
          continue; // Skip if no fundamentals data
        }

        metricValue = calculator(fundamentals);
        log(
          `         ${metricValue !== null ? "✅" : "❌"} ${metric.displayName}: ${
            metricValue !== null ? metricValue : "null (insufficient quarterly data)"
          }`
        );
      } else if (metric.category === "performance") {
        // Price change metrics need symbol and EODHD client
        // These are async functions
        metricValue = await calculator(symbol, eodhdClient);
        log(
          `         ${metricValue !== null ? "✅" : "❌"} ${metric.displayName}: ${
            metricValue !== null ? metricValue : "null"
          }`
        );
      } else {
        // Unknown category, skip
        log(`         ⏭️  Skipping ${metric.displayName} - unknown category: ${metric.category}`);
        continue;
      }

      // Store the calculated value using enum field name (single source of truth)
      if (metricValue !== null && metricValue !== undefined) {
        calculatedMetrics[metric.dbField] = metricValue;
      }
    } catch (error) {
      // Continue with other metrics even if one fails
      log(`         ⚠️  Error calculating ${metric.displayName}: ${error.message}`);
    }
  }

  return calculatedMetrics;
}
