import {
  calculateValuationDCF,
  normalizeFundamentalsDocument,
} from "../../../calculators/valuation/valuationDCF.js";
import { calculateValuationLynch } from "../../../calculators/valuation/valuationLynch.js";
import { getModel } from "@buydy/se-db";
import {
  getLargeCapStocksFromDatabase,
  countLargeCapStocks,
  extractLargeCapStocks,
} from "@buydy/se-db/src/utils/largeCapFilter.js";
import logger from "@buydy/se-logger";
import EODHDCacheClient from "@buydy/se-eodhd-cache";
import {
  buildSymbolKey,
  getDevModeLimit,
  parseDevModeCompany,
} from "../../../utils/devModeFilter.js";
import { normalizeCurrencyCode } from "@buydy/iso-business-types/src/metricsUtils.js";

const PRICE_CACHE_TTL_HOURS = 24;
const FX_BASE_CURRENCY = "USD";

function formatUpside(upside) {
  if (!Number.isFinite(upside)) {
    return "n/a";
  }
  return `${(upside * 100).toFixed(1)}%`;
}

function logDecision(symbol, message, level = "business") {
  if (typeof logger[level] === "function") {
    logger[level](`[Valuation] ${symbol} → ${message}`);
  } else {
    logger.business(`[Valuation] ${symbol} → ${message}`);
  }
}

function buildValuationPayload(
  namespace,
  {
    fairValue = null,
    upside = null,
    rangeLow = null,
    rangeHigh = null,
    quality = "N/A",
    reason = null,
    reasonCode = null,
    reasonInputs = null,
    valueExtra = {},
    metadataExtra = {},
  } = {}
) {
  const sanitizedValueExtra = Object.entries(valueExtra || {}).reduce((acc, [key, value]) => {
    acc[key] = value ?? null;
    return acc;
  }, {});

  const sanitizedMetadataExtra = Object.entries(metadataExtra || {}).reduce((acc, [key, value]) => {
    acc[key] = value ?? null;
    return acc;
  }, {});

  const metadata = {
    reasonCode: reasonCode ?? null,
    reasonText: reason ?? null,
    reason: reason ?? null,
    inputs: reasonInputs ?? null,
    timestamp: new Date(),
    ...sanitizedMetadataExtra,
  };

  return {
    [namespace]: {
      fairValue: fairValue ?? null,
      upsidePct: upside ?? null,
      range: {
        low: rangeLow ?? null,
        high: rangeHigh ?? null,
      },
      quality: quality ?? "N/A",
      metadata,
      ...sanitizedValueExtra,
    },
  };
}

function toNumericValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function fetchLatestEodClose(symbol, priceClient) {
  if (!priceClient) {
    return null;
  }

  const now = new Date();
  const toDate = now.toISOString().split("T")[0];
  const fromDateValue = new Date(now);
  fromDateValue.setDate(fromDateValue.getDate() - 180);
  const fromDate = fromDateValue.toISOString().split("T")[0];

  try {
    const candles = await priceClient.getEODData(symbol, fromDate, toDate, { order: "d" });
    if (!Array.isArray(candles) || candles.length === 0) {
      return null;
    }

    const sorted = candles
      .slice()
      .filter((entry) => toNumericValue(entry?.close) !== null)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
      return null;
    }

    const latest = sorted[0];
    return {
      price: toNumericValue(latest.close),
      date: latest.date,
      payload: latest,
    };
  } catch (error) {
    logDecision(symbol, `failed to fetch fallback EOD price: ${error.message}`, "debug");
    return null;
  }
}

async function getOrCreateMetricsDocument(Model, symbolKey, exchangeCode) {
  let doc = await Model.findOne({ symbol: symbolKey });
  if (doc) {
    return doc;
  }

  doc = new Model({
    symbol: symbolKey,
    exchange: exchangeCode || "UNKNOWN",
    currency: "USD",
    metrics: {},
    lastUpdated: new Date(),
    fetchedAt: new Date(),
  });

  await doc.save();
  return doc;
}

function deriveSymbolEntries(exchanges) {
  const encountered = new Set();
  const entries = [];
  for (const exchangeDoc of exchanges) {
    const { exchangeCode, symbols = [] } = exchangeDoc;
    for (const stock of symbols) {
      const symbolKey = buildSymbolKey(stock, exchangeCode);
      if (!symbolKey || encountered.has(symbolKey)) continue;
      encountered.add(symbolKey);
      entries.push({
        symbolKey,
        exchangeCode,
      });
    }
  }
  return entries;
}

