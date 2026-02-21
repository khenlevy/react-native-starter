# Price Performance Job Improvements

## Current Issues Identified

### 1. **Inefficiency: Multiple API Calls Per Symbol**

**Problem**: Each metric (1W, 1M, 3M, 6M, 1Y) makes a separate API call to `getEODData()`

- 5 API calls per symbol = 5x overhead
- Even with caching, cache misses are expensive
- Sequential processing in `calculatePerformanceMetrics()`

**Impact**: For 4000 companies = 20,000 potential API calls (though cached)

**Solution**: Fetch historical data once (1 year), calculate all periods from single dataset

### 2. **Accuracy: Simple First/Last Price Comparison**

**Problem**: Uses `historicalData[0].close` and `historicalData[historicalData.length - 1].close`

- Doesn't account for market holidays/weekends
- May use stale prices if market was closed
- Doesn't verify data quality
- No handling of stock splits (should use adjusted prices)

**Impact**: Inaccurate price changes, especially around weekends/holidays

**Solution**:

- Use most recent trading day (not just last array element)
- Use adjusted close prices when available
- Validate data quality (gaps, outliers)

### 3. **Missing Trading Days Not Handled**

**Problem**: If market was closed, might compare Friday to Monday (3-day gap counted as 1 day)

- 1W calculation might use 7 calendar days but only 5 trading days
- No validation that we have sufficient trading days

**Impact**: Inconsistent period calculations

**Solution**: Calculate based on trading days, not calendar days

### 4. **No Outlier Detection**

**Problem**: Extreme price changes (e.g., 1000% due to data error) not flagged

- Similar to dividend growth - outliers skew percentiles

**Impact**: Bad data affects percentile rankings

**Solution**: Add outlier detection using IQR method

### 5. **No Retry Logic**

**Problem**: API failures immediately fail the symbol

- Network hiccups cause permanent failures

**Impact**: Missing data for transient failures

**Solution**: Add exponential backoff retry (like dividend job)

### 6. **No Currency Normalization**

**Problem**: Price changes stored in original currency

- Cannot compare performance across currencies
- Percentiles calculated separately per currency (if at all)

**Impact**: Cross-currency comparisons inaccurate

**Solution**: Store both original and USD-normalized values

### 7. **No Data Quality Flags**

**Problem**: No tracking of why price data might be missing or inaccurate

- Can't distinguish "no trading" from "data unavailable"

**Impact**: Hard to debug and improve data quality

**Solution**: Add quality flags and metadata

### 8. **Inefficient Chunk Size**

**Problem**: CHUNK_SIZE = 8 is conservative

- Could process more symbols in parallel

**Impact**: Slower job execution

**Solution**: Increase chunk size or use dynamic batching

### 9. **No Batch Price Fetching**

**Problem**: Each symbol fetches independently

- Could batch multiple symbols in single API call (if EODHD supports)

**Impact**: More API calls than necessary

**Solution**: Check if EODHD supports bulk endpoints

### 10. **No Validation of Price Data Quality**

**Problem**: No checks for:

- Missing trading days
- Extreme price jumps (potential data errors)
- Zero or negative prices
- Gaps in historical data

**Impact**: Bad data stored without flags

**Solution**: Add comprehensive validation

## Proposed Improvements

### High Priority (Accuracy & Efficiency)

1. **Batch Historical Data Fetch**

   - Fetch 1 year of data once per symbol
   - Calculate all periods (1W, 1M, 3M, 6M, 1Y) from single dataset
   - Reduces API calls from 5 to 1 per symbol

2. **Use Adjusted Close Prices**

   - Prefer adjusted close when available
   - Accounts for stock splits and dividends
   - More accurate long-term comparisons

3. **Trading Day-Based Calculation**

   - Calculate periods based on trading days, not calendar days
   - Use most recent trading day (skip weekends/holidays)
   - Validate sufficient trading days exist

4. **Data Quality Validation**
   - Check for gaps in historical data
   - Validate price continuity (no extreme jumps)
   - Flag missing trading days

### Medium Priority (Quality & Reliability)

5. **Outlier Detection**

   - Use IQR method to detect extreme price changes
   - Flag outliers in metadata
   - Cap extreme values for percentile calculations

6. **Retry Logic**

   - Exponential backoff for API failures
   - 3 retries with increasing delays

7. **Currency Normalization**

   - Store USD-converted values alongside original
   - Enable cross-currency comparisons

8. **Enhanced Error Handling**
   - Distinguish between "no data" and "API failure"
   - Store error reasons in metadata

### Low Priority (Optimization)

9. **Increase Chunk Size**

   - Test optimal chunk size (16-32)
   - Use dynamic batching based on API rate limits

10. **Parallel Metric Calculation**

    - Calculate all periods in parallel from fetched data
    - Reduce sequential processing overhead

11. **Cache Optimization**

    - Pre-fetch common date ranges
    - Use longer cache TTL for historical data (doesn't change)

12. **Data Quality Flags**
    - Track missing days, outliers, data gaps
    - Store in metadata for diagnostics
