import { executeRemoteCommand } from "@buydy/dv-ssh";

/**
 * Checks if Docker is already installed on the remote server
 * @param {NodeSSH} conn - SSH client connection
 * @returns {Promise<boolean>} True if Docker is installed
 */
export async function checkDocker(conn) {
  console.log("🔍 Checking if Docker is already installed...");

  try {
    const result = await executeRemoteCommand(conn, "docker --version", {
      throwOnError: false,
      silent: true,
    });

    if (result.code === 0) {
      console.log("Docker version:", result.stdout.trim());
      console.log("✅ Docker is already installed");
      return true;
    } else {
      console.log("❌ Docker is not installed");
      return false;
    }
  } catch (error) {
    console.log("❌ Docker is not installed");
    return false;
  }
}
