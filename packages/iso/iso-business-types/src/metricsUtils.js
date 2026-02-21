/**
 * Metrics Utilities
 *
 * Shared utilities to ensure consistent metric handling across jobs and APIs.
 * This ensures single source of truth for all metric operations.
 */

import {
  getMetricsByEnabledStatus,
  getMetricsMapByType,
  getMetrics,
} from './index.js';

/**
 * Currency code alias map for normalization
 */
const CURRENCY_ALIAS_MAP = {
  USD: 'USD',
  US: 'USD',
  'US DOLLAR': 'USD',
  'U.S. DOLLAR': 'USD',
  'UNITED STATES DOLLAR': 'USD',
  'AMERICAN DOLLAR': 'USD',
  EUR: 'EUR',
  EURO: 'EUR',
  GBP: 'GBP',
  'BRITISH POUND': 'GBP',
  'POUND STERLING': 'GBP',
  CAD: 'CAD',
  'CANADIAN DOLLAR': 'CAD',
  AUD: 'AUD',
  'AUSTRALIAN DOLLAR': 'AUD',
  NZD: 'NZD',
  'NEW ZEALAND DOLLAR': 'NZD',
  CHF: 'CHF',
  'SWISS FRANC': 'CHF',
  SEK: 'SEK',
  NOK: 'NOK',
  DKK: 'DKK',
  JPY: 'JPY',
  'JAPANESE YEN': 'JPY',
  HKD: 'HKD',
  SGD: 'SGD',
  INR: 'INR',
  'INDIAN RUPEE': 'INR',
  CNY: 'CNY',
  'CHINESE YUAN': 'CNY',
  KRW: 'KRW',
  'SOUTH KOREAN WON': 'KRW',
  BRL: 'BRL',
  'BRAZILIAN REAL': 'BRL',
  MXN: 'MXN',
  'MEXICAN PESO': 'MXN',
  ZAR: 'ZAR',
  ZAC: 'ZAR', // Common typo/variant for ZAR (South African Rand)
  'SOUTH AFRICAN RAND': 'ZAR',
  PLN: 'PLN',
  'POLISH ZLOTY': 'PLN',
};

/**
 * Normalize currency code to standard 3-letter ISO format
 * Handles various input formats and aliases
 * @param {string|null|undefined} input - Currency code input
 * @returns {string|null} Normalized 3-letter currency code or null if invalid
 */
export function normalizeCurrencyCode(input) {
  if (input === null || input === undefined) {
    return null;
  }
  const raw = String(input).trim();
  if (!raw) {
    return null;
  }

  const upper = raw.toUpperCase();
  if (CURRENCY_ALIAS_MAP[upper]) {
    return CURRENCY_ALIAS_MAP[upper];
  }

  const letterOnly = upper.replace(/[^A-Z]/g, '');
  if (!letterOnly) {
    return null;
  }

  if (CURRENCY_ALIAS_MAP[letterOnly]) {
    return CURRENCY_ALIAS_MAP[letterOnly];
  }

  if (letterOnly.length === 3) {
    return letterOnly;
  }

  const firstThree = letterOnly.slice(0, 3);
  if (firstThree.length === 3) {
    return firstThree;
  }

  return null;
}

/**
 * Get enabled metrics that have calculators available
 * This ensures we only process metrics that can actually be calculated
 */
