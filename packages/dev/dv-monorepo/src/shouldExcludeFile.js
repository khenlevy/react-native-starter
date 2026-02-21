import path from "path";

/**
 * Checks if a file should be excluded based on patterns
 * @param {string} filePath - The file path to check
 * @param {string} baseDir - The base directory for relative path calculation
 * @param {string[]} excludePatterns - Patterns to exclude
 * @returns {boolean} True if file should be excluded
 */
export function shouldExcludeFile(filePath, baseDir, excludePatterns) {
  const relativePath = path.relative(baseDir, filePath);
  return excludePatterns.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace("*", ".*"));
      return regex.test(relativePath);
    }
    return relativePath.includes(pattern);
  });
}
