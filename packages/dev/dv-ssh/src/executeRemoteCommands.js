import { executeRemoteCommand } from "./executeRemoteCommand.js";

/**
 * Executes an array of commands on the remote server sequentially
 * @param {NodeSSH} conn - SSH client connection
 * @param {string[]} commands - Array of commands to execute
 * @param {Object} [options] - Execution options
 * @param {boolean} [options.throwOnError=true] - Throw error if any command fails
 * @param {boolean} [options.silent=false] - Don't log output
 * @returns {Promise<void>}
 */
export async function executeRemoteCommands(conn, commands, options = {}) {
  for (const command of commands) {
    await executeRemoteCommand(conn, command, options);
  }
}
