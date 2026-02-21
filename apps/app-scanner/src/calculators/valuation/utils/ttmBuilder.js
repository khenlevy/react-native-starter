import { sum } from "./math.js";

const CASH_FROM_OPERATIONS_KEYS = [
  "cashFromOperations",
  "totalCashFromOperatingActivities",
  "operatingCashFlow",
  "netCashProvidedByOperatingActivities",
  "netCashProvidedByUsedInOperatingActivities",
];

const CAPITAL_EXPENDITURE_KEYS = [
  "capitalExpenditures",
  "capitalExpenditure",
  "investmentInFixedAssets",
  "purchaseOfPropertyPlantEquipment",
  "capex",
];

function pickValue(object = {}, keys = []) {
  for (const key of keys) {
    const value = Number(object?.[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function pickIncomeValue(object = {}, keys = [], fallback = 0) {
  for (const key of keys) {
    const value = Number(object?.[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function detectCapexSign(values = []) {
  const nonZero = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value !== 0);

  if (nonZero.length === 0) {
    return -1;
  }

  const positives = nonZero.filter((value) => value > 0).length;
  const negatives = nonZero.length - positives;

  // If majority positive, it likely means CapEx is reported as a positive cash outlay
  return positives > negatives ? -1 : 1;
}

function normalizeCapexSeries(rawValues = []) {
  const sign = detectCapexSign(rawValues);
  return rawValues.map((value) => value * sign);
}

function findContiguousQuarterRun(entries, required = 4, maxGapDays = 125) {
  if (!Array.isArray(entries) || entries.length < required) {
    return null;
  }

  const sorted = entries.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  for (let end = sorted.length - 1; end >= required - 1; end -= 1) {
    const candidate = sorted.slice(end - required + 1, end + 1);
    let contiguous = true;

    for (let i = 1; i < candidate.length; i += 1) {
      const prevDate = new Date(candidate[i - 1].date);
      const currDate = new Date(candidate[i].date);
      const gapDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
      if (!Number.isFinite(gapDays) || gapDays > maxGapDays) {
        contiguous = false;
        break;
      }
    }

    if (contiguous) {
      return candidate;
    }
  }

  return null;
}

export function computeTTM(fundamentals = []) {
  if (!Array.isArray(fundamentals) || fundamentals.length === 0) {
    return {
      revenueTTM: 0,
      ebitTTM: 0,
      cfoTTM: 0,
      capexTTM: 0,
      fcfTTM: 0,
    };
  }

  const quarterly = fundamentals.filter(
    (entry) => entry?.frequency === "Q" || entry?.period === "Q"
  );

  if (quarterly.length >= 4) {
    const contiguous = findContiguousQuarterRun(quarterly, 4);
    const last4 = contiguous || quarterly.slice(-4);

    const revenueTTM = sum(
      last4.map((item) =>
        pickIncomeValue(item?.incomeStatement, ["revenue", "totalRevenue", "Revenue"], 0)
      )
    );
    const ebitTTM = sum(
      last4.map((item) =>
        pickIncomeValue(
          item?.incomeStatement,
          ["operatingIncome", "operatingIncomeLoss", "ebit"],
          0
        )
      )
    );

    const rawCfoValues = last4.map((item) => pickValue(item?.cashFlow, CASH_FROM_OPERATIONS_KEYS));
    const rawCapexValues = last4.map((item) => pickValue(item?.cashFlow, CAPITAL_EXPENDITURE_KEYS));

    const normalizedCapexValues = normalizeCapexSeries(rawCapexValues);

    const cfoTTM = sum(rawCfoValues);
    const capexTTM = sum(normalizedCapexValues);

    return {
      revenueTTM,
      ebitTTM,
      cfoTTM,
      capexTTM,
      fcfTTM: cfoTTM - capexTTM,
    };
  }

  const latest = fundamentals[fundamentals.length - 1];
  const revenueTTM = pickIncomeValue(latest?.incomeStatement, [
    "revenue",
    "totalRevenue",
    "Revenue",
  ]);
  const ebitTTM = pickIncomeValue(latest?.incomeStatement, [
    "operatingIncome",
    "operatingIncomeLoss",
    "ebit",
  ]);
  const cfoTTM = pickValue(latest?.cashFlow, CASH_FROM_OPERATIONS_KEYS);
  const capexTTM = normalizeCapexSeries([pickValue(latest?.cashFlow, CAPITAL_EXPENDITURE_KEYS)])[0];

  return {
    revenueTTM,
    ebitTTM,
    cfoTTM,
    capexTTM,
    fcfTTM: cfoTTM - capexTTM,
  };
}
