import { deriveMetrics } from "./deriveMetrics.js";
import { normalizeFundamentalsDocument } from "./valuationDCF.js";
import {
  clamp,
  isPositiveNumber,
  standardDeviation,
  safeDiv,
  geometricMean,
} from "./utils/math.js";

const EPS_KEYS = [
  "eps",
  "epsbasic",
  "epsbasicnet",
  "epsdiluted",
  "epsDiluted",
  "epsBasic",
  "dilutedEPS",
  "basicEPS",
  "earningspershare",
  "earningspersharebasic",
  "earningsShare",
  "epsttm",
  "epsTTM",
  "epsusd",
];

const NET_INCOME_KEYS = [
  "netincome",
  "netIncome",
  "netincomeloss",
  "netIncomeLoss",
  "netincomelossavailabletocommonstockholdersbasic",
  "netIncomeApplicableToCommonShares",
  "netincomeapplicabletocommonshares",
];

const SHARES_KEYS = [
  "sharesdiluted",
  "sharesDiluted",
  "sharesweightedavgdiluted",
  "sharesWeightedAvgDiluted",
  "weightedaverageshsoutdil",
  "weightedAverageDilutedSharesOutstanding",
  "weightedAverageShsOut",
  "sharesbasic",
  "sharesBasic",
  "totalsharesoutstanding",
  "totalSharesOutstanding",
];

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

function pickFirstNumber(source = {}, keys = []) {
  if (!source) {
    return null;
  }
  const entries = Object.entries(source);
  for (const keyCandidate of keys) {
    const match = entries.find(([key]) => key && key.toLowerCase() === keyCandidate.toLowerCase());
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num)) {
        return num;
      }
    }
  }
  return null;
}

function parseYear(dateString) {
  if (!dateString) return null;
  const year = Number(String(dateString).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function selectYearlyEntries(fundamentals = []) {
  if (!Array.isArray(fundamentals) || fundamentals.length === 0) {
    return [];
  }

  const yearly = fundamentals.filter((entry) => entry.frequency === "Y");
  if (yearly.length > 0) {
    return yearly
      .map((entry) => ({ ...entry, year: parseYear(entry.date) }))
      .filter((entry) => Number.isFinite(entry.year))
      .sort((a, b) => a.year - b.year);
  }

  const grouped = new Map();
  fundamentals.forEach((entry) => {
    const year = parseYear(entry.date);
    if (!Number.isFinite(year)) return;
    const existing = grouped.get(year);
    if (!existing || new Date(entry.date) > new Date(existing.date)) {
      grouped.set(year, { ...entry, year });
    }
  });

  return Array.from(grouped.values()).sort((a, b) => a.year - b.year);
}

function extractEps(entry = {}) {
  const income = entry.incomeStatement || {};
  const directEps = pickFirstNumber(income, EPS_KEYS);
  if (Number.isFinite(directEps)) {
    return directEps;
  }

  const netIncome = pickFirstNumber(income, NET_INCOME_KEYS);
  const shares = pickFirstNumber(income, SHARES_KEYS);
  return safeDiv(netIncome, shares, null);
}

function buildEpsHistory(fundamentals = []) {
  const yearlyEntries = selectYearlyEntries(fundamentals);
  const history = yearlyEntries
    .map((entry) => ({
      year: entry.year,
      eps: extractEps(entry),
    }))
    .filter((item) => Number.isFinite(item.eps));

  return history;
}

function computeEpsCagr(history = []) {
  const positiveHistory = history.filter((item) => item.eps > 0);
  if (positiveHistory.length < 2) {
    return null;
  }

  const lookback = Math.min(5, positiveHistory.length - 1);
  const relevant = positiveHistory.slice(positiveHistory.length - (lookback + 1));
  const growthFactors = [];

  for (let i = 1; i < relevant.length; i += 1) {
    const factor = safeDiv(relevant[i].eps, relevant[i - 1].eps, null);
    if (Number.isFinite(factor) && factor > 0) {
      growthFactors.push(factor);
    }
  }

  const geoMean = geometricMean(growthFactors, null);
  if (!Number.isFinite(geoMean)) {
    return null;
  }

  return geoMean - 1;
}

function computeEpsGrowthRates(history = []) {
  if (!Array.isArray(history) || history.length < 2) {
    return [];
  }
  const rates = [];
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1];
    const current = history[i];
    const factor = safeDiv(current.eps, prev.eps, null);
    if (Number.isFinite(factor)) {
      rates.push(factor - 1);
    }
  }
  return rates;
}

