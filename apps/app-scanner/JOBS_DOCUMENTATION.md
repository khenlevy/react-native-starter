# Jobs Structure Documentation - app-stocks-scanner

## Overview

The `app-stocks-scanner` application uses a structured job system for processing stock market data. Jobs are organized hierarchically and follow consistent patterns for execution, error handling, and data processing.

## Directory Structure

```
src/jobs/
├── makeJob.js                           # Job factory and scheduling utility
├── all/                                 # Jobs that process ALL stocks
│   └── exchanges/
│       └── syncExchangesAndSymbols.js   # Sync all exchanges and symbols
└── large-cap/                          # Jobs that process LARGE CAP stocks only
    ├── findAndMarkLargeCapStocks.js     # Identify and mark large cap stocks
    ├── dividends/
    │   └── syncDividendsLargeCap.js     # Sync dividend data for large cap stocks
    ├── fundamentals/
    │   └── syncFundamentalsLargeCap.js  # Sync fundamental data for large cap stocks
    ├── technicals/
    │   └── syncTechnicalsLargeCap.js    # Sync technical indicators for large cap stocks
    ├── metrics/
    │   └── syncMetricsLargeCap.js # Calculate financial metrics for large cap stocks (enum-based)
    ├── performance/
    │   └── syncPricePerformanceLargeCap.js # Refresh price change metrics for large cap stocks
    ├── metrics-base/
    │   └── percentileUtils.js           # Shared utilities for percentile calculations
    └── company-percentiles/
        ├── syncSectorPercentiles.js     # Calculate company percentiles relative to sector
        └── syncIndustryPercentiles.js   # Calculate company percentiles relative to industry
```

## Job Categories

### 1. All Stocks Jobs (`all/`)
Jobs that process **ALL** stocks across all exchanges:
- **Purpose**: Foundation data that all other jobs depend on
- **Scope**: Global - processes every exchange and symbol
- **Examples**: Exchange lists, symbol lists, basic market data

### 2. Large Cap Jobs (`large-cap/`)
Jobs that process only **LARGE CAP** stocks (≥$1B market cap):
- **Purpose**: Focused analysis on high-value, liquid stocks
- **Scope**: Filtered - only processes stocks meeting large cap criteria
- **Examples**: Fundamentals, dividends, technical indicators, calculated metrics

## Job Execution Patterns

### 1. Job Function Signature
All jobs follow this standard signature:
```javascript
export async function jobName({ progress, appendLog } = {}) {
  // Default appendLog to console.log if not provided
  const log = appendLog || console.log;
  
  // Job implementation...
  
  return {
    success: true,
    // ... other result data
  };
}
```

### 2. Standard Job Structure
```javascript
import { getModel } from "@buydy/se-db";
import { EODHDClient } from "@buydy/se-eodhd";

const maxAgeDays = 7; // Data freshness threshold

export async function jobName({ progress, appendLog } = {}) {
  const log = appendLog || console.log;
  
  // 1. Initialize models and clients
  const Model = getModel("modelName");
  const client = new EODHDClient({
    apiKey: process.env.API_EODHD_API_TOKEN,
    maxCallsPerMin: 200,
    useSingletonClient: true,
  });
  
  // 2. Setup data structures
  const results = [];
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  
  try {
    // 3. Main processing logic
    // - Find data to process
    // - Check freshness
    // - Process in chunks
    // - Update progress
    
    // 4. Return results
    return {
      success: true,
      totalProcessed: results.length,
      // ... other metrics
    };
  } catch (error) {
    log(`❌ Job failed: ${error.message}`);
    throw error;
  }
}
```

### 3. Common Patterns

#### Data Freshness Check
```javascript
const existingData = await Model.findOne({
  symbol: symbolKey,
  fetchedAt: { $gte: cutoff },
});

if (existingData) {
  // Skip - data is fresh
  return { ok: true, skipped: true, symbol: symbolKey };
}
```

