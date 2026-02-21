/**
 * Maintenance Jobs Initialization
 *
 * Initializes automated cleanup for:
 * 1. API response cache (every 1 hour)
 * 2. Job history records (every 6 hours)
 *
 * This ensures database size stays controlled and doesn't grow indefinitely.
 */

import { CacheMaintenanceJob } from "@buydy/se-eodhd-cache/cacheMaintenanceJob";
import { JobMaintenanceJob } from "@buydy/se-db/src/jobMaintenanceJob.js";
import logger from "@buydy/se-logger";

let cacheMaintenance = null;
let jobMaintenance = null;

/**
 * Initialize and start all maintenance jobs
 */
export async function initializeMaintenance() {
  logger.business("🔧 Initializing maintenance jobs...");

  try {
    // 1. Cache Maintenance
    // Runs every 1 hour to clean expired API responses and enforce size limits
    cacheMaintenance = new CacheMaintenanceJob({
      maxCacheSizeMB: 500, // Max 500 MB of cached API responses
      maxDocuments: 100000, // Max 100k cached documents
      cleanupIntervalMs: 60 * 60 * 1000, // Run every 1 hour
    });

    await cacheMaintenance.initialize();
    cacheMaintenance.start();
    logger.debug("   ✅ Cache maintenance started (every 1 hour)");
    logger.debug("      - Max size: 500 MB");
    logger.debug("      - Max documents: 100,000");
    logger.debug("      - Cache TTL: 7 days");

    // 2. Job History Maintenance
    // Runs every 6 hours to clean old job records and enforce retention policies
    jobMaintenance = new JobMaintenanceJob({
      completedJobsRetentionDays: 30, // Keep completed jobs for 30 days
      failedJobsRetentionDays: 90, // Keep failed jobs for 90 days (debugging)
      stuckJobThresholdHours: 2, // Mark jobs as stuck after 2 hours
      maxTotalJobs: 10000, // Max 10k total job records
      maxLogsPerJob: 1000, // Max 1k log entries per job
      minJobsToKeepPerType: 10, // Always keep last 10 of each job type
      cleanupIntervalMs: 6 * 60 * 60 * 1000, // Run every 6 hours
    });

    await jobMaintenance.initialize();
    jobMaintenance.start();
    logger.debug("   ✅ Job maintenance started (every 6 hours)");
    logger.debug("      - Completed jobs: 30 days retention");
    logger.debug("      - Failed jobs: 90 days retention");
    logger.debug("      - Max total: 10,000 records");
    logger.debug("      - Minimum keep: 10/type");

    logger.business("✅ Maintenance jobs initialized successfully");
    logger.debug("");
    logger.debug("💡 Database size will be automatically controlled:");
    logger.debug("   - Cache collection: bounded at ~500 MB");
    logger.debug("   - Jobs collection: bounded at ~10k records");
    logger.debug("");
  } catch (error) {
    logger.business("❌ Failed to initialize maintenance jobs:", error);
    logger.business("⚠️  Database cleanup will not run automatically");
    logger.business("💡 Run manual cleanup: yarn cache:cleanup && yarn jobs:cleanup");
  }
}

/**
 * Stop all maintenance jobs (for graceful shutdown)
 */
export function stopMaintenance() {
  logger.debug("🛑 Stopping maintenance jobs...");

  if (cacheMaintenance) {
    cacheMaintenance.stop();
    logger.debug("   ✅ Cache maintenance stopped");
  }

  if (jobMaintenance) {
    jobMaintenance.stop();
    logger.debug("   ✅ Job maintenance stopped");
  }
}

/**
 * Get current maintenance status
 */
export function getMaintenanceStatus() {
  return {
    cache: {
      running: cacheMaintenance !== null,
      config: cacheMaintenance
        ? {
            maxSizeMB: 500,
            maxDocuments: 100000,
            intervalHours: 1,
          }
        : null,
    },
    jobs: {
      running: jobMaintenance !== null,
      config: jobMaintenance
        ? {
            completedRetentionDays: 30,
            failedRetentionDays: 90,
            maxTotalJobs: 10000,
            intervalHours: 6,
          }
        : null,
    },
  };
}

/**
 * Get health report from both maintenance jobs
 */
export async function getMaintenanceHealth() {
  const health = {
    cache: null,
    jobs: null,
    overall: "unknown",
  };

  try {
    if (cacheMaintenance) {
      health.cache = await cacheMaintenance.getHealthReport();
    }

    if (jobMaintenance) {
      health.jobs = await jobMaintenance.getHealthReport();
    }

    // Determine overall health
    const cacheHealthy = !health.cache || health.cache.status === "healthy";
    const jobsHealthy = !health.jobs || health.jobs.status === "healthy";

    if (cacheHealthy && jobsHealthy) {
      health.overall = "healthy";
    } else {
      health.overall = "warning";
    }
  } catch (error) {
    logger.business("Error getting maintenance health:", error);
    health.overall = "error";
  }

  return health;
}

export default {
  initializeMaintenance,
  stopMaintenance,
  getMaintenanceStatus,
  getMaintenanceHealth,
};
