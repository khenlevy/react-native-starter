import { spawn } from "child_process";

/**
 * Executes rsync with the given arguments
 * This is the core rsync wrapper used by all sync operations
 * @param {string[]} args - Rsync arguments
 * @param {Object} [options] - Spawn options
 * @returns {Promise<void>}
 */
export async function executeRsync(args, options = {}) {
  return new Promise((resolve, reject) => {
    const rsync = spawn("rsync", args, {
      stdio: "inherit",
      ...options,
    });

    rsync.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Rsync failed with exit code ${code}`));
      }
    });

    rsync.on("error", (error) => {
      reject(new Error(`Rsync execution error: ${error.message}`));
    });
  });
}
