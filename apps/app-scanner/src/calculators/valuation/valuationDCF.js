import { DCF_DEFAULTS, runDCF } from "./valuationDCFEngine.js";
import { deriveMetrics } from "./deriveMetrics.js";
import { computeTTM } from "./utils/ttmBuilder.js";
import { clamp, isPositiveNumber } from "./utils/math.js";

const ERP_DEFAULT = 0.055;
const MAX_WACC = 0.18;
const MIN_WACC = 0.05;
const SIZE_PREMIUM_SMALL = 0.02;
const SIZE_PREMIUM_MID = 0.01;
const CASH_YIELD_MAX = 0.02;

const RISK_FREE_BY_CURRENCY = {
  USD: 0.043,
  EUR: 0.025,
  GBP: 0.035,
  CAD: 0.036,
  AUD: 0.042,
  NZD: 0.045,
  CHF: 0.012,
  SEK: 0.028,
  NOK: 0.03,
  PLN: 0.055,
  DKK: 0.025,
  JPY: 0.01,
  HKD: 0.035,
  SGD: 0.03,
  INR: 0.07,
  CNY: 0.029,
  KRW: 0.038,
  BRL: 0.09,
  MXN: 0.085,
  ZAR: 0.095,
};

const COUNTRY_RISK_PREMIUM = {
  USA: 0,
  CANADA: 0.005,
  UNITED_STATES: 0,
  UNITED_KINGDOM: 0.01,
  GERMANY: 0.005,
  FRANCE: 0.01,
  ITALY: 0.02,
  SPAIN: 0.015,
  SWITZERLAND: 0,
  AUSTRALIA: 0.005,
  NEW_ZEALAND: 0.01,
  JAPAN: 0.005,
  HONG_KONG: 0.01,
  SINGAPORE: 0.005,
  INDIA: 0.03,
  CHINA: 0.025,
  BRAZIL: 0.04,
  MEXICO: 0.03,
  SOUTH_AFRICA: 0.045,
  SOUTH_KOREA: 0.02,
  INDONESIA: 0.04,
  MALAYSIA: 0.025,
  THAILAND: 0.025,
  PHILIPPINES: 0.035,
};

const TERMINAL_GROWTH_BY_CURRENCY = {
  USD: 0.02,
  EUR: 0.01,
  GBP: 0.015,
  CAD: 0.02,
  AUD: 0.02, // Reduced from 0.025
  NZD: 0.02, // Reduced from 0.025
  CHF: 0.012,
  SEK: 0.015,
  NOK: 0.018,
  PLN: 0.02,
  DKK: 0.012,
  JPY: 0.01,
  HKD: 0.02, // Reduced from 0.025
  SGD: 0.02, // Reduced from 0.025
  INR: 0.025, // Reduced from 0.03 - more conservative for emerging markets
  CNY: 0.02, // Reduced from 0.025
  KRW: 0.02, // Reduced from 0.025
  BRL: 0.025, // Reduced from 0.03
  MXN: 0.025, // Reduced from 0.03
  ZAR: 0.025, // Reduced from 0.03
};

const TAX_FLOOR_BY_COUNTRY = {
  USA: 0.21,
  UNITED_STATES: 0.21,
  CANADA: 0.26,
  UNITED_KINGDOM: 0.19,
  GERMANY: 0.3,
  FRANCE: 0.28,
  ITALY: 0.24,
  SPAIN: 0.25,
  SWITZERLAND: 0.18,
  AUSTRALIA: 0.3,
  NEW_ZEALAND: 0.28,
  JAPAN: 0.23,
  HONG_KONG: 0.165,
  SINGAPORE: 0.17,
  INDIA: 0.25,
  CHINA: 0.25,
  BRAZIL: 0.34,
  MEXICO: 0.3,
  SOUTH_AFRICA: 0.28,
  SOUTH_KOREA: 0.25,
  INDONESIA: 0.22,
  MALAYSIA: 0.24,
  THAILAND: 0.2,
  PHILIPPINES: 0.25,
};

const TAX_FLOOR_BY_CURRENCY = {
  USD: 0.21,
  EUR: 0.25,
  GBP: 0.19,
  CAD: 0.26,
  AUD: 0.3,
  JPY: 0.23,
  INR: 0.25,
  CNY: 0.25,
  BRL: 0.34,
  MXN: 0.3,
  ZAR: 0.28,
  SGD: 0.17,
  HKD: 0.165,
};

