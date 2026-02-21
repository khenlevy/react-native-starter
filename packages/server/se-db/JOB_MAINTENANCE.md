# Job History Maintenance Guide

## Overview

The jobs collection can grow indefinitely as jobs run repeatedly. This maintenance system ensures old job history doesn't accumulate forever while preserving important debugging information.

## Protection Layers

### Layer 1: Retention Policies

**Default retention periods:**
- ✅ Completed jobs: 30 days
- ✅ Failed jobs: 90 days (kept longer for debugging)
- ✅ Always keep last 10 runs of each job type (minimum)

**Why different retention?**
- Completed jobs: Routine success, don't need long history
- Failed jobs: Kept longer to investigate patterns and root causes

### Layer 2: Size Limits

**Limits:**
- Max total jobs: 10,000 records
- Max logs per job: 1,000 log entries
- When exceeded: Removes oldest records first (FIFO)

### Layer 3: Stuck Job Detection

**Protection:**
- Marks jobs as "failed" if running > 2 hours
- Prevents zombie jobs from blocking new runs
- Automatic cleanup every 6 hours

### Layer 4: Log Trimming

**Protection:**
- Trims excessive logs from individual jobs
- Keeps only the last 1,000 log entries per job
- Prevents single jobs from consuming excessive space

---

## Quick Start

### 1. Monitor Job History

```bash
# Check current status
yarn jobs:health

# Output:
# 📊 Job History Health Report:
# Status: ✅ HEALTHY
# Total Jobs: 2,345
# Running: 0
# Completed: 2,100
# Failed: 245
```

### 2. Run Manual Cleanup

```bash
# Clean expired jobs
yarn jobs:cleanup

# Show detailed breakdown
yarn jobs:health --details
```

### 3. Enable Automated Maintenance

Add to `apps/app-stocks-scanner/src/index.js`:

```javascript
import { JobMaintenanceJob } from "@buydy/se-db/src/jobMaintenanceJob.js";

// Initialize maintenance
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

## Configuration Options

```javascript
{
  // Retention periods (in days)
  completedJobsRetentionDays: 30,    // Keep completed jobs for 30 days
  failedJobsRetentionDays: 90,       // Keep failed jobs for 90 days
  
  // Stuck job detection
  stuckJobThresholdHours: 2,         // Mark as stuck after 2 hours
  
  // Size limits
  maxTotalJobs: 10000,               // Max total job records
  maxLogsPerJob: 1000,               // Max logs per job
  minJobsToKeepPerType: 10,          // Always keep last N of each job
  
  // Maintenance schedule
  cleanupIntervalMs: 21600000,       // Run every 6 hours
}
```

---

## What Gets Cleaned Up

### Scenario 1: Old Completed Jobs

```
Job: syncMetricsLargeCap
- 50 completed runs in last 30 days → KEEP
- 20 completed runs older than 30 days → DELETE (keep last 10)
- Result: 60 total records (50 recent + 10 oldest)
```

### Scenario 2: Old Failed Jobs

```
Job: syncDividendsLargeCap
- 15 failed runs in last 90 days → KEEP
- 5 failed runs older than 90 days → DELETE (keep last 10 if < 15 total)
- Result: All kept (within retention + minimum)
```

### Scenario 3: Stuck Jobs

```
Job: syncFundamentalsLargeCap
- Started: 3 hours ago
- Status: still "running"
- Action: Mark as FAILED after 2 hours threshold
```

### Scenario 4: Total Limit Enforcement

```
Total jobs: 11,000 (exceeds 10,000 limit)
- Remove 1,000 oldest completed/failed jobs
- Never delete running or scheduled jobs
- Result: 10,000 total (within limit)
```

---

## Maintenance Tasks

### Task 1: Clean Stuck Jobs ✅

**Frequency**: Every 6 hours  
**Action**: Mark jobs running > 2 hours as failed  
**Prevents**: Zombie jobs blocking new runs

### Task 2: Clean Old Completed Jobs ✅

**Frequency**: Every 6 hours  
**Action**: Delete completed jobs > 30 days (keep last 10 per type)  
**Saves**: Space from routine successful runs

### Task 3: Clean Old Failed Jobs ✅

**Frequency**: Every 6 hours  
**Action**: Delete failed jobs > 90 days (keep last 10 per type)  
**Preserves**: Recent failures for debugging

### Task 4: Trim Large Logs ✅

**Frequency**: Every 6 hours  
**Action**: Keep only last 1,000 logs per job  
**Prevents**: Single jobs consuming excessive space

### Task 5: Enforce Total Limits ✅

**Frequency**: Every 6 hours  
**Action**: Remove oldest records if total > limit  
**Prevents**: Unbounded growth

---

## Health Monitoring

### Health Status Codes

- **✅ healthy**: All metrics within normal range
- **⚠️ warning**: Approaching limits or high failure rate

### Warning Triggers

1. **Total jobs > 90% of limit**
   ```
   Warning: Approaching job limit: 9,500/10,000
   ```

2. **Many running jobs**
   ```
   Warning: Many running jobs: 15
   ```

3. **Excessive logs**
   ```
   Warning: Job with excessive logs: 1,500 (limit: 1,000)
   ```

4. **High failure rate**
   ```
   Warning: High failure rate: 35.2%
   ```

5. **Very old records**
   ```
   Warning: Very old job records found: 120 days old
   ```

---

## CLI Commands

### View Health

```bash
# Basic health check
yarn jobs:health

