import cron from "node-cron";
import { getModel } from "@buydy/se-db";
import logger from "@buydy/se-logger";
import { getMachineDisplayName } from "../utils/machine-info.js";

/**
 * Global Job Manager
 * Handles all job lifecycle management, error handling, and completion tracking
 * Ensures database always reflects the true job status
 */
class GlobalJobManager {
  constructor() {
    this.activeJobs = new Map(); // Track active job records
    this.setupGlobalErrorHandlers();
  }

  /**
   * Setup global error handlers to ensure jobs are always marked as completed/failed
   */
  setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.business("🚨 Unhandled Rejection", { reason, promise });
      this.markAllActiveJobsAsFailed("Unhandled promise rejection");
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.business("🚨 Uncaught Exception", { error: error.message, stack: error.stack });
      this.markAllActiveJobsAsFailed(`Uncaught exception: ${error.message}`);
      process.exit(1);
    });

    // Handle process termination
    process.on("SIGINT", () => {
      logger.business("🚨 Process interrupted (SIGINT)");
      this.markAllActiveJobsAsFailed("Process interrupted by user");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.business("🚨 Process terminated (SIGTERM)");
      this.markAllActiveJobsAsFailed("Process terminated by system");
      process.exit(0);
    });
  }

  /**
   * Mark all active jobs as failed (emergency cleanup)
   */
  async markAllActiveJobsAsFailed(reason) {
    const Jobs = getModel("jobs");
    try {
      const errorDetails = {
        message: reason,
        timestamp: new Date().toISOString(),
        emergency: true,
      };

      await Jobs.updateMany(
        { status: "running" },
        {
          status: "failed",
          endedAt: new Date(),
          error: reason,
          errorDetails: errorDetails,
          progress: 0,
        }
      );
      logger.business("🚨 Marked all running jobs as failed", { reason });
    } catch (error) {
      logger.business("🚨 Failed to mark active jobs as failed", { error: error.message });
    }
  }

  /**
   * Register an active job for tracking
   */
  registerActiveJob(name, jobRecord) {
    this.activeJobs.set(name, jobRecord);
    logger.debug("📝 Registered active job", { name });
  }

  /**
   * Unregister a completed job
   */
  unregisterActiveJob(name) {
    this.activeJobs.delete(name);
    logger.debug("✅ Unregistered completed job", { name });
  }

  /**
   * Get active job record
   */
  getActiveJob(name) {
    return this.activeJobs.get(name);
  }
}

// Global instance
const globalJobManager = new GlobalJobManager();

/**
 * makeJob
 * Registers a job that runs on a cron schedule, tracks lifecycle in Mongo,
 * and can optionally run immediately.
 *
 * GLOBAL ERROR HANDLING: This function ensures that job status is ALWAYS
 * properly updated in the database, regardless of how the job fails or completes.
 *
 * @param {Function} fn   async function(ctx) => result
 * @param {Object} opts   { cron: string, name?: string, runNow?: boolean }
 */
