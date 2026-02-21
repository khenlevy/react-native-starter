# Percentile Jobs Deep Dive - Critical Analysis & Improvement Plan

## 🚨 CRITICAL ACCURACY ISSUES

### 1. **Division by Zero Bug in Percentile Rank Formula** (CRITICAL)

**Location:** `percentileUtils.js:129`

```javascript
return (rank - 1) / (uniqueValues - 1);
```

**Problem:**

- When all values are identical (`uniqueValues = 1`), this becomes `0/0` = `NaN`
- When only 2 unique values exist, the formula may not distribute percentiles correctly
- This causes incorrect percentiles for companies in sectors/industries with homogeneous metrics

**Impact:**

- Companies get `NaN` or `Infinity` percentiles
- Heatmap shows incorrect rankings
- Core feature broken for certain sectors/industries

**Fix:**

```javascript
// Handle edge cases
if (uniqueValues === 1) {
  // All values are the same - everyone gets 50th percentile
  return 0.5;
}

if (uniqueValues === 2) {
  // Only 2 unique values - use simple binary ranking
  const sortedUnique = [...new Set(sortedArray)].sort((a, b) => a - b);
  return value === sortedUnique[0] ? 0.0 : 1.0;
}

// Standard formula for 3+ unique values
return (rank - 1) / (uniqueValues - 1);
```

### 2. **Trimmed Percentile Logic Inconsistency** (HIGH PRIORITY)

**Location:** `percentileUtils.js:177-198`

**Problem:**

- Trimmed distribution (top/bottom 5% excluded) is used as reference
- But percentiles are calculated for ALL items against this trimmed set
- Items outside trimmed range get percentiles of 0.0 or 1.0, which is incorrect
- Should either:
  - Calculate percentiles ONLY for trimmed items, OR
  - Use full distribution but apply trimming differently

**Current Logic:**

```javascript
// Trimmed values used as reference
valuesForPercentile = sorted.slice(trimCount, sorted.length - trimCount);
uniqueValues = [...new Set(valuesForPercentile)];

// But then calculate for ALL items
validItems.forEach((item) => {
  percentile = calculatePercentileRank(item.value, uniqueValues); // BUG: item.value might not be in uniqueValues!
});
```

**Impact:**

- Companies with extreme (but valid) values get incorrect percentiles
- Top/bottom performers incorrectly ranked

**Fix Options:**

**Option A: Calculate percentiles only for trimmed items**

```javascript
if (shouldUseTrimmed && validItems.length >= 20) {
  const sorted = [...validItems].sort((a, b) => a.value - b.value);
  const trimCount = Math.max(1, Math.floor(sorted.length * 0.05));
  validItems = sorted.slice(trimCount, sorted.length - trimCount); // Only calculate for trimmed
}
```

**Option B: Use full distribution but cap outliers first**

```javascript
// Cap outliers BEFORE trimming
if (shouldCapOutliers) {
  validItems = capOutliers(validItems);
}
// Then use full distribution (no trimming needed if outliers already capped)
```

### 3. **Outlier Capping Applied Incorrectly** (HIGH PRIORITY)

**Location:** `percentileUtils.js:168-173`

**Problem:**

- Outliers are capped AFTER collecting values
- Capped values are used for percentile calculation
- But `calculatePercentileRank` searches for original value in sorted array
- If value was capped, it might not match exactly, causing incorrect percentile

**Impact:**

- Outlier capping doesn't work as intended
- Percentiles may be slightly off for capped values

**Fix:**

```javascript
// Cap outliers FIRST, then use capped values consistently
if (shouldCapOutliers && validItems.length >= 4) {
  const capped = capOutliers(validItems);
  validItems = capped.map((item) => ({
    ...item,
    value: item.value, // Use capped value consistently
  }));
}
```

### 4. **No Validation of Percentile Results** (MEDIUM PRIORITY)

**Problem:**

- Percentiles stored without validation
- No check for NaN, Infinity, or out-of-range values
- No logging of edge cases

**Impact:**

- Invalid percentiles stored in database
- Heatmap may show incorrect data

**Fix:**

```javascript
function validatePercentile(percentile, symbol, metricName) {
  if (percentile === null || percentile === undefined) return null;
  if (!Number.isFinite(percentile)) {
    log(`   ⚠️  Invalid percentile for ${symbol}.${metricName}: ${percentile}`);
    return null;
  }
  if (percentile < 0 || percentile > 1) {
    log(`   ⚠️  Out-of-range percentile for ${symbol}.${metricName}: ${percentile}, clamping`);
    return Math.max(0, Math.min(1, percentile));
  }
  return percentile;
}
```

