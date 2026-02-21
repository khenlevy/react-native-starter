#!/usr/bin/env node

// Load environment variables FIRST
import { loadEnvironmentVariables } from "./config/envLoader.js";
loadEnvironmentVariables();

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { getDatabase } from "@buydy/se-db";
import { AsyncQueueManager } from "@buydy/dv-async-priority-queue";
import { getMaxConcurrentRequests } from "./config/concurrency.js";
import { getMachineDisplayName } from "./utils/machine-info.js";
import logger from "@buydy/se-logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure all logs are flushed immediately
process.stdout.setEncoding("utf8");
process.stderr.setEncoding("utf8");

// Handle process termination gracefully
process.on("SIGINT", () => {
  logger.business("⚠️  Job interrupted by user (Ctrl+C)");
  process.exit(130);
});

process.on("SIGTERM", () => {
  logger.business("⚠️  Job terminated by system");
  process.exit(143);
});

process.on("uncaughtException", (error) => {
  logger.business("💥 Uncaught Exception", { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.business("💥 Unhandled Rejection", { reason, promise });
  process.exit(1);
});

/**
 * Run a job module
 * @param {string} jobPath - Path to the job file (relative to src/)
 */
async function runJob(jobPath) {
  const startTime = Date.now();

  try {
    logger.business("🚀 Running job", { jobPath });
    logger.debug("📋 Environment variables", {
      mongoHost: process.env.MONGO_HOST ? "Set" : "Missing",
      eodhdApiToken: process.env.API_EODHD_API_TOKEN ? "Set" : "Missing",
    });

    // Import and run the job
    const jobModule = await import(resolve(__dirname, jobPath));

    // Find the main export function (usually the default export or the only export)
    const jobFunction = jobModule.default || Object.values(jobModule)[0];

    if (typeof jobFunction !== "function") {
      throw new Error(
        `No function found in ${jobPath}. Expected a default export or single function export.`
      );
    }

    logger.debug("⏳ Starting job execution");

    // Set up global API priority queue for EODHD API requests
    logger.debug("🚀 Setting up global API priority queue");
    const maxConcurrency = getMaxConcurrentRequests();
    const globalApiQueue = new AsyncQueueManager({
      maxConcurrency,
      name: "GlobalAPIQueue",
      verbose: process.env.QUEUE_VERBOSE_LOGGING === "true",
      onProgress: (completed, total) => {
        logger.debug("📊 API Queue Progress", {
          completed,
          total,
          percentage: ((completed / total) * 100).toFixed(1),
        });
      },
    });

    // Make the queue available globally for EODHD client
    globalThis.__BUYDY_API_PRIORITY_QUEUE__ = globalApiQueue;
    logger.debug("✅ Global API queue initialized", { maxConcurrency });

    // Initialize database connection before running the job
    logger.debug("🔗 Initializing database connection");
    try {
      await getDatabase();
      logger.debug("✅ Database connection established");
    } catch (error) {
      logger.business("❌ Failed to connect to database", { error: error.message });
      throw error;
    }

    // Extract job name from the path for tracking
    const jobName = jobPath.split("/").pop().replace(".js", "");
    const machineName = getMachineDisplayName();

    logger.debug("🏠 Running job with database tracking", { jobName, machineName });

    // Create job record directly (bypassing makeJob's conflict checking for manual runs)
    const Jobs = (await import("@buydy/se-db")).getModel("jobs");

    // Create job record directly
    const jobRecord = new Jobs({
      name: jobName,
      machineName: machineName,
      status: "scheduled",
      scheduledAt: new Date(),
      startedAt: null,
      endedAt: null,
      progress: 0,
      result: null,
      error: null,
      logs: [],
      metadata: {},
      cronExpression: "0 0 0 1 1 *", // Dummy cron
      timezone: "UTC",
      nextRun: null,
    });

    await jobRecord.save();

    // Mark as running
    await jobRecord.markAsRunning();
    logger.debug("📊 Job started with database tracking", { jobName, machineName });

    const appendLog = async (msg, level = "info") => {
      const formattedMessage = `[${jobName}] ${msg}`;
      if (level === "error") {
        logger.business(formattedMessage, { level: "error" });
      } else {
        logger.business(formattedMessage);
      }
      try {
        await jobRecord.addLogAtomic(msg, level);
      } catch (error) {
        logger.business(`[${jobName}] Failed to add log`, { error: error.message });
      }
    };

    const progress = async (p) => {
      if (typeof p !== "number" || p < 0 || p > 1) {
        throw new Error(`progress() expects number in [0,1], got ${p}`);
      }
      try {
        // Use atomic update to avoid stale document errors
        await Jobs.findByIdAndUpdate(jobRecord._id, { progress: p }, { new: true });
        logger.debug(`[${jobName}] progress`, { percentage: (p * 100).toFixed(1) });
      } catch (error) {
        // If document not found, try to find the latest job record
        if (error.name === "DocumentNotFoundError") {
          try {
            const latestJob = await Jobs.findOne({ name: jobName }).sort({ scheduledAt: -1 });
            if (latestJob) {
              await Jobs.findByIdAndUpdate(latestJob._id, { progress: p }, { new: true });
              logger.debug(`[${jobName}] progress (using latest record)`, {
                percentage: (p * 100).toFixed(1),
              });
            }
          } catch (retryError) {
            logger.debug(`[${jobName}] Failed to update progress (retry failed)`, {
              error: retryError.message,
            });
          }
        } else {
          logger.debug(`[${jobName}] Failed to update progress`, { error: error.message });
        }
      }
    };

    try {
      // Execute the job function with proper tracking
      const result = await jobFunction({ progress, appendLog });

      // Mark as completed
      await jobRecord.markAsCompletedAtomic(result);
      await appendLog("job completed", "info");

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.business("✅ Job completed successfully", { duration, machineName });

      if (result && Array.isArray(result)) {
        const stats = {
          total: result.length,
          success: result.filter((r) => r.ok).length,
          failed: result.filter((r) => !r.ok).length,
          skipped: result.filter((r) => r.skipped).length,
        };
        logger.debug("📊 Results Summary", stats);

        if (stats.failed > 0) {
          const failedSymbols = result
            .filter((r) => !r.ok)
            .map((r) => ({ symbol: r.symbol, error: r.error }));
          logger.debug("❌ Failed symbols", {
            count: stats.failed,
            symbols: failedSymbols.slice(0, 10),
          });
        }
      }

      // Force process exit after successful completion
      logger.debug("🏁 Job execution completed, exiting process");
      process.exit(0);
    } catch (error) {
      // Mark as failed
      try {
        await jobRecord.markAsFailedAtomic(error.message || String(error));
        await appendLog(`job failed: ${error.message}`, "error");
      } catch (statusError) {
        logger.debug(`[${jobName}] Failed to mark job as failed`, {
          error: statusError.message,
        });
      }

      throw error;
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.business("❌ Job failed", { duration, error: error.message });
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const jobPath = args[0];

if (!jobPath) {
  logger.business("❌ Usage: node run-job.js <job-path>");
  logger.debug("Example: node run-job.js jobs/large-cap/fundamentals/syncFundamentalsLargeCap.js");
  process.exit(1);
}

runJob(jobPath);