#### Chunked Processing
```javascript
const CHUNK_SIZE = 10;
for (let i = 0; i < items.length; i += CHUNK_SIZE) {
  const chunk = items.slice(i, i + CHUNK_SIZE);
  
  const chunkPromises = chunk.map(async (item) => {
    // Process individual item
  });
  
  await Promise.all(chunkPromises);
  
  // Progress reporting
  if (progress) {
    progress(processedItems / totalItems);
  }
}
```

#### Error Handling
```javascript
try {
  // API call or database operation
  const result = await client.getData(symbol);
  results.push({ symbol, ok: true });
} catch (error) {
  results.push({ 
    symbol, 
    ok: false, 
    error: error.message 
  });
}
```

## Job Scheduling

### 1. Cron Schedule
Jobs are scheduled using cron expressions in `src/index.js`:

```javascript
const UTC_05AM_WEEKLY = "0 5 * * 0";   // Sunday 05:00 UTC
const UTC_06AM_DAILY = "0 6 * * *";    // Daily 06:00 UTC
const UTC_0630AM_DAILY = "30 6 * * *"; // Daily 06:30 UTC
const UTC_07AM_DAILY = "0 7 * * *";    // Daily 07:00 UTC
const UTC_0730AM_DAILY = "30 7 * * *"; // Daily 07:30 UTC
const UTC_08AM_DAILY = "0 8 * * *";    // Daily 08:00 UTC
```

### 2. Job Dependencies
Jobs run in a specific order to respect dependencies:

1. **syncAllExchangesAndSymbols** (Weekly) - Foundation data
2. **syncFundamentalsLargeCap** (Daily) - Market cap data needed for filtering
3. **findAndMarkLargeCapStocks** (Daily) - Identifies large cap stocks
4. **syncDividendsLargeCap** (Daily) - Dividend data for large cap stocks
5. **syncTechnicalsLargeCap** (Daily) - Technical indicators for large cap stocks
6. **syncMetricsLargeCap** (Daily) - Calculated financial metrics for large cap stocks (enum-based)
7. **syncPricePerformanceLargeCap** (Daily) - Refreshes price change metrics from cached price history
8. **syncSectorPercentiles** / **syncIndustryPercentiles** (Daily) - Derive percentile ranks

### 3. Registration
```javascript
makeJob(syncAllExchangesAndSymbols, { 
  cron: UTC_05AM_WEEKLY, 
  timezone: "UTC" 
});
```

## Job Execution Methods

### 1. Scheduled Execution
Jobs run automatically based on their cron schedule.

### 2. Manual Execution
Jobs can be run manually using npm scripts:

```bash
# Run specific job
yarn run:job:syncFundamentalsLargeCap
yarn run:job:syncDividendsLargeCap
yarn run:job:syncTechnicalsLargeCap
yarn run:job:syncMetricsLargeCap
yarn run:job:syncPricePerformanceLargeCap
yarn run:job:syncExchangesAndSymbols
yarn run:job:findAndMarkLargeCapStocks

# Run any job with custom path
yarn run jobs/large-cap/fundamentals/syncFundamentalsLargeCap.js
```

### 3. Direct Execution
```bash
node src/run-job.js jobs/large-cap/fundamentals/syncFundamentalsLargeCap.js
```

## Job Lifecycle Management

### 1. Job Tracking
Jobs are tracked in the `jobs` MongoDB collection with:
- `name`: Job identifier
- `status`: "scheduled", "running", "completed", "failed"
- `scheduledAt`, `startedAt`, `endedAt`: Timestamps
- `progress`: 0-1 progress indicator
- `result`: Job results
- `error`: Error message if failed
- `logs`: Important log entries

### 2. Stuck Job Detection
Jobs stuck in "running" status for >2 hours are automatically marked as failed.

### 3. Concurrent Job Prevention
Only one instance of each job can run at a time.

## Individual Job Details

### syncMetricsLargeCap Job

