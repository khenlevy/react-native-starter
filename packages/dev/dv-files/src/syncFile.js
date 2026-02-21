import { executeRsync } from "./rsyncWrapper.js";
import path from "path";

/**
 * Syncs a single file to a remote server using rsync
 * @param {Object} config - Sync configuration
 * @param {string} config.localFilePath - Local file to sync
 * @param {string} config.remoteFilePath - Remote destination file path
 * @param {string} config.host - Remote host address
 * @param {string} config.user - Remote SSH username
 * @param {Object} [config.options] - Additional rsync options
 * @param {boolean} [config.options.verbose=true] - Show detailed output
 * @param {boolean} [config.options.compress=true] - Enable compression
 * @param {boolean} [config.options.showProgress=true] - Show progress
 * @returns {Promise<void>}
 */
export async function syncFile(config) {
  const { localFilePath, remoteFilePath, host, user, options = {} } = config;

  const { verbose = true, compress = true, showProgress = true } = options;

  console.log(`📤 Uploading ${path.basename(localFilePath)} to ${host}...`);

  const args = [];

  // Base options
  if (verbose) args.push("-v");
  if (compress) args.push("-z");
  if (showProgress) args.push("--progress");

  // Archive mode for preserving permissions
  args.push("-a");

  // SSH options
  args.push("-e", "ssh -o StrictHostKeyChecking=no");

  // Source and destination
  args.push(localFilePath);
  args.push(`${user}@${host}:${remoteFilePath}`);

  await executeRsync(args);

  console.log(`✅ File uploaded to: ${remoteFilePath}`);
}
