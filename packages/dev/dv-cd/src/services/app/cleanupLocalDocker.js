import { execSync } from "child_process";

/**
 * Cleans up local Docker images and containers after successful deployment
 * This prevents local Docker artifacts from interfering with SSH tunneling
 * @param {string} imageName - Name of the Docker image to clean up
 * @returns {Promise<void>}
 */
export async function cleanupLocalDocker(imageName) {
  try {
    console.log(`🧹 Cleaning up local Docker artifacts for ${imageName}...`);

    // Remove any containers with the image name
    try {
      execSync(
        `docker ps -a --filter "ancestor=${imageName}" -q | xargs -r docker rm -f`,
        { stdio: "ignore" }
      );
    } catch (e) {
      // Ignore if no containers found
    }

    // Remove the local image
    try {
      execSync(`docker rmi ${imageName}`, { stdio: "ignore" });
      console.log(`✅ Removed local Docker image: ${imageName}`);
    } catch (e) {
      // Ignore if image not found
    }

    // Clean up dangling images and unused networks
    try {
      execSync("docker system prune -f", { stdio: "ignore" });
      console.log(`✅ Cleaned up dangling Docker artifacts`);
    } catch (e) {
      console.warn(`⚠️  Could not clean up Docker system: ${e.message}`);
    }
  } catch (error) {
    console.warn(
      `⚠️  Could not clean up local Docker artifacts: ${error.message}`
    );
  }
}
