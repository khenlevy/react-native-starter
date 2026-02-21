import { exec } from "child_process";
import { promisify } from "util";
import { getAppName } from "@buydy/dv-monorepo";
import path from "path";
import { mkdir, access, unlink } from "fs/promises";

const execAsync = promisify(exec);

/**
 * Checks if Docker daemon is running locally
 * @returns {Promise<boolean>} True if Docker is running
 */
async function checkDockerDaemon() {
  try {
    await execAsync("docker info");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Checks available disk space locally
 * @param {string} path - Path to check disk space
 * @returns {Promise<{available: number, total: number, percentage: number}>}
 */
async function checkLocalDiskSpace(path = "/") {
  try {
    const { stdout } = await execAsync(
      `df -h ${path} | tail -1 | awk '{print $4, $2, $5}'`
    );
    const [available, total, percentage] = stdout.trim().split(" ");
    const availableNum = parseFloat(available.replace(/[A-Z]/g, ""));
    const totalNum = parseFloat(total.replace(/[A-Z]/g, ""));
    const percentageNum = parseInt(percentage.replace("%", ""));

    return {
      available: availableNum,
      total: totalNum,
      percentage: percentageNum,
    };
  } catch (error) {
    throw new Error(`Local disk space check failed: ${error.message}`);
  }
}

/**
 * Provides storage error messages and cleanup suggestions for local operations
 * @param {string} operation - The operation that failed (e.g., 'Docker build', 'Image save')
 * @param {string} error - The error message
 * @param {Object} diskSpace - Disk space information
 * @returns {string} Formatted error message with suggestions
 */
function getLocalStorageErrorMessage(operation, error, diskSpace = null) {
  let message = `❌ ${operation} failed due to storage issues: ${error}\n\n`;

  if (diskSpace) {
    message += `💾 Local Disk Space Status:\n`;
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
  message += `   6. Restart Docker Desktop if needed\n\n`;

  message += `💡 The CD system will attempt automatic cleanup after successful deployment.`;

  return message;
}

/**
 * Waits for Docker daemon to be ready with retries
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<void>}
 */
async function waitForDockerDaemon(maxRetries = 30, delayMs = 2000) {
  console.log("⏳ Waiting for Docker daemon to start...");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (await checkDockerDaemon()) {
      console.log("✅ Docker daemon is ready!");
      return;
    }

    if (attempt < maxRetries) {
      console.log(
        `⏳ Attempt ${attempt}/${maxRetries}: Docker daemon not ready yet, waiting ${
          delayMs / 1000
        }s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    "Docker daemon failed to start within the expected time. Please check Docker Desktop."
  );
}

/**
 * Builds Docker image locally and saves it as tar file
 * @param {string} monorepoRoot - Monorepo root directory
 * @returns {Promise<{imageName: string, tarPath: string}>} Image name and tar file path
 */
export async function buildAndSaveImage(monorepoRoot) {
  const appName = getAppName();
  const imageName = appName;

  // Create dedicated build directory in the app directory
  const appDir = path.join(monorepoRoot, "apps", appName);
  const buildDir = path.join(appDir, ".build");
  const tarFileName = `${appName}.tar`;
  const tarPath = path.join(buildDir, tarFileName);

  // Find the Dockerfile path - it should be in the app directory
  const dockerfilePath = path.join(appDir, "Dockerfile");

  console.log("🐳 Building Docker image locally...");
  console.log(`📦 Image name: ${imageName}`);
  console.log(`📁 Working directory: ${monorepoRoot}`);
  console.log(`📂 App directory: ${appDir}`);
  console.log(`📂 Build directory: ${buildDir}`);
  console.log(`🐳 Dockerfile path: ${dockerfilePath}`);

  try {
    // Check local disk space before building
    console.log("💾 Checking local disk space...");
    const diskSpace = await checkLocalDiskSpace();
    console.log(
      `📊 Local disk space: ${diskSpace.available}GB available of ${diskSpace.total}GB (${diskSpace.percentage}% used)`
    );

    if (diskSpace.available < 5) {
      console.warn("⚠️  Low disk space detected locally");
    }

    // Check if Docker daemon is running and wait if needed
    console.log("🔍 Checking Docker daemon...");
    if (!(await checkDockerDaemon())) {
      console.log(
        "⚠️  Docker daemon not running, attempting to start Docker Desktop..."
      );
      try {
        await execAsync('open -a "Docker Desktop"');
        await waitForDockerDaemon();
      } catch (error) {
        throw new Error(
          "Docker daemon is not running. Please start Docker Desktop manually and try again."
        );
      }
    } else {
      console.log("✅ Docker daemon is running");
    }

    // Create build directory
    console.log("📂 Creating build directory...");
    await mkdir(buildDir, { recursive: true });

    // Clean up existing tar file if it exists
    try {
      await access(tarPath);
      console.log("🧹 Removing existing tar file...");
      await unlink(tarPath);
    } catch (error) {
      // File doesn't exist, which is fine
    }

    // Build the Docker image using the app's Dockerfile
    console.log("🔨 Building image...");
    await execAsync(
      `docker build --platform linux/amd64 -t ${imageName} -f ${dockerfilePath} .`,
      {
        cwd: monorepoRoot,
      }
    );
    console.log("✅ Docker image built successfully");

    // Save the image as tar file in build directory
    console.log("💾 Saving image as tar file...");
    await execAsync(`docker save ${imageName} > ${tarFileName}`, {
      cwd: buildDir,
    });
    console.log(`✅ Image saved as: ${tarPath}`);

    return { imageName, tarPath };
  } catch (error) {
    console.error("❌ Failed to build/save Docker image:", error.message);

    // Check if it's a storage-related error
    if (
      error.message.includes("No space left on device") ||
      error.message.includes("disk full") ||
      error.message.includes("ENOSPC")
    ) {
      try {
        const diskSpace = await checkLocalDiskSpace();
        const errorMessage = getLocalStorageErrorMessage(
          "Docker build/save",
          error.message,
          diskSpace
        );
        console.error(errorMessage);
      } catch (diskError) {
        console.error(
          "❌ Storage error detected but could not get disk space details:",
          error.message
        );
      }
    }

    throw new Error(`Docker build failed: ${error.message}`);
  }
}
