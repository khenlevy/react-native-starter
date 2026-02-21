import { clamp, isPositiveNumber, safeDiv } from "./utils/math.js";

export const DCF_DEFAULTS = {
  horizonYears: 5,
  terminalGrowth: 0.02,
  wacc: 0.09,
  gStartCap: 0.3,
  upsideMin: -1,
  upsideMax: 5,
  fairValueMin: 0,
  fairValueMax: 50000,
};

function sanitizeAssumptions(assumptions = {}) {
  const config = { ...DCF_DEFAULTS, ...assumptions };
  config.horizonYears = Math.max(1, Math.round(config.horizonYears));
  config.terminalGrowth = clamp(config.terminalGrowth, -0.01, 0.05);
  config.wacc = clamp(config.wacc, 0.03, 0.25);
  config.gStartCap = clamp(config.gStartCap, -0.2, 0.3);
  config.upsideMin = Number.isFinite(config.upsideMin) ? config.upsideMin : DCF_DEFAULTS.upsideMin;
  config.upsideMax = Number.isFinite(config.upsideMax) ? config.upsideMax : DCF_DEFAULTS.upsideMax;
  config.fairValueMin = Number.isFinite(config.fairValueMin)
    ? config.fairValueMin
    : DCF_DEFAULTS.fairValueMin;
  config.fairValueMax = Number.isFinite(config.fairValueMax)
    ? config.fairValueMax
    : DCF_DEFAULTS.fairValueMax;
  return config;
}

function prepareInputs(inputs = {}) {
  const {
    revenueTTM = 0,
    ebitMargin = 0,
    taxRate = 0.21,
    salesToCapital = 4,
    netDebt = 0,
    sharesDiluted = 0,
    currentPrice = 0,
    revenueGrowthStart = 0.1,
    minorityInterest = 0,
    preferredEquity = 0,
    investmentsAssociates = 0,
  } = inputs;

  return {
    revenueTTM: Math.max(0, Number(revenueTTM) || 0),
    ebitMargin: clamp(Number(ebitMargin) || 0, -1, 1),
    taxRate: clamp(Number(taxRate) || 0, 0, 0.5),
    salesToCapital: Math.max(Number(salesToCapital) || 0, 0.0001),
    netDebt: Number(netDebt) || 0,
    sharesDiluted: Number(sharesDiluted) || 0,
    currentPrice: Number(currentPrice) || 0,
    revenueGrowthStart: Number.isFinite(revenueGrowthStart) ? revenueGrowthStart : 0.1,
    minorityInterest: Number(minorityInterest) || 0,
    preferredEquity: Number(preferredEquity) || 0,
    investmentsAssociates: Number(investmentsAssociates) || 0,
  };
}

const HAS_FMA = typeof Math.fma === "function";

function buildDiscountFactors(discountRate, length) {
  const factors = new Array(length);
  if (!Number.isFinite(discountRate)) {
    for (let i = 0; i < length; i += 1) {
      factors[i] = 0;
    }
    return factors;
  }

  const base = 1 / (1 + discountRate);
  let current = base;
  for (let i = 0; i < length; i += 1) {
    factors[i] = current;
    current *= base;
  }

  return factors;
}

function computeDCFProjection(inputs, assumptions) {
  const sanitized = prepareInputs(inputs);
  const config = sanitizeAssumptions(assumptions);

  const { revenueTTM, ebitMargin, taxRate, salesToCapital } = sanitized;
  // More conservative growth cap: reduce by 20% to account for uncertainty
  const adjustedGrowthStart = sanitized.revenueGrowthStart * 0.8;
  const growthStart = clamp(adjustedGrowthStart, -0.2, config.gStartCap * 0.8);

  let revenuePrev = revenueTTM;
  const fcfSeries = [];
  let reinvestmentClampCount = 0;

  for (let t = 1; t <= config.horizonYears; t += 1) {
    const progress = t / config.horizonYears;
    const gCurrent = growthStart - (growthStart - config.terminalGrowth) * progress;

    const revenueCurrent = revenuePrev * (1 + gCurrent);
    const ebitCurrent = revenueCurrent * ebitMargin;
    const nopatCurrent = ebitCurrent * (1 - taxRate);
    const revenueDelta = revenueCurrent - revenuePrev;
    let reinvestmentCurrent = Math.max(
      0,
      salesToCapital > 0 ? safeDiv(revenueDelta, salesToCapital, 0) : 0
    );
    let fcfCurrent = nopatCurrent - reinvestmentCurrent;

    if (reinvestmentCurrent > nopatCurrent) {
      reinvestmentClampCount += 1;
      fcfCurrent = nopatCurrent * 0.9;
      reinvestmentCurrent = nopatCurrent - fcfCurrent;
    }

    fcfSeries.push(fcfCurrent);
    revenuePrev = revenueCurrent;
  }

  let continuityViolation = false;
  for (let i = 1; i < fcfSeries.length; i += 1) {
    const prev = fcfSeries[i - 1];
    const current = fcfSeries[i];
    if (!Number.isFinite(prev) || Math.abs(prev) < 1e-6) {
      continue;
    }
    if (!Number.isFinite(current)) {
      continuityViolation = true;
      break;
    }
    const ratio = safeDiv(current, prev, null);
    if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 2) {
      continuityViolation = true;
      break;
    }
  }

  return {
    fcfSeries,
    inputs: sanitized,
    assumptions: config,
    adjustments: {
      reinvestmentClampCount,
      continuityViolation,
    },
  };
}

