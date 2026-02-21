# Cache Management Guide

## Overview

The EODHD cache uses a multi-layered approach to ensure data doesn't stay forever:

1. **MongoDB TTL Index** (automatic, passive)
2. **Manual Cleanup Methods** (on-demand)
3. **Scheduled Maintenance Job** (automated, active)
4. **Size Limits Enforcement** (prevents infinite growth)

## Protection Layers

### Layer 1: MongoDB TTL Index ✅ (Already Active)

**How it works:**
- MongoDB automatically deletes documents when `expiresAt` timestamp is reached
- Runs every 60 seconds in background
- Zero overhead, fully automatic

**Pros:**
- ✅ Automatic
- ✅ No application code needed
- ✅ Works even if app crashes

**Cons:**
- ⚠️ Up to 60-second delay
- ⚠️ No guarantees during heavy load
- ⚠️ Doesn't enforce size limits

### Layer 2: Manual Cleanup Methods

**Available methods:**

```javascript
import { EODHDCacheClient } from "@buydy/se-eodhd-cache";

const client = new EODHDCacheClient({ apiKey: "..." });

// Get cache statistics
const stats = await client.getCacheStats();
console.log(stats);
// { total: 1500, active: 1200, expired: 300, expirationHours: 168 }

// Clean up expired entries (backup for TTL index)
const cleaned = await client.cleanupExpired();
console.log(`Cleaned ${cleaned} entries`);

// Clear all cache (use with caution!)
const cleared = await client.clearCache();
console.log(`Cleared ${cleared} entries`);
```

### Layer 3: Automated Maintenance Job (NEW)

**Features:**
- ✅ Scheduled cleanup every hour
- ✅ Enforces maximum cache size (500 MB default)
- ✅ Enforces maximum document count (100k default)
- ✅ Removes orphaned entries
- ✅ Provides health monitoring

**Integration:**

```javascript
// In your app startup (e.g., apps/app-stocks-scanner/src/index.js)
import { CacheMaintenanceJob } from "@buydy/se-eodhd-cache/src/cacheMaintenanceJob.js";

const cacheMaintenance = new CacheMaintenanceJob({
  maxCacheSizeMB: 500,        // Max 500 MB
  maxDocuments: 100000,       // Max 100k documents
  cleanupIntervalMs: 3600000, // Run every 1 hour
});

await cacheMaintenance.initialize();
cacheMaintenance.start();  // Start scheduled maintenance

// On app shutdown
process.on('SIGTERM', () => {
  cacheMaintenance.stop();
});
```

### Layer 4: Size Limits

**How it protects:**

When cache exceeds limits, the maintenance job automatically:
1. Removes oldest entries first (FIFO)
2. Targets 10% reduction when size limit hit
3. Logs warnings at 90% capacity

**Default limits:**
- Max size: 500 MB
- Max documents: 100,000

**Calculation example:**
```
Average entry size: ~5 KB
100,000 entries × 5 KB = ~500 MB
```

## Monitoring & Health Checks

### CLI Monitoring

```bash
# View cache health
node scripts/monitor-cache-health.js

# Run cleanup manually
node scripts/monitor-cache-health.js --cleanup

# Emergency flush (removes ALL cache)
node scripts/monitor-cache-health.js --flush
```

### Programmatic Health Check

```javascript
const health = await cacheMaintenance.getHealthReport();

console.log(health);
// {
//   status: "healthy",  // or "warning"
//   warnings: [],
//   stats: {
//     total: 15000,
//     active: 12000,
//     expired: 3000,
//     totalSizeMB: "75.50",
//     avgSizeKB: "5.15",
//     maxSizeKB: "125.00",
//     byEndpoint: [...]
//   },
//   timestamp: "2025-01-15T10:30:00.000Z"
// }
```

### Health Status Codes

- **✅ healthy**: Everything normal
- **⚠️ warning**: Approaching limits or high expired count

## Cache Lifecycle

### Normal Flow

```
New API call
    ↓
Cache entry created
    ├─ expiresAt = now + 7 days
    ├─ createdAt = now
    └─ Store in MongoDB
    ↓
[7 days pass]
    ↓
MongoDB TTL index deletes (within 60s)
    ↓
OR
    ↓
Maintenance job deletes (within 1 hour)
    ↓
Cache entry removed
```

