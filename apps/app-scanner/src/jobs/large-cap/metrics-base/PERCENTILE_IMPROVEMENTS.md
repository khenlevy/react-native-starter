# Percentile Calculation Improvements

## Current Issues Identified

1. **No Outlier Handling**: Extreme values (e.g., EBITDAGrowth1Y: 371% or -93%) skew percentiles
2. **No Minimum Sample Size**: Percentiles calculated with <5 companies aren't statistically meaningful
3. **Currency Metrics Not Normalized**: EBITDA and Net Debt compared directly across different currencies
4. **Growth Volatility Not Penalized**: Companies with volatile growth get same percentile as steady growers
5. **No Robust Percentile Method**: Uses simple dense ranking, sensitive to outliers

## Proposed Improvements

### 1. Outlier Detection & Capping (IQR Method)

**Impact**: Prevents extreme values from skewing percentiles

**Implementation**:

- Calculate Q1 (25th percentile) and Q3 (75th percentile)
- IQR = Q3 - Q1
- Cap values outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR] to boundaries
- Apply before percentile calculation

**Metrics Affected**: All growth metrics (EBITDAGrowth*, DividendGrowth*, PriceChange\*)

### 2. Minimum Sample Size Requirement

**Impact**: Only calculate percentiles when statistically meaningful

**Implementation**:

- Require minimum 5 companies for percentile calculation
- If <5 companies, return null percentiles with warning log
- Prevents misleading percentiles in small groups

### 3. Growth Consistency Adjustment

**Impact**: Reward steady growth over volatile growth

**Implementation**:

- For growth metrics, calculate volatility (std dev) from historical rates
- Apply penalty: `adjustedPercentile = percentile × (1 - volatilityPenalty)`
- Volatility penalty: `min(0.2, volatility / maxVolatility)` where maxVolatility = 0.5 (50%)
- Only apply if volatility > 0.2 (20%)

**Metrics Affected**: EBITDAGrowth*, DividendGrowth* (where volatility data available)

### 4. Robust Percentile Calculation (Trimmed Percentiles)

**Impact**: More stable percentiles resistant to outliers

**Implementation**:

- Use trimmed percentile method: exclude top/bottom 5% before calculation
- Fallback to standard method if sample size < 20
- Better for groups with known outliers

### 5. Data Quality Weighting (Optional)

**Impact**: Weight percentiles by data quality score

**Implementation**:

- For valuation metrics, weight percentile by `dataQualityScore` (0-1)
- `weightedPercentile = percentile × (0.5 + 0.5 × dataQualityScore)`
- Only apply if dataQualityScore < 0.8 (penalize lower quality)

**Metrics Affected**: Valuation metrics (valuationDCF.upsidePct, valuationLynch.upsidePct)

### 6. Log Transformation for Currency Metrics

**Impact**: Better comparison of currency values across different scales

**Implementation**:

- Apply log transformation: `logValue = Math.log(Math.abs(value) + 1) × sign(value)`
- Calculate percentiles on log-transformed values
- Revert to original scale for display

**Metrics Affected**: EBITDACurrent, NetDebtCurrent

## Priority Implementation Order

1. **High Priority** (Immediate Impact):

   - ✅ Minimum sample size requirement
   - ✅ Outlier detection & capping (IQR method)

2. **Medium Priority** (Quality Improvement):

   - ✅ Robust percentile calculation (trimmed method)
   - ✅ Growth consistency adjustment

3. **Low Priority** (Nice to Have):
   - ⚠️ Log transformation for currency metrics (test first)
   - ⚠️ Data quality weighting (may confuse users)

## Testing Strategy

1. Run percentile job on sample sectors/industries
2. Compare before/after percentile distributions
3. Verify outliers are capped appropriately
4. Ensure small groups (<5 companies) return null
5. Validate growth consistency penalty improves rankings