function presentValue(series, discountRate) {
  const factors = buildDiscountFactors(discountRate, series.length);
  let total = 0;

  for (let i = 0; i < series.length; i += 1) {
    const cashFlow = Number.isFinite(series[i]) ? series[i] : 0;
    const discount = factors[i];
    if (!Number.isFinite(discount)) {
      continue;
    }
    total = HAS_FMA ? Math.fma(cashFlow, discount, total) : total + cashFlow * discount;
  }

  return { value: total, factors };
}

export function runDCF(inputs, assumptions = DCF_DEFAULTS) {
  const projection = computeDCFProjection(inputs, assumptions);
  const { fcfSeries, inputs: normalized, assumptions: config, adjustments } = projection;

  const { value: pvFcf, factors: discountFactors } = presentValue(fcfSeries, config.wacc);
  const lastFcf = Number.isFinite(fcfSeries.at(-1)) ? fcfSeries.at(-1) : 0;
  const fcfTerminal = HAS_FMA
    ? Math.fma(lastFcf, config.terminalGrowth, lastFcf)
    : lastFcf * (1 + config.terminalGrowth);
  const terminalValue = safeDiv(fcfTerminal, config.wacc - config.terminalGrowth, 0);
  const terminalDiscountFactor =
    discountFactors.at(-1) ?? Math.pow(1 + config.wacc, -Math.max(1, config.horizonYears));
  const pvTerminalValue = terminalValue * terminalDiscountFactor;

  const enterpriseValue = pvFcf + pvTerminalValue;
  const equityValue =
    enterpriseValue -
    normalized.netDebt -
    normalized.minorityInterest -
    normalized.preferredEquity +
    normalized.investmentsAssociates;
  const sharesBase =
    Number.isFinite(normalized.sharesDiluted) && normalized.sharesDiluted > 0
      ? normalized.sharesDiluted
      : 1;
  const fairValuePerShare = safeDiv(equityValue, sharesBase, 0);
  const upsideRatio = safeDiv(fairValuePerShare, normalized.currentPrice, null);
  const upside = Number.isFinite(upsideRatio) ? upsideRatio - 1 : null;

  const clampedFairValue = clamp(
    Number.isFinite(fairValuePerShare) ? fairValuePerShare : 0,
    config.fairValueMin,
    config.fairValueMax
  );
  const clampedUpside = clamp(
    Number.isFinite(upside) ? upside : 0,
    config.upsideMin,
    config.upsideMax
  );

  const sensitivity = generateSensitivityMatrix(normalized, config);
  const qualityResult = qualityCheck(normalized, fcfSeries, adjustments);

  return {
    fairValuePerShare: clampedFairValue,
    upside: clampedUpside,
    range: sensitivity.range,
    sensitivityMatrix: sensitivity.matrix,
    quality: qualityResult.quality,
    qualityReason: qualityResult.reason,
    reasonCode: qualityResult.reasonCode ?? null,
    reasonInputs: qualityResult.reasonInputs ?? null,
    wacc: config.wacc,
    terminalGrowth: config.terminalGrowth,
    waccComponents: assumptions.waccComponents || null,
  };
}

function runSingleScenario(inputs, assumptions) {
  const projection = computeDCFProjection(inputs, assumptions);
  const { fcfSeries, inputs: normalized, assumptions: config } = projection;

  const { value: pvFcf, factors: discountFactors } = presentValue(fcfSeries, config.wacc);
  const lastFcf = Number.isFinite(fcfSeries.at(-1)) ? fcfSeries.at(-1) : 0;
  const fcfTerminal = HAS_FMA
    ? Math.fma(lastFcf, config.terminalGrowth, lastFcf)
    : lastFcf * (1 + config.terminalGrowth);
  const terminalValue = safeDiv(fcfTerminal, config.wacc - config.terminalGrowth, 0);
  const terminalDiscountFactor =
    discountFactors.at(-1) ?? Math.pow(1 + config.wacc, -Math.max(1, config.horizonYears));
  const pvTerminalValue = terminalValue * terminalDiscountFactor;
  const enterpriseValue = pvFcf + pvTerminalValue;
  const equityValue =
    enterpriseValue -
    normalized.netDebt -
    normalized.minorityInterest -
    normalized.preferredEquity +
    normalized.investmentsAssociates;
  const sharesBase =
    Number.isFinite(normalized.sharesDiluted) && normalized.sharesDiluted > 0
      ? normalized.sharesDiluted
      : 1;
  const fairValuePerShare = safeDiv(equityValue, sharesBase, 0);

  return fairValuePerShare;
}

