import path from "path";
import fs from "fs";
import { shouldExcludeFile } from "./shouldExcludeFile.js";

/**
 * Recursively gets all files from a directory, excluding specified patterns
 * @param {string} dir - The directory to scan
 * @param {string} baseDir - The base directory for relative path calculation
 * @param {string[]} excludePatterns - Patterns to exclude
 * @param {string[]} files - Array to collect files (used internally)
 * @returns {string[]} Array of file paths
 */
export function getAllFiles(dir, baseDir, excludePatterns, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!shouldExcludeFile(fullPath, baseDir, excludePatterns)) {
        getAllFiles(fullPath, baseDir, excludePatterns, files);
      }
    } else {
      if (!shouldExcludeFile(fullPath, baseDir, excludePatterns)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}
