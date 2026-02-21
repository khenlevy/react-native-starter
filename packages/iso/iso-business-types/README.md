# @buydy/iso-business-job-types

Centralized job type definitions for the Buydy stocks system. This package serves as the **single source of truth** for all job configurations, schedules, and metadata.

## Overview

This package contains comprehensive definitions for all job types in the Buydy system, including:
- Job metadata (name, description, category, scope)
- Scheduling information (cron expressions, timezone)
- Dependencies and execution order
- Data sources and output collections
- Retry policies and priorities

## Installation

```bash
# In your workspace
yarn add @buydy/iso-business-job-types
```

## Usage

### Basic Usage

```javascript
import { getJobs, getJobById, getJobsMapByType } from '@buydy/iso-business-job-types';

// Get all job types
const allJobs = getJobs();

// Get a specific job by ID
const job = getJobById('syncFundamentalsLargeCap');

// Get jobs mapped by type for quick lookup
const jobsMap = getJobsMapByType();
const job = jobsMap['syncFundamentalsLargeCap'];
```

### Advanced Queries

```javascript
import { 
  getJobsByCategory,
  getJobsByScope,
  getJobsByPriority,
  getDailyJobs,
  getLargeCapJobs,
  getJobsInExecutionOrder
} from '@buydy/iso-business-job-types';

// Get jobs by category
const fundamentalsJobs = getJobsByCategory().fundamentals;

// Get jobs by scope
const largeCapJobs = getJobsByScope()['large-cap'];

// Get high priority jobs
const highPriorityJobs = getJobsByPriority('high');

// Get daily jobs
const dailyJobs = getDailyJobs();

// Get jobs in execution order (respecting dependencies)
const orderedJobs = getJobsInExecutionOrder();
```

### Job Type Structure

Each job type definition includes:

```javascript
{
  "id": "syncFundamentalsLargeCap",
  "name": "syncFundamentalsLargeCap",
  "displayName": "Sync Fundamentals - Large Cap",
  "description": "Daily fundamentals data sync for large cap stocks...",
  "category": "fundamentals",
  "scope": "large-cap",
  "cronDefinition": "0 6 * * *",
  "cronDescription": "Daily at 06:00 UTC",
  "timezone": "UTC",
  "dependencies": ["syncAllExchangesAndSymbols"],
  "estimatedDuration": "45-60 minutes",
  "priority": "high",
  "dataSource": "EODHD API - Fundamentals endpoint",
  "outputCollections": ["fundamentals"],
  "tags": ["fundamentals", "daily", "large-cap", "financial-metrics"],
  "enabled": true,
  "retryPolicy": {
    "maxRetries": 3,
    "retryDelay": "10 minutes"
  }
}
```

## API Reference

### Core Functions

- `getJobs()` - Get all job types as an array
- `getJobsMapByType()` - Get jobs mapped by ID/name for quick lookup
- `getJobById(identifier)` - Get a specific job by ID or name

### Filtering Functions

- `getJobsByCategory()` - Group jobs by category
- `getJobsByScope()` - Group jobs by scope (all, large-cap)
- `getJobsByPriority(priority)` - Filter by priority level
- `getJobsByEnabledStatus(enabled)` - Filter by enabled status
- `getJobsByTags(tags)` - Filter by tags
- `getJobsByCron(cronDefinition)` - Filter by cron expression
- `getJobsByDependency(dependencyId)` - Get jobs that depend on another job

### Convenience Functions

- `getDailyJobs()` - Get all daily jobs
- `getWeeklyJobs()` - Get all weekly jobs
- `getLargeCapJobs()` - Get all large cap jobs
- `getAllStocksJobs()` - Get all stocks jobs
- `getJobsInExecutionOrder()` - Get jobs ordered by dependencies

### Utility Functions

- `getJobsWithScheduleInfo()` - Get jobs with formatted schedule information
- `validateJobType(job)` - Validate a job type definition
- `getJobStatistics()` - Get statistics about job types

## Job Categories

- **foundation** - Core infrastructure jobs (exchanges, symbols)
- **fundamentals** - Financial fundamentals data
- **filtering** - Stock filtering and classification
- **dividends** - Dividend data and calculations
- **technicals** - Technical indicators
- **metrics** - Calculated financial metrics
- **sector-metrics** - Sector-level aggregations
- **industry-metrics** - Industry-level aggregations

## Job Scopes

- **all** - Processes all stocks across all exchanges
- **large-cap** - Processes only large cap stocks (≥$1B market cap)

## Priorities

- **critical** - Must run successfully for system to function
- **high** - Important for data quality and analysis
- **medium** - Useful but not critical
- **low** - Optional or experimental

## Integration

### With Stocks Scanner

```javascript
// In app-stocks-scanner/src/index.js
import { getJobs, getJobsInExecutionOrder } from '@buydy/iso-business-job-types';

const jobs = getJobsInExecutionOrder();
jobs.forEach(job => {
  makeJob(job.fn, { 
    cron: job.cronDefinition, 
    timezone: job.timezone 
  });
});
```

### With Stocks API

```javascript
// In app-stocks-api/src/controllers/jobsController.js
import { getJobsMapByType } from '@buydy/iso-business-job-types';

const jobTypesMap = getJobsMapByType();
// Use jobTypesMap for schedule information instead of hardcoded values
```

### With Stocks Web UI

```javascript
// In app-stocks-web
import { getJobs, getJobsByCategory } from '@buydy/iso-business-job-types';

// Fetch job types from API endpoint
const jobTypes = await fetch('/api/v1/job-types').then(r => r.json());
```

## Migration Guide

When migrating from hardcoded job definitions:

1. **Replace hardcoded schedules** with imports from this package
2. **Update job registration** to use centralized definitions
3. **Remove duplicate job metadata** from individual files
4. **Update API endpoints** to serve job types from this package

## Contributing

When adding new job types:

1. Add the job definition to `src/jobTypes.json`
2. Include all required fields (see validation function)
3. Update this README if adding new categories or scopes
4. Test with the validation function

## Validation

Use the built-in validation function to ensure job definitions are correct:

```javascript
import { validateJobType } from '@buydy/iso-business-job-types';

const result = validateJobType(jobDefinition);
if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```
