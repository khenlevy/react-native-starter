# Job History Cleanup Summary

## Problem: How to prevent job history from accumulating forever?

## Solution: 5-Layer Protection System ✅

### Layer 1: Retention Policies (Smart Cleanup)
**What:** Different retention periods for different job statuses  
**How:** 
- Completed jobs: Keep 30 days
- Failed jobs: Keep 90 days (longer for debugging)
- Always keep last 10 runs of each job type (minimum)

**Why different retention?**
- ✅ Completed jobs are routine - don't need long history
- ✅ Failed jobs need investigation - keep longer
- ✅ Minimum per type ensures you always have recent history

### Layer 2: Stuck Job Detection
**What:** Automatic cleanup of zombie jobs  
**How:** Marks jobs as "failed" if running > 2 hours  
**When:** Every 6 hours  
**Prevents:** Jobs blocking new runs indefinitely

### Layer 3: Size Limits
**What:** Hard limits on total records  
**How:** 
- Max total jobs: 10,000 records
- Max logs per job: 1,000 entries
- Removes oldest first when limits exceeded

### Layer 4: Log Trimming
**What:** Prevents individual jobs from consuming excessive space  
**How:** Keeps only last 1,000 log entries per job  
**Saves:** Megabytes from verbose logging

### Layer 5: Scheduled Maintenance
**What:** Automated cleanup every 6 hours  
**How:** Runs all cleanup tasks automatically  
**When:** Configurable (default: 6 hours)

---

## Quick Start

### 1. Check Job History Health

```bash
# View current status
yarn jobs:health
```

**Example Output:**
```
📊 Job History Health Report:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ✅ HEALTHY

Statistics:
  Total Jobs: 2,345
  Running: 0
  Completed: 2,100
  Failed: 245
  Avg Logs/Job: 42
  Oldest Record: 28 days ago

Retention Policy:
  Completed Jobs: Keep 30 days
  Failed Jobs: Keep 90 days
  Stuck Threshold: 2 hours
  Max Total Jobs: 10,000

Cleanup Candidates:
  Expired Completed: 120
  Expired Failed: 15
  Stuck Jobs: 0
  Total to Clean: 135
```

### 2. Run Manual Cleanup

```bash
# Clean expired job records
yarn jobs:cleanup

# See detailed job breakdown
yarn jobs:health --details
```

### 3. Enable Automated Maintenance (Recommended)

Add to `apps/app-stocks-scanner/src/index.js`:

```javascript
import { JobMaintenanceJob } from "@buydy/se-db/src/jobMaintenanceJob.js";

// Initialize job maintenance
const jobMaintenance = new JobMaintenanceJob({
  completedJobsRetentionDays: 30,
  failedJobsRetentionDays: 90,
  stuckJobThresholdHours: 2,
  maxTotalJobs: 10000,
  cleanupIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
});

await jobMaintenance.initialize();
jobMaintenance.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  jobMaintenance.stop();
  process.exit(0);
});
```

---

## How It Prevents Forever Storage

### Timeline Example

```
Day 1: Job runs successfully
  ├─ Status: completed
  └─ Will be kept for 30 days

Day 15: Job fails
  ├─ Status: failed
  └─ Will be kept for 90 days (longer!)

Day 31: Cleanup runs
  ├─ Day 1 job expired (> 30 days)
  ├─ Delete, but keep if it's in last 10 runs
  └─ Day 15 failure still kept (< 90 days)

Day 91: Cleanup runs
  ├─ Day 15 failure expired (> 90 days)
  └─ Delete, but keep if it's in last 10 runs

If total jobs > 10,000:
  ├─ Remove oldest completed/failed jobs
  ├─ Never delete running jobs
  └─ Bring total back under limit ✅
```

### Protection Mechanisms

| Mechanism | Trigger | Action | Frequency |
|-----------|---------|--------|-----------|
| **Completed Cleanup** | Age > 30 days | Delete old runs | Every 6h |
| **Failed Cleanup** | Age > 90 days | Delete old failures | Every 6h |
| **Stuck Detection** | Running > 2h | Mark as failed | Every 6h |
| **Log Trimming** | Logs > 1000 | Keep last 1000 | Every 6h |
| **Size Limit** | Total > 10k | Remove oldest | Every 6h |
| **Minimum Keep** | Always | Keep last 10/type | Always |

---

## Smart Retention: Why It Works

### Scenario: syncMetricsLargeCap

```
Runs daily (365 runs/year)

Without cleanup:
  Year 1: 365 records
  Year 2: 730 records
  Year 3: 1,095 records ❌ Growing forever!

With cleanup (30-day retention + min 10):
  Year 1: ~40 records (30 days + 10 minimum)
  Year 2: ~40 records (stable)
  Year 3: ~40 records (stable) ✅ Controlled!

Storage saved: ~1,000 records/3 years!
```

### Scenario: Job Failures