export function getCalculableMetrics() {
  const enabledMetrics = getMetricsByEnabledStatus(true);

  // Define which metrics have calculator functions available
  const calculableMetricIds = [
    'DividendYieldCurrent',
    'DividendGrowth3Y',
    'DividendGrowth5Y',
    'DividendGrowth10Y',
    // Debt-to-Equity
    'DebtToEquityCurrent',
    'DebtToEquityChange3M',
    'DebtToEquityChange6M',
    'DebtToEquityChange1Y',
    'DebtToEquityChange2Y',
    // Net Debt/EBITDA
    'NetDebtToEBITDACurrent',
    'NetDebtToEBITDAChange3M',
    'NetDebtToEBITDAChange6M',
    'NetDebtToEBITDAChange1Y',
    'NetDebtToEBITDAChange2Y',
    // EBITDA
    'EBITDACurrent',
    'EBITDAGrowth3M',
    'EBITDAGrowth6M',
    'EBITDAGrowth1Y',
    'EBITDAGrowth2Y',
    // Net Debt
    'NetDebtCurrent',
    'NetDebtChange3M',
    'NetDebtChange6M',
    'NetDebtChange1Y',
    'NetDebtChange2Y',
    // Price Change
    'PriceChange1W',
    'PriceChange1M',
    'PriceChange3M',
    'PriceChange6M',
    'PriceChange1Y',
    // Valuation metrics
    'ValuationDCF_Upside',
    'ValuationLynch_Upside',
  ];

  return enabledMetrics.filter((metric) =>
    calculableMetricIds.includes(metric.id),
  );
}

/**
 * Get default metrics for API responses
 * This ensures APIs use the same metrics as jobs
 */
export function getDefaultMetricsForAPI() {
  const calculableMetrics = getCalculableMetrics();
  return calculableMetrics.map((metric) => metric.dbField);
}

/**
 * Get metrics configuration for jobs
 * This ensures jobs process the same metrics as APIs
 */
export function getMetricsConfigForJobs() {
  const calculableMetrics = getCalculableMetrics();
  const metricsMap = getMetricsMapByType();

  return {
    metrics: calculableMetrics,
    metricsMap,
    metricIds: calculableMetrics.map((m) => m.id),
    dbFields: calculableMetrics.map((m) => m.dbField),
    apiFields: calculableMetrics.map((m) => m.apiField),
  };
}

/**
 * Validate that requested metrics exist in enum
 * This ensures APIs only process valid metrics
 */
export function validateMetrics(metricIds) {
  const allMetrics = getMetrics();

  const isMetricMatch = (candidate, metric) =>
    metric.dbField === candidate ||
    metric.apiField === candidate ||
    metric.id === candidate ||
    metric.key === candidate;

  const validMetrics = metricIds.filter((candidate) =>
    allMetrics.some((metric) => isMetricMatch(candidate, metric)),
  );

  const invalidMetrics = metricIds.filter(
    (candidate) => !validMetrics.includes(candidate),
  );

  return {
    valid: validMetrics,
    invalid: invalidMetrics,
    isValid: invalidMetrics.length === 0,
  };
}

/**
 * Get metric display information for UI
 * This ensures UI shows consistent metric information
 */
export function getMetricDisplayInfo(metricIds) {
  const metricsMap = getMetricsMapByType();

  return metricIds.map((id) => {
    const metric = metricsMap[id];
    return {
      id: id,
      field: id,
      label: metric?.label || id,
      displayName: metric?.displayName || id,
      description: metric?.description || '',
      unit: metric?.unit || '',
      type: metric?.type || 'unknown',
    };
  });
}

/**
 * Get calculator mapping for jobs
 * This ensures jobs use the correct calculator functions
 */
export function getCalculatorMapping() {
  return {
    DividendYieldCurrent: 'DividendYieldCurrent',
    DividendGrowth3Y: 'DividendGrowth3Y',
    DividendGrowth5Y: 'DividendGrowth5Y',
    DividendGrowth10Y: 'DividendGrowth10Y',
  };
}

/**
 * Log metrics configuration for debugging
 * This helps verify that jobs and APIs are using the same metrics
 */
export function logMetricsConfiguration(context = '') {
  const config = getMetricsConfigForJobs();

  console.log(`📊 Metrics Configuration ${context}:`);
  console.log(`   Total calculable metrics: ${config.metrics.length}`);
  config.metrics.forEach((metric) => {
    console.log(`   - ${metric.displayName} (${metric.dbField})`);
  });

  return config;
}
