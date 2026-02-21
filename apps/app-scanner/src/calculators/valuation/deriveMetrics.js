import {
  clamp,
  trimmedMean,
  average,
  isPositiveNumber,
  standardDeviation,
  safeDiv,
  geometricMean,
} from "./utils/math.js";

const CAPITAL_EXPENDITURE_KEYS = [
  "capitalExpenditures",
  "capitalExpenditure",
  "investmentInFixedAssets",
  "purchaseOfPropertyPlantEquipment",
  "capex",
];

const DEPRECIATION_KEYS = ["depreciationAndAmortization", "depreciation", "reconciledDepreciation"];

const CURRENT_ASSET_KEYS = ["totalCurrentAssets", "currentAssets", "CurrentAssets"];

const CURRENT_LIABILITY_KEYS = [
  "totalCurrentLiabilities",
  "currentLiabilities",
  "CurrentLiabilities",
];

const PPE_KEYS = [
  "propertyPlantAndEquipmentNet",
  "propertyPlantEquipment",
  "propertyPlantEquipmentNet",
  "netPPE",
  "PPENet",
  "ppAndENet",
];

const MINORITY_INTEREST_KEYS = [
  "minorityInterest",
  "minorityInterestLiabilities",
  "minorityInterestTotal",
  "noncontrollingInterest",
  "noncontrollingInterests",
];

const PREFERRED_EQUITY_KEYS = [
  "preferredStock",
  "preferredStockEquity",
  "preferredStockValue",
  "preferredStockRedeemable",
  "preferredStockTotalEquity",
];

const INVESTMENTS_ASSOCIATES_KEYS = [
  "investmentsInAssociates",
  "investmentInAssociates",
  "investmentsAssociates",
  "equityMethodInvestments",
  "investmentsInSubsidiariesAssociatesJointVentures",
];

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pickFirstNumber(source = {}, keys = [], fallback = 0) {
  for (const key of keys) {
    const value = toNumber(source?.[key]);
    if (Number.isFinite(value) && value !== 0) {
      return value;
    }
  }
  return fallback;
}

function pickFirstFinite(source = {}, keys = [], fallback = null) {
  for (const key of keys) {
    const value = toNumber(source?.[key], null);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function collectCapexValues(fundamentals) {
  return fundamentals
    .map((item) => toNumber(pickFirstNumber(item?.cashFlow, CAPITAL_EXPENDITURE_KEYS, null), null))
    .filter((value) => Number.isFinite(value) && value !== 0);
}

function detectCapexSign(fundamentals) {
  const values = collectCapexValues(fundamentals);
  if (values.length === 0) {
    return -1;
  }

  const positives = values.filter((value) => value > 0).length;
  const negatives = values.length - positives;
  return positives > negatives ? -1 : 1;
}

function normalizeCapex(value, capexSign) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.abs(value * (capexSign || -1));
}

function computeRevenueCAGR(fundamentals) {
  const revenues = fundamentals
    .map((item) =>
      pickFirstNumber(item?.incomeStatement, ["revenue", "totalRevenue", "Revenue"], null)
    )
    .filter(isPositiveNumber);

  if (revenues.length < 2) {
    return 0.05; // More conservative default: 5% instead of 10%
  }

  const periods = Math.min(5, revenues.length - 1);
  const relevantSlice = revenues.slice(revenues.length - (periods + 1));
  const growthFactors = [];

  for (let i = 1; i < relevantSlice.length; i += 1) {
    const factor = safeDiv(relevantSlice[i], relevantSlice[i - 1], null);
    if (Number.isFinite(factor) && factor > 0) {
      growthFactors.push(factor);
    }
  }

  const geoMean = geometricMean(growthFactors, null);
  if (!Number.isFinite(geoMean)) {
    return clamp(0.05, -0.2, 0.25); // Lower default and max cap
  }

  const cagr = geoMean - 1;
  // Cap growth more conservatively, especially for high-growth companies
  return clamp(cagr, -0.2, 0.25); // Reduced max from 30% to 25%
}

function computeRevenueGrowthRates(fundamentals) {
  const revenues = fundamentals
    .map((item) =>
      pickFirstNumber(item?.incomeStatement, ["revenue", "totalRevenue", "Revenue"], null)
    )
    .filter(Number.isFinite);

  if (revenues.length < 2) {
    return [];
  }

  const rates = [];
  for (let i = 1; i < revenues.length; i += 1) {
    const prev = revenues[i - 1];
    const current = revenues[i];
    const factor = safeDiv(current, prev, null);
    if (Number.isFinite(factor)) {
      rates.push(factor - 1);
    }
  }

  return rates;
}

function computeOperatingMarginInsights(fundamentals) {
  const series = fundamentals
    .map((item) => {
      const revenue = pickFirstNumber(item?.incomeStatement, [
        "revenue",
        "totalRevenue",
        "Revenue",
      ]);
      const operatingIncome = pickFirstNumber(item?.incomeStatement, [
        "operatingIncome",
        "operatingIncomeLoss",
        "ebit",
        "ebitda",
      ]);
      if (!isPositiveNumber(revenue)) {
        return null;
      }
      return safeDiv(operatingIncome, revenue, null);
    })
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1);

  if (series.length === 0) {
    return {
      margin: 0.1, // More conservative default: 10% instead of 15%
      volatility: 0,
      series: [],
    };
  }

  const trimmed = trimmedMean(series, 0.2);
  const margin = clamp(trimmed, 0.05, 0.3); // Reduced max from 35% to 30%

  return {
    margin,
    volatility: standardDeviation(series),
    series,
  };
}