# Detailed breakdown
yarn jobs:health --details
```

### Run Cleanup

```bash
# Manual cleanup
yarn jobs:cleanup

# This will:
# 1. Clean stuck jobs
# 2. Delete old completed jobs (> 30 days)
# 3. Delete old failed jobs (> 90 days)
# 4. Trim excessive logs
# 5. Enforce total limits
```

---

## Best Practices

### 1. Monitor Regularly

```bash
# Add to cron (daily at 3 AM)
0 3 * * * cd /path/to/Buydy && yarn jobs:health >> logs/job-maintenance.log 2>&1

# Weekly cleanup
0 3 * * 0 cd /path/to/Buydy && yarn jobs:cleanup >> logs/job-maintenance.log 2>&1
```

### 2. Adjust Retention Based on Usage

**Low-frequency jobs** (weekly):
```javascript
completedJobsRetentionDays: 90,  // Keep more history
failedJobsRetentionDays: 180,
```

**High-frequency jobs** (every 5 minutes):
```javascript
completedJobsRetentionDays: 7,   // Keep less history
failedJobsRetentionDays: 30,
```

### 3. Archive Before Deletion

For critical production data:

```javascript
// Custom implementation needed
async archiveJobsBeforeDeletion(jobs) {
  // Save to S3, file system, or archive database
  await saveToArchive(jobs);
}
```

### 4. Monitor Failure Patterns

```bash
# Check health regularly
yarn jobs:health --details

# Look for:
# - Repeatedly failing jobs
# - Jobs with high failure rates
# - Stuck jobs pattern
```

---

## Integration Examples

### Example 1: Basic Integration

```javascript
// In apps/app-stocks-scanner/src/index.js
import { JobMaintenanceJob } from "@buydy/se-db/src/jobMaintenanceJob.js";

const jobMaintenance = new JobMaintenanceJob();
await jobMaintenance.initialize();
jobMaintenance.start();
```

### Example 2: Custom Configuration

```javascript
const jobMaintenance = new JobMaintenanceJob({
  completedJobsRetentionDays: 14,   // 2 weeks
  failedJobsRetentionDays: 60,      // 2 months
  maxTotalJobs: 5000,               // Smaller limit
});
```

### Example 3: Manual Trigger

```javascript
// Run maintenance manually (e.g., before release)
const jobMaintenance = new JobMaintenanceJob();
await jobMaintenance.initialize();
await jobMaintenance.runMaintenance();
```

---

## Troubleshooting

### Issue: Jobs Collection Growing Too Fast

**Symptoms:**
- Total jobs increasing rapidly
- Cleanup not keeping up

**Solutions:**
1. Reduce retention periods:
   ```javascript
   completedJobsRetentionDays: 7,  // Reduce from 30
   ```
2. Increase cleanup frequency:
   ```javascript
   cleanupIntervalMs: 3600000,  // Every hour instead of 6
   ```
3. Reduce `maxLogsPerJob`:
   ```javascript
   maxLogsPerJob: 100,  // Reduce from 1000
   ```

### Issue: Missing Important Job History

**Symptoms:**
- Can't find recent job runs
- History gaps

**Solutions:**
1. Increase retention:
   ```javascript
   completedJobsRetentionDays: 60,
   ```
2. Increase minimum kept per type:
   ```javascript
   minJobsToKeepPerType: 50,
   ```
3. Check cleanup logs for aggressive deletion

### Issue: Stuck Jobs Not Cleaned

**Symptoms:**
- Jobs stuck in "running" status
- Blocking new runs

**Solutions:**
1. Run manual cleanup:
   ```bash
   yarn jobs:cleanup
   ```
2. Reduce stuck threshold:
   ```javascript
   stuckJobThresholdHours: 1,
   ```
3. Check cleanup logs

---

## Comparison: Jobs vs Cache Cleanup

| Feature | Job Maintenance | Cache Maintenance |
|---------|----------------|-------------------|
| **Retention** | 30/90 days | 7 days (TTL) |
| **Size limit** | 10k records | 500 MB |
| **Cleanup freq** | Every 6 hours | Every 1 hour |
| **Auto cleanup** | Scheduled | TTL + Scheduled |
| **Critical data** | Yes (keep failed) | No (all ephemeral) |

---

## Metrics to Track

Monitor these in production:

1. **Total job count**
2. **Jobs by status** (running, completed, failed)
3. **Failure rate** (failed / total)
4. **Cleanup frequency** (how often maintenance runs)
5. **Average job duration**
6. **Stuck job count**
7. **Oldest job record age**

---

## FAQ

**Q: Will cleanup affect running jobs?**  
A: No, cleanup only affects completed/failed/stuck jobs. Running jobs are never deleted.

**Q: What happens if I delete a job while it's being viewed in the UI?**  
A: The UI will show a "not found" error. Implement soft deletes if this is critical.

**Q: Can I recover deleted jobs?**  
A: No, unless you implement archiving. Consider archiving before enabling aggressive cleanup.

**Q: Why keep failed jobs longer than completed?**  
A: Failed jobs contain debugging information. Keeping them longer helps identify patterns.

**Q: Can I disable cleanup for specific job types?**  
A: Not directly, but you can increase `minJobsToKeepPerType` to effectively keep more history.

---

## Next Steps

1. ✅ Run health check: `yarn jobs:health`
2. ✅ Review retention policy
3. 🔧 Enable automated maintenance (optional)
4. 📊 Monitor regularly
5. 🧹 Schedule periodic cleanup