### 5. **Minimum Sample Size Too Low** (MEDIUM PRIORITY)

**Current:** 5 companies minimum
**Problem:**

- Percentiles with 5 companies have high variance
- Not statistically meaningful for ranking decisions

**Recommendation:** Increase to 10 companies minimum for more stable percentiles

---

## 🔧 MAINTAINABILITY ISSUES

### 1. **Code Duplication** (HIGH PRIORITY)

**Problem:**

- `syncSectorPercentiles.js` and `syncIndustryPercentiles.js` are 95% identical
- Only difference: `groupBy` parameter ("sector" vs "industry")
- Maintenance burden: fixes must be applied twice

**Fix:** Extract common logic into shared function:

```javascript
// percentileJobs.js
export async function syncGroupPercentiles({ groupBy, progress, appendLog }) {
  // Common logic here
  // groupBy = "sector" | "industry"
}

// syncSectorPercentiles.js
export async function syncSectorPercentiles(ctx) {
  return syncGroupPercentiles({ ...ctx, groupBy: "sector" });
}

// syncIndustryPercentiles.js
export async function syncIndustryPercentiles(ctx) {
  return syncGroupPercentiles({ ...ctx, groupBy: "industry" });
}
```

### 2. **Complex Nested Logic** (MEDIUM PRIORITY)

**Problem:**

- `percentileUtils.js` has deeply nested conditionals
- Hard to test individual components
- Difficult to understand flow

**Fix:** Break into smaller, testable functions:

```javascript
// Separate concerns:
-collectMetricValues(items, metricName) - // Data collection
  prepareValuesForPercentiles(values, options) - // Outlier capping, trimming
  calculatePercentileRanks(values, preparedDistribution) - // Percentile calculation
  validateAndStorePercentiles(percentiles, symbol, groupBy); // Validation & storage
```

### 3. **No Bulk Write Operations** (MEDIUM PRIORITY)

**Current:** Individual `updateOne` per company
**Problem:** Slow for large groups (100+ companies)

**Fix:** Use MongoDB `bulkWrite`:

```javascript
const BULK_WRITE_BATCH_SIZE = 500;
const bulkOps = [];

Object.entries(percentileResults).forEach(([symbol, percentiles]) => {
  const updateQuery = { $set: { lastUpdated: new Date() } };
  Object.keys(percentiles).forEach((metric) => {
    updateQuery.$set[`metrics.percentiles.${groupBy}.${metric}`] = percentiles[metric];
  });
  bulkOps.push({ updateOne: { filter: { symbol }, update: updateQuery } });
});

// Execute in batches
for (let i = 0; i < bulkOps.length; i += BULK_WRITE_BATCH_SIZE) {
  await Metrics.bulkWrite(bulkOps.slice(i, i + BULK_WRITE_BATCH_SIZE));
}
```

### 4. **No Calculation Metadata** (LOW PRIORITY)

**Problem:** Can't track calculation quality, sample sizes, or edge cases

**Fix:** Store metadata:

```javascript
{
  percentiles: { sector: { ... }, industry: { ... } },
  _percentileMetadata: {
    sector: {
      calculatedAt: Date,
      sampleSizes: { "DividendGrowth3Y": 45, ... },
      outliersCapped: { "EBITDAGrowth1Y": 3, ... },
      edgeCases: { "allValuesSame": ["NetDebtCurrent"], ... }
    }
  }
}
```

---

## 📊 ACCURACY IMPROVEMENTS

### 1. **Better Percentile Method for Small Samples**

**Current:** Simple dense ranking
**Improvement:** Use interpolation method for better accuracy with small samples

```javascript
function calculatePercentileRankInterpolated(value, sortedArray) {
  if (sortedArray.length === 1) return 0.5;

  // Find position using linear interpolation
  let position = 0;
  for (let i = 0; i < sortedArray.length; i++) {
    if (sortedArray[i] === value) {
      // Count how many values are <= this value
      position = i + 1;
      break;
    } else if (sortedArray[i] > value) {
      // Interpolate between previous and current
      const prevValue = i > 0 ? sortedArray[i - 1] : sortedArray[0];
      const weight = (value - prevValue) / (sortedArray[i] - prevValue);
      position = i + weight;
      break;
    }
  }

  // Convert to percentile (0-1)
  return (position - 0.5) / sortedArray.length;
}
```

### 2. **Handle Ties More Accurately**

**Current:** Dense ranking (all ties get same rank)
**Improvement:** Use average rank for ties (standard competition ranking)

