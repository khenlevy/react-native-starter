import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";
import dotenv from "dotenv";

/**
 * Loads the appropriate .env file based on NODE_ENV
 * - Defaults to 'development' if NODE_ENV is not set
 * - Looks for .env.dev in development
 * - Looks for .env.production in production
 * - No fallback files needed
 *
 * This works both in monorepo (development) and standalone (Docker production)
 *
 * Runs silently to avoid console pollution during startup.
 * Throws error only if the required environment file is not found.
 */
export function loadEnvironmentVariables() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Determine the environment (defaults to 'development')
  const env = process.env.NODE_ENV || "development";

  // Map environment to file name
  const envFileMap = {
    development: ".env.dev",
    production: ".env.production",
  };

  const envFileName = envFileMap[env] || ".env";

  // Try to load from app directory (both monorepo and Docker)
  const appDir = resolve(__dirname, "../../");
  const envPath = resolve(appDir, envFileName);

  // Check if the file exists
  if (!existsSync(envPath)) {
    throw new Error(`Environment file not found: ${envPath}. Please create ${envFileName} file`);
  }

  // Load the environment file
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    throw new Error(`Failed to load ${envFileName}: ${result.error.message}`);
  }

  return true;
}
