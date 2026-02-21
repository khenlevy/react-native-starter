#!/usr/bin/env node

// Load environment variables FIRST
import { loadEnvironmentVariables } from "./config/envLoader.js";
loadEnvironmentVariables();

import { getDatabase, getModel } from "@buydy/se-db";
import logger from "@buydy/se-logger";
import { getJobsInExecutionOrder } from "@buydy/iso-business-types";

/**
 * Update job schedules in the database to match the current configuration
 * This script ensures that existing job records have the correct cron expressions and timezone
 */
async function updateJobSchedules() {
  logger.business("🔄 Updating job schedules in database...");

  try {
    // Initialize database connection
    logger.debug("🔗 Connecting to database");
    await getDatabase();
    logger.debug("✅ Database connected");

    // Get Jobs model
    const Jobs = getModel("jobs");

    // Get current job configuration
    const orderedJobTypes = getJobsInExecutionOrder();
    logger.debug(`📋 Found ${orderedJobTypes.length} job types in configuration`);

    let updatedCount = 0;
    let createdCount = 0;

    for (const jobType of orderedJobTypes) {
      logger.debug(`🔄 Processing job: ${jobType.displayName}`);

      // Find existing job record
      const existingJob = await Jobs.findOne({ name: jobType.id });

      if (existingJob) {
        // Update existing job record
        const needsUpdate =
          existingJob.cronExpression !== jobType.cronDefinition ||
          existingJob.timezone !== jobType.timezone;

        if (needsUpdate) {
          logger.debug(
            `   📝 Updating ${jobType.id}: cron=${jobType.cronDefinition}, timezone=${jobType.timezone}`
          );

          // Update the job record
          await Jobs.updateOne(
            { _id: existingJob._id },
            {
              cronExpression: jobType.cronDefinition,
              timezone: jobType.timezone,
              nextRun: null, // Will be recalculated
            }
          );

          // Recalculate next run time
          const updatedJob = await Jobs.findById(existingJob._id);
          if (updatedJob && updatedJob.calculateNextRun) {
            const nextRun = updatedJob.calculateNextRun();
            if (nextRun) {
              await Jobs.updateOne({ _id: existingJob._id }, { nextRun: nextRun });
            }
          }

          updatedCount++;
          logger.debug(`   ✅ Updated ${jobType.id}`);
        } else {
          logger.debug(`   ✅ ${jobType.id} is already up to date`);
        }
      } else {
        // Create new job record
        logger.debug(`   📝 Creating new job record for ${jobType.id}`);

        const newJob = new Jobs({
          name: jobType.id,
          machineName: "system",
          status: "scheduled",
          scheduledAt: new Date(),
          startedAt: null,
          endedAt: null,
          progress: 0,
          result: null,
          error: null,
          logs: [],
          metadata: {},
          cronExpression: jobType.cronDefinition,
          timezone: jobType.timezone,
          nextRun: null,
        });

        await newJob.save();

        // Calculate next run time
        if (newJob.calculateNextRun) {
          const nextRun = newJob.calculateNextRun();
          if (nextRun) {
            newJob.nextRun = nextRun;
            await newJob.save();
          }
        }

        createdCount++;
        logger.debug(`   ✅ Created ${jobType.id}`);
      }
    }

    logger.business("🎉 Job schedule update completed", {
      totalJobTypes: orderedJobTypes.length,
      updated: updatedCount,
      created: createdCount,
      unchanged: orderedJobTypes.length - updatedCount - createdCount,
    });
  } catch (error) {
    logger.business("❌ Job schedule update failed", { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run update if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateJobSchedules()
    .then(() => {
      logger.debug("✅ Job schedule update completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.business("❌ Job schedule update failed", { error: error.message });
      process.exit(1);
    });
}

export { updateJobSchedules };