const EMERGING_MARKETS = new Set([
  "INDIA",
  "CHINA",
  "BRAZIL",
  "MEXICO",
  "SOUTH_AFRICA",
  "THAILAND",
  "PHILIPPINES",
  "INDONESIA",
  "MALAYSIA",
  "POLAND",
  "CZECH_REPUBLIC",
  "HUNGARY",
  "TURKEY",
]);

function cleanNumericRecord(record = {}) {
  return Object.entries(record || {}).reduce((acc, [key, value]) => {
    const num = Number(value);
    acc[key] = Number.isFinite(num) ? num : value;
    return acc;
  }, {});
}

export function normalizeFundamentalsDocument(fundamentalsDoc) {
  if (!fundamentalsDoc) {
    return [];
  }

  const financials = fundamentalsDoc.Financials || fundamentalsDoc;
  const incomeQuarterly = financials?.Income_Statement?.quarterly || {};
  const cashQuarterly = financials?.Cash_Flow?.quarterly || {};
  const balanceQuarterly = financials?.Balance_Sheet?.quarterly || {};

  const allQuarterDates = new Set([
    ...Object.keys(incomeQuarterly),
    ...Object.keys(cashQuarterly),
    ...Object.keys(balanceQuarterly),
  ]);

  const sortedQuarterDates = Array.from(allQuarterDates).sort();

  const quarterlyEntries = sortedQuarterDates.map((date) => ({
    date,
    frequency: "Q",
    incomeStatement: cleanNumericRecord(incomeQuarterly[date]),
    cashFlow: cleanNumericRecord(cashQuarterly[date]),
    balanceSheet: cleanNumericRecord(balanceQuarterly[date]),
  }));

  if (quarterlyEntries.length > 0) {
    return quarterlyEntries;
  }

  const incomeYearly = financials?.Income_Statement?.yearly || {};
  const cashYearly = financials?.Cash_Flow?.yearly || {};
  const balanceYearly = financials?.Balance_Sheet?.yearly || {};

  const allYearDates = new Set([
    ...Object.keys(incomeYearly),
    ...Object.keys(cashYearly),
    ...Object.keys(balanceYearly),
  ]);

  const sortedYearDates = Array.from(allYearDates).sort();

  return sortedYearDates.map((date) => ({
    date,
    frequency: "Y",
    incomeStatement: cleanNumericRecord(incomeYearly[date]),
    cashFlow: cleanNumericRecord(cashYearly[date]),
    balanceSheet: cleanNumericRecord(balanceYearly[date]),
  }));
}

function createLazyLoader(importer, resolver) {
  let cachedPromise;
  return async () => {
    if (!cachedPromise) {
      cachedPromise = importer()
        .then((module) => resolver(module) || null)
        .catch(() => null);
    }
    return cachedPromise;
  };
}

const loadFundamentalsFetcher = createLazyLoader(
  () => import("@buydy/se-db/utils/getFundamentals.js"),
  (module) => module?.getFundamentals || module?.default
);

const loadPriceFetcher = createLazyLoader(
  () => import("@buydy/se-eodhd-cache"),
  (module) => module?.getLatestPrice || module?.default?.getLatestPrice
);