### When Cache Exceeds Limits

```
Cache size > 500 MB
    ↓
Maintenance job detects issue
    ↓
Calculates entries to remove (10% oldest)
    ↓
Deletes oldest entries first
    ↓
Logs action
    ↓
Cache within limits ✅
```

## Best Practices

### 1. Monitor Regularly

```bash
# Add to cron (daily at 2 AM)
0 2 * * * cd /path/to/Buydy && node scripts/monitor-cache-health.js --cleanup >> logs/cache-maintenance.log 2>&1
```

### 2. Set Appropriate Limits

Based on your needs:

```javascript
// Small deployment (<1000 stocks)
maxCacheSizeMB: 100,
maxDocuments: 10000,

// Medium deployment (1000-5000 stocks)
maxCacheSizeMB: 500,    // Default
maxDocuments: 100000,   // Default

// Large deployment (>5000 stocks)
maxCacheSizeMB: 2000,
maxDocuments: 500000,
```

### 3. Emergency Response

If cache grows unexpectedly:

```bash
# 1. Check health
node scripts/monitor-cache-health.js

# 2. Try cleanup first
node scripts/monitor-cache-health.js --cleanup

# 3. If still too large, emergency flush
node scripts/monitor-cache-health.js --flush
```

### 4. Integrate into Jobs

```javascript
// In syncMetricsLargeCap or other jobs
import { CacheMaintenanceJob } from "@buydy/se-eodhd-cache/src/cacheMaintenanceJob.js";

// Run cleanup after heavy API usage
const maintenance = new CacheMaintenanceJob();
await maintenance.initialize();
await maintenance.runMaintenance();
```

## Troubleshooting

### Cache Not Shrinking

**Issue**: Cache keeps growing despite TTL index

**Solutions:**
1. Verify TTL index exists:
   ```bash
   mongosh
   > use your_database
   > db.cached_response_eodhistoricaldata.getIndexes()
   ```
2. Run manual cleanup:
   ```bash
   node scripts/monitor-cache-health.js --cleanup
   ```
3. Check MongoDB server time (TTL uses server time)

### Cache Too Small

**Issue**: Getting too many cache misses

**Solutions:**
1. Increase cache size limits
2. Increase expiration time (in `jobConfig.js`)
3. Reduce cleanup frequency

### High Memory Usage

**Issue**: MongoDB using too much RAM

**Solutions:**
1. Reduce `maxCacheSizeMB` limit
2. Run cleanup more frequently
3. Add MongoDB memory limits in config

## Configuration Reference

### CacheMaintenanceJob Options

```javascript
{
  collectionName: "cached_response_eodhistoricaldata",  // Collection name
  maxCacheSizeMB: 500,                 // Max cache size in MB
  maxDocuments: 100000,                // Max number of documents
  cleanupIntervalMs: 3600000,          // Cleanup interval (1 hour)
}
```

### Cache Expiration (in jobConfig.js)

```javascript
JOB_CONFIG = {
  MAX_AGE_DAYS: 7,                    // Database freshness
  CACHE_EXPIRATION_HOURS: 24 * 7,     // API cache expiration (7 days)
}
```

## FAQ

**Q: Will cache cleanup affect running jobs?**
A: No, cleanup only removes expired entries. Active jobs create new cache entries.

**Q: Can I run cleanup during peak hours?**
A: Yes, cleanup is designed to be non-blocking and efficient.

**Q: What happens if MongoDB crashes?**
A: Cache is stored in MongoDB, so it persists across app restarts. TTL index resumes after MongoDB restarts.

**Q: How do I disable cache?**
A: Use `EODHDClient` instead of `EODHDCacheClient` in your jobs.

**Q: Can I have different expiration per endpoint?**
A: Currently no, but you can modify `EODHDCacheClient` to accept per-endpoint config.

## Metrics to Track

Monitor these metrics in production:

1. **Total cache size** (MB)
2. **Cache hit rate** (hits / total requests)
3. **Expired entry count**
4. **Cleanup frequency**
5. **Average entry age**

## Alerts to Set Up

Configure alerts for:

- ⚠️ Cache size > 90% of limit
- ⚠️ Expired entries > 10% of total
- ⚠️ Cache cleanup failures
- ⚠️ TTL index missing