```
Job occasionally fails (10 failures/year)

Without cleanup:
  Year 1: 10 failed records
  Year 2: 20 failed records
  Year 3: 30 failed records

With cleanup (90-day retention):
  Year 1: 10 records
  Year 2: ~3 records (only last 90 days)
  Year 3: ~3 records ✅ Bounded!

Debugging window: 90 days (plenty of time!)
```

---

## Configuration Presets

### Conservative (Keep More History)

```javascript
{
  completedJobsRetentionDays: 90,
  failedJobsRetentionDays: 180,
  maxTotalJobs: 50000,
  minJobsToKeepPerType: 50,
}
```

**Best for:**
- Production environments
- Critical jobs
- Audit requirements

### Balanced (Default)

```javascript
{
  completedJobsRetentionDays: 30,
  failedJobsRetentionDays: 90,
  maxTotalJobs: 10000,
  minJobsToKeepPerType: 10,
}
```

**Best for:**
- Most deployments
- Standard operations

### Aggressive (Save Space)

```javascript
{
  completedJobsRetentionDays: 7,
  failedJobsRetentionDays: 30,
  maxTotalJobs: 1000,
  minJobsToKeepPerType: 5,
}
```

**Best for:**
- Development environments
- Space-constrained servers
- High-frequency jobs

---

## Files Created

1. ✅ `packages/server/se-db/src/jobMaintenanceJob.js` - Maintenance job implementation
2. ✅ `scripts/monitor-job-history.js` - CLI monitoring tool
3. ✅ `packages/server/se-db/JOB_MAINTENANCE.md` - Detailed guide

**New Scripts:**
- `yarn jobs:health` - Check job history status
- `yarn jobs:cleanup` - Run manual cleanup

---

## Comparison: Cache vs Jobs Cleanup

| Feature | Cache Cleanup | Job History Cleanup |
|---------|--------------|-------------------|
| **Purpose** | API response caching | Job execution tracking |
| **Data Type** | Ephemeral (can recreate) | Historical (permanent) |
| **Retention** | 7 days (uniform) | 30/90 days (by status) |
| **TTL Index** | Yes (MongoDB) | No (manual only) |
| **Minimum Keep** | No | Yes (last 10/type) |
| **Cleanup Freq** | Every 1 hour | Every 6 hours |
| **Size Limit** | 500 MB | 10k records |
| **Critical?** | No | Yes (failures) |

---

## Monitoring & Alerts

### Recommended Alerts

```javascript
const health = await jobMaintenance.getHealthReport();

// Alert if approaching limits
if (health.stats.total > 9000) {
  sendAlert("Job history approaching limit");
}

// Alert on high failure rate
const failureRate = health.stats.byStatus.failed / health.stats.total;
if (failureRate > 0.3) {
  sendAlert("High job failure rate: " + (failureRate * 100) + "%");
}

// Alert on stuck jobs
if (health.stats.byStatus.running > 10) {
  sendAlert("Many jobs stuck in running status");
}
```

### Cron Setup

```bash
# Daily health check (2 AM)
0 2 * * * cd /path/to/Buydy && yarn jobs:health >> logs/job-health.log 2>&1

# Weekly cleanup (Sunday 3 AM)
0 3 * * 0 cd /path/to/Buydy && yarn jobs:cleanup >> logs/job-cleanup.log 2>&1
```

---

## FAQ

**Q: Will cleanup delete currently running jobs?**  
A: No! Only completed, failed, or stuck (>2h) jobs are cleaned.

**Q: What if I need longer history for compliance?**  
A: Increase retention periods or implement archiving to separate storage.

**Q: Why 90 days for failed jobs?**  
A: Balances debugging needs with storage efficiency. You can adjust this.

**Q: Can I exclude specific jobs from cleanup?**  
A: Increase `minJobsToKeepPerType` to effectively keep more of each job type.

**Q: What happens to jobs between 30-90 days old?**  
A: Completed jobs deleted after 30 days. Failed jobs kept until 90 days.

**Q: How much space will this save?**  
A: Depends on job frequency. High-frequency jobs (daily) save ~90% of space.

---

## Summary: Protection Guaranteed ✅

| Layer | What It Does | Result |
|-------|-------------|--------|
| **Retention** | Delete old records | ✅ Bounded history |
| **Stuck Detection** | Clean zombie jobs | ✅ No blocking |
| **Size Limits** | Cap total records | ✅ Max 10k jobs |
| **Log Trimming** | Limit logs/job | ✅ No bloat |
| **Minimum Keep** | Preserve recent | ✅ Debugging data |

**Bottom Line:** Your job history is now protected from infinite growth! 🎉

---

## Next Steps

1. ✅ Run health check: `yarn jobs:health`
2. ✅ Review current history size
3. 🔧 Enable automated maintenance (recommended)
4. 📊 Monitor weekly
5. 🧹 Schedule periodic cleanup

Try it: `yarn jobs:health` 🚀

