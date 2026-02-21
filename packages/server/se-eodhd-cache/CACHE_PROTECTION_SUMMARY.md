# Cache Protection Summary

## Problem: How to ensure cache doesn't store data forever?

## Solution: 4-Layer Protection System ✅

### Layer 1: MongoDB TTL Index (Already Active)
**What:** Automatic background cleanup by MongoDB  
**How:** Deletes documents when `expiresAt` timestamp is reached  
**When:** Every 60 seconds  
**Pros:** Zero overhead, fully automatic, works even if app crashes  
**Cons:** Up to 60-second delay

### Layer 2: Manual Cleanup Methods
**What:** On-demand cleanup via API methods  
**How:** Call `cleanupExpired()` or `clearCache()` manually  
**When:** As needed (testing, debugging, emergency)  

```javascript
const client = new EODHDCacheClient({ apiKey: "..." });
await client.cleanupExpired();  // Remove expired entries
await client.clearCache();      // Emergency flush
```

### Layer 3: Automated Maintenance Job (NEW!)
**What:** Scheduled background cleanup with smart limits  
**How:** Runs every hour, enforces size/count limits  
**When:** Configurable (default: every 1 hour)  

**Features:**
- ✅ Removes expired entries (backup for TTL)
- ✅ Enforces max size (500 MB default)
- ✅ Enforces max documents (100k default)
- ✅ Removes orphaned entries
- ✅ Health monitoring

### Layer 4: Size Limits Enforcement
**What:** Prevents infinite cache growth  
**How:** When limits exceeded, removes oldest entries (FIFO)  
**Limits:**
- Max size: 500 MB (configurable)
- Max documents: 100,000 (configurable)

---

## Quick Start

### 1. Monitor Cache Health

```bash
# Check current cache status
yarn cache:health

# Output:
# 📊 Cache Health Report:
# Status: ✅ HEALTHY
# Total Entries: 15,234
# Total Size: 76.5 MB
# Expired Entries: 1,234
```

### 2. Run Manual Cleanup

```bash
# Clean expired entries
yarn cache:cleanup

# Emergency flush (removes ALL cache)
yarn cache:cleanup --flush
```

### 3. Enable Automated Maintenance (Optional)

Add to `apps/app-stocks-scanner/src/index.js`:

```javascript
import { CacheMaintenanceJob } from "@buydy/se-eodhd-cache/cacheMaintenanceJob";

// Initialize maintenance
const cacheMaintenance = new CacheMaintenanceJob({
  maxCacheSizeMB: 500,        // 500 MB limit
  maxDocuments: 100000,       // 100k documents
  cleanupIntervalMs: 3600000, // 1 hour
});

await cacheMaintenance.initialize();
cacheMaintenance.start();  // Start scheduled cleanup

// Graceful shutdown
process.on('SIGTERM', () => {
  cacheMaintenance.stop();
  process.exit(0);
});
```

---

## How It Prevents Forever Storage

### Timeline Example

```
Day 0: Cache entry created
  ├─ expiresAt = Day 7
  └─ Total size: 50 MB

Day 1-6: Cache grows
  ├─ New entries added
  └─ Total size: 250 MB

Day 7 00:00: Entries start expiring
  ├─ MongoDB TTL deletes expired (every 60s)
  ├─ Maintenance job cleans up (hourly)
  └─ Total size: 200 MB

Day 14: All old entries expired
  └─ Total size: back to normal

If size exceeds 500 MB:
  ├─ Maintenance job triggered
  ├─ Removes oldest 10% of entries
  └─ Size back under limit ✅
```

### Protection Mechanisms

| Mechanism | Trigger | Action | Frequency |
|-----------|---------|--------|-----------|
| TTL Index | `expiresAt` reached | Auto-delete | Every 60s |
| Maintenance | Schedule | Cleanup expired | Every 1h |
| Size Limit | Size > 500 MB | Remove oldest 10% | Every 1h check |
| Count Limit | Docs > 100k | Remove oldest excess | Every 1h check |

---

## Configuration

### Default Settings (Good for Most Cases)

```javascript
{
  cacheExpirationHours: 168,     // 7 days
  maxCacheSizeMB: 500,           // 500 MB
  maxDocuments: 100000,          // 100k documents
  cleanupIntervalMs: 3600000,    // 1 hour
}
```

### Adjust for Your Needs

**Small deployment** (<1000 stocks):
```javascript
{
  maxCacheSizeMB: 100,
  maxDocuments: 10000,
}
```

**Large deployment** (>5000 stocks):
```javascript
{
  maxCacheSizeMB: 2000,
  maxDocuments: 500000,
}
```

---

## Monitoring

### Health Metrics

The system tracks:
- ✅ Total cache size (MB)
- ✅ Total document count
- ✅ Expired entry count
- ✅ Size per endpoint
- ✅ Average entry size

### Warnings

Automatic warnings when:
- ⚠️ Size > 90% of limit
- ⚠️ Documents > 90% of limit
- ⚠️ Expired entries > 10% of total

---

## Files Created

1. **`packages/server/se-eodhd-cache/src/cacheMaintenanceJob.js`**
   - Core maintenance job implementation
   
2. **`scripts/monitor-cache-health.js`**
   - CLI tool for monitoring and cleanup
   
3. **`packages/server/se-eodhd-cache/CACHE_MANAGEMENT.md`**
   - Detailed documentation

4. **`CACHE_VERIFICATION.md`**
   - Technical deep-dive on cache behavior

---

## FAQ

**Q: Is the cache safe now?**  
A: Yes! 4 protection layers ensure it won't grow forever.

**Q: Do I need to do anything?**  
A: No! MongoDB TTL index already protects you. Maintenance job is optional but recommended.

**Q: What if cache gets too big anyway?**  
A: Run `yarn cache:cleanup` or `yarn cache:cleanup --flush`

**Q: Will this affect performance?**  
A: No! Cleanup is designed to be non-blocking and efficient.

**Q: Can I disable automatic cleanup?**  
A: Yes, just don't start the maintenance job. TTL index still works.

---

## Next Steps

1. ✅ **Current state:** TTL index protects cache (already active)
2. 🔧 **Optional:** Enable maintenance job for extra protection
3. 📊 **Monitor:** Run `yarn cache:health` periodically
4. 🧹 **Maintain:** Run `yarn cache:cleanup` if needed

The cache is already protected by MongoDB TTL index. The maintenance job adds extra safety and monitoring capabilities!