export function makeJob(fn, opts) {
  const name = opts.name || fn.name || "anonymous-job";
  const cronExpr = opts.cron;
  const timezone = opts.timezone || "UTC";

  if (!cronExpr) throw new Error(`Job "${name}" requires a cron expression`);

  const runOnce = async () => {
    let jobRecord = null;
    let jobStarted = false;

    try {
      // Get Jobs model
      const Jobs = getModel("jobs");

      // Check if a job with the same name is already running
      const existingRunningJob = await Jobs.findOne({
        name,
        status: "running",
      });

      if (existingRunningJob) {
        // Check if the running job has been stuck for more than 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        if (existingRunningJob.startedAt < twoHoursAgo) {
          logger.business(
            `[${name}] Found stuck job (running for ${Math.round(
              (Date.now() - existingRunningJob.startedAt) / 1000 / 60
            )} minutes), marking as failed and continuing...`
          );
          try {
            // Use atomic method to prevent parallel save conflicts
            await existingRunningJob.markAsFailedAtomic(
              "Job was stuck in running status for more than 2 hours"
            );
            globalJobManager.unregisterActiveJob(name);
          } catch (error) {
            logger.business(`[${name}] Failed to mark stuck job as failed`, {
              error: error.message,
            });
          }
        } else {
          logger.debug(
            `[${name}] Job already running, skipping execution. Started at: ${existingRunningJob.startedAt}`
          );
          return;
        }
      }

      // Create scheduled job record
      const scheduledAt = new Date();
      const machineName = getMachineDisplayName();
      jobRecord = new Jobs({
        name,
        machineName,
        status: "scheduled",
        scheduledAt,
        startedAt: null,
        endedAt: null,
        progress: 0,
        result: null,
        error: null,
        logs: [],
        metadata: {},
        cronExpression: cronExpr,
        timezone: timezone,
        nextRun: null, // Will be calculated after save
      });

      await jobRecord.save();

      // Calculate and update next run time
      const nextRun = jobRecord.calculateNextRun();
      if (nextRun) {
        jobRecord.nextRun = nextRun;
        await jobRecord.save();
      }

      const appendLog = async (msg, level = "info") => {
        // Only log to console, not to database (to avoid memory issues with large logs)
        logger.debug(`[${name}] ${msg}`);
        // Optionally, only store important logs (errors, warnings, start/end)
        if (
          level === "error" ||
          level === "warn" ||
          msg.includes("started") ||
          msg.includes("completed") ||
          msg.includes("Summary")
        ) {
          try {
            // Use atomic method to prevent parallel save conflicts
            await jobRecord.addLogAtomic(msg, level);
          } catch (error) {
            logger.debug(`[${name}] Failed to add log`, { error: error.message });
          }
        }
      };

      const progress = async (p) => {
        if (typeof p !== "number" || p < 0 || p > 1) {
          throw new Error(`progress() expects number in [0,1], got ${p}`);
        }
        try {
          // Use atomic update to avoid stale document errors
          await Jobs.findByIdAndUpdate(jobRecord._id, { progress: p }, { new: true });
          logger.debug(`[${name}] progress: ${(p * 100).toFixed(1)}%`);
        } catch (error) {
          // If document not found, try to find the latest job record
          if (error.name === "DocumentNotFoundError") {
            try {
              const latestJob = await Jobs.findOne({ name }).sort({ scheduledAt: -1 });
              if (latestJob) {
                await Jobs.findByIdAndUpdate(latestJob._id, { progress: p }, { new: true });
                logger.debug(`[${name}] progress: ${(p * 100).toFixed(1)}% (using latest record)`);
              }
            } catch (retryError) {
              logger.debug(`[${name}] Failed to update progress (retry failed)`, {
                error: retryError.message,
              });
            }
          } else {
            logger.debug(`[${name}] Failed to update progress`, { error: error.message });
          }
        }
      };

      // Mark job as running with robust error handling
      try {
        await jobRecord.markAsRunning();
        jobStarted = true;
        globalJobManager.registerActiveJob(name, jobRecord);
        await appendLog("job started");
        logger.business(`🚀 [${name}] Job started`);
      } catch (error) {
        logger.debug(`[${name}] Failed to mark job as running`, { error: error.message });
        throw new Error(`Failed to start job: ${error.message}`);
      }

      // Execute the job function with timeout protection
      const jobTimeout = 6 * 60 * 60 * 1000; // 6 hours timeout
      const jobPromise = fn({ progress, appendLog });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Job timeout after 6 hours")), jobTimeout);
      });

      const result = await Promise.race([jobPromise, timeoutPromise]);

      // Mark job as completed with robust error handling
      try {
        // Use atomic method to prevent parallel save conflicts
        await jobRecord.markAsCompletedAtomic(result);
        globalJobManager.unregisterActiveJob(name);
        // Add completion log using atomic method
        await jobRecord.addLogAtomic("job completed", "info");
        logger.business(`✅ [${name}] Job completed`);
      } catch (error) {
        logger.debug(`[${name}] Failed to mark job as completed`, { error: error.message });
        // Force update the database directly
        await Jobs.updateOne(
          { _id: jobRecord._id },
          {
            status: "completed",
            endedAt: new Date(),
            result: result,
            progress: 1,
          }
        );
        globalJobManager.unregisterActiveJob(name);
      }
    } catch (err) {
      logger.business(`❌ [${name}] Job failed`, { error: err.message, stack: err.stack });

      // Mark job as failed with robust error handling
      if (jobRecord && jobStarted) {
        try {
          // Create comprehensive error details object
          const errorDetails = {
            message: err.message || String(err),
            stack: err.stack,
            name: err.name,
            code: err.code,
            status: err.status,
            response: err.response
              ? {
                  status: err.response.status,
                  statusText: err.response.statusText,
                  data: err.response.data,
                }
              : null,
            timestamp: new Date().toISOString(),
            jobName: name,
          };

          // Use atomic method to prevent parallel save conflicts
          await jobRecord.markAsFailedAtomic(err.message || String(err), errorDetails);
          globalJobManager.unregisterActiveJob(name);
          logger.debug(`💥 [${name}] Job marked as failed in database`);
        } catch (statusUpdateError) {
          logger.debug(`[${name}] Failed to mark job as failed`, {
            error: statusUpdateError.message,
          });

          // Force update the database directly as last resort
          try {
            const Jobs = getModel("jobs");
            const errorDetails = {
              message: err.message || String(err),
              stack: err.stack,
              name: err.name,
              code: err.code,
              status: err.status,
              response: err.response
                ? {
                    status: err.response.status,
                    statusText: err.response.statusText,
                    data: err.response.data,
                  }
                : null,
              timestamp: new Date().toISOString(),
              jobName: name,
            };

            await Jobs.updateOne(
              { _id: jobRecord._id },
              {
                status: "failed",
                endedAt: new Date(),
                error: err.message || String(err),
                errorDetails: errorDetails,
                progress: 0,
              }
            );
            globalJobManager.unregisterActiveJob(name);
            logger.debug(`💥 [${name}] Job force-updated as failed in database`);
          } catch (forceUpdateError) {
            logger.business(`[${name}] CRITICAL: Failed to force-update job status`, {
              error: forceUpdateError.message,
            });
          }
        }
      } else if (jobRecord) {
        // Job failed before it could be marked as running
        try {
          const errorDetails = {
            message: `Job failed during startup: ${err.message || String(err)}`,
            stack: err.stack,
            name: err.name,
            code: err.code,
            status: err.status,
            response: err.response
              ? {
                  status: err.response.status,
                  statusText: err.response.statusText,
                  data: err.response.data,
                }
              : null,
            timestamp: new Date().toISOString(),
            jobName: name,
          };

          // Use atomic method to prevent parallel save conflicts
          await jobRecord.markAsFailedAtomic(
            `Job failed during startup: ${err.message || String(err)}`,
            errorDetails
          );
          logger.debug(`💥 [${name}] Job marked as failed during startup`);
        } catch (statusUpdateError) {
          logger.debug(`[${name}] Failed to mark job as failed during startup`, {
            error: statusUpdateError.message,
          });
        }
      }
    }
  };

  // schedule via cron
  cron.schedule(cronExpr, runOnce, {
    timezone,
  });

  logger.debug(`[${name}] scheduled with cron`, { cronExpr });

  // optional immediate run
  if (opts.runNow) {
    logger.debug(`[${name}] running immediately (runNow=true)`);
    runOnce();
  }
}

// Export the global job manager for external access
export { globalJobManager };
