#!/usr/bin/env node

/**
 * Test Schedule Information Script
 *
 * This script tests the new schedule information functionality
 * and shows how to retrieve job schedules from the database.
 */

import { getDatabase, getModel } from "@buydy/se-db";
import logger from "@buydy/se-logger";

async function testSchedules() {
  logger.debug("🧪 Testing schedule information functionality...");

  try {
    // Bootstrap database connection
    await getDatabase();
    logger.debug("✅ Database connection established");

    const Jobs = getModel("jobs");

    // Test the new getJobSchedules method
    logger.debug("📊 Retrieving job schedules");
    const schedules = await Jobs.getJobSchedules();

    if (schedules.length === 0) {
      logger.debug("ℹ️  No scheduled jobs found in database");
      logger.debug("   This is expected if no jobs have run yet with the new schedule fields");
      return;
    }

    logger.debug(`\n📋 Found ${schedules.length} job schedules:\n`);

    schedules.forEach((schedule, index) => {
      logger.debug(`${index + 1}. ${schedule.name}`);
      logger.debug(`   Cron: ${schedule.cronExpression}`);
      logger.debug(`   Timezone: ${schedule.timezone}`);
      logger.debug(
        `   Next Run: ${schedule.nextRun ? schedule.nextRun.toISOString() : "Not calculated"}`
      );
      logger.debug(`   Last Run: ${schedule.lastRun ? schedule.lastRun.toISOString() : "Never"}`);
      logger.debug(`   Total Runs: ${schedule.totalRuns}`);
      logger.debug(`   Success Rate: ${schedule.successRate.toFixed(1)}%`);
      logger.debug(`   Currently Running: ${schedule.runningRuns}`);
      logger.debug("");
    });

    // Test individual job records with schedule info
    logger.debug("🔍 Sample job records with schedule information:");
    const sampleJobs = await Jobs.find({ cronExpression: { $ne: null } })
      .sort({ scheduledAt: -1 })
      .limit(3)
      .select("name cronExpression timezone nextRun status scheduledAt");

    sampleJobs.forEach((job, index) => {
      logger.debug(`\n${index + 1}. ${job.name}`);
      logger.debug(`   Status: ${job.status}`);
      logger.debug(`   Cron: ${job.cronExpression}`);
      logger.debug(`   Timezone: ${job.timezone}`);
      logger.debug(`   Next Run: ${job.nextRun ? job.nextRun.toISOString() : "Not set"}`);
      logger.debug(`   Scheduled At: ${job.scheduledAt.toISOString()}`);
    });
  } catch (error) {
    logger.debug("❌ Error during schedule test:", error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSchedules()
    .then(() => {
      logger.debug("\n🎉 Schedule test completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      logger.debug("\n💥 Schedule test failed:", error);
      process.exit(1);
    });
}
