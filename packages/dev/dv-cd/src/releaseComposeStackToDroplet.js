import {
  createSSHConnection,
  executeRemoteCommands,
  executeRemoteCommand,
} from "@buydy/dv-ssh";
import { ensureDocker } from "@buydy/dv-docker";
import { syncDirectory, syncFile } from "@buydy/dv-files";
import path from "path";

/**
 * Releases a Docker Compose stack to a Digital Ocean droplet
 * This is designed for multi-service stacks that don't need image building
 * (e.g., MongoDB + AdminMongo using public images)
 *
 * @param {Object} config - Release configuration
 * @param {string} config.host - Remote host address or SSH config hostname
 * @param {string} config.user - Remote SSH username (default: 'root')
 * @param {string} config.remotePath - Remote deployment path (e.g., '/opt/app-db')
 * @param {string} config.stackPath - Local path to docker-compose stack directory
 * @param {string} config.envFile - Local path to .env file to upload
 * @param {string[]} [config.postDeploy] - Optional array of commands to run after sync
 * @returns {Promise<void>}
 */
export async function releaseComposeStackToDroplet(config) {
  const {
    host,
    user = "root",
    remotePath,
    stackPath,
    envFile,
    postDeploy = [],
  } = config;

  if (!host) {
    throw new Error("config.host is required");
  }
  if (!remotePath) {
    throw new Error("config.remotePath is required");
  }
  if (!stackPath) {
    throw new Error("config.stackPath is required");
  }
  if (!envFile) {
    throw new Error("config.envFile is required");
  }

  let conn;

  try {
    console.log("🚀 Starting Docker Compose stack release...");

    // Connect to droplet
    conn = await createSSHConnection({ host, username: user });

    // Ensure Docker is installed and running
    await ensureDocker(conn);

    // Ensure buydy-network exists before compose deployment
    // Docker Compose requires external networks to exist before running
    await executeRemoteCommand(
      conn,
      "docker network create buydy-network --driver bridge 2>/dev/null || true"
    );

    // Ensure Docker iptables chains are (re)created after any firewall changes
    await executeRemoteCommand(
      conn,
      "systemctl restart docker || service docker restart || true"
    );

    // Create remote directories
    console.log("📁 Creating remote directories...");
    await executeRemoteCommand(conn, `mkdir -p ${remotePath}/docker`);
    await executeRemoteCommand(conn, `mkdir -p ${remotePath}/scripts`);

    // Sync stack directory (docker-compose.yml, etc.)
    await syncDirectory({
      localPath: stackPath,
      remotePath: `${remotePath}/docker`,
      host,
      user,
      options: { delete: true },
    });

    // Upload .env.production file (single source of truth)
    await syncFile({
      localFilePath: envFile,
      remoteFilePath: `${remotePath}/docker/.env.production`,
      host,
      user,
    });

    // Sync scripts directory if it exists
    const scriptsPath = path.join(path.dirname(stackPath), "scripts");
    await syncDirectory({
      localPath: scriptsPath,
      remotePath: `${remotePath}/scripts`,
      host,
      user,
      options: { delete: true },
    });

    // Execute post-deploy commands
    if (postDeploy.length > 0) {
      console.log("⚙️  Running post-deploy commands...");
      await executeRemoteCommands(conn, postDeploy);
    }

    console.log("✅ Docker Compose stack release complete!");
  } catch (err) {
    console.error("❌ Release failed:", err.message);
    throw err;
  } finally {
    if (conn) {
      conn.dispose();
    }
  }
}
