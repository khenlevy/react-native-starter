import { checkDocker } from "./checkDocker.js";
import { installDocker } from "./installDocker.js";

/**
 * Ensures Docker is installed on the droplet
 * Checks if Docker is already installed, and installs it if not
 * @param {NodeSSH} ssh - SSH client connection
 * @returns {Promise<void>}
 */
export async function ensureDocker(ssh) {
  try {
    const isDockerInstalled = await checkDocker(ssh);

    if (!isDockerInstalled) {
      await installDocker(ssh);
    }
  } catch (error) {
    throw new Error(`Failed to ensure Docker installation: ${error.message}`);
  }
}