**Location**: `src/jobs/large-cap/metrics/syncMetricsLargeCap.js`

**Purpose**: Calculate financial metrics for large cap stocks based on dividend data using ISO business enum

**Dependencies**: 
- Requires dividend data from `syncDividendsLargeCap` job
- Uses large cap stocks identified by `findAndMarkLargeCapStocks` job

**Schedule**: Daily at 08:00 UTC (30 minutes after technicals job)

**Data Source**: 
- Large cap stocks from `exchange_symbols` collection
- Dividend history from `dividends` collection

**Calculations Performed**:
- **DividendGrowth3Y**: 3-year annualized dividend growth rate
- **DividendGrowth5Y**: 5-year annualized dividend growth rate  
- **DividendGrowth10Y**: 10-year annualized dividend growth rate
- **DividendYieldCurrent**: Current dividend yield (TTM-based)

**Calculator Functions Used**:
```javascript
import {
  DividendGrowth3Y,
  DividendGrowth5Y,
  DividendGrowth10Y,
  DividendYieldCurrent,
} from "../../calculators/dividendGrowth.js";
```

**Database Storage**:
- **Collection**: `metrics`
- **Fields**: `symbol`, `exchange`, `currency`, `metrics`, `lastUpdated`, `fetchedAt`
- **Metrics Object**: Contains all calculated dividend metrics

**Processing Logic**:
1. Finds all large cap stocks using centralized functions
2. For each stock, retrieves dividend history
3. Calculates metrics using dedicated calculator functions
4. Saves results to dedicated metrics collection
5. Skips calculation if data is fresh (< 7 days old)

**Console Output**:
```javascript
console.log("DivGrowth3Y:", divGrowth3Y);
console.log("DivGrowth5Y:", divGrowth5Y);
console.log("DivGrowth10Y:", divGrowth10Y);
console.log("DivYield:", divYield);
```

**Error Handling**:
- Continues processing other stocks if one fails
- Returns null values for failed calculations
- Logs detailed error information

**Performance**:
- Processes stocks in chunks of 10
- Uses existing dividend data (no API calls)
- Updates progress every 10%

## Creating New Jobs

### 1. Choose Job Category
- **All stocks**: Place in `all/` directory
- **Large cap only**: Place in `large-cap/` directory

### 2. Create Job File
```javascript
// src/jobs/category/subcategory/jobName.js
import { getModel } from "@buydy/se-db";
import { EODHDClient } from "@buydy/se-eodhd";

const maxAgeDays = 7;

export async function jobName({ progress, appendLog } = {}) {
  const log = appendLog || console.log;
  
  // Job implementation following standard patterns
  
  return {
    success: true,
    // ... results
  };
}
```

### 3. Add to Package.json
```json
{
  "scripts": {
    "run:job:jobName": "node src/run-job.js jobs/category/subcategory/jobName.js"
  }
}
```

### 4. Register in index.js
```javascript
import { jobName } from "./jobs/category/subcategory/jobName.js";

// Add to initial sync sequence
const jobs = [
  // ... existing jobs
  { name: "jobName", fn: jobName },
];

// Register for scheduled execution
makeJob(jobName, { 
  cron: "0 8 * * *", // 08:00 UTC daily
  timezone: "UTC" 
});
```

## Best Practices

### 1. Data Processing
- Always check data freshness before API calls
- Process data in chunks to avoid memory issues
- Use bulk operations for database updates
- Handle API rate limits gracefully

### 2. Error Handling
- Use try-catch blocks around API calls
- Log errors with context (symbol, exchange, etc.)
- Continue processing other items when one fails
- Return detailed error information

### 3. Progress Reporting
- Report progress regularly (every 5-10%)
- Use the `progress` callback for UI updates
- Log important milestones

### 4. Resource Management
- Use the global API queue for rate limiting
- Close database connections properly
- Clean up large data structures
- Use garbage collection between chunks