function generateSensitivityMatrix(inputs, assumptions) {
  const waccSteps = [-0.01, 0, 0.01];
  const growthSteps = [-0.005, 0, 0.005];

  const matrix = [];
  const values = [];

  waccSteps.forEach((waccDelta) => {
    const row = [];
    growthSteps.forEach((growthDelta) => {
      const scenarioAssumptions = sanitizeAssumptions({
        ...assumptions,
        wacc: assumptions.wacc + waccDelta,
        terminalGrowth: assumptions.terminalGrowth + growthDelta,
      });

      if (scenarioAssumptions.wacc <= scenarioAssumptions.terminalGrowth) {
        row.push({
          wacc: scenarioAssumptions.wacc,
          terminalGrowth: scenarioAssumptions.terminalGrowth,
          fairValue: null,
        });
        return;
      }

      const fairValue = runSingleScenario(inputs, scenarioAssumptions);
      const clamped =
        Number.isFinite(fairValue) && fairValue > 0
          ? clamp(fairValue, scenarioAssumptions.fairValueMin, scenarioAssumptions.fairValueMax)
          : null;

      if (Number.isFinite(clamped)) {
        values.push(clamped);
      }

      row.push({
        wacc: scenarioAssumptions.wacc,
        terminalGrowth: scenarioAssumptions.terminalGrowth,
        fairValue: Number.isFinite(clamped) ? clamped : null,
      });
    });
    matrix.push(row);
  });

  const range =
    values.length === 0
      ? { low: null, high: null }
      : {
          low: clamp(Math.min(...values), assumptions.fairValueMin, assumptions.fairValueMax),
          high: clamp(Math.max(...values), assumptions.fairValueMin, assumptions.fairValueMax),
        };

  return { matrix, range };
}

function qualityCheck(inputs, fcfSeries, adjustments = {}) {
  if (!isPositiveNumber(inputs.revenueTTM)) {
    return {
      quality: "N/A",
      reason: "Missing or invalid revenue data",
      reasonCode: "MISSING_DATA",
      reasonInputs: { revenueTTM: inputs.revenueTTM },
    };
  }

  const negativeCount = fcfSeries.filter((value) => value <= 0).length;
  if (negativeCount >= Math.ceil(fcfSeries.length / 2)) {
    return {
      quality: "LOW",
      reason: "Negative or unstable free cash flow history",
      reasonCode: "NEG_FCF",
      reasonInputs: { negativePeriods: negativeCount },
    };
  }

  // Stricter margin threshold: require at least 7% operating margin
  if (inputs.ebitMargin < 0.07 || inputs.salesToCapital < 0.5) {
    return {
      quality: "LOW",
      reason: "Margins or reinvestment metrics below thresholds",
      reasonCode: "NEG_FCF",
      reasonInputs: {
        margin: inputs.ebitMargin,
        salesToCapital: inputs.salesToCapital,
      },
    };
  }

  if (adjustments.reinvestmentClampCount > 0) {
    return {
      quality: "LOW",
      reason: "Reinvestment requirement exceeds NOPAT in projection",
      reasonCode: "NEG_FCF",
      reasonInputs: { reinvestmentClampCount: adjustments.reinvestmentClampCount },
    };
  }

  if (adjustments.continuityViolation) {
    return {
      quality: "LOW",
      reason: "Projected FCF growth falls outside 0.5x–2x band",
      reasonCode: "VOLATILE_GROWTH",
      reasonInputs: { continuityViolation: true },
    };
  }

  if (!isPositiveNumber(inputs.sharesDiluted) || !isPositiveNumber(inputs.currentPrice)) {
    return {
      quality: "N/A",
      reason: "Missing share count or price",
      reasonCode: "MISSING_DATA",
      reasonInputs: {
        sharesDiluted: inputs.sharesDiluted,
        currentPrice: inputs.currentPrice,
      },
    };
  }

  return { quality: "HIGH", reason: null, reasonCode: null, reasonInputs: null };
}