function clampRangeValue(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export async function calculateValuationLynch(
  symbol,
  {
    fundamentals: providedFundamentals,
    price: providedPrice,
    getFundamentals,
    getPrice,
    highlights: providedHighlights,
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

  const highlights = providedHighlights || null;

  let price = providedPrice;
  if (!Number.isFinite(price)) {
    const priceFetcher = getPrice || (await loadPriceFetcher());
    price = priceFetcher ? await priceFetcher(symbol) : null;
  }

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const earningsHistory = buildEpsHistory(fundamentals);
  const latestEpsEntry = earningsHistory.at(-1);
  let epsTtm = Number.isFinite(latestEpsEntry?.eps) ? latestEpsEntry.eps : null;

  if (!Number.isFinite(epsTtm) && highlights) {
    epsTtm =
      pickFirstNumber(highlights, [
        "DilutedEpsTTM",
        "dilutedEpsTTM",
        "DilutedEPS",
        "dilutedEPS",
        "EarningsShare",
        "earningsShare",
      ]) ?? null;
  }

  if (!Number.isFinite(epsTtm)) {
    return {
      fairValue: null,
      upside: null,
      range: { low: null, high: null },
      peFair: null,
      quality: "N/A",
      qualityReason: "Missing EPS data",
      reasonCode: "MISSING_DATA",
      reasonInputs: { epsTTM: epsTtm },
    };
  }

  const derivedMetrics = deriveMetrics(fundamentals);
  if (!derivedMetrics) {
    return {
      fairValue: null,
      upside: null,
      range: { low: null, high: null },
      peFair: null,
      quality: "N/A",
      qualityReason: "Insufficient fundamental data",
      reasonCode: "MISSING_DATA",
      reasonInputs: { fundamentalsCount: fundamentals.length },
    };
  }

  // Reject valuations when data quality is too poor
  // STRICT threshold: require 70%+ data quality (only 30% or less defaults allowed)
  const dataQualityScore = derivedMetrics.controls?.dataQualityScore ?? 1;
  if (dataQualityScore < 0.7) {
    return {
      fairValue: null,
      upside: null,
      range: { low: null, high: null },
      peFair: null,
      quality: "N/A",
      qualityReason: "Insufficient data quality for reliable valuation",
      reasonCode: "MISSING_DATA",
      reasonInputs: {
        dataQualityScore,
        dataQualityFlags: derivedMetrics.controls?.dataQualityFlags ?? {},
      },
    };
  }

  const sharesSource = derivedMetrics?.structure?.sharesSource || null;
  const revenueGrowth5Y = derivedMetrics?.growth?.revenueCAGR5Y ?? null;
  let epsGrowth5Y = computeEpsCagr(earningsHistory);
  if (!Number.isFinite(epsGrowth5Y) && Number.isFinite(revenueGrowth5Y)) {
    epsGrowth5Y = revenueGrowth5Y;
  }
  if (
    Number.isFinite(revenueGrowth5Y) &&
    (!Number.isFinite(epsGrowth5Y) || earningsHistory.length < 3)
  ) {
    epsGrowth5Y = Number.isFinite(epsGrowth5Y)
      ? epsGrowth5Y * 0.7 + revenueGrowth5Y * 0.3
      : revenueGrowth5Y;
  }

  let pegDerivedGrowth = null;
  if (highlights) {
    const pegRatio = Number(highlights.PEGRatio);
    const peRatio = Number(highlights.PERatio);
    if (
      Number.isFinite(pegRatio) &&
      pegRatio > 0 &&
      pegRatio <= 3 &&
      Number.isFinite(peRatio) &&
      peRatio > 0
    ) {
      const derived = safeDiv(peRatio, pegRatio, null);
      if (Number.isFinite(derived) && derived > 0) {
        pegDerivedGrowth = clamp(derived / 100, -0.5, 0.5);
      }
    }
  }
  if (!Number.isFinite(epsGrowth5Y) && Number.isFinite(pegDerivedGrowth)) {
    epsGrowth5Y = pegDerivedGrowth;
  }

  const growthRates = computeEpsGrowthRates(earningsHistory);
  const growthStd = growthRates.length > 1 ? standardDeviation(growthRates) : null;
  const negativeYears = earningsHistory.filter((item) => item.eps <= 0).length;

  let quality = "MEDIUM";
  let qualityReason = null;
  let reasonCode = null;
  let reasonInputs = null;

  if (!isPositiveNumber(epsTtm)) {
    quality = "LOW";
    qualityReason = "Non-positive EPS TTM";
    reasonCode = "NEG_EPS";
    reasonInputs = { epsTTM: epsTtm };
  } else if (negativeYears >= 2) {
    quality = "LOW";
    qualityReason = "EPS negative in multiple years";
    reasonCode = "NEG_EPS";
    reasonInputs = { negativeYears };
  } else if (Number.isFinite(growthStd) && growthStd > 0.35) {
    quality = "LOW";
    qualityReason = "EPS growth volatility exceeds 35%";
    reasonCode = "VOLATILE_GROWTH";
    reasonInputs = { growthStd };
  } else if (
    earningsHistory.length >= 5 &&
    negativeYears === 0 &&
    (growthStd === null || growthStd <= 0.15) // Stricter: require volatility <= 15% for HIGH
  ) {
    quality = "HIGH";
    qualityReason = null;
    reasonCode = null;
    reasonInputs = null;
  } else if (!Number.isFinite(epsGrowth5Y)) {
    quality = "LOW";
    qualityReason = "Insufficient EPS growth history";
    reasonCode = "MISSING_DATA";
    reasonInputs = { epsGrowth5Y, revenueGrowth5Y };
  }

  const peCurrent =
    isPositiveNumber(price) && isPositiveNumber(epsTtm) ? safeDiv(price, epsTtm, null) : null;

  // More conservative: lower baseline and cap, penalize high volatility
  const volatilityPenalty =
    Number.isFinite(growthStd) && growthStd > 0.2 ? Math.min(0.2, (growthStd - 0.2) * 0.3) : 0;
  const adjustedGrowth = Number.isFinite(epsGrowth5Y)
    ? epsGrowth5Y * (1 - volatilityPenalty)
    : null;
  const growthComponent = Number.isFinite(adjustedGrowth) ? adjustedGrowth * 100 : null;
  const baselineComponent = 8; // Increased from 5 to be more conservative
  const targetFromGrowth = Number.isFinite(growthComponent)
    ? clamp(growthComponent + baselineComponent, 8, 40) // Higher min (8 vs 5), lower max (40 vs 50)
    : null;

  let peFair = targetFromGrowth;
  if (Number.isFinite(peCurrent) && peCurrent > 0) {
    if (!Number.isFinite(peFair)) {
      peFair = clamp(peCurrent, 5, 50);
    } else {
      peFair = clamp((peFair + peCurrent) / 2, 5, 50);
    }
  }

  if (!Number.isFinite(peFair) || peFair <= 0) {
    peFair = 12; // More conservative default: 12 instead of 15
  }

  let fairValue = epsTtm * peFair;
  const upsideRatio = safeDiv(fairValue, price, null);
  let upside = Number.isFinite(upsideRatio) ? upsideRatio - 1 : null;

  const range = {
    low: clampRangeValue(epsTtm * peFair * 0.8),
    high: clampRangeValue(epsTtm * peFair * 1.2),
  };

  if (!isPositiveNumber(epsTtm)) {
    fairValue = 0;
    upside = -1;
    reasonCode = reasonCode ?? "NEG_EPS";
    reasonInputs = {
      ...(reasonInputs || {}),
      epsTTM: epsTtm,
    };
  }

  return {
    fairValue: Number.isFinite(fairValue) ? fairValue : null,
    upside: Number.isFinite(upside) ? upside : null,
    range,
    peFair: Number.isFinite(peFair) ? peFair : null,
    quality,
    qualityReason,
    reasonCode,
    reasonInputs,
    sharesSource,
  };
}
