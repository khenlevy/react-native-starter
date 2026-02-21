import fs from "fs";
import path from "path";
import { findMonorepoRoot } from "@buydy/dv-monorepo";

const REQUIRED_ENV_FILES = [".env.dev", ".env.production"];

/**
 * Check if an environment file exists (either as real file or symlink)
 */
function checkEnvironmentFile(appPath, envFile, _rootDir) {
  const envFilePath = path.join(appPath, envFile);
  const expectedTarget = path.join("..", "..", envFile);

  // Check if file exists
  if (!fs.existsSync(envFilePath)) {
    return {
      valid: false,
      reason: `Missing ${envFile}`,
    };
  }

  // Check if it's a symlink
  const stats = fs.lstatSync(envFilePath);
  if (stats.isSymbolicLink()) {
    // If it's a symlink, check if it points to the correct target
    const actualTarget = fs.readlinkSync(envFilePath);
    if (actualTarget !== expectedTarget) {
      return {
        valid: false,
        reason: `${envFile} symlink points to "${actualTarget}" instead of "${expectedTarget}"`,
      };
    }
  }
  // If it's a real file, that's also valid (new approach)

  return { valid: true };
}

/**
 * Validate environment symlinks for a single app
 */
function validateApp(appName, rootDir) {
  const appPath = path.join(rootDir, "apps", appName);
  const errors = [];

  for (const envFile of REQUIRED_ENV_FILES) {
    const result = checkEnvironmentFile(appPath, envFile, rootDir);
    if (!result.valid) {
      errors.push(result.reason);
    }
  }

  return {
    app: appName,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate all apps in the monorepo
 */
export function validateEnvironmentSymlinks(options = {}) {
  const rootDir = options.rootDir || findMonorepoRoot(process.cwd());
  const appsDir = path.join(rootDir, "apps");

  // Apps to skip validation (infrastructure apps with different env setup)
  const SKIP_APPS = ["app-stocks-web"]; // Frontend app doesn't need environment files

  // Get all app directories
  const apps = fs.readdirSync(appsDir).filter((name) => {
    const appPath = path.join(appsDir, name);
    return (
      fs.statSync(appPath).isDirectory() &&
      name.startsWith("app-") &&
      !SKIP_APPS.includes(name)
    );
  });

  const results = [];
  let allValid = true;

  for (const app of apps) {
    const result = validateApp(app, rootDir);
    results.push(result);

    if (!result.valid) {
      allValid = false;
    }
  }

  return {
    allValid,
    results,
  };
}

/**
 * Get instructions for fixing invalid environment files
 */
export function getFixInstructions() {
  return `
To fix, run the following commands:
  cd <app-directory>
  # Create symlinks to root env files
  ln -s ../../.env.dev .env.dev
  ln -s ../../.env.production .env.production
  `.trim();
}

/**
 * Ensure environment symlinks exist for a single app
 */
function ensureAppEnvironmentFiles(appName, rootDir) {
  const appPath = path.join(rootDir, "apps", appName);
  const created = [];

  for (const envFile of REQUIRED_ENV_FILES) {
    const envFilePath = path.join(appPath, envFile);
    const expectedTarget = path.join("..", "..", envFile);

    // Check if file exists
    if (!fs.existsSync(envFilePath)) {
      // Create symlink if source file exists
      const sourcePath = path.join(rootDir, envFile);
      if (fs.existsSync(sourcePath)) {
        fs.symlinkSync(expectedTarget, envFilePath);
        created.push(envFile);
      }
    } else {
      // Check if it's a symlink pointing to correct location
      const stats = fs.lstatSync(envFilePath);
      if (stats.isSymbolicLink()) {
        const actualTarget = fs.readlinkSync(envFilePath);
        if (actualTarget !== expectedTarget) {
          // Wrong target, recreate symlink
          fs.unlinkSync(envFilePath);
          fs.symlinkSync(expectedTarget, envFilePath);
          created.push(envFile);
        }
      }
      // If it's a real file, leave it as is
    }
  }

  return created;
}

/**
 * Ensure environment symlinks exist for all apps
 */
export function ensureEnvironmentSymlinks(options = {}) {
  const rootDir = options.rootDir || findMonorepoRoot(process.cwd());
  const appsDir = path.join(rootDir, "apps");

  // Apps to skip (infrastructure apps with different env setup)
  const SKIP_APPS = ["app-stocks-web"]; // Frontend app doesn't need environment files

  // Get all app directories
  const apps = fs.readdirSync(appsDir).filter((name) => {
    const appPath = path.join(appsDir, name);
    return (
      fs.statSync(appPath).isDirectory() &&
      name.startsWith("app-") &&
      !SKIP_APPS.includes(name)
    );
  });

  const results = [];

  for (const app of apps) {
    const created = ensureAppEnvironmentFiles(app, rootDir);
    results.push({
      app,
      created,
    });
  }

  return results;
}
