/**
 * Disk Management Service
 *
 * Provides utilities for checking disk space and performing cleanup operations
 * on remote servers during deployment processes.
 */

/**
 * Check disk space and perform cleanup if needed
 * @param {Object} conn - SSH connection object
 * @param {Object} options - Configuration options
 * @param {number} options.cleanupThreshold - Disk usage percentage to trigger cleanup (default: 80)
 * @param {number} options.failThreshold - Disk usage percentage to fail deployment (default: 85)
 */
export async function checkDiskSpaceAndCleanup(conn, options = {}) {
  const { cleanupThreshold = 80, failThreshold = 85 } = options;

  try {
    console.log("💾 Checking remote disk space...");

    // Get disk usage
    const diskUsageResult = await conn.execCommand("df -h / | tail -1");
    const diskUsageLine = diskUsageResult.stdout.trim();
    const usageMatch = diskUsageLine.match(/(\d+)%/);

    if (!usageMatch) {
      console.warn("⚠️  Could not parse disk usage");
      return;
    }

    const usagePercent = parseInt(usageMatch[1]);
    console.log(`📊 Remote disk space: ${usagePercent}% used`);

    // If disk usage is above threshold, perform cleanup
    if (usagePercent > cleanupThreshold) {
      console.log(
        `🧹 Disk usage above ${cleanupThreshold}%, performing cleanup...`
      );

      // Clean up old backups
      await cleanupOldBackups(conn);

      // Clean up Docker resources
      await cleanupDockerResources(conn);

      // Check disk space again
      const newDiskUsageResult = await conn.execCommand("df -h / | tail -1");
      const newDiskUsageLine = newDiskUsageResult.stdout.trim();
      const newUsageMatch = newDiskUsageLine.match(/(\d+)%/);

      if (newUsageMatch) {
        const newUsagePercent = parseInt(newUsageMatch[1]);
        console.log(`📊 Disk space after cleanup: ${newUsagePercent}% used`);

        // If still above fail threshold, fail the deployment
        if (newUsagePercent > failThreshold) {
          throw new Error(
            `Disk space still critically low (${newUsagePercent}%). Manual cleanup required.`
          );
        }
      }
    } else {
      console.log("✅ Disk space is sufficient");
    }
  } catch (error) {
    console.error("❌ Disk space check failed:", error.message);
    throw error;
  }
}

/**
 * Clean up old backup files
 * @param {Object} conn - SSH connection object
 * @param {Object} options - Configuration options
 * @param {number} options.keepBackups - Number of recent backups to keep (default: 2)
 * @param {number} options.keepReleases - Number of recent releases to keep (default: 3)
 */
export async function cleanupOldBackups(conn, options = {}) {
  const { keepBackups = 2, keepReleases = 3 } = options;

  try {
    console.log("🗑️  Cleaning up old backup files...");

    // Clean up old MongoDB backups (keep only the most recent ones)
    await conn.execCommand(`
      cd /var/backups/mongo 2>/dev/null || exit 0
      ls -t *.gz 2>/dev/null | tail -n +${keepBackups + 1} | xargs -r rm -f
      find . -name "stocks-cluster-*" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true
      find . -name "pre_restore_backup_*" -mtime +3 -delete 2>/dev/null || true
    `);

    // Clean up old release files (keep only the most recent ones)
    await conn.execCommand(`
      find /opt -name "releases" -type d 2>/dev/null | while read dir; do
        find "$dir" -maxdepth 1 -type d -name "[0-9]*" | sort -nr | tail -n +${
          keepReleases + 1
        } | xargs -r rm -rf
      done
    `);

    console.log("✅ Old backup files cleaned up");
  } catch (error) {
    console.warn("⚠️  Backup cleanup failed:", error.message);
  }
}

/**
 * Clean up Docker resources
 * @param {Object} conn - SSH connection object
 * @param {Object} options - Configuration options
 * @param {boolean} options.aggressive - Whether to perform aggressive cleanup (default: false)
 */
export async function cleanupDockerResources(conn, options = {}) {
  const { aggressive = false } = options;

  try {
    console.log("🐳 Cleaning up Docker resources...");

    if (aggressive) {
      // Stop all containers first
      await conn.execCommand("docker stop $(docker ps -q) 2>/dev/null || true");
      await conn.execCommand("docker rm $(docker ps -aq) 2>/dev/null || true");
      await conn.execCommand(
        "docker rmi $(docker images -q) 2>/dev/null || true"
      );
      await conn.execCommand("docker volume prune -f");
      await conn.execCommand("docker network prune -f");
    } else {
      // Remove unused containers, networks, and images
      await conn.execCommand("docker system prune -f");

      // Remove unused volumes
      await conn.execCommand("docker volume prune -f");
    }

    console.log("✅ Docker resources cleaned up");
  } catch (error) {
    console.warn("⚠️  Docker cleanup failed:", error.message);
  }
}

/**
 * Get current disk usage percentage
 * @param {Object} conn - SSH connection object
 * @returns {Promise<number>} Disk usage percentage
 */
export async function getDiskUsage(conn) {
  try {
    const result = await conn.execCommand("df -h / | tail -1");
    const line = result.stdout.trim();
    const match = line.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  } catch (error) {
    console.warn("⚠️  Could not get disk usage:", error.message);
    return 0;
  }
}

/**
 * Clean up log files
 * @param {Object} conn - SSH connection object
 * @param {Object} options - Configuration options
 * @param {number} options.logRetentionDays - Days to keep log files (default: 7)
 */
export async function cleanupLogFiles(conn, options = {}) {
  const { logRetentionDays = 7 } = options;

  try {
    console.log("📝 Cleaning up log files...");

    // Clean up system logs
    await conn.execCommand(`
      find /var/log -name "*.log" -mtime +${logRetentionDays} -delete 2>/dev/null || true
      find /var/log -name "*.gz" -mtime +30 -delete 2>/dev/null || true
      journalctl --vacuum-time=${logRetentionDays}d 2>/dev/null || true
    `);

    // Clean up application logs
    await conn.execCommand(`
      find /opt -name "*.log" -mtime +${logRetentionDays} -delete 2>/dev/null || true
      find /opt -name "logs" -type d -exec find {} -name "*.log" -mtime +${logRetentionDays} -delete \\; 2>/dev/null || true
    `);

    console.log("✅ Log files cleaned up");
  } catch (error) {
    console.warn("⚠️  Log cleanup failed:", error.message);
  }
}
