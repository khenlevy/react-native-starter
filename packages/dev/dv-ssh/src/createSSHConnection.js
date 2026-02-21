import { NodeSSH } from "node-ssh";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import logger from "@buydy/se-logger";

/**
 * Parse SSH config file to resolve hostnames
 * @param {string} hostname - Hostname to resolve
 * @returns {Object|null} SSH config for the hostname
 */
function parseSSHConfig(hostname) {
  try {
    const sshConfigPath = join(homedir(), ".ssh", "config");
    const configContent = readFileSync(sshConfigPath, "utf8");

    const lines = configContent.split("\n");
    let currentHost = null;
    let currentConfig = {};

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("Host ")) {
        // Save previous host config
        if (currentHost === hostname) {
          return currentConfig;
        }

        // Start new host
        currentHost = trimmedLine.substring(5).trim();
        currentConfig = {};
      } else if (trimmedLine.startsWith("HostName ")) {
        currentConfig.hostname = trimmedLine
          .substring(9)
          .trim()
          .split("#")[0]
          .trim();
      } else if (trimmedLine.startsWith("User ")) {
        currentConfig.username = trimmedLine
          .substring(5)
          .trim()
          .split("#")[0]
          .trim();
      } else if (trimmedLine.startsWith("Port ")) {
        currentConfig.port = parseInt(
          trimmedLine.substring(5).trim().split("#")[0].trim()
        );
      } else if (trimmedLine.startsWith("IdentityFile ")) {
        currentConfig.identityFile = trimmedLine
          .substring(13)
          .trim()
          .split("#")[0]
          .trim();
      }
    }

    // Check last host
    if (currentHost === hostname) {
      return currentConfig;
    }

    return null;
  } catch (error) {
    logger.business("Could not read SSH config", { error: error.message });
    return null;
  }
}

/**
 * Creates an SSH connection to a remote server
 * Assumes SSH keys are properly configured on the machine
 * @param {Object} config - SSH configuration
 * @param {string} config.host - Remote host address or SSH config hostname
 * @param {string} config.username - SSH username
 * @param {number} [config.port=22] - SSH port
 * @returns {Promise<NodeSSH>} SSH client connection
 */
export async function createSSHConnection(config) {
  logger.business("Creating SSH connection", { host: config.host });

  const ssh = new NodeSSH();

  // Try to resolve hostname from SSH config
  const sshConfig = parseSSHConfig(config.host);

  const sshConfigFinal = {
    host: sshConfig?.hostname || config.host,
    username: sshConfig?.username || config.username,
    port: sshConfig?.port || config.port || 22,
  };

  // Load private key from SSH config IdentityFile if specified
  if (sshConfig?.identityFile) {
    try {
      // Expand ~ to homedir
      const expandedPath = sshConfig.identityFile.startsWith("~")
        ? sshConfig.identityFile.replace("~", homedir())
        : sshConfig.identityFile;
      sshConfigFinal.privateKey = readFileSync(expandedPath, "utf8");
    } catch (e) {
      logger.business("Could not read private key from SSH config", {
        identityFile: sshConfig.identityFile,
        error: e.message,
      });
    }
  }

  // Also load private key if DO_DROPLET_HOST is set
  if (process.env.DO_DROPLET_HOST) {
    const keyPath = join(homedir(), ".ssh", process.env.DO_DROPLET_HOST);
    try {
      sshConfigFinal.privateKey = readFileSync(keyPath, "utf8");
    } catch (e) {
      logger.business("Could not read private key", {
        keyPath,
        error: e.message,
      });
    }
  }

  try {
    await ssh.connect(sshConfigFinal);
    logger.business("SSH connection established");
    return ssh;
  } catch (error) {
    logger.business("SSH connection failed", { error: error.message });
    throw error;
  }
}
