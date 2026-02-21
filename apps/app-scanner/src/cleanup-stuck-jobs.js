#!/usr/bin/env node

// Load environment variables FIRST
import { loadEnvironmentVariables } from "./config/envLoader.js";
loadEnvironmentVariables();

import { getDatabase, getModel } from "@buydy/se-db";
import logger from "@buydy/se-logger";

/**
 * Cleanup stuck jobs in the database
 * This script finds jobs that are stuck in "running" status and marks them as failed
 */
async function cleanupStuckJobs() {
  logger.business("🧹 Starting stuck jobs cleanup");

  try {
    // Initialize database connection
    logger.debug("🔗 Connecting to database");
    await getDatabase();
    logger.debug("✅ Database connected");

    // Get Jobs model
    const Jobs = getModel("jobs");

    // Find all jobs stuck in "running" status
    const stuckJobs = await Jobs.find({ status: "running" });

    if (stuckJobs.length === 0) {
      logger.debug("✅ No stuck jobs found");
      return;
    }

    logger.business(`🔍 Found ${stuckJobs.length} stuck jobs`);

    let cleanedCount = 0;
    const now = new Date();

    for (const job of stuckJobs) {
      const runningTime = now - job.startedAt;
      const runningMinutes = Math.round(runningTime / (1000 * 60));
      const runningHours = Math.round(runningMinutes / 60);

      logger.business(
        `   📋 ${job.name}: running for ${runningMinutes} minutes (${runningHours} hours)`
      );

      // Mark as failed if running for more than 1 hour
      if (runningTime > 60 * 60 * 1000) {
        try {
          await job.markAsFailed(`Job was stuck in running status for ${runningHours} hours`);
          cleanedCount++;
          logger.debug(`   ✅ Marked ${job.name} as failed`);
        } catch (error) {
          logger.debug(`   ❌ Failed to mark ${job.name} as failed`, { error: error.message });

          // Force update as last resort
          try {
            await Jobs.updateOne(
              { _id: job._id },
              {
                status: "failed",
                endedAt: new Date(),
                error: `Job was stuck in running status for ${runningHours} hours`,
                progress: 0,
              }
            );
            cleanedCount++;
            logger.business(`   ✅ Force-updated ${job.name} as failed`);
          } catch (forceError) {
            logger.business(
              `   💥 CRITICAL: Failed to force-update ${job.name}:`,
              forceError.message
            );
          }
        }
      } else {
        logger.debug(`   ⏳ ${job.name} is still within acceptable running time`);
      }
    }

    logger.business("🎉 Cleanup completed", {
      totalStuckJobs: stuckJobs.length,
      jobsCleaned: cleanedCount,
      jobsStillRunning: stuckJobs.length - cleanedCount,
    });
  } catch (error) {
    logger.business("❌ Cleanup failed", { error: error.message, stack: error.stack });
    // Don't exit - this is called during app startup, errors should be handled gracefully
    // The app should continue to initialize even if cleanup fails
    throw error; // Re-throw so caller can decide whether to continue
  }
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupStuckJobs()
    .then(() => {
      logger.debug("✅ Cleanup completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.business("❌ Cleanup failed", { error: error.message });
      process.exit(1);
    });
}

export { cleanupStuckJobs };
