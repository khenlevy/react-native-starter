# Find and Mark Large Cap Stocks Job Improvements

## Current Issues Identified

### 1. **Inefficiency: Sequential Processing**

**Problem**: `MAX_CONCURRENT_EXCHANGES = 1` processes exchanges one at a time

- For 100+ exchanges, this is very slow
- No parallelization despite independent exchanges

**Impact**: Job takes unnecessarily long

**Solution**: Increase concurrency (with memory management)

### 2. **Inefficiency: Aggregation Pipeline Performance**

**Problem**: Uses `$lookup` with regex matching for each exchange

- Regex matching on every fundamentals document is slow
- No index optimization for symbol matching
- Fetches all fundamentals even if not needed

**Impact**: Slow queries, especially for large exchanges

**Solution**:

- Use indexed queries instead of regex
- Filter fundamentals by exchange code prefix
- Add projection to reduce data transfer

### 3. **Accuracy: No Currency Normalization**

**Problem**: Market cap from EODHD might be in different currencies

- USD, EUR, GBP, JPY, etc. all compared to $1B threshold
- No FX conversion to normalize to USD

**Impact**: Incorrect classification (e.g., €800M EUR company marked as large cap)

**Solution**: Normalize market cap to USD using FX rates

### 4. **Accuracy: No Data Quality Validation**

**Problem**: No validation of:

- Market cap reasonableness (not negative, not zero, not extreme outliers)
- Fundamentals data freshness
- Missing or invalid market cap values

**Impact**: Bad data causes incorrect classifications

**Solution**: Add comprehensive validation

### 5. **Inefficiency: No Bulk Operation Batching**

**Problem**: All bulk operations executed at once

- For exchanges with 1000+ large cap stocks, single bulkWrite can be slow
- No batching limit

**Impact**: Slow updates, potential memory issues

**Solution**: Batch bulk operations (e.g., 500 at a time)

### 6. **Inefficiency: Processing All Symbols**

**Problem**: Iterates through all symbols even if they don't have fundamentals

- Checks every symbol in exchange_symbols
- Only filters after lookup

**Impact**: Unnecessary iterations

**Solution**: Pre-filter symbols that have fundamentals

### 7. **Missing: Retry Logic**

**Problem**: No retry for failed exchanges

- Network hiccups cause permanent failures

**Impact**: Missing data for transient failures

**Solution**: Add exponential backoff retry

### 8. **Missing: Progress Tracking**

**Problem**: Progress only tracks exchanges, not individual symbols

- No visibility into symbol-level progress

**Impact**: Hard to estimate remaining time

**Solution**: Add symbol-level progress tracking

### 9. **Accuracy: No Handling of Stale Fundamentals**

**Problem**: Uses fundamentals data without checking freshness

- Old fundamentals might have outdated market cap

**Impact**: Incorrect market cap values

**Solution**: Check fundamentals `fetchedAt` date

### 10. **Inefficiency: No Early Exit**

**Problem**: Processes entire exchange even if no symbols found

- Continues aggregation even when result is empty

**Impact**: Wasted processing time

**Solution**: Early exit if no symbols

## Proposed Improvements

### High Priority (Accuracy & Efficiency)

1. **Currency Normalization**

   - Detect currency from fundamentals or exchange
   - Convert market cap to USD using FX rates
   - Store both original and USD values

2. **Optimize Aggregation Pipeline**

   - Use indexed queries instead of regex
   - Filter fundamentals by exchange prefix (e.g., `AAPL.US` for US exchange)
   - Add projection to reduce data transfer
   - Check fundamentals freshness

3. **Increase Concurrency**

   - Process 3-5 exchanges in parallel (with memory management)
   - Use Promise.allSettled for error isolation

4. **Batch Bulk Operations**

   - Process bulk writes in batches of 500
   - Prevents memory issues and improves performance

5. **Data Quality Validation**
   - Validate market cap is positive and reasonable
   - Check fundamentals freshness
   - Flag outliers

### Medium Priority (Reliability & Performance)

6. **Retry Logic**

   - Exponential backoff for failed exchanges
   - 3 retries with increasing delays

7. **Pre-filter Symbols**

   - Only process symbols that have fundamentals
   - Use aggregation to filter early

8. **Enhanced Progress Tracking**

   - Track symbol-level progress
   - Better estimates for remaining time

9. **Early Exit Optimization**
   - Skip exchanges with no symbols
   - Skip exchanges with no fundamentals

### Low Priority (Nice to Have)

10. **Caching**

    - Cache FX rates per exchange
    - Cache exchange metadata

11. **Statistics**

    - Track market cap distribution
    - Track currency breakdown
    - Track data quality metrics

12. **Logging Improvements**
    - More detailed logging for debugging
    - Performance metrics per exchange
