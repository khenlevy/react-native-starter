import path from "path";
import fs from "fs";

/**
 * Gets the app name from the current package.json
 * @returns {string} The app name
 */
export function getAppName() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const fullName = packageJson.name || "unknown-app";

    // Extract app name from scoped package name (e.g., "@buydy/app-api" -> "app-api")
    const appName = fullName.includes("/") ? fullName.split("/")[1] : fullName;
    return appName;
  } catch (error) {
    console.warn("⚠️  Could not read package.json, using default app name");
    return "unknown-app";
  }
}
