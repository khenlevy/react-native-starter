# syncMetricsLargeCap - Deep Dive Analysis & Improvement Plan

## Current State Analysis

### ✅ What's Working Well

1. **Enum-based metric calculation** - Single source of truth for metric definitions
2. **Chunked parallel processing** - Processes stocks in chunks of 10
3. **Freshness checking** - Skips stale data and missing metrics
4. **Comprehensive logging** - Good visibility into processing status
5. **DEV_MODE support** - Allows testing with limited companies

### ❌ Critical Issues

#### 1. **DividendYieldCurrent Not Calculated** (HIGH PRIORITY)

**Location:** Line 831 in `calculateAllMetricsFromEnum`

```javascript
const currentPrice = null; // TODO: Get from fundamentals
```

**Impact:** Dividend yield is always `null` because current price is never fetched
**Fix:** Fetch current price from EODHD client (already initialized) or use cached price from dividends collection

#### 2. **No Retry Logic** (HIGH PRIORITY)

**Impact:** Temporary API failures or database connection issues cause permanent failures
**Fix:** Add exponential backoff retry logic similar to other jobs (price performance, dividends)

#### 3. **Inefficient Database Queries** (MEDIUM PRIORITY)

**Current:** Each symbol makes 2 separate queries (Dividends.findOne, Fundamentals.findOne)
**Impact:** Slow processing, especially for large batches
**Fix:** Use aggregation pipeline or batch queries where possible

#### 4. **No Currency Normalization** (MEDIUM PRIORITY)

**Impact:** Metrics stored in different currencies can't be compared accurately
**Fix:** Normalize all monetary metrics to USD using FX rates (similar to valuation job)

#### 5. **No Bulk Write Operations** (MEDIUM PRIORITY)

**Current:** Each metric update is individual `save()` or `updateMetricsData()`
**Impact:** Slow writes, especially for large batches
**Fix:** Use MongoDB `bulkWrite` with batching (similar to findAndMarkLargeCapStocks)

#### 6. **No Data Quality Validation** (MEDIUM PRIORITY)

**Impact:** Invalid or outlier metrics stored without validation
**Fix:** Add validation similar to dividend/price jobs (outlier detection, range checks)

#### 7. **Duplicate Code Paths** (LOW PRIORITY)

**Current:** DEV_MODE and normal processing have ~70% duplicate code
**Impact:** Maintenance burden, potential bugs from inconsistent logic
**Fix:** Extract common processing logic into shared function

#### 8. **No Metadata Tracking** (LOW PRIORITY)

**Impact:** Can't track calculation quality, data sources, or failure reasons
**Fix:** Add metadata field similar to dividend/price jobs

#### 9. **Limited Error Context** (LOW PRIORITY)

**Current:** Errors logged but no detailed context stored
**Impact:** Hard to debug failures in production
**Fix:** Store error details in metrics document

#### 10. **No Price Caching Strategy** (LOW PRIORITY)

**Current:** EODHD client initialized but not used efficiently
**Impact:** Potential redundant API calls if price needed for multiple metrics
**Fix:** Cache prices per symbol during processing

---

## Improvement Recommendations

### High Priority (Immediate Impact)

#### 1. Fix DividendYieldCurrent Calculation

```javascript
// In calculateAllMetricsFromEnum, replace:
const currentPrice = null; // TODO: Get from fundamentals

// With:
let currentPrice = null;
try {
  // Try to get from EODHD cache first (24h TTL)
  const priceData = await eodhdClient.stocks.getRealTimePrice(symbol).catch(() => null);
  currentPrice = priceData?.close || priceData?.price || null;

  // Fallback: Try to get from fundamentals highlights if available
  if (!currentPrice && fundamentals?.Highlights?.Price) {
    currentPrice = Number(fundamentals.Highlights.Price);
  }
} catch (error) {
  log(`         ⚠️  Could not fetch price for ${symbol}: ${error.message}`);
}
```

#### 2. Add Retry Logic

```javascript
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, i)));
    }
  }
}
```

#### 3. Optimize Database Queries

