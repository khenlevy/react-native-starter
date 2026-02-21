import { unlink } from "fs/promises";
import path from "path";

/**
 * Removes the local tar file after successful upload
 * @param {string} tarPath - Path to the tar file to remove
 * @returns {Promise<void>}
 */
export async function cleanupLocalTar(tarPath) {
  try {
    await unlink(tarPath);
    console.log(`🧹 Cleaned up local tar file: ${path.basename(tarPath)}`);
  } catch (error) {
    console.warn(`⚠️  Could not remove local tar file: ${error.message}`);
  }
}