function computeEbitdaMarginInsights(fundamentals) {
  const series = fundamentals
    .map((item) => {
      const revenue = pickFirstNumber(item?.incomeStatement, [
        "revenue",
        "totalRevenue",
        "Revenue",
      ]);
      const operatingIncome = pickFirstNumber(item?.incomeStatement, [
        "operatingIncome",
        "operatingIncomeLoss",
        "ebit",
      ]);
      const depreciation =
        pickFirstNumber(item?.cashFlow, DEPRECIATION_KEYS, null) ||
        pickFirstNumber(item?.incomeStatement, DEPRECIATION_KEYS, null);

      if (!isPositiveNumber(revenue)) {
        return null;
      }

      const ebitda =
        (Number.isFinite(operatingIncome) ? operatingIncome : 0) +
        (Number.isFinite(depreciation) ? Math.abs(depreciation) : 0);

      if (ebitda <= 0) {
        return null;
      }

      return safeDiv(ebitda, revenue, null);
    })
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1);

  if (series.length === 0) {
    return {
      margin: null,
      volatility: 0,
      series: [],
    };
  }

  const trimmed = trimmedMean(series, 0.2);
  const margin = clamp(trimmed, 0.05, 0.45);

  return {
    margin,
    volatility: standardDeviation(series),
    series,
  };
}

function computeWorkingCapitalAndPpe(entry) {
  const balance = entry?.balanceSheet || {};
  const currentAssets = pickFirstFinite(balance, CURRENT_ASSET_KEYS, null);
  const currentLiabilities = pickFirstFinite(balance, CURRENT_LIABILITY_KEYS, null);
  const ppe = pickFirstFinite(balance, PPE_KEYS, null);

  const workingCapital =
    (Number.isFinite(currentAssets) ? currentAssets : 0) -
    (Number.isFinite(currentLiabilities) ? currentLiabilities : 0);

  return {
    workingCapital: Number.isFinite(workingCapital) ? workingCapital : null,
    ppe: Number.isFinite(ppe) ? ppe : null,
  };
}

function computeInvestedCapital(entry) {
  const { workingCapital, ppe } = computeWorkingCapitalAndPpe(entry);
  if (!Number.isFinite(workingCapital) && !Number.isFinite(ppe)) {
    return {
      workingCapital: null,
      ppe: null,
      investedCapital: null,
    };
  }

  const investedCapital =
    (Number.isFinite(workingCapital) ? workingCapital : 0) + (Number.isFinite(ppe) ? ppe : 0);

  return {
    workingCapital: Number.isFinite(workingCapital) ? workingCapital : null,
    ppe: Number.isFinite(ppe) ? ppe : null,
    investedCapital: Number.isFinite(investedCapital) ? investedCapital : null,
  };
}

function computeMinorityInterest(balance) {
  return pickFirstFinite(balance, MINORITY_INTEREST_KEYS, 0);
}

function computePreferredEquity(balance) {
  return pickFirstFinite(balance, PREFERRED_EQUITY_KEYS, 0);
}

