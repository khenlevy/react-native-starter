# Job Scripts Guide - app-stocks-scanner

## Overview

This guide provides easy-to-run scripts for all jobs in the scanner application. All scripts follow the same approach and method using the `run-job.js` utility.

## Available Job Scripts

### Individual Job Scripts

Run any single job with:
```bash
yarn run:job:<jobName>
```

**Available individual scripts:**

1. **Exchange & Symbols**
   - `yarn run:job:syncExchangesAndSymbols` - Sync all exchanges and their symbols

2. **Large Cap Fundamentals**
   - `yarn run:job:syncFundamentalsLargeCap` - Sync fundamental data for large cap stocks
   - `yarn run:job:findAndMarkLargeCapStocks` - Identify and mark large cap stocks

3. **Dividends**
   - `yarn run:job:syncDividendsLargeCap` - Sync dividend data for large cap stocks

4. **Technical Analysis**
   - `yarn run:job:syncTechnicalsLargeCap` - Sync technical indicators for large cap stocks

5. **Metrics & Percentiles**
   - `yarn run:job:syncMetricsLargeCap` - Calculate financial metrics for large cap stocks (enum-based)
   - `yarn run:job:syncSectorPercentiles` - Calculate sector-based percentile rankings
   - `yarn run:job:syncIndustryPercentiles` - Calculate industry-based percentile rankings

### Batch Scripts

Run multiple related jobs in sequence:

1. **All Jobs (Complete Pipeline)**
   ```bash
   yarn run:all:jobs
   ```
   Runs all jobs in the correct execution order.

2. **Exchange Jobs Only**
   ```bash
   yarn run:all:exchanges
   ```
   Runs only exchange and symbol synchronization jobs.

3. **Large Cap Jobs Only**
   ```bash
   yarn run:all:large-cap
   ```
   Runs all large cap related jobs (fundamentals, dividends, technicals, metrics).

4. **Metrics & Percentiles Jobs Only**
   ```bash
   yarn run:all:metrics
   ```
   Runs all metrics calculation and percentile ranking jobs.

### Utility Scripts

1. **List All Available Scripts**
   ```bash
   yarn run:job:list
   ```
   Shows all available job scripts and batch scripts with descriptions.

## Job Execution Order

Jobs should be run in this order for proper data dependencies:

1. `syncExchangesAndSymbols` - Foundation data (exchanges and symbols)
2. `syncFundamentalsLargeCap` - Basic company data
3. `findAndMarkLargeCapStocks` - Identify large cap stocks
4. `syncDividendsLargeCap` - Dividend history data
5. `syncTechnicalsLargeCap` - Technical indicators
6. `syncMetricsLargeCap` - Individual stock metrics (enum-based)
7. `syncSectorPercentiles` - Sector-based percentile rankings
8. `syncIndustryPercentiles` - Industry-based percentile rankings

## Environment Requirements

All scripts require these environment variables:
- `MONGO_HOST` - MongoDB connection string
- `API_EODHD_API_TOKEN` - EODHD API key

## Common Usage Patterns

### Development/Testing
```bash
# Test a single job
yarn run:job:syncSectorPercentiles

# Run all metrics jobs
yarn run:all:metrics

# List available scripts
yarn run:job:list
```

### Production/Full Sync
```bash
# Run complete pipeline
yarn run:all:jobs
```

### Troubleshooting
```bash
# Check job status
yarn status

# Cleanup stuck jobs
yarn cleanup:stuck-jobs

# Test schedules
yarn test:schedules
```

## Script Architecture

All scripts use the same underlying architecture:

1. **`run-job.js`** - Main job runner that:
   - Sets up environment variables
   - Initializes database connection
   - Sets up global API priority queue
   - Executes the job function
   - Handles errors and cleanup

2. **Job Functions** - Each job exports a default function with signature:
   ```javascript
   export async function jobName({ progress, appendLog } = {}) {
     // Job implementation
   }
   ```

3. **Package.json Scripts** - Each job has a corresponding npm script:
   ```json
   "run:job:jobName": "node src/run-job.js jobs/path/to/jobName.js"
   ```

## Error Handling

All scripts include comprehensive error handling:
- API rate limiting and retries
- Database connection management
- Progress tracking and logging
- Graceful failure recovery
- Memory management with garbage collection

## Performance Features

- **Concurrent Processing**: Jobs process data in chunks with configurable concurrency
- **API Queue Management**: Global priority queue for EODHD API requests
- **Memory Management**: Garbage collection between job phases
- **Progress Tracking**: Real-time progress updates and logging
- **Data Freshness**: Skips API calls when data is recent (< 7 days old)

## Adding New Jobs

To add a new job:

1. Create the job file in the appropriate directory
2. Add the npm script to `package.json`
3. Update the `run:all:jobs` script if needed
4. Test with `yarn run:job:newJobName`

Example:
```json
"run:job:newJobName": "node src/run-job.js jobs/category/subcategory/newJobName.js"
```
