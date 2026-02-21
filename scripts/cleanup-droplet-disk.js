#!/usr/bin/env node

/**
 * Droplet Disk Cleanup Script
 * 
 * This script can be run manually or as part of maintenance to clean up
 * disk space on the production droplet.
 * 
 * Usage:
 *   node scripts/cleanup-droplet-disk.js
 *   yarn cleanup:droplet
 */

import dotenv from "dotenv";
import { createSSHConnection } from "@buydy/dv-ssh";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });

async function cleanupDropletDisk() {
  let conn;
  try {
    console.log("🧹 Starting droplet disk cleanup...");
    
    // Connect to droplet
    conn = await createSSHConnection({
      host: process.env.DO_DROPLET_HOST,
      username: process.env.DO_DROPLET_USERNAME,
    });

    // Check initial disk space
    console.log("📊 Checking initial disk space...");
    const initialDiskUsage = await getDiskUsage(conn);
    console.log(`Initial disk usage: ${initialDiskUsage}%`);

    if (initialDiskUsage < 70) {
      console.log("✅ Disk usage is below 70%, no cleanup needed");
      return;
    }

    // Perform cleanup
    console.log("🗑️  Performing disk cleanup...");
    
    // Clean up old backups
    await cleanupOldBackups(conn);
    
    // Clean up Docker resources
    await cleanupDockerResources(conn);
    
    // Clean up log files
    await cleanupLogFiles(conn);
    
    // Check final disk space
    const finalDiskUsage = await getDiskUsage(conn);
    console.log(`Final disk usage: ${finalDiskUsage}%`);
    
    const spaceFreed = initialDiskUsage - finalDiskUsage;
    console.log(`🎉 Cleanup complete! Freed up approximately ${spaceFreed}% of disk space`);

  } catch (error) {
    console.error("❌ Cleanup failed:", error.message);
    process.exit(1);
  } finally {
    if (conn) conn.dispose();
  }
}

/**
 * Get current disk usage percentage
 */
async function getDiskUsage(conn) {
  const result = await conn.exec("df -h / | tail -1");
  const line = result.stdout.trim();
  const match = line.match(/(\d+)%/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Clean up old backup files
 */
async function cleanupOldBackups(conn) {
  try {
    console.log("🗑️  Cleaning up old backup files...");
    
    // Clean up old MongoDB backups
    await conn.exec(`
      echo "Cleaning MongoDB backups..."
      cd /var/backups/mongo 2>/dev/null || exit 0
      
      # Keep only the 2 most recent .gz files
      ls -t *.gz 2>/dev/null | tail -n +3 | xargs -r rm -f
      
      # Remove old cluster backups older than 7 days
      find . -name "stocks-cluster-*" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
      
      # Remove pre-restore backups older than 3 days
      find . -name "pre_restore_backup_*" -mtime +3 -delete 2>/dev/null || true
    `);
    
    // Clean up old release files
    await conn.exec(`
      echo "Cleaning old release files..."
      find /opt -name "releases" -type d 2>/dev/null | while read dir; do
        # Keep only the 3 most recent releases
        find "$dir" -maxdepth 1 -type d -name "[0-9]*" | sort -nr | tail -n +4 | xargs -r rm -rf
      done
    `);
    
    console.log("✅ Old backup files cleaned up");
  } catch (error) {
    console.warn("⚠️  Backup cleanup failed:", error.message);
  }
}

/**
 * Clean up Docker resources
 */
async function cleanupDockerResources(conn) {
  try {
    console.log("🐳 Cleaning up Docker resources...");
    
    // Remove unused containers, networks, and images
    await conn.exec("docker system prune -f");
    
    // Remove unused volumes
    await conn.exec("docker volume prune -f");
    
    console.log("✅ Docker resources cleaned up");
  } catch (error) {
    console.warn("⚠️  Docker cleanup failed:", error.message);
  }
}

/**
 * Clean up log files
 */
async function cleanupLogFiles(conn) {
  try {
    console.log("📝 Cleaning up log files...");
    
    // Clean up system logs older than 7 days
    await conn.exec(`
      find /var/log -name "*.log" -mtime +7 -delete 2>/dev/null || true
      find /var/log -name "*.gz" -mtime +30 -delete 2>/dev/null || true
      journalctl --vacuum-time=7d 2>/dev/null || true
    `);
    
    // Clean up application logs
    await conn.exec(`
      find /opt -name "*.log" -mtime +7 -delete 2>/dev/null || true
      find /opt -name "logs" -type d -exec find {} -name "*.log" -mtime +7 -delete \\; 2>/dev/null || true
    `);
    
    console.log("✅ Log files cleaned up");
  } catch (error) {
    console.warn("⚠️  Log cleanup failed:", error.message);
  }
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDropletDisk();
}

export { cleanupDropletDisk };
