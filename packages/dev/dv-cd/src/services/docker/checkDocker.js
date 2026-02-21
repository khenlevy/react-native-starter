/**
 * Checks if Docker is already installed on the droplet
 * @param {NodeSSH} ssh - SSH client connection
 * @returns {Promise<boolean>} True if Docker is installed
 */
export async function checkDocker(ssh) {
  console.log("🔍 Checking if Docker is already installed...");

  try {
    const result = await ssh.execCommand("docker --version");

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