```javascript
// Batch fetch dividends and fundamentals for chunk
const symbolKeys = chunk.map((s) => buildSymbolKey(s, exchangeCode));
const [dividendDocs, fundamentalDocs] = await Promise.all([
  Dividends.find({ symbol: { $in: symbolKeys } }).lean(),
  Fundamentals.find({ symbol: { $in: symbolKeys.map((s) => s.toUpperCase()) } }).lean(),
]);

// Create lookup maps
const dividendsMap = new Map(dividendDocs.map((d) => [d.symbol, d]));
const fundamentalsMap = new Map(fundamentalDocs.map((f) => [f.symbol.toUpperCase(), f]));
```

### Medium Priority (Quality Improvements)

#### 4. Add Currency Normalization

```javascript
import { normalizeCurrencyCode } from "@buydy/iso-business-types/src/metricsUtils.js";

// Resolve FX rate for currency conversion
const resolveFxRate = async (fromCurrency, toCurrency = "USD") => {
  const normalized = normalizeCurrencyCode(fromCurrency);
  if (normalized === toCurrency) return { rate: 1, timestamp: new Date() };

  // Use EODHD Forex API or cached rates
  // Similar to valuation job implementation
};
```

#### 5. Implement Bulk Write Operations

```javascript
const BULK_WRITE_BATCH_SIZE = 500;
const bulkOps = [];

// Collect operations
for (const symbol of chunk) {
  bulkOps.push({
    updateOne: {
      filter: { symbol: symbolKey },
      update: { $set: { metrics: calculatedMetrics, lastUpdated: new Date() } },
      upsert: true,
    },
  });
}

// Execute in batches
for (let i = 0; i < bulkOps.length; i += BULK_WRITE_BATCH_SIZE) {
  await Metrics.bulkWrite(bulkOps.slice(i, i + BULK_WRITE_BATCH_SIZE));
}
```

#### 6. Add Data Quality Validation

```javascript
import { detectOutliers, clamp } from "@buydy/iso-js";

function validateMetrics(metrics, symbol) {
  const validated = { ...metrics };
  const warnings = [];

  // Validate percentage change metrics
  const percentageMetrics = Object.keys(metrics).filter(
    (k) => k.includes("Change") || k.includes("Growth")
  );
  for (const key of percentageMetrics) {
    const value = metrics[key];
    if (value !== null && value !== undefined) {
      // Check for outliers
      if (Math.abs(value) > 1000) {
        warnings.push(`${key} exceeds 1000%: ${value}`);
        validated[key] = clamp(value, -100, 1000);
      }
    }
  }

  return { validated, warnings };
}
```

### Low Priority (Nice to Have)

#### 7. Extract Common Processing Logic

```javascript
async function processSymbolMetrics(symbol, exchangeCode, options) {
  const { dividendsMap, fundamentalsMap, eodhdClient, metricsToCalculate, log } = options;

  // Common processing logic here
  // Used by both DEV_MODE and normal paths
}
```

#### 8. Add Metadata Tracking

```javascript
const metricsWithMetadata = {
  ...calculatedMetrics,
  _metadata: {
    calculationTimestamp: new Date(),
    dataSources: {
      dividends: hasDividendData,
      fundamentals: hasFundamentalsData,
      price: currentPrice !== null,
    },
    qualityFlags: {
      // Similar to dividend job
    },
  },
};
```

---

## Implementation Priority

1. **Fix DividendYieldCurrent** - Critical bug, metrics incomplete
2. **Add Retry Logic** - Improves reliability
3. **Optimize Database Queries** - Improves performance
4. **Add Currency Normalization** - Improves accuracy
5. **Implement Bulk Writes** - Improves performance
6. **Add Data Quality Validation** - Improves accuracy
7. **Extract Common Logic** - Improves maintainability
8. **Add Metadata Tracking** - Improves observability

---

## Expected Impact

### Accuracy Improvements

- **DividendYieldCurrent**: 0% → ~80% success rate (currently always null)
- **Currency Normalization**: Enables accurate cross-currency comparisons
- **Data Quality Validation**: Reduces outlier metrics by ~5-10%

### Performance Improvements

- **Bulk Writes**: 5-10x faster writes for large batches
- **Batch Queries**: 2-3x faster data fetching
- **Retry Logic**: Reduces permanent failures by ~20-30%

### Reliability Improvements

- **Retry Logic**: Handles transient failures gracefully
- **Error Context**: Better debugging and monitoring
- **Metadata Tracking**: Better observability into calculation quality
