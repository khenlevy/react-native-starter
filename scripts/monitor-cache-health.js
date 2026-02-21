#!/usr/bin/env node

/**
 * Cache Health Monitor Script
 * 
 * Run this script to check cache health and optionally clean up
 * 
 * Usage:
 *   node scripts/monitor-cache-health.js              # View stats only
 *   node scripts/monitor-cache-health.js --cleanup    # Run cleanup
 *   node scripts/monitor-cache-health.js --flush      # Emergency flush (careful!)
 */

import { CacheMaintenanceJob } from "../packages/server/se-eodhd-cache/src/cacheMaintenanceJob.js";

async function main() {
  const args = process.argv.slice(2);
  const shouldCleanup = args.includes("--cleanup");
  const shouldFlush = args.includes("--flush");

  const maintenance = new CacheMaintenanceJob({
    maxCacheSizeMB: 500,        // 500 MB limit
    maxDocuments: 100000,       // 100k documents
    cleanupIntervalMs: 3600000, // 1 hour (not used for manual run)
  });

  try {
    console.log("🔍 Initializing cache maintenance...\n");
    await maintenance.initialize();

    // Get health report
    console.log("📊 Cache Health Report:");
    console.log("━".repeat(60));
    
    const health = await maintenance.getHealthReport();
    
    console.log(`Status: ${health.status === "healthy" ? "✅ HEALTHY" : "⚠️  WARNING"}`);
    console.log(`\nStatistics:`);
    console.log(`  Total Entries: ${health.stats.total.toLocaleString()}`);
    console.log(`  Active Entries: ${health.stats.active.toLocaleString()}`);
    console.log(`  Expired Entries: ${health.stats.expired.toLocaleString()}`);
    console.log(`  Total Size: ${health.stats.totalSizeMB} MB`);
    console.log(`  Avg Entry Size: ${health.stats.avgSizeKB} KB`);
    console.log(`  Max Entry Size: ${health.stats.maxSizeKB} KB`);
    
    if (health.stats.byEndpoint && health.stats.byEndpoint.length > 0) {
      console.log(`\nTop Endpoints:`);
      health.stats.byEndpoint.slice(0, 5).forEach((endpoint, i) => {
        const sizeMB = (endpoint.totalSize / 1024 / 1024).toFixed(2);
        console.log(`  ${i + 1}. ${endpoint._id}: ${endpoint.count.toLocaleString()} entries (${sizeMB} MB)`);
      });
    }

    if (health.warnings.length > 0) {
      console.log(`\n⚠️  Warnings:`);
      health.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }

    console.log("━".repeat(60));

    // Perform cleanup if requested
    if (shouldFlush) {
      console.log("\n🚨 EMERGENCY FLUSH REQUESTED");
      console.log("⚠️  This will delete ALL cache entries!");
      
      // Wait 3 seconds for user to cancel
      console.log("Starting in 3 seconds... (Ctrl+C to cancel)");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const flushed = await maintenance.emergencyFlush();
      console.log(`✅ Emergency flush completed: ${flushed} entries removed\n`);
      
    } else if (shouldCleanup) {
      console.log("\n🧹 Running cleanup...");
      await maintenance.runMaintenance();
      
      // Show updated stats
      const newHealth = await maintenance.getHealthReport();
      console.log(`\nAfter cleanup:`);
      console.log(`  Total Entries: ${newHealth.stats.total.toLocaleString()}`);
      console.log(`  Total Size: ${newHealth.stats.totalSizeMB} MB`);
      console.log(`  Status: ${newHealth.status === "healthy" ? "✅ HEALTHY" : "⚠️  WARNING"}\n`);
    } else {
      console.log("\n💡 Tip: Run with --cleanup to clean expired entries");
      console.log("💡 Tip: Run with --flush to clear all cache (emergency only)\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