function computeInvestmentsAssociates(balance) {
  return pickFirstFinite(balance, INVESTMENTS_ASSOCIATES_KEYS, 0);
}

function computeSalesToCapitalInsights(fundamentals) {
  const ratios = [];
  const reinvestmentDeviations = [];
  const capexSign = detectCapexSign(fundamentals);
  const investedSnapshots = fundamentals.map((entry) => ({
    ...computeInvestedCapital(entry),
    date: entry?.date || null,
  }));

  for (let i = 1; i < fundamentals.length; i++) {
    const current = fundamentals[i];
    const previous = fundamentals[i - 1];

    const revenueNow = pickFirstNumber(current?.incomeStatement, [
      "revenue",
      "totalRevenue",
      "Revenue",
    ]);
    const revenuePrev = pickFirstNumber(previous?.incomeStatement, [
      "revenue",
      "totalRevenue",
      "Revenue",
    ]);
    const deltaRevenue = revenueNow - revenuePrev;
    if (!(deltaRevenue > 0)) {
      continue;
    }

    const rawCapex = pickFirstNumber(current?.cashFlow, CAPITAL_EXPENDITURE_KEYS, 0);
    const capex = normalizeCapex(rawCapex, capexSign);

    const depreciation = Math.abs(
      pickFirstNumber(current?.cashFlow, DEPRECIATION_KEYS, null) ||
        pickFirstNumber(current?.incomeStatement, DEPRECIATION_KEYS, null) ||
        0
    );

    // Include working capital changes in reinvestment calculation
    const currentWC = investedSnapshots[i]?.workingCapital ?? 0;
    const previousWC = investedSnapshots[i - 1]?.workingCapital ?? 0;
    const deltaWorkingCapital = currentWC - previousWC;

    // Reinvestment = capex - depreciation + increase in working capital
    // (increase in WC consumes cash, decrease releases cash)
    const reinvestment = Math.max(0, capex - depreciation + Math.max(0, deltaWorkingCapital));

    if (reinvestment > 0) {
      ratios.push(safeDiv(deltaRevenue, reinvestment, null));
    }

    const currentInvested = investedSnapshots[i]?.investedCapital;
    const previousInvested = investedSnapshots[i - 1]?.investedCapital;

    if (Number.isFinite(currentInvested) && Number.isFinite(previousInvested)) {
      const deltaInvested = currentInvested - previousInvested;
      const baseline = Math.max(Math.abs(reinvestment), Math.abs(deltaInvested), 1);
      reinvestmentDeviations.push(safeDiv(Math.abs(reinvestment - deltaInvested), baseline, null));
    }
  }

  // More conservative default: if we can't compute ratios, use a lower salesToCapital
  // This reflects uncertainty and forces more conservative FCF projections
  if (ratios.length === 0) {
    return {
      salesToCapital: 2.5, // Reduced from 4 to be more conservative
      reinvestmentStats: {
        averageDeviation: null,
        flagged: true, // Flag when we can't compute - indicates data quality issue
      },
    };
  }

  // Use trimmed mean to reduce impact of outliers, then clamp more conservatively
  const trimmedRatios = ratios.filter((r) => Number.isFinite(r) && r > 0 && r < 20);
  if (trimmedRatios.length === 0) {
    return {
      salesToCapital: 2.5,
      reinvestmentStats: {
        averageDeviation: null,
        flagged: true,
      },
    };
  }

  const salesToCapital = clamp(average(trimmedRatios), 1, 8); // Reduced max from 10 to 8
  const avgDeviation = reinvestmentDeviations.length > 0 ? average(reinvestmentDeviations) : null;

  return {
    salesToCapital,
    reinvestmentStats: {
      averageDeviation: Number.isFinite(avgDeviation) ? avgDeviation : null,
      flagged: Number.isFinite(avgDeviation) ? avgDeviation > 0.25 : false, // Stricter threshold: 25% instead of 30%
    },
  };
}

function computeEffectiveTaxRate(fundamentals) {
  const taxRates = fundamentals
    .map((item) => {
      const tax = Math.abs(
        pickFirstNumber(item?.incomeStatement, [
          "incomeTaxExpense",
          "taxProvision",
          "incomeTaxProvision",
        ])
      );
      const ebt = pickFirstNumber(item?.incomeStatement, [
        "incomeBeforeTax",
        "earningsBeforeTax",
        "preTaxIncome",
      ]);
      if (!isPositiveNumber(ebt)) {
        return null;
      }
      const rate = safeDiv(tax, ebt, null);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 0.6) {
        return null;
      }
      return rate;
    })
    .filter(Number.isFinite);

  if (taxRates.length === 0) {
    return 0.25; // More conservative default: assume higher tax rate
  }

  return clamp(trimmedMean(taxRates, 0.2), 0.15, 0.35); // Higher minimum floor
}

