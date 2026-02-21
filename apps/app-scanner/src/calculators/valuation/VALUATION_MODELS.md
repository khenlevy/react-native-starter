## Valuation Model Cheat Sheet

This note summarizes the two core valuation calculators so we can quickly explain or debug their outputs.

**CONSERVATIVE BIAS**: Both models are intentionally conservative to identify truly excellent companies from mass screening. Defaults assume lower growth, higher reinvestment needs, and stricter quality thresholds.

### Discounted Cash Flow (DCF)

- **Primary inputs**
  - `deriveMetrics` for revenue CAGR, EBITDA/operating margins, ROIC proxy, sales-to-capital, net debt, and reinvestment diagnostics.
  - Latest price (real-time → EOD → fundamentals fallback) and diluted shares.
  - Company context: currency, country, market cap, beta highlights.
- **Key math updates**
  - **Reinvestment includes working capital changes**: `reinvestment = capex - depreciation + ΔworkingCapital` (not just capex-depreciation).
  - Growth path fades from TTM revenue using geometric means; growth reduced by 20% to account for uncertainty.
  - **Volatility penalty**: Revenue growth reduced by up to 30% if std dev > 20%.
  - Discounting pre-computes `(1 + WACC)^(-t)` factors and uses `Math.fma` when available to limit float drift.
  - WACC assembled dynamically: `risk-free + beta × ERP + size premium + country risk − cash yield`; tax rate floored by jurisdiction.
  - Terminal value applies conservative jurisdictional growth (emerging markets: 2.5% max, developed: 2%).
- **Conservative defaults & thresholds**
  - `salesToCapital` default: **2.5** (was 4) when ratios can't be computed; max capped at **8** (was 10).
  - Revenue CAGR default: **5%** (was 10%); max capped at **25%** (was 30%).
  - Operating margin default: **10%** (was 15%); max capped at **30%** (was 35%).
  - Tax rate default: **25%** (was 20%); minimum floor **15%** (was 10%).
  - Quality threshold: requires **≥7%** operating margin (was 5%).
- **Quality & metadata**
  - `reasonCode`: `NEG_FCF`, `VOLATILE_GROWTH`, `MISSING_DATA`, etc.
  - `reasonInputs` capture offending ratios (e.g., margin, sales-to-capital, reinvestment deviation).
  - Continuity checks enforce `FCF_t+1 / FCF_t ∈ [0.5, 2]`; reinvestment flagged when projected needs exceed NOPAT or deviation > 25% (was 30%).

### Peter Lynch Fair Value

- **Primary inputs**
  - EPS history rebuilt from fundamentals (EPS keys → net income / shares fallback) with geometric CAGR and growth volatility.
  - Hybrid growth = 70% EPS CAGR + 30% revenue CAGR when EPS series is sparse; PEG-derived growth only if `PEG ≤ 3`.
  - Latest EPS TTM (fundamentals or highlights) and market price.
- **Key math updates**
  - Safe division across EPS/net income, PE, and growth factors prevents negative skew.
  - **Volatility penalty**: EPS growth reduced by up to 20% if std dev > 20%.
  - Fair PE = `clamp(growth × 100 + baseline, 8, 40)` blended 50/50 with current PE when available; baseline **8** (was 5), max **40** (was 50).
  - Negative EPS forces `fairValue = 0`, `upside = -1`, and emits `NEG_EPS`.
- **Conservative defaults & thresholds**
  - Fair PE default: **12** (was 15).
  - Volatility threshold for LOW: **>35%** (was 40%).
  - HIGH quality requires volatility **≤15%** (was 20%).
- **Quality & metadata**
  - Reason codes mirror DCF where possible (`NEG_EPS`, `VOLATILE_GROWTH`, `MISSING_DATA`).
  - Volatility ≤ 35% softens quality to `MEDIUM`; strong, stable EPS (volatility ≤ 15%) earns `HIGH`.

### Cross-cutting Metadata

- Both calculators feed `buildValuationPayload`, storing:
  - `currency`, `sourceCurrency`, FX rate/timestamp, share source, price source.
  - DCF-specific `wacc`, `terminalGrowth`, sensitivity matrix; Lynch-specific `peFair`.
  - `reasonCode`, `reasonText`, `reasonInputs`, and timestamp for downstream analytics.

**Design Philosophy**: When in doubt, assume worse performance. This ensures only truly excellent companies pass quality filters and show positive upside in mass screening scenarios.

### Data Quality & Certainty Requirements

**CRITICAL**: Valuation metrics are only set when we're CERTAIN about the calculation. Companies with uncertain metrics are excluded from percentile rankings.

- **Data Quality Threshold**: Requires ≥70% data quality score (max 2 defaults out of 6 indicators)
- **Quality Flag**: Only `HIGH`, `MEDIUM`, or `LOW` quality metrics are included in percentiles
- **N/A Quality**: Metrics with `quality: "N/A"` have `upsidePct: null` and are excluded from percentile calculations
- **Percentile Range**: Percentiles are calculated ONLY from companies with certain metrics - this ensures the percentile range represents reliable comparisons

**Example**: If 100 companies are in a sector but only 60 have certain valuation metrics, percentiles are calculated from those 60 companies only. The other 40 companies won't have percentile ranks for valuation metrics.

Use this sheet as the quick reference for analysts or when instrumenting new diagnostics.
