import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { getMetricsConfigForJobs } from '@buydy/iso-business-types';
import { ensureConnected, closeDatabase, getModel } from '@buydy/se-db';
import { loadEnvironmentVariables } from '../../src/config/envLoader.js';

const companiesUnderTest = [
  '5016.TWO',
  '0098.KLSE',
  'HH.CO',
  '000698.SHE',
  'BODALCHEM.NSE',
  '000815.SHE',
  'APL.PSE',
  'MFRISCOA-1.MX',
  'FLMC.JK',
  'ULVR.VI',
  'EVER.RO',
  '1A9.F',
  'BCI.AU',
  'BRE.AU',
  'UPM.PSE',
  // 'SDL.JSE', // EODHD missing data (known upstream integrity issue)
  'LAC.US',
  'TKO.TO',
  'ARVEE.NSE',
  '3508.TWO',
  'PHN.PSE',
  'APCL.NSE',
  '2017.TW',
  '600076.SHG',
  '5009.TWO',
  '188H.F',
  '1104.TW',
  '3565.KLSE',
  'AZAD.NSE',
  'ATS.TO',
  'AETHER.NSE',
  'CADLR.OL',
  'A1UT34.SA',
  'MDA.TO',
  // Companies with missing debt metrics (from heatmap analysis)
  'STI.PSE',
  '0DJV.IL',
  'BVCL.NSE',
  'FEU.PSE',
  // Additional companies to verify metrics completeness
  'WCH.HN',
  '600423.SHG',
  'AAUC.TO',
  'VITROA.MX',
  '0R7.F',
  'KNT.V',
  'CHE.UN.TO',
  'SZG.HN',
  // Additional companies to verify metrics completeness
  '2OY.XETRA',
  '1COV.HN',
  '1COV.HA',
  '1COV.DU',
  '1COV.BE',
  'ATM.AU',
  'AUY.US',
];

const { metrics: calculableMetrics } = getMetricsConfigForJobs();
const metricIds = calculableMetrics.map((metric) => metric.dbField);
const metricMetaById = new Map(calculableMetrics.map((metric) => [metric.dbField, metric]));

const Metrics = getModel('metrics');
const Dividends = getModel('dividends');

const metricsCache = new Map();
const executedMetrics = new Set();
let connectionEstablished = false;
const dividendsCache = new Map();

function getMetricValue(source, path) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  if (!path.includes('.')) {
    return source[path];
  }

  return path.split('.').reduce((acc, segment) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }
    return acc[segment];
  }, source);
}

async function loadMetricsForSymbol(symbol) {
  if (!metricsCache.has(symbol)) {
    const doc = await Metrics.findOne({ symbol }).lean().exec();
    metricsCache.set(symbol, doc || null);
  }

  return metricsCache.get(symbol);
}

async function loadDividendsForSymbol(symbol) {
  if (!dividendsCache.has(symbol)) {
    const doc = await Dividends.findOne({ symbol }).lean().exec();
    dividendsCache.set(symbol, doc || null);
  }

  return dividendsCache.get(symbol);
}

beforeAll(async () => {
  process.env.NODE_ENV = 'development';
  loadEnvironmentVariables();
  await ensureConnected();
  connectionEstablished = true;
}, 120000);

afterAll(async () => {
  if (connectionEstablished) {
    await closeDatabase();
    expect(executedMetrics.size).toBe(metricIds.length);
  }
}, 60000);

describe('Metrics completeness by company', () => {
  companiesUnderTest.forEach((symbol) => {
    describe(symbol, () => {
      metricIds.forEach((metricId) => {
        test(`${metricId} is present`, async () => {
          executedMetrics.add(metricId);

          const metricsDocument = await loadMetricsForSymbol(symbol);

          expect(metricsDocument, `Metrics document not found for ${symbol}`).toBeTruthy();

          const metricMeta = metricMetaById.get(metricId);

          if (
            metricMeta?.category === 'valuation' &&
            metricId !== 'valuationDCF.upsidePct' &&
            metricId !== 'valuationLynch.upsidePct'
          ) {
            return;
          }
          if (metricMeta?.category === 'dividend') {
            const dividendsDocument = await loadDividendsForSymbol(symbol);
            const hasDividendHistory =
              Array.isArray(dividendsDocument?.history) && dividendsDocument.history.length > 0;
            if (!hasDividendHistory) {
              return;
            }
          }

          const rawValue = getMetricValue(metricsDocument.metrics, metricId);
          expect(
            rawValue,
            `Raw value for ${metricId} is missing for ${symbol}`,
          ).not.toBeNull();

          const sectorPercentile = getMetricValue(
            metricsDocument.metrics?.percentiles?.sector,
            metricId,
          );
          const industryPercentile = getMetricValue(
            metricsDocument.metrics?.percentiles?.industry,
            metricId,
          );

          expect(
            sectorPercentile ?? industryPercentile,
            `Percentile for ${metricId} is missing for ${symbol}`,
          ).not.toBeNull();
        });
      });
    });
  });
});