function computeNetDebt(latest) {
  const balance = latest?.balanceSheet || {};
  const totalDebt =
    pickFirstNumber(balance, ["totalDebt", "totalLiab", "totalLiabilities"]) ||
    pickFirstNumber(balance, ["shortLongTermDebtTotal"]) ||
    pickFirstNumber(balance, ["shortTermDebt"]) + pickFirstNumber(balance, ["longTermDebt"]);

  const leaseLiabilities = pickFirstNumber(balance, ["leaseLiabilities"], 0);

  const cash =
    pickFirstNumber(balance, ["cashAndEquivalents", "cashAndCashEquivalents"]) ||
    pickFirstNumber(balance, ["cash"]);

  return totalDebt + leaseLiabilities - cash;
}

function computeSharesDiluted(latest) {
  const income = latest?.incomeStatement || {};
  const dilutedCandidates = [
    { key: "sharesWeightedAvgDiluted", source: "incomeStatement.sharesWeightedAvgDiluted" },
    { key: "sharesDiluted", source: "incomeStatement.sharesDiluted" },
    { key: "weightedAverageShsOutDil", source: "incomeStatement.weightedAverageShsOutDil" },
    {
      key: "weightedAverageDilutedSharesOutstanding",
      source: "incomeStatement.weightedAverageDilutedSharesOutstanding",
    },
  ];

  for (const candidate of dilutedCandidates) {
    const value = toNumber(income?.[candidate.key] ?? null);
    if (Number.isFinite(value) && value > 0) {
      return {
        diluted: value,
        basic: toNumber(
          income.sharesWeightedAvgBasic ??
            income.weightedAverageShsOut ??
            income.basicAverageShares ??
            income.basicSharesOutstanding ??
            latest?.balanceSheet?.commonStockSharesOutstanding
        ),
        source: candidate.source,
      };
    }
  }

  const fallbackBasic =
    toNumber(
      income.sharesWeightedAvgBasic ??
        income.weightedAverageShsOut ??
        income.basicAverageShares ??
        income.basicSharesOutstanding
    ) || toNumber(latest?.balanceSheet?.commonStockSharesOutstanding);

  return {
    diluted: fallbackBasic,
    basic: fallbackBasic,
    source: "fallback.basicShares",
  };
}

