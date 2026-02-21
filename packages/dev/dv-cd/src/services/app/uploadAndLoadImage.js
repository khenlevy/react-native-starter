import { getAppName } from "@buydy/dv-monorepo";
import { syncFile } from "@buydy/dv-files";
import { executeRemoteCommand } from "@buydy/dv-ssh";
import {
  cleanupLocalDocker,
  checkDiskSpace,
  getStorageErrorMessage,
} from "./cleanup.js";

/**
 * Uploads tar file to droplet and loads the Docker image
 * @param {Client} conn - SSH client connection
 * @param {string} tarPath - Local path to tar file
 * @param {string} releasePath - Remote release directory path
 * @param {string} imageName - Name of the Docker image
 * @returns {Promise<string>} Image name that was loaded
 */
export async function uploadAndLoadImage(
  conn,
  tarPath,
  releasePath,
  imageName
) {
  const appName = getAppName();
  const tarFileName = `${appName}.tar`;
  // Simplify the remote tar path to be directly under the release directory
  const remoteTarPath = `${releasePath}/${tarFileName}`;

  console.log("📤 Uploading Docker image to droplet...");

  try {
    // Check disk space before upload
    console.log("💾 Checking remote disk space...");
    const diskSpace = await checkDiskSpace(conn);
    console.log(
      `📊 Remote disk space: ${diskSpace.available}GB available of ${diskSpace.total}GB (${diskSpace.percentage}% used)`
    );

    if (diskSpace.available < 2) {
      console.warn("⚠️  Low disk space detected on remote server");
    }

    // Ensure the release directory exists before uploading
    await executeRemoteCommand(conn, `mkdir -p ${releasePath}`);

    // Upload tar file using dv-file-sync
    await syncFile({
      localFilePath: tarPath,
      remoteFilePath: remoteTarPath,
      host: process.env.DO_DROPLET_HOST,
      user: process.env.DO_DROPLET_USERNAME,
    });

    // Load the Docker image on the droplet
    console.log("🔄 Loading Docker image on droplet...");
    const result = await conn.execCommand(`docker load < ${remoteTarPath}`);

    if (result.code === 0) {
      console.log("✅ Docker image loaded successfully");
      console.log("📋 Load output:", result.stdout.trim());

      // Clean up local Docker resources after successful upload and load
      console.log(
        "🧹 Cleaning up local Docker resources after successful upload..."
      );
      await cleanupLocalDocker(imageName, tarPath);
    } else {
      console.error("❌ Failed to load Docker image with code:", result.code);
      console.error("Output:", result.stderr);

      // Check if it's a storage-related error
      if (
        result.stderr.includes("No space left on device") ||
        result.stderr.includes("disk full")
      ) {
        const diskSpace = await checkDiskSpace(conn);
        const errorMessage = getStorageErrorMessage(
          "Docker image load",
          result.stderr,
          diskSpace
        );
        console.error(errorMessage);
      }

      throw new Error(`Docker load failed with code ${result.code}`);
    }

    return appName;
  } catch (error) {
    // Check if it's a storage-related error
    if (
      error.message.includes("No space left on device") ||
      error.message.includes("disk full") ||
      error.message.includes("ENOSPC")
    ) {
      try {
        const diskSpace = await checkDiskSpace(conn);
        const errorMessage = getStorageErrorMessage(
          "File upload",
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

    throw new Error(`Failed to upload/load Docker image: ${error.message}`);
  }
}
