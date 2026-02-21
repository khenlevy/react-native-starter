import path from "path";
import fs from "fs";

/**
 * Finds the monorepo root directory by looking for package.json, apps, and packages directories
 * @param {string} currentDir - The directory to start searching from
 * @returns {string} The absolute path to the monorepo root
 * @throws {Error} If monorepo root cannot be found
 */
export function findMonorepoRoot(currentDir) {
  let dir = currentDir;
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, "package.json")) &&
      fs.existsSync(path.join(dir, "apps")) &&
      fs.existsSync(path.join(dir, "packages"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(
    "Could not find monorepo root. Make sure you are in a Buydy app directory."
  );
}