export async function calculateValuationDCF(
  symbol,
  {
    fundamentals: providedFundamentals,
    price: providedPrice,
    getFundamentals,
    getPrice,
    highlights: providedHighlights,
    currency: providedCurrency,
    country: providedCountry,
    marketCap: providedMarketCap,
  } = {}
) {
  let fundamentals = providedFundamentals;
  if (!fundamentals) {
    const fetcher = getFundamentals || (await loadFundamentalsFetcher());
    fundamentals = fetcher ? await fetcher(symbol) : null;
  }

  if (!Array.isArray(fundamentals)) {
    fundamentals = normalizeFundamentalsDocument(fundamentals);
  }

  if (!Array.isArray(fundamentals) || fundamentals.length === 0) {
    return null;
  }

  let price = providedPrice;
  if (!Number.isFinite(price)) {
    const priceFetcher = getPrice || (await loadPriceFetcher());
    price = priceFetcher ? await priceFetcher(symbol) : null;
  }

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const metrics = deriveMetrics(fundamentals);
  if (!metrics) {
    return null;
  }

  // Reject valuations when data quality is too poor
  // If data quality score < 0.7 (more than 30% metrics are defaults), reject - STRICT threshold
  const dataQualityScore = metrics.controls?.dataQualityScore ?? 1;
  if (dataQualityScore < 0.7) {
    return {
      fairValuePerShare: null,
      upside: null,
      range: { low: null, high: null },
      quality: "N/A",
      qualityReason: "Insufficient data quality for reliable valuation",
      reasonCode: "MISSING_DATA",
      reasonInputs: {
        dataQualityScore,
        dataQualityFlags: metrics.controls?.dataQualityFlags ?? {},
      },
      sharesSource: metrics?.structure?.sharesSource || null,
      wacc: null,
      terminalGrowth: null,
      waccComponents: null,
      sensitivityMatrix: null,
    };
  }

  // Also reject if critical inputs are missing or using defaults
  const ttm = computeTTM(fundamentals);
  if (!isPositiveNumber(ttm.revenueTTM)) {
    return {
      fairValuePerShare: null,
      upside: null,
      range: { low: null, high: null },
      quality: "N/A",
      qualityReason: "Missing revenue TTM data",
      reasonCode: "MISSING_DATA",
      reasonInputs: { revenueTTM: ttm.revenueTTM },
      sharesSource: metrics?.structure?.sharesSource || null,
      wacc: null,
      terminalGrowth: null,
      waccComponents: null,
      sensitivityMatrix: null,
    };
  }

  const country = (providedCountry || "").toUpperCase();
  const currency = (providedCurrency || "").toUpperCase();
  const highlights = providedHighlights || {};
  const marketCap = Number.isFinite(providedMarketCap) ? providedMarketCap : null;

  const waccComponents = buildWacc({
    currency,
    country,
    highlights,
    marketCap,
  });

  const terminalGrowth = resolveTerminalGrowth(currency, country);
  const taxRate = applyTaxFloor(metrics.taxes.effectiveTaxRate, country, currency);

  const sharesSource = metrics?.structure?.sharesSource || null;

  const inputs = {
    revenueTTM: ttm.revenueTTM,
    ebitMargin: Number.isFinite(metrics.margins.operatingMargin)
      ? metrics.margins.operatingMargin
      : Number.isFinite(metrics.margins.ebitdaMargin)
      ? metrics.margins.ebitdaMargin
      : 0.1, // More conservative default: 10% instead of 15%
    taxRate,
    salesToCapital: metrics.reinvestment.salesToCapital,
    netDebt: metrics.structure.netDebt,
    sharesDiluted: metrics.structure.sharesDiluted,
    currentPrice: price,
    revenueGrowthStart: (() => {
      const baseGrowth = metrics.growth.revenueCAGR5Y;
      const growthStdDev = metrics.growth.revenueGrowthStdDev ?? 0;
      // Penalize high volatility: reduce growth assumption by volatility factor
      // If std dev > 20%, reduce growth by up to 30%
      const volatilityPenalty = growthStdDev > 0.2 ? Math.min(0.3, (growthStdDev - 0.2) * 0.5) : 0;
      return Number.isFinite(baseGrowth)
        ? clamp(baseGrowth * (1 - volatilityPenalty), -0.2, 0.25)
        : 0.05;
    })(),
    minorityInterest: Number.isFinite(metrics.structure.minorityInterest)
      ? metrics.structure.minorityInterest
      : 0,
    preferredEquity: Number.isFinite(metrics.structure.preferredEquity)
      ? metrics.structure.preferredEquity
      : 0,
    investmentsAssociates: Number.isFinite(metrics.structure.investmentsAssociates)
      ? metrics.structure.investmentsAssociates
      : 0,
  };

  const assumptions = {
    ...DCF_DEFAULTS,
    wacc: waccComponents.wacc,
    terminalGrowth,
    waccComponents,
  };

  const valuation = runDCF(inputs, assumptions);

  if (!valuation || !Number.isFinite(valuation.fairValuePerShare)) {
    return null;
  }

  const result = {
    fairValuePerShare: valuation.fairValuePerShare,
    upside: valuation.upside,
    range: valuation.range,
    quality: valuation.quality,
    qualityReason: valuation.qualityReason || null,
    reasonCode: valuation.reasonCode ?? null,
    reasonInputs: valuation.reasonInputs ?? null,
    sharesSource,
    reinvestmentFlagged: metrics.controls?.reinvestmentFlagged ?? false,
    wacc: valuation.wacc,
    terminalGrowth: valuation.terminalGrowth,
    waccComponents: valuation.waccComponents,
    sensitivityMatrix: valuation.sensitivityMatrix,
  };

  if (metrics.controls?.reinvestmentFlagged) {
    result.quality = "N/A";
    result.qualityReason = "Reinvestment consistency check failed";
    result.reasonCode = result.reasonCode ?? "NEG_FCF";
    result.reasonInputs = {
      ...(result.reasonInputs || {}),
      reinvestmentDeviation: metrics.controls?.reinvestmentStats?.averageDeviation ?? null,
    };
    result.upside = null;
    result.range = { low: null, high: null };
    result.sensitivityMatrix = null;
  }

  // Add data quality metadata to result
  if (metrics.controls?.dataQualityScore !== undefined) {
    result.reasonInputs = {
      ...(result.reasonInputs || {}),
      dataQualityScore: metrics.controls.dataQualityScore,
      dataQualityFlags: metrics.controls.dataQualityFlags,
    };
  }

  return result;
}

