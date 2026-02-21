/**
 * Executes a single command on the remote server
 * @param {NodeSSH} conn - SSH client connection
 * @param {string} command - Command to execute
 * @param {Object} [options] - Execution options
 * @param {boolean} [options.throwOnError=true] - Throw error if command fails
 * @param {boolean} [options.silent=false] - Don't log output
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
export async function executeRemoteCommand(conn, command, options = {}) {
  const { throwOnError = true, silent = false } = options;

  if (!silent) {
    console.log(`🔧 Executing: ${command}`);
  }

  const result = await conn.execCommand(command);

  if (!silent) {
    if (result.stdout) {
      console.log(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }
  }

  if (throwOnError && result.code !== 0) {
    throw new Error(`Command failed with code ${result.code}: ${command}`);
  }

  return result;
}
