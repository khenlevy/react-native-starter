#!/usr/bin/env node

/**
 * Job History Monitor Script
 *
 * Run this script to check job history health and optionally clean up
 *
 * Usage:
 *   node scripts/monitor-job-history.js              # View stats only
 *   node scripts/monitor-job-history.js --cleanup    # Run cleanup
 *   node scripts/monitor-job-history.js --details    # Show detailed breakdown
 */

import { JobMaintenanceJob } from "../packages/server/se-db/src/jobMaintenanceJob.js";
import { loadEnvironmentVariables } from "../packages/dev/dv-env/src/index.js";

// Load environment variables
loadEnvironmentVariables();

async function main() {
  const args = process.argv.slice(2);
  const shouldCleanup = args.includes("--cleanup");
  const showDetails = args.includes("--details");

  const maintenance = new JobMaintenanceJob({
    completedJobsRetentionDays: 30, // Keep 30 days
    failedJobsRetentionDays: 90, // Keep 90 days
    stuckJobThresholdHours: 2, // Mark stuck after 2 hours
    maxTotalJobs: 10000, // Max 10k jobs
    maxLogsPerJob: 1000, // Max 1k logs per job
    minJobsToKeepPerType: 10, // Always keep last 10
  });

  try {
    console.log("🔍 Initializing job maintenance...\n");
    await maintenance.initialize();

    // Get health report
    console.log("📊 Job History Health Report:");
    console.log("━".repeat(60));

    const health = await maintenance.getHealthReport();

    console.log(`Status: ${health.status === "healthy" ? "✅ HEALTHY" : "⚠️  WARNING"}`);
    console.log(`\nStatistics:`);
    console.log(`  Total Jobs: ${health.stats.total.toLocaleString()}`);
    console.log(`  Running: ${(health.stats.byStatus.running || 0).toLocaleString()}`);
    console.log(`  Completed: ${(health.stats.byStatus.completed || 0).toLocaleString()}`);
    console.log(`  Failed: ${(health.stats.byStatus.failed || 0).toLocaleString()}`);
    console.log(`  Scheduled: ${(health.stats.byStatus.scheduled || 0).toLocaleString()}`);
    console.log(`  Avg Logs/Job: ${health.stats.avgLogsPerJob}`);
    console.log(`  Max Logs/Job: ${health.stats.maxLogsPerJob}`);

    if (health.stats.oldestRecord) {
      const oldestAge = Math.floor(
        (Date.now() - new Date(health.stats.oldestRecord).getTime()) / (1000 * 60 * 60 * 24)
      );
      console.log(`  Oldest Record: ${oldestAge} days ago`);
    }

    // Show retention summary
    console.log(`\nRetention Policy:`);
    const retention = await maintenance.getRetentionSummary();
    console.log(`  Completed Jobs: Keep ${retention.policy.completedRetentionDays} days`);
    console.log(`  Failed Jobs: Keep ${retention.policy.failedRetentionDays} days`);
    console.log(`  Stuck Threshold: ${retention.policy.stuckThresholdHours} hours`);
    console.log(`  Max Total Jobs: ${retention.policy.maxTotalJobs.toLocaleString()}`);
    console.log(`  Min Keep Per Type: ${retention.policy.minJobsToKeepPerType}`);

    console.log(`\nCleanup Candidates:`);
    console.log(`  Expired Completed: ${retention.completedExpired.toLocaleString()}`);
    console.log(`  Expired Failed: ${retention.failedExpired.toLocaleString()}`);
    console.log(`  Stuck Jobs: ${retention.stuckJobs.toLocaleString()}`);
    console.log(`  Total to Clean: ${retention.total.toLocaleString()}`);

    if (showDetails && health.stats.byJobName.length > 0) {
      console.log(`\nTop Jobs by Record Count:`);
      health.stats.byJobName.slice(0, 10).forEach((job, i) => {
        const successRate =
          job.count > 0 ? ((job.completedCount / job.count) * 100).toFixed(1) : 0;
        console.log(
          `  ${i + 1}. ${job._id}: ${job.count.toLocaleString()} records (${successRate}% success)`
        );
      });
    }

    if (health.warnings.length > 0) {
      console.log(`\n⚠️  Warnings:`);
      health.warnings.forEach((warning) => {
        console.log(`  - ${warning}`);
      });
    }

    console.log("━".repeat(60));

    // Perform cleanup if requested
    if (shouldCleanup) {
      if (retention.total === 0) {
        console.log("\n✅ No cleanup needed - all jobs within retention policy\n");
      } else {
        console.log(`\n🧹 Running cleanup (will remove ~${retention.total} jobs)...`);
        await maintenance.runMaintenance();

        // Show updated stats
        const newHealth = await maintenance.getHealthReport();
        const newRetention = await maintenance.getRetentionSummary();

        console.log(`\nAfter cleanup:`);
        console.log(`  Total Jobs: ${newHealth.stats.total.toLocaleString()}`);
        console.log(`  Cleanup Candidates: ${newRetention.total.toLocaleString()}`);
        console.log(`  Status: ${newHealth.status === "healthy" ? "✅ HEALTHY" : "⚠️  WARNING"}\n`);
      }
    } else {
      console.log("\n💡 Tip: Run with --cleanup to clean expired jobs");
      console.log("💡 Tip: Run with --details to see job breakdown\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