function toNumber(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function resolveRiskFreeRate(currency) {
  return RISK_FREE_BY_CURRENCY[currency] ?? 0.045;
}

function resolveCountryRiskPremium(country) {
  return COUNTRY_RISK_PREMIUM[country] ?? 0;
}

function resolveTerminalGrowth(currency, country) {
  if (TERMINAL_GROWTH_BY_CURRENCY[currency]) {
    return TERMINAL_GROWTH_BY_CURRENCY[currency];
  }
  if (country && EMERGING_MARKETS.has(country)) {
    return 0.025; // Reduced from 0.03 - more conservative
  }
  return 0.02;
}

function computeSizePremium(marketCap) {
  if (!Number.isFinite(marketCap)) {
    return 0;
  }
  if (marketCap < 1_000_000_000) {
    return SIZE_PREMIUM_SMALL;
  }
  if (marketCap < 5_000_000_000) {
    return SIZE_PREMIUM_MID;
  }
  return 0;
}

function computeCashYield(highlights) {
  const yieldValue =
    toNumber(highlights?.DividendYield, null) ?? toNumber(highlights?.DividendYield5Years, null);
  if (!Number.isFinite(yieldValue)) {
    return 0;
  }
  // EODHD returns dividend yield as percentage (e.g. 2.5)
  const normalized = yieldValue > 1 ? yieldValue / 100 : yieldValue;
  return clamp(normalized, 0, CASH_YIELD_MAX);
}

function applyTaxFloor(currentTaxRate, country, currency) {
  const normalized = Number.isFinite(currentTaxRate) ? currentTaxRate : 0.2;
  const normalizedCountry = (country || "").toUpperCase().replace(/\s+/g, "_");
  const normalizedCurrency = (currency || "").toUpperCase();
  const floor =
    TAX_FLOOR_BY_COUNTRY[normalizedCountry] ?? TAX_FLOOR_BY_CURRENCY[normalizedCurrency] ?? 0.2;
  return clamp(Math.max(normalized, floor), 0.05, 0.4);
}

function buildWacc({ currency, country, highlights, marketCap }) {
  const normalizedCurrency = (currency || "").toUpperCase();
  const normalizedCountry = (country || "").toUpperCase().replace(/\s+/g, "_");
  const riskFreeRate = resolveRiskFreeRate(normalizedCurrency);
  const countryRiskPremium = resolveCountryRiskPremium(normalizedCountry);
  const equityRiskPremium = ERP_DEFAULT + countryRiskPremium;

  const rawBeta =
    toNumber(highlights?.Beta, null) ??
    toNumber(highlights?.beta, null) ??
    toNumber(highlights?.Beta5Years, null);
  const beta = clamp(Number.isFinite(rawBeta) ? rawBeta : 1, 0.2, 3);

  const sizePremium = computeSizePremium(marketCap);
  const cashYield = computeCashYield(highlights);

  const wacc = clamp(
    riskFreeRate + beta * equityRiskPremium + sizePremium - cashYield,
    MIN_WACC,
    MAX_WACC
  );

  return {
    wacc,
    riskFreeRate,
    beta,
    equityRiskPremium,
    countryRiskPremium,
    sizePremium,
    cashYield,
  };
}
