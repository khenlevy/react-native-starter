import { exec } from "child_process";
import { promisify } from "util";
import { unlink } from "fs/promises";

const execAsync = promisify(exec);

/**
 * Cleans up local Docker resources (images, containers, tar files)
 * @param {string} imageName - Name of the Docker image to clean up
 * @param {string} tarPath - Path to the tar file to remove
 * @returns {Promise<void>}
 */
export async function cleanupLocalDocker(imageName, tarPath) {
  console.log("🧹 Cleaning up local Docker resources...");

  try {
    // Remove the Docker image
    console.log(`🗑️  Removing local Docker image: ${imageName}`);
    await execAsync(`docker rmi ${imageName} 2>/dev/null || true`);
    console.log("✅ Local Docker image removed");

    // Remove the tar file
    if (tarPath) {
      console.log(`🗑️  Removing local tar file: ${tarPath}`);
      await unlink(tarPath);
      console.log("✅ Local tar file removed");
    }

    // Clean up any dangling images
    console.log("🧹 Cleaning up dangling Docker images...");
    await execAsync("docker image prune -f 2>/dev/null || true");
    console.log("✅ Dangling images cleaned up");
  } catch (error) {
    console.warn("⚠️  Local cleanup warning:", error.message);
  }
}

/**
 * Cleans up remote Docker resources and old releases
 * @param {Client} conn - SSH client connection
 * @param {string} remoteBasePath - Base path for releases
 * @param {string} currentReleasePath - Path to current release (to keep)
 * @param {string} imageName - Name of the Docker image
 * @param {number} keepReleases - Number of recent releases to keep
 * @returns {Promise<void>}
 */
export async function cleanupRemoteDocker(
  conn,
  remoteBasePath,
  currentReleasePath,
  imageName,
  keepReleases = 15
) {
  console.log("🧹 Cleaning up remote Docker resources...");

  try {
    // Remove old Docker containers and images
    console.log(
      `🗑️  Removing old Docker containers and images for: ${imageName}`
    );
    const cleanupCmd = `
      docker stop ${imageName} 2>/dev/null || true && \
      docker rm ${imageName} 2>/dev/null || true && \
      docker rmi ${imageName} 2>/dev/null || true
    `;

    const cleanupResult = await conn.execCommand(cleanupCmd);
    if (cleanupResult.code === 0) {
      console.log("✅ Old Docker containers and images removed");
    } else {
      console.warn("⚠️  Docker cleanup warning:", cleanupResult.stderr);
    }

    // Clean up old releases (keep the most recent ones)
    console.log(
      `🧹 Cleaning up old releases (keeping latest ${keepReleases})...`
    );
    const cleanupReleasesCmd = `
      cd ${remoteBasePath}/releases && \
      ls -t | tail -n +$((keepReleases + 1)) | xargs -r rm -rf
    `;

    const releasesResult = await conn.execCommand(cleanupReleasesCmd);
    if (releasesResult.code === 0) {
      console.log("✅ Cleanup completed successfully");
      console.log("Cleanup completed");
    } else {
      console.warn("⚠️  Releases cleanup warning:", releasesResult.stderr);
    }

    // Clean up dangling Docker images on remote
    console.log("🧹 Cleaning up dangling Docker images on remote...");
    const pruneResult = await conn.execCommand(
      "docker image prune -f 2>/dev/null || true"
    );
    if (pruneResult.code === 0) {
      console.log("✅ Remote dangling images cleaned up");
    }

    // Aggressive cleanup for performance - remove unused containers, networks, and volumes
    console.log("🧹 Performing aggressive Docker cleanup...");
    const aggressiveCleanupCmd = `
      docker container prune -f 2>/dev/null || true && \
      docker network prune -f 2>/dev/null || true && \
      docker volume prune -f 2>/dev/null || true && \
      docker system prune -f 2>/dev/null || true
    `;

    const aggressiveResult = await conn.execCommand(aggressiveCleanupCmd);
    if (aggressiveResult.code === 0) {
      console.log("✅ Aggressive cleanup completed");
    } else {
      console.warn("⚠️  Aggressive cleanup warning:", aggressiveResult.stderr);
    }
  } catch (error) {
    console.warn("⚠️  Remote cleanup warning:", error.message);
  }
}

/**
 * Checks available disk space and provides storage error handling
 * @param {Client} conn - SSH client connection
 * @param {string} path - Path to check disk space
 * @returns {Promise<{available: number, total: number, percentage: number}>}
 */
export async function checkDiskSpace(conn, path = "/") {
  try {
    const result = await conn.execCommand(
      `df -h ${path} | tail -1 | awk '{print $4, $2, $5}'`
    );

    if (result.code === 0) {
      const [available, total, percentage] = result.stdout.trim().split(" ");
      const availableNum = parseFloat(available.replace(/[A-Z]/g, ""));
      const totalNum = parseFloat(total.replace(/[A-Z]/g, ""));
      const percentageNum = parseInt(percentage.replace("%", ""));

      return {
        available: availableNum,
        total: totalNum,
        percentage: percentageNum,
      };
    }

    throw new Error("Failed to get disk space information");
  } catch (error) {
    throw new Error(`Disk space check failed: ${error.message}`);
  }
}

/**
 * Provides storage error messages and cleanup suggestions
 * @param {string} operation - The operation that failed (e.g., 'Docker build', 'File upload')
 * @param {string} error - The error message
 * @param {Object} diskSpace - Disk space information
 * @returns {string} Formatted error message with suggestions
 */
export function getStorageErrorMessage(operation, error, diskSpace = null) {
  let message = `❌ ${operation} failed due to storage issues: ${error}\n\n`;

  if (diskSpace) {
    message += `💾 Disk Space Status:\n`;
    message += `   - Available: ${diskSpace.available}GB\n`;
    message += `   - Total: ${diskSpace.total}GB\n`;
    message += `   - Usage: ${diskSpace.percentage}%\n\n`;
  }

  message += `🔧 Suggested Solutions:\n`;
  message += `   1. Clean up Docker resources: docker system prune -a\n`;
  message += `   2. Remove old containers: docker container prune\n`;
  message += `   3. Remove old images: docker image prune -a\n`;
  message += `   4. Remove old volumes: docker volume prune\n`;
  message += `   5. Check for large files: du -sh /* | sort -hr | head -10\n`;
  message += `   6. Restart Docker service if needed\n\n`;

  message += `💡 The CD system will attempt automatic cleanup on next deployment.`;

  return message;
}