export function deriveMetrics(fundamentals = []) {
  if (!Array.isArray(fundamentals) || fundamentals.length === 0) {
    return null;
  }

  const latest = fundamentals[fundamentals.length - 1];

  // Check minimum data requirements for reliable valuation
  const hasMinimumData = (() => {
    // Need at least 2 periods to compute any meaningful metrics
    if (fundamentals.length < 2) {
      return false;
    }

    // Need revenue data in at least 2 periods
    const revenues = fundamentals
      .map((item) =>
        pickFirstNumber(item?.incomeStatement, ["revenue", "totalRevenue", "Revenue"], null)
      )
      .filter(isPositiveNumber);
    if (revenues.length < 2) {
      return false;
    }

    // Need latest revenue to be positive
    const latestRevenue = pickFirstNumber(latest?.incomeStatement, [
      "revenue",
      "totalRevenue",
      "Revenue",
    ]);
    if (!isPositiveNumber(latestRevenue)) {
      return false;
    }

    return true;
  })();

  if (!hasMinimumData) {
    return null;
  }

  const revenueGrowthRates = computeRevenueGrowthRates(fundamentals);
  const revenueCAGR5Y = computeRevenueCAGR(fundamentals);
  const operatingMarginInsights = computeOperatingMarginInsights(fundamentals);
  const ebitdaMarginInsights = computeEbitdaMarginInsights(fundamentals);
  const salesToCapitalInsights = computeSalesToCapitalInsights(fundamentals);
  const effectiveTaxRate = computeEffectiveTaxRate(fundamentals);
  const netDebt = computeNetDebt(latest);
  const sharesInfo = computeSharesDiluted(latest);
  const investedSnapshotLatest = computeInvestedCapital(latest);
  const minorityInterest = computeMinorityInterest(latest?.balanceSheet || {});
  const preferredEquity = computePreferredEquity(latest?.balanceSheet || {});
  const investmentsAssociates = computeInvestmentsAssociates(latest?.balanceSheet || {});

  const latestRevenue = pickFirstNumber(latest?.incomeStatement, [
    "revenue",
    "totalRevenue",
    "Revenue",
  ]);

  const nopat =
    Number.isFinite(latestRevenue) && Number.isFinite(operatingMarginInsights.margin)
      ? latestRevenue * operatingMarginInsights.margin * (1 - effectiveTaxRate)
      : null;

  const roic =
    Number.isFinite(nopat) && Number.isFinite(investedSnapshotLatest.investedCapital)
      ? safeDiv(nopat, investedSnapshotLatest.investedCapital, null)
      : null;

  // Track data quality indicators - STRICT: any default usage reduces certainty
  const dataQualityFlags = {
    // True if we're using default values (indicates missing/poor data)
    usingDefaultRevenueGrowth: revenueGrowthRates.length < 2,
    usingDefaultMargin: operatingMarginInsights.series.length === 0,
    usingDefaultSalesToCapital:
      salesToCapitalInsights.reinvestmentStats.flagged &&
      salesToCapitalInsights.salesToCapital === 2.5,
    usingDefaultTaxRate:
      effectiveTaxRate === 0.25 &&
      fundamentals.filter((item) => {
        const ebt = pickFirstNumber(item?.incomeStatement, [
          "incomeBeforeTax",
          "earningsBeforeTax",
          "preTaxIncome",
        ]);
        return isPositiveNumber(ebt);
      }).length === 0,
    usingFallbackShares: sharesInfo.source === "fallback.basicShares",
    insufficientHistory: fundamentals.length < 3, // Less than 3 periods
  };

  // Count how many defaults we're using
  const defaultCount = Object.values(dataQualityFlags).filter(Boolean).length;
  // STRICT scoring: each default significantly reduces certainty
  // Score of 0.7 means max 2 defaults out of 6 (33% defaults allowed)
  const dataQualityScore = 1 - defaultCount / Object.keys(dataQualityFlags).length; // 0 = all defaults, 1 = no defaults

  return {
    growth: {
      revenueCAGR5Y,
      revenueGrowthRates,
      revenueGrowthStdDev: standardDeviation(revenueGrowthRates),
    },
    margins: {
      operatingMargin: operatingMarginInsights.margin,
      operatingMarginStdDev: operatingMarginInsights.volatility,
      operatingMarginSeries: operatingMarginInsights.series,
      ebitdaMargin: ebitdaMarginInsights.margin,
      ebitdaMarginStdDev: ebitdaMarginInsights.volatility,
      ebitdaMarginSeries: ebitdaMarginInsights.series,
    },
    reinvestment: {
      salesToCapital: salesToCapitalInsights.salesToCapital,
      reinvestmentDeviation: salesToCapitalInsights.reinvestmentStats.averageDeviation,
      reinvestmentFlagged: salesToCapitalInsights.reinvestmentStats.flagged,
    },
    taxes: {
      effectiveTaxRate,
    },
    structure: {
      netDebt,
      sharesDiluted: sharesInfo.diluted,
      sharesBasic: sharesInfo.basic,
      sharesSource: sharesInfo.source,
      workingCapital: investedSnapshotLatest.workingCapital,
      ppe: investedSnapshotLatest.ppe,
      investedCapital: investedSnapshotLatest.investedCapital,
      minorityInterest,
      preferredEquity,
      investmentsAssociates,
    },
    profitability: {
      roic: Number.isFinite(roic) ? roic : null,
      nopat: Number.isFinite(nopat) ? nopat : null,
    },
    volatility: {
      revenueGrowthStdDev: standardDeviation(revenueGrowthRates),
      operatingMarginStdDev: operatingMarginInsights.volatility,
      ebitdaMarginStdDev: ebitdaMarginInsights.volatility,
    },
    controls: {
      reinvestmentDeviation: salesToCapitalInsights.reinvestmentStats.averageDeviation,
      reinvestmentFlagged: salesToCapitalInsights.reinvestmentStats.flagged,
      dataQualityFlags,
      dataQualityScore,
    },
  };
}
