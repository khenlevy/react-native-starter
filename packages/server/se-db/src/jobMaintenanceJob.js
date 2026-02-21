/**
 * Job History Maintenance Job
 *
 * Ensures the jobs collection doesn't store data forever by:
 * 1. Cleaning up old completed jobs (keep recent history)
 * 2. Cleaning up old failed jobs (keep for debugging)
 * 3. Archiving stuck running jobs
 * 4. Enforcing log size limits
 * 5. Providing health monitoring
 */

import { getDatabase, getModel } from "./index.js";
import logger from "@buydy/se-logger";

export class JobMaintenanceJob {
  constructor(options = {}) {
    // Retention periods (in days)
    this.completedJobsRetentionDays = options.completedJobsRetentionDays || 30; // Keep 30 days
    this.failedJobsRetentionDays = options.failedJobsRetentionDays || 90; // Keep 90 days
    this.stuckJobThresholdHours = options.stuckJobThresholdHours || 2; // Mark as stuck after 2 hours

    // Size limits
    this.maxTotalJobs = options.maxTotalJobs || 10000; // Max 10k total job records
    this.maxLogsPerJob = options.maxLogsPerJob || 1000; // Max 1k logs per job
    this.minJobsToKeepPerType = options.minJobsToKeepPerType || 10; // Always keep last 10 of each job type

    // Maintenance schedule
    this.cleanupIntervalMs = options.cleanupIntervalMs || 6 * 60 * 60 * 1000; // 6 hours

    this.intervalId = null;
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      this.db = await getDatabase();
      logger.debug("✅ Job maintenance initialized");
    } catch (error) {
      logger.business("❌ Failed to initialize job maintenance:", error);
      throw error;
    }
  }

  /**
   * Start scheduled maintenance
   */
  start() {
    if (this.intervalId) {
      logger.debug("⚠️  Job maintenance already running");
      return;
    }

    logger.business(
      `🔧 Starting job maintenance (every ${this.cleanupIntervalMs / 1000 / 60 / 60} hours)`
    );

    // Run immediately
    this.runMaintenance();

    // Schedule recurring maintenance
    this.intervalId = setInterval(() => {
      this.runMaintenance();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop scheduled maintenance
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.business("🛑 Job maintenance stopped");
    }
  }

  /**
   * Run all maintenance tasks
   */
  async runMaintenance() {
    try {
      logger.debug("🧹 Running job maintenance...");

      const stats = await this.getJobStats();
      logger.debug(`📊 Job stats: ${JSON.stringify(stats)}`);

      // Task 1: Clean up stuck jobs
      const stuckCount = await this.cleanupStuckJobs();

      // Task 2: Clean up old completed jobs
      const completedCount = await this.cleanupOldCompletedJobs();

      // Task 3: Clean up old failed jobs (keep longer for debugging)
      const failedCount = await this.cleanupOldFailedJobs();

      // Task 4: Trim large logs
      const logsTrimmed = await this.trimLargeLogs();

      // Task 5: Enforce total job limits
      const limitCleanup = await this.enforceTotalJobLimits(stats);

      const totalCleaned = stuckCount + completedCount + failedCount + limitCleanup;

      if (totalCleaned > 0 || logsTrimmed > 0) {
        logger.business(
          `✅ Job maintenance completed: ${totalCleaned} jobs removed, ${logsTrimmed} logs trimmed`
        );
        logger.debug(
          `   - Stuck: ${stuckCount}, Completed: ${completedCount}, Failed: ${failedCount}, Limit: ${limitCleanup}`
        );
      } else {
        logger.debug("✅ Job maintenance completed: no cleanup needed");
      }
    } catch (error) {
      logger.business("❌ Job maintenance failed:", error);
    }
  }

  /**
   * Get job statistics
   */
  async getJobStats() {
    const Jobs = getModel("jobs");

    const stats = await Jobs.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          byJobName: [
            {
              $group: {
                _id: "$name",
                count: { $sum: 1 },
                lastRun: { $max: "$scheduledAt" },
                completedCount: {
                  $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
                },
                failedCount: {
                  $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
                },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          oldestRecord: [{ $sort: { scheduledAt: 1 } }, { $limit: 1 }],
          avgLogsPerJob: [
            {
              $group: {
                _id: null,
                avgLogs: { $avg: { $size: "$logs" } },
                maxLogs: { $max: { $size: "$logs" } },
              },
            },
          ],
        },
      },
    ]);

    const result = stats[0];

    const byStatus = {};
    result.byStatus.forEach((s) => {
      byStatus[s._id] = s.count;
    });

    return {
      total: result.total[0]?.count || 0,
      byStatus,
      byJobName: result.byJobName,
      oldestRecord: result.oldestRecord[0]?.scheduledAt || null,
      avgLogsPerJob: Math.round(result.avgLogsPerJob[0]?.avgLogs || 0),
      maxLogsPerJob: result.avgLogsPerJob[0]?.maxLogs || 0,
    };
  }

  /**
   * Clean up stuck jobs (jobs running for more than threshold)
   */
  async cleanupStuckJobs() {
    try {
      const Jobs = getModel("jobs");
      const threshold = new Date(Date.now() - this.stuckJobThresholdHours * 60 * 60 * 1000);

      const stuckJobs = await Jobs.find({
        status: "running",
        startedAt: { $lt: threshold },
      });

      if (stuckJobs.length === 0) {
        return 0;
      }

      logger.business(`⚠️  Found ${stuckJobs.length} stuck jobs`);

      let cleaned = 0;
      for (const job of stuckJobs) {
        try {
          await job.markAsFailedAtomic(
            `Job stuck in running status for more than ${this.stuckJobThresholdHours} hours`
          );
          cleaned++;
        } catch (error) {
          logger.business(`Failed to mark stuck job ${job.name} as failed:`, error.message);
        }
      }

      if (cleaned > 0) {
        logger.business(`🗑️  Cleaned up ${cleaned} stuck jobs`);
      }

      return cleaned;
    } catch (error) {
      logger.business("Error cleaning stuck jobs:", error);
      return 0;
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldCompletedJobs() {
    try {
      const Jobs = getModel("jobs");
      const cutoff = new Date(Date.now() - this.completedJobsRetentionDays * 24 * 60 * 60 * 1000);

      // Get unique job names to preserve minimum history per job type
      const jobNames = await Jobs.distinct("name");

      let totalDeleted = 0;

      for (const jobName of jobNames) {
        // Get all completed jobs for this job name, sorted by date (newest first)
        const completedJobs = await Jobs.find({
          name: jobName,
          status: "completed",
        })
          .sort({ endedAt: -1 })
          .select("_id endedAt");

        // Keep at least minJobsToKeepPerType, delete the rest if older than cutoff
        const jobsToDelete = completedJobs
          .slice(this.minJobsToKeepPerType) // Skip the newest N jobs
          .filter((job) => job.endedAt && job.endedAt < cutoff)
          .map((job) => job._id);

        if (jobsToDelete.length > 0) {
          const result = await Jobs.deleteMany({
            _id: { $in: jobsToDelete },
          });
          totalDeleted += result.deletedCount;
        }
      }

      if (totalDeleted > 0) {
        logger.business(
          `🗑️  Removed ${totalDeleted} old completed jobs (older than ${this.completedJobsRetentionDays} days)`
        );
      }

      return totalDeleted;
    } catch (error) {
      logger.business("Error cleaning old completed jobs:", error);
      return 0;
    }
  }

  /**
   * Clean up old failed jobs (keep longer for debugging)
   */
  async cleanupOldFailedJobs() {
    try {
      const Jobs = getModel("jobs");
      const cutoff = new Date(Date.now() - this.failedJobsRetentionDays * 24 * 60 * 60 * 1000);

      // Get unique job names
      const jobNames = await Jobs.distinct("name");

      let totalDeleted = 0;

      for (const jobName of jobNames) {
        // Get all failed jobs for this job name, sorted by date (newest first)
        const failedJobs = await Jobs.find({
          name: jobName,
          status: "failed",
        })
          .sort({ endedAt: -1 })
          .select("_id endedAt");

        // Keep at least minJobsToKeepPerType, delete the rest if older than cutoff
        const jobsToDelete = failedJobs
          .slice(this.minJobsToKeepPerType)
          .filter((job) => job.endedAt && job.endedAt < cutoff)
          .map((job) => job._id);

        if (jobsToDelete.length > 0) {
          const result = await Jobs.deleteMany({
            _id: { $in: jobsToDelete },
          });
          totalDeleted += result.deletedCount;
        }
      }

      if (totalDeleted > 0) {
        logger.business(
          `🗑️  Removed ${totalDeleted} old failed jobs (older than ${this.failedJobsRetentionDays} days)`
        );
      }

      return totalDeleted;
    } catch (error) {
      logger.business("Error cleaning old failed jobs:", error);
      return 0;
    }
  }

  /**
   * Trim logs from jobs with excessive log entries
   */
  async trimLargeLogs() {
    try {
      const Jobs = getModel("jobs");

      // Find jobs with more than maxLogsPerJob logs
      const jobsWithLargeLogs = await Jobs.find({
        $expr: { $gt: [{ $size: "$logs" }, this.maxLogsPerJob] },
      }).select("_id logs");

      if (jobsWithLargeLogs.length === 0) {
        return 0;
      }

      let trimmed = 0;

      for (const job of jobsWithLargeLogs) {
        // Keep only the last maxLogsPerJob logs
        const trimmedLogs = job.logs.slice(-this.maxLogsPerJob);

        await Jobs.updateOne({ _id: job._id }, { $set: { logs: trimmedLogs } });

        trimmed++;
      }

      if (trimmed > 0) {
        logger.debug(`✂️  Trimmed logs from ${trimmed} jobs`);
      }

      return trimmed;
    } catch (error) {
      logger.business("Error trimming large logs:", error);
      return 0;
    }
  }

  /**
   * Enforce total job limits by removing oldest jobs
   */
  async enforceTotalJobLimits(stats) {
    if (stats.total <= this.maxTotalJobs) {
      return 0;
    }

    try {
      const Jobs = getModel("jobs");
      const excessCount = stats.total - this.maxTotalJobs;

      logger.business(`⚠️  Job count exceeds limit (${stats.total} > ${this.maxTotalJobs})`);

      // Get oldest completed/failed jobs (never delete running/scheduled)
      const oldestJobs = await Jobs.find({
        status: { $in: ["completed", "failed"] },
      })
        .sort({ endedAt: 1 })
        .limit(excessCount)
        .select("_id");

      const idsToRemove = oldestJobs.map((job) => job._id);

      const result = await Jobs.deleteMany({
        _id: { $in: idsToRemove },
      });

      logger.business(`🗑️  Removed ${result.deletedCount} oldest jobs to enforce limit`);

      return result.deletedCount;
    } catch (error) {
      logger.business("Error enforcing job limits:", error);
      return 0;
    }
  }

  /**
   * Get health report
   */
  async getHealthReport() {
    const stats = await this.getJobStats();

    const health = {
      status: "healthy",
      warnings: [],
      stats,
      timestamp: new Date(),
    };

    // Check for issues
    if (stats.total > this.maxTotalJobs * 0.9) {
      health.warnings.push(`Approaching job limit: ${stats.total}/${this.maxTotalJobs}`);
      health.status = "warning";
    }

    if (stats.byStatus.running > 10) {
      health.warnings.push(`Many running jobs: ${stats.byStatus.running}`);
    }

    if (stats.maxLogsPerJob > this.maxLogsPerJob) {
      health.warnings.push(
        `Job with excessive logs: ${stats.maxLogsPerJob} (limit: ${this.maxLogsPerJob})`
      );
    }

    const failureRate = stats.total > 0 ? (stats.byStatus.failed || 0) / stats.total : 0;
    if (failureRate > 0.3) {
      health.warnings.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
      health.status = "warning";
    }

    // Check for very old records
    if (stats.oldestRecord) {
      const oldestAge = Date.now() - new Date(stats.oldestRecord).getTime();
      const oldestAgeDays = Math.floor(oldestAge / (1000 * 60 * 60 * 24));

      if (oldestAgeDays > this.completedJobsRetentionDays * 1.5) {
        health.warnings.push(`Very old job records found: ${oldestAgeDays} days old`);
      }
    }

    return health;
  }

  /**
   * Get job retention summary
   */
  async getRetentionSummary() {
    const Jobs = getModel("jobs");

    const now = new Date();
    const completedCutoff = new Date(now - this.completedJobsRetentionDays * 24 * 60 * 60 * 1000);
    const failedCutoff = new Date(now - this.failedJobsRetentionDays * 24 * 60 * 60 * 1000);

    const [completedExpired, failedExpired, stuckJobs] = await Promise.all([
      Jobs.countDocuments({
        status: "completed",
        endedAt: { $lt: completedCutoff },
      }),
      Jobs.countDocuments({
        status: "failed",
        endedAt: { $lt: failedCutoff },
      }),
      Jobs.countDocuments({
        status: "running",
        startedAt: {
          $lt: new Date(now - this.stuckJobThresholdHours * 60 * 60 * 1000),
        },
      }),
    ]);

    return {
      completedExpired,
      failedExpired,
      stuckJobs,
      total: completedExpired + failedExpired + stuckJobs,
      policy: {
        completedRetentionDays: this.completedJobsRetentionDays,
        failedRetentionDays: this.failedJobsRetentionDays,
        stuckThresholdHours: this.stuckJobThresholdHours,
        maxTotalJobs: this.maxTotalJobs,
        minJobsToKeepPerType: this.minJobsToKeepPerType,
      },
    };
  }

  /**
   * Archive jobs before deletion (optional, for important historical data)
   */
  async archiveJobsBeforeDeletion(jobs) {
    // TODO: Implement archival to S3, file system, or separate archive collection
    // This is a placeholder for future implementation
    logger.debug(`📦 Archiving ${jobs.length} jobs (not yet implemented)`);
    return jobs;
  }
}

export default JobMaintenanceJob;
