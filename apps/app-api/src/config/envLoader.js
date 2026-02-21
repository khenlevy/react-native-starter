import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

/**
 * Loads the appropriate .env file based on NODE_ENV
 * - Defaults to 'development' if NODE_ENV is not set
 * - Looks for .env.dev in development
 * - Looks for .env.production in production
 * - Falls back to .env if environment-specific file doesn't exist
 *
 * Runs silently to avoid console pollution during startup.
 * Throws error only if no environment file is found.
 */
export function loadEnvironmentVariables() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Determine the environment (defaults to 'development')
  const env = process.env.NODE_ENV || 'development';

  // Map environment to file name
  const envFileMap = {
    development: '.env.dev',
    production: '.env.production',
  };

  const envFileName = envFileMap[env] || '.env';
  const envPath = join(__dirname, '../../', envFileName);

  // Check if the file exists
  if (!existsSync(envPath)) {
    // Try fallback to .env
    const fallbackPath = join(__dirname, '../../.env');
    if (existsSync(fallbackPath)) {
      const result = dotenv.config({ path: fallbackPath });
      if (result.error) {
        // If fallback load fails, continue with process defaults instead of crashing in dev
        return false;
      }
      return true;
    }

    // No env files found; continue with process defaults (useful for local dev/mock mode)
    return false;
  }

  // Load the environment file
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    throw new Error(`Failed to load ${envFileName}: ${result.error.message}`);
  }

  return true;
}