### 5. Logging
- Use consistent log formatting
- Include emojis for visual scanning
- Log both successes and failures
- Provide context in error messages

## Environment Variables

### Required
- `API_EODHD_API_TOKEN`: EODHD API key
- `MONGO_HOST`: MongoDB connection string

### Optional
- `FUNDAMENTALS_STOCKS_PER_EXCHANGE`: Limit stocks per exchange (default: 400)
- `MAX_CONCURRENT_REQUESTS`: API concurrency limit (default: from config)

## Database Models

### Core Models
- `exchanges`: Exchange information
- `exchange_symbols`: Symbols for each exchange
- `fundamentals`: Fundamental data (market cap, etc.)
- `dividends`: Dividend history and yields
- `technicals`: Technical indicators
- `metrics`: Calculated financial metrics
- `jobs`: Job execution tracking

### Model Usage
```javascript
const Model = getModel("modelName");
const data = await Model.findOne({ symbol: "AAPL.US" });
```

## Calculator Functions

### Dividend Growth Calculator

**Location**: `src/calculators/dividendGrowth.js`

**Purpose**: Pure calculation functions for dividend growth rates and yield

**Functions Available**:
- `DividendGrowth3Y(history)` - 3-year dividend growth rate
- `DividendGrowth5Y(history)` - 5-year dividend growth rate
- `DividendGrowth10Y(history)` - 10-year dividend growth rate
- `DividendYieldCurrent(history, currentPrice)` - Current dividend yield (TTM)

**Usage**:
```javascript
import {
  DividendGrowth3Y,
  DividendGrowth5Y,
  DividendGrowth10Y,
  DividendYieldCurrent,
} from "../../calculators/dividendGrowth.js";

// Calculate metrics
const growth3Y = DividendGrowth3Y(dividendHistory);
const growth5Y = DividendGrowth5Y(dividendHistory);
const growth10Y = DividendGrowth10Y(dividendHistory);
const currentYield = DividendYieldCurrent(dividendHistory, currentPrice);
```

**Dependencies**:
- Imports `groupByYear` from `../mappers/groupByYear.js`
- Uses private `calcDividendGrowth` function for core calculations

**Return Values**:
- Growth rates as decimals (e.g., 0.05 for 5% growth)
- Returns `null` for insufficient data or invalid calculations

## API Client

### EODHD Client Configuration
```javascript
const client = new EODHDClient({
  apiKey: process.env.API_EODHD_API_TOKEN,
  maxCallsPerMin: 200,
  useSingletonClient: true, // Uses global queue
});
```

### Common API Calls
- `client.search.getAvailableExchanges()`
- `client.search.getSymbolsByExchange(exchangeCode)`
- `client.getFundamentals(symbol)`
- `client.dividends.getDividends(symbol, fromDate, toDate)`
- `client.stocks.getTechnicalIndicator(symbol, indicator, options)`

## Troubleshooting

### Common Issues
1. **Database Connection**: Check `MONGO_HOST` environment variable
2. **API Rate Limits**: Reduce `maxCallsPerMin` or increase delays
3. **Memory Issues**: Reduce chunk sizes or add garbage collection
4. **Stuck Jobs**: Use `yarn cleanup:stuck-jobs` to reset

### Debugging
- Check job logs in MongoDB `jobs` collection
- Use `yarn run:job:jobName` for manual testing
- Enable detailed logging with `appendLog` parameter
- Monitor API queue progress in console output

## Performance Optimization

### 1. Concurrency Control
- Use global API queue for rate limiting
- Process data in parallel chunks
- Limit concurrent database operations

### 2. Memory Management
- Process data in streams, not arrays
- Clear large data structures after use
- Use garbage collection between chunks

### 3. Database Optimization
- Use bulk operations for updates
- Index frequently queried fields
- Use aggregation pipelines for complex queries

### 4. API Efficiency
- Check data freshness before API calls
- Use appropriate rate limits
- Handle API errors gracefully
- Cache results when possible
