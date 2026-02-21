import { checkDocker } from "./checkDocker.js";
import { installDocker } from "./installDocker.js";

/**
 * Ensures Docker is installed on the remote server
 * Checks if Docker is already installed, and installs it if not
 * @param {NodeSSH} conn - SSH client connection
 * @returns {Promise<void>}
 */
export async function ensureDocker(conn) {
  try {
    const isDockerInstalled = await checkDocker(conn);

    if (!isDockerInstalled) {
      await installDocker(conn);
    }
  } catch (error) {
    throw new Error(`Failed to ensure Docker installation: ${error.message}`);
  }
}
