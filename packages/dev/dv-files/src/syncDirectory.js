import { executeRsync } from "./rsyncWrapper.js";

/**
 * Syncs a directory to a remote server using rsync
 * @param {Object} config - Sync configuration
 * @param {string} config.localPath - Local directory to sync
 * @param {string} config.remotePath - Remote destination path
 * @param {string} config.host - Remote host address
 * @param {string} config.user - Remote SSH username
 * @param {Object} [config.options] - Additional rsync options
 * @param {boolean} [config.options.verbose=true] - Show detailed output
 * @param {boolean} [config.options.compress=true] - Enable compression
 * @param {boolean} [config.options.showProgress=true] - Show progress
 * @param {boolean} [config.options.delete=false] - Delete files on remote that don't exist locally
 * @param {string[]} [config.options.exclude=[]] - Patterns to exclude
 * @returns {Promise<void>}
 */
export async function syncDirectory(config) {
  const { localPath, remotePath, host, user, options = {} } = config;

  const {
    verbose = true,
    compress = true,
    showProgress = true,
    delete: deleteRemote = false,
    exclude = [],
  } = options;

  console.log(`📤 Syncing ${localPath} to ${host}:${remotePath}...`);

  const args = [];

  // Base options
  if (verbose) args.push("-v");
  if (compress) args.push("-z");
  if (showProgress) args.push("--progress");

  // Archive mode for preserving permissions
  args.push("-a");

  // Delete files on remote that don't exist locally
  if (deleteRemote) {
    args.push("--delete");
  }

  // Exclude patterns
  for (const pattern of exclude) {
    args.push("--exclude", pattern);
  }

  // SSH options
  args.push("-e", "ssh -o StrictHostKeyChecking=no");

  // Source and destination (note the trailing slashes for directory sync)
  args.push(`${localPath}/`);
  args.push(`${user}@${host}:${remotePath}/`);

  await executeRsync(args);

  console.log(`✅ Directory synced to: ${remotePath}`);
}