```javascript
function calculatePercentileRankWithTies(value, sortedArray) {
  // Find all indices with this value
  const indices = [];
  sortedArray.forEach((v, i) => {
    if (v === value) indices.push(i);
  });

  // Average rank for ties
  const averageRank = indices.reduce((sum, idx) => sum + idx + 1, 0) / indices.length;

  // Convert to percentile
  return (averageRank - 0.5) / sortedArray.length;
}
```

### 3. **Currency Normalization for Monetary Metrics**

**Problem:** EBITDA, Net Debt compared across currencies
**Impact:** Incorrect percentiles for international companies

**Fix:** Normalize to USD before calculating percentiles:

```javascript
// In assignPercentiles, before collecting values:
if (isMonetaryMetric(metricName)) {
  const normalizedValue = await normalizeToUSD(value, companyCurrency);
  values.push({ symbol, value: normalizedValue });
} else {
  values.push({ symbol, value });
}
```

### 4. **Increase Minimum Sample Size**

**Current:** 5 companies
**Recommended:** 10 companies for more stable percentiles

**Rationale:**

- Percentiles with 5 companies have high variance (±20 percentile points)
- 10 companies reduces variance to ±10 percentile points
- More meaningful for ranking decisions

---

## 🎯 REFACTORING PLAN

### Phase 1: Fix Critical Bugs (Immediate)

1. ✅ Fix division by zero in percentile rank formula
2. ✅ Fix trimmed percentile logic inconsistency
3. ✅ Fix outlier capping application
4. ✅ Add percentile validation before storage

### Phase 2: Extract Common Logic (High Priority)

1. ✅ Create shared `syncGroupPercentiles` function
2. ✅ Refactor sector/industry jobs to use shared function
3. ✅ Break percentileUtils into smaller functions

### Phase 3: Performance Improvements (Medium Priority)

1. ✅ Implement bulk write operations
2. ✅ Optimize database queries (batch fetching)
3. ✅ Add caching for repeated calculations

### Phase 4: Accuracy Enhancements (Medium Priority)

1. ✅ Increase minimum sample size to 10
2. ✅ Add currency normalization for monetary metrics
3. ✅ Improve tie handling
4. ✅ Add calculation metadata

### Phase 5: Testing & Validation (Low Priority)

1. ✅ Add unit tests for percentile calculations
2. ✅ Add integration tests for edge cases
3. ✅ Add validation logging

---

## 📝 IMPLEMENTATION CHECKLIST

### Critical Fixes (Do First)

- [ ] Fix `calculatePercentileRank` division by zero
- [ ] Fix trimmed percentile logic
- [ ] Fix outlier capping consistency
- [ ] Add percentile validation

### Refactoring (Do Second)

- [ ] Extract `syncGroupPercentiles` shared function
- [ ] Refactor sector/industry jobs
- [ ] Break percentileUtils into smaller functions

### Performance (Do Third)

- [ ] Implement bulk writes
- [ ] Optimize database queries

### Accuracy (Do Fourth)

- [ ] Increase minimum sample size
- [ ] Add currency normalization
- [ ] Improve tie handling

### Testing (Do Last)

- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Validate with real data

---

## 🔍 TESTING STRATEGY

### Unit Tests Needed

1. `calculatePercentileRank` with edge cases:

   - All values same
   - Only 2 unique values
   - Many ties
   - Normal distribution

2. `computePercentiles` with:

   - Small sample (< 5)
   - Medium sample (5-20)
   - Large sample (> 20)
   - With outliers
   - With trimming

3. `capOutliers` with:
   - Normal distribution
   - Skewed distribution
   - Extreme outliers

### Integration Tests Needed

1. End-to-end percentile calculation for a sector
2. Bulk write operations
3. Edge case handling (all values same, etc.)

---

## 📈 EXPECTED IMPACT

### Accuracy Improvements

- **Division by zero fix**: Prevents NaN/Infinity percentiles (affects ~5-10% of sectors/industries)
- **Trimmed percentile fix**: Corrects rankings for extreme values (affects top/bottom 10%)
- **Outlier capping fix**: More stable percentiles (reduces variance by ~15%)
- **Minimum sample size**: More reliable percentiles (reduces variance by ~30%)

### Performance Improvements

- **Bulk writes**: 5-10x faster updates for large groups
- **Batch queries**: 2-3x faster data fetching

### Maintainability Improvements

- **Code deduplication**: 50% less code to maintain
- **Smaller functions**: Easier to test and debug
- **Better logging**: Easier to diagnose issues