export async function syncMetricsValuationLargeCap(context = {}) {
  const envLimit = getDevModeLimit();
  const devCompanies = parseDevModeCompany();
  const {
    limit = envLimit || null,
    devMode = Boolean(envLimit),
    symbols: overrideSymbols,
  } = context;

  const Metrics = getModel("metrics");
  const Fundamentals = getModel("fundamentals");

  let priceClient = null;
  if (process.env.API_EODHD_API_TOKEN) {
    try {
      priceClient = new EODHDCacheClient({
        apiKey: process.env.API_EODHD_API_TOKEN,
        cacheExpirationHours: PRICE_CACHE_TTL_HOURS,
      });
    } catch (error) {
      logger.debug(`[Valuation] ⚠️ Failed to initialize EODHD cache client: ${error.message}`);
      priceClient = null;
    }
  } else {
    logger.debug(
      "[Valuation] ⚠️ API_EODHD_API_TOKEN not set. Valuation job will skip price retrieval."
    );
  }

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

    if (!priceClient?.eodhdClient?.forex) {
      return null;
    }

    try {
      const conversion = await priceClient.eodhdClient.forex.convertCurrency(
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
      logDecision(
        "FX",
        `failed to resolve FX rate for ${normalizedCurrency}: ${error.message}`,
        "debug"
      );
      return null;
    }
  };

  const largeCapDocs = await getLargeCapStocksFromDatabase();
  const extracted = extractLargeCapStocks(largeCapDocs);
  const symbolEntries = deriveSymbolEntries(extracted);

  let workingList;
  if (overrideSymbols && Array.isArray(overrideSymbols) && overrideSymbols.length > 0) {
    workingList = overrideSymbols.map((symbolKey) => ({ symbolKey }));
  } else if (devCompanies && devCompanies.length > 0) {
    const prioritized = symbolEntries.filter((entry) => devCompanies.includes(entry.symbolKey));
    const remaining = symbolEntries.filter((entry) => !devCompanies.includes(entry.symbolKey));
    workingList = [...prioritized, ...remaining];
  } else {
    workingList = symbolEntries;
  }

  if (limit && Number.isInteger(limit)) {
    workingList = workingList.slice(0, limit);
  }

  logger.business(
    `[Valuation] Starting valuation metrics job for ${workingList.length} symbols${
      devMode ? " (dev mode)" : ""
    }`
  );

  let processed = 0;
  let persisted = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of workingList) {
    const symbol = entry.symbolKey;
    processed += 1;
    try {
      const metricsDoc = await getOrCreateMetricsDocument(Metrics, symbol, entry.exchangeCode);

      const fundamentalsDoc = await Fundamentals.findOne({ symbol: symbol.toUpperCase() }).lean();
      const fundamentalsCurrencyRaw =
        fundamentalsDoc?.fundamentals?.General?.CurrencyCode ||
        fundamentalsDoc?.fundamentals?.General?.Currency ||
        fundamentalsDoc?.fundamentals?.General?.CurrencySymbol;
      const fundamentalsCurrency = normalizeCurrencyCode(fundamentalsCurrencyRaw);
      let metricsDocDirty = false;
      if (!metricsDoc.exchange && entry.exchangeCode) {
        metricsDoc.exchange = entry.exchangeCode;
        metricsDocDirty = true;
      }
      const currentCurrency = normalizeCurrencyCode(metricsDoc.currency);
      if (!currentCurrency || currentCurrency !== fundamentalsCurrency) {
        metricsDoc.currency = fundamentalsCurrency || FX_BASE_CURRENCY;
        metricsDocDirty = true;
      }
      if (metricsDocDirty) {
        await metricsDoc.save();
      }

      if (!fundamentalsDoc?.fundamentals) {
        skipped += 1;
        logDecision(symbol, "skipped (no fundamentals document found)");
        await metricsDoc.updateMetricsData({
          _calculationStatus: "not_applicable",
          _lastAttempt: new Date(),
          ...buildValuationPayload("valuationDCF", {
            quality: "N/A",
            reason: "Fundamentals missing",
            reasonCode: "MISSING_DATA",
          }),
          ...buildValuationPayload("valuationLynch", {
            quality: "N/A",
            reason: "Fundamentals missing",
            reasonCode: "MISSING_DATA",
          }),
        });
        continue;
      }

      const normalizedFundamentals = normalizeFundamentalsDocument(fundamentalsDoc.fundamentals);

      if (!normalizedFundamentals.length) {
        skipped += 1;
        logDecision(symbol, "skipped (could not normalize fundamentals data)");
        await metricsDoc.updateMetricsData({
          _calculationStatus: "not_applicable",
          _lastAttempt: new Date(),
          ...buildValuationPayload("valuationDCF", {
            quality: "N/A",
            reason: "Unable to normalize fundamentals data",
            reasonCode: "MISSING_DATA",
          }),
          ...buildValuationPayload("valuationLynch", {
            quality: "N/A",
            reason: "Unable to normalize fundamentals data",
            reasonCode: "MISSING_DATA",
          }),
        });
        continue;
      }

      let latestPriceInfo = null;
      let pricePayload = null;
      if (priceClient) {
        try {
          const priceData = await priceClient.getRealTimeData(symbol);
          pricePayload = priceData;
          const priceCandidate =
            toNumericValue(priceData?.close) ??
            toNumericValue(priceData?.Close) ??
            toNumericValue(priceData?.price) ??
            toNumericValue(priceData?.Price);
          if (priceCandidate !== null && priceCandidate > 0) {
            latestPriceInfo = { price: priceCandidate, source: "real-time-close" };
          } else {
            const previousCloseCandidate = toNumericValue(priceData?.previousClose);
            if (previousCloseCandidate !== null && previousCloseCandidate > 0) {
              latestPriceInfo = {
                price: previousCloseCandidate,
                source: "real-time-previous-close",
              };
              logDecision(
                symbol,
                "real-time close unavailable; using previousClose instead",
                "debug"
              );
            } else {
              logDecision(symbol, "real-time price response contained no numeric close", "debug");
            }
          }
        } catch (error) {
          logger.debug(`[Valuation] ${symbol} → failed to fetch real-time price: ${error.message}`);
        }
      }

      if (!latestPriceInfo) {
        const eodFallback = await fetchLatestEodClose(symbol, priceClient);
        if (eodFallback?.price !== null && eodFallback.price > 0) {
          latestPriceInfo = {
            price: eodFallback.price,
            source: "eod-close",
          };
          const dateLabel = eodFallback.date ? ` (${eodFallback.date})` : "";
          logDecision(symbol, `using end-of-day close${dateLabel} as valuation price`, "debug");
        }
      }

      if (!latestPriceInfo) {
        const fundamentalsClose = toNumericValue(
          fundamentalsDoc?.fundamentals?.Highlights?.PreviousClose
        );
        if (fundamentalsClose !== null && fundamentalsClose > 0) {
          latestPriceInfo = {
            price: fundamentalsClose,
            source: "fundamentals-previous-close",
          };
          logDecision(symbol, "using fundamentals previous close as valuation price", "debug");
        }
      }

      const latestPrice =
        latestPriceInfo && Number.isFinite(latestPriceInfo.price) && latestPriceInfo.price > 0
          ? latestPriceInfo.price
          : null;
      const priceSource = latestPriceInfo?.source ?? null;

      if (latestPrice === null) {
        skipped += 1;
        logDecision(symbol, "skipped (no price data available after fallbacks)");
        await metricsDoc.updateMetricsData({
          _calculationStatus: "not_applicable",
          _lastAttempt: new Date(),
          ...buildValuationPayload("valuationDCF", {
            quality: "N/A",
            reason: "Missing price data (real-time and fallback sources unavailable)",
            reasonCode: "MISSING_DATA",
          }),
          ...buildValuationPayload("valuationLynch", {
            quality: "N/A",
            reason: "Missing price data (real-time and fallback sources unavailable)",
            reasonCode: "MISSING_DATA",
          }),
        });
        if (pricePayload) {
          logger.business(
            `[Valuation] ${symbol} → price payload keys: ${Object.keys(pricePayload).join(", ")}`
          );
        }
        continue;
      }

      const highlights = fundamentalsDoc.fundamentals?.Highlights || null;
      const generalInfo = fundamentalsDoc.fundamentals?.General || {};
      const valuationCurrency =
        fundamentalsCurrency || normalizeCurrencyCode(metricsDoc.currency) || FX_BASE_CURRENCY;
      const marketCapAbsolute = toNumericValue(highlights?.MarketCapitalization);
      const marketCapMln = toNumericValue(highlights?.MarketCapitalizationMln);
      const marketCap =
        Number.isFinite(marketCapAbsolute) && marketCapAbsolute > 0
          ? marketCapAbsolute
          : Number.isFinite(marketCapMln) && marketCapMln > 0
          ? marketCapMln * 1_000_000
          : null;
      const country = generalInfo?.Country || null;

      const dcfValuation = await calculateValuationDCF(symbol, {
        fundamentals: normalizedFundamentals,
        price: latestPrice,
        highlights,
        currency: valuationCurrency,
        country,
        marketCap,
      });

      const lynchValuation = await calculateValuationLynch(symbol, {
        fundamentals: normalizedFundamentals,
        price: latestPrice,
        highlights,
      });

      const fxInfo = await resolveFxRate(valuationCurrency);

      const baseMetadataExtra = {
        priceSource: priceSource || null,
        priceCurrency: valuationCurrency,
      };

      const updates = {};
      const summaries = [];
      let highQuality = 0;
      let lowQuality = 0;

      const applyValuation = (
        label,
        namespace,
        valuationInfo,
        defaultReason,
        {
          defaultReasonCode = "MISSING_DATA",
          metadataExtra = {},
          valueExtra = {},
          conversionInfo = null,
          localCurrency = FX_BASE_CURRENCY,
          sharesSource = null,
        } = {}
      ) => {
        const effectiveSourceCurrency = normalizeCurrencyCode(localCurrency) || FX_BASE_CURRENCY;
        const hasConversion =
          conversionInfo && Number.isFinite(conversionInfo.rate) && conversionInfo.rate > 0;
        const targetCurrency = hasConversion
          ? conversionInfo.targetCurrency || FX_BASE_CURRENCY
          : effectiveSourceCurrency;

        const metadataExtrasCombined = {
          ...metadataExtra,
        };
        if (!Object.prototype.hasOwnProperty.call(metadataExtrasCombined, "currency")) {
          metadataExtrasCombined.currency = targetCurrency;
        }
        if (!Object.prototype.hasOwnProperty.call(metadataExtrasCombined, "sourceCurrency")) {
          metadataExtrasCombined.sourceCurrency = effectiveSourceCurrency;
        }
        if (hasConversion) {
          metadataExtrasCombined.fxRate = conversionInfo.rate;
          metadataExtrasCombined.fxTimestamp = conversionInfo?.timestamp ?? null;
        }

        const reasonCode = valuationInfo?.reasonCode ?? defaultReasonCode ?? null;
        const reasonInputs = valuationInfo?.reasonInputs ?? null;

        if (!valuationInfo) {
          Object.assign(
            updates,
            buildValuationPayload(namespace, {
              quality: "N/A",
              reason: defaultReason,
              reasonCode,
              reasonInputs,
              metadataExtra: metadataExtrasCombined,
              valueExtra: {
                ...valueExtra,
                sharesSource,
              },
            })
          );
          summaries.push(`${label}: N/A (${defaultReason})`);
          return;
        }

        const localFairValue = Number.isFinite(valuationInfo.fairValuePerShare)
          ? valuationInfo.fairValuePerShare
          : Number.isFinite(valuationInfo.fairValue)
          ? valuationInfo.fairValue
          : null;
        const localRangeLow = Number.isFinite(valuationInfo.range?.low)
          ? valuationInfo.range.low
          : null;
        const localRangeHigh = Number.isFinite(valuationInfo.range?.high)
          ? valuationInfo.range.high
          : null;

        const conversionRate = hasConversion ? conversionInfo.rate : 1;
        const convert = (value) => (Number.isFinite(value) ? value * conversionRate : null);

        const convertedFairValue = convert(localFairValue);
        const convertedRangeLow = convert(localRangeLow);
        const convertedRangeHigh = convert(localRangeHigh);

        const qualityLabel = valuationInfo.quality || "N/A";
        const finalReason = valuationInfo.qualityReason || defaultReason || null;

        const valueExtraCombined = {
          ...valueExtra,
          sharesSource: sharesSource ?? valuationInfo.sharesSource ?? null,
          originalFairValue: localFairValue,
          originalRangeLow: localRangeLow,
          originalRangeHigh: localRangeHigh,
        };

        // CRITICAL: If quality is N/A, ensure upsidePct is explicitly null (not calculated)
        // This ensures companies with uncertain metrics are excluded from percentile calculations
        const finalUpside = qualityLabel === "N/A" ? null : valuationInfo.upside ?? null;

        Object.assign(
          updates,
          buildValuationPayload(namespace, {
            fairValue:
              Number.isFinite(convertedFairValue) && convertedFairValue > 0
                ? convertedFairValue
                : null,
            upside: finalUpside, // Explicitly null if quality is N/A
            rangeLow:
              Number.isFinite(convertedRangeLow) && convertedRangeLow >= 0
                ? convertedRangeLow
                : null,
            rangeHigh:
              Number.isFinite(convertedRangeHigh) && convertedRangeHigh >= 0
                ? convertedRangeHigh
                : null,
            quality: qualityLabel,
            reason: finalReason,
            reasonCode,
            reasonInputs,
            metadataExtra: metadataExtrasCombined,
            valueExtra: valueExtraCombined,
          })
        );

        const currencyLabel = targetCurrency === "USD" ? "$" : `${targetCurrency} `;
        const fairSnippet =
          Number.isFinite(convertedFairValue) && convertedFairValue !== null
            ? `${currencyLabel}${convertedFairValue.toFixed(2)}`
            : "n/a";
        const summaryBase = `${label}: ${qualityLabel} fair ${fairSnippet}, upside ${formatUpside(
          valuationInfo.upside
        )}`;

        if (qualityLabel === "HIGH") {
          highQuality += 1;
          summaries.push(summaryBase);
          return;
        }

        if (qualityLabel === "LOW") {
          lowQuality += 1;
          summaries.push(finalReason ? `${summaryBase} (${finalReason})` : summaryBase);
          return;
        }

        summaries.push(finalReason ? `${summaryBase} (${finalReason})` : summaryBase);
      };

      const dcfInfo = dcfValuation
        ? {
            fairValue: dcfValuation.fairValuePerShare ?? null,
            fairValuePerShare: dcfValuation.fairValuePerShare ?? null,
            upside: dcfValuation.upside ?? null,
            range: {
              low: dcfValuation.range?.low ?? null,
              high: dcfValuation.range?.high ?? null,
            },
            sensitivityMatrix: dcfValuation.sensitivityMatrix ?? null,
            quality: dcfValuation.quality ?? "N/A",
            qualityReason: dcfValuation.qualityReason || null,
            sharesSource: dcfValuation.sharesSource ?? null,
            wacc: dcfValuation.wacc ?? null,
            terminalGrowth: dcfValuation.terminalGrowth ?? null,
            waccComponents: dcfValuation.waccComponents ?? null,
            reasonCode: dcfValuation.reasonCode ?? null,
            reasonInputs: dcfValuation.reasonInputs ?? null,
          }
        : null;

      const dcfMetadataExtra = {
        ...baseMetadataExtra,
      };
      const dcfValueExtra = {
        wacc: dcfValuation?.wacc ?? null,
        terminalGrowth: dcfValuation?.terminalGrowth ?? null,
        riskFreeRate: dcfValuation?.waccComponents?.riskFreeRate ?? null,
        equityRiskPremium: dcfValuation?.waccComponents?.equityRiskPremium ?? null,
        countryRiskPremium: dcfValuation?.waccComponents?.countryRiskPremium ?? null,
        sizePremium: dcfValuation?.waccComponents?.sizePremium ?? null,
        cashYieldAdjustment: dcfValuation?.waccComponents?.cashYield ?? null,
        beta: dcfValuation?.waccComponents?.beta ?? null,
        sensitivityMatrix: dcfValuation?.sensitivityMatrix ?? null,
      };

      const lynchInfo = lynchValuation
        ? {
            fairValue: lynchValuation.fairValue ?? null,
            upside: lynchValuation.upside ?? null,
            range: {
              low: lynchValuation.range?.low ?? null,
              high: lynchValuation.range?.high ?? null,
            },
            quality: lynchValuation.quality ?? "N/A",
            qualityReason: lynchValuation.qualityReason || null,
            sharesSource: lynchValuation.sharesSource ?? null,
            peFair: lynchValuation.peFair ?? null,
            reasonCode: lynchValuation.reasonCode ?? null,
            reasonInputs: lynchValuation.reasonInputs ?? null,
          }
        : null;

      const lynchMetadataExtra = {
        ...baseMetadataExtra,
      };
      const lynchValueExtra = {
        peFair: lynchValuation?.peFair ?? null,
      };

      applyValuation("DCF", "valuationDCF", dcfInfo, "Insufficient data for valuation", {
        defaultReasonCode: "MISSING_DATA",
        metadataExtra: dcfMetadataExtra,
        valueExtra: dcfValueExtra,
        conversionInfo: fxInfo,
        localCurrency: valuationCurrency,
        sharesSource: dcfInfo?.sharesSource ?? null,
      });
      applyValuation(
        "Peter Lynch",
        "valuationLynch",
        lynchInfo,
        "Insufficient data for Peter Lynch valuation",
        {
          defaultReasonCode: "MISSING_DATA",
          metadataExtra: lynchMetadataExtra,
          valueExtra: lynchValueExtra,
          conversionInfo: fxInfo,
          localCurrency: valuationCurrency,
          sharesSource: lynchInfo?.sharesSource ?? null,
        }
      );

      const hasHighQuality = highQuality > 0;
      const hasAnyQuality = highQuality > 0 || lowQuality > 0;

      updates._calculationStatus = hasAnyQuality ? "success" : "not_applicable";
      updates._lastAttempt = new Date();

      await metricsDoc.updateMetricsData(updates);

      if (dcfValuation && (dcfValuation.quality === "N/A" || !dcfValuation.quality)) {
        const latestEntry = normalizedFundamentals[normalizedFundamentals.length - 1];
        if (latestEntry) {
          const incomeShareKeys = Object.keys(latestEntry.incomeStatement || {}).filter((key) =>
            key.toLowerCase().includes("share")
          );
          const balanceShareKeys = Object.keys(latestEntry.balanceSheet || {}).filter((key) =>
            key.toLowerCase().includes("share")
          );

          logger.business(
            `[ValuationDCF] ${symbol} → latest income keys: ${Object.keys(
              latestEntry.incomeStatement || {}
            )
              .slice(0, 12)
              .join(", ")}`
          );
          logger.business(
            `[ValuationDCF] ${symbol} → latest cash-flow keys: ${Object.keys(
              latestEntry.cashFlow || {}
            )
              .slice(0, 12)
              .join(", ")}`
          );
          logger.business(
            `[ValuationDCF] ${symbol} → latest balance-sheet keys: ${Object.keys(
              latestEntry.balanceSheet || {}
            )
              .slice(0, 12)
              .join(", ")}`
          );
          if (incomeShareKeys.length > 0 || balanceShareKeys.length > 0) {
            logger.business(
              `[ValuationDCF] ${symbol} → share-related keys (income): ${incomeShareKeys.join(
                ", "
              )} | (balance): ${balanceShareKeys.join(", ")}`
            );
          }
        }
        if (fundamentalsDoc?.fundamentals?.Highlights) {
          logger.business(
            `[ValuationDCF] ${symbol} → highlights keys: ${Object.keys(
              fundamentalsDoc.fundamentals.Highlights
            )
              .slice(0, 12)
              .join(", ")}`
          );
        }
      }

      if (hasHighQuality) {
        persisted += 1;
        logDecision(symbol, summaries.join(" | "), "business");
      } else {
        skipped += 1;
        logDecision(symbol, summaries.join(" | "), "debug");
      }
    } catch (error) {
      failed += 1;
      logDecision(symbol, `ERROR: ${error.message}`, "error");
      try {
        const metricsDoc = await getOrCreateMetricsDocument(Metrics, symbol, entry.exchangeCode);
        await metricsDoc.updateMetricsData({
          _calculationStatus: "calculation_error",
          _lastAttempt: new Date(),
          ...buildValuationPayload("valuationDCF", {
            quality: "N/A",
            reason: error.message,
            reasonCode: "MISSING_DATA",
          }),
          ...buildValuationPayload("valuationLynch", {
            quality: "N/A",
            reason: error.message,
            reasonCode: "MISSING_DATA",
          }),
        });
      } catch (persistError) {
        logDecision(
          symbol,
          `ERROR persisting failure metadata: ${persistError.message}`,
          "business"
        );
      }
    }
  }

  logger.business(
    `[Valuation] Finished valuation job – total: ${processed}, persisted: ${persisted}, skipped: ${skipped}, failed: ${failed}`
  );

  return {
    processed,
    persisted,
    skipped,
    failed,
    totalLargeCaps: countLargeCapStocks(largeCapDocs),
  };
}

export default syncMetricsValuationLargeCap;
