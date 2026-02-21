import os from "os";
import logger from "@buydy/se-logger";
import { execSync } from "child_process";

/**
 * Get machine identification information
 */
export function getMachineInfo() {
  try {
    // Get hostname
    const hostname = os.hostname();

    // Get platform info
    const platform = os.platform();
    const arch = os.arch();

    // Try to get more descriptive machine name
    let machineName = hostname;

    // Try to detect if we're running in a cloud environment
    if (isCloudEnvironment()) {
      machineName = getCloudMachineName();
    } else {
      // For local machines, try to get a more descriptive name
      machineName = getLocalMachineName(hostname, platform);
    }

    return {
      hostname,
      machineName,
      platform,
      arch,
      environment: isCloudEnvironment() ? "cloud" : "local",
    };
  } catch (error) {
    logger.debug("Failed to get machine info:", error.message);
    return {
      hostname: "unknown",
      machineName: "unknown",
      platform: "unknown",
      arch: "unknown",
      environment: "unknown",
    };
  }
}

/**
 * Detect if we're running in a cloud environment
 */
function isCloudEnvironment() {
  // Check for common cloud environment indicators
  const cloudIndicators = [
    "DIGITALOCEAN",
    "AWS",
    "GCP",
    "AZURE",
    "HEROKU",
    "RAILWAY",
    "VERCEL",
    "NETLIFY",
  ];

  // Check environment variables
  for (const indicator of cloudIndicators) {
    if (
      process.env[indicator] ||
      process.env[`${indicator}_TOKEN`] ||
      process.env[`${indicator}_KEY`]
    ) {
      return true;
    }
  }

  // Check hostname patterns
  const hostname = os.hostname();
  const cloudHostnamePatterns = [
    /droplet/i,
    /aws/i,
    /gcp/i,
    /azure/i,
    /heroku/i,
    /railway/i,
    /vercel/i,
    /netlify/i,
  ];

  return cloudHostnamePatterns.some((pattern) => pattern.test(hostname));
}

/**
 * Get cloud machine name
 */
function getCloudMachineName() {
  const hostname = os.hostname();

  // DigitalOcean droplet
  if (hostname.includes("droplet")) {
    return "droplet";
  }

  // AWS EC2
  if (process.env.AWS_REGION || hostname.includes("ec2")) {
    return `aws-${hostname}`;
  }

  // Google Cloud
  if (process.env.GOOGLE_CLOUD_PROJECT || hostname.includes("gcp")) {
    return `gcp-${hostname}`;
  }

  // Azure
  if (process.env.AZURE_REGION || hostname.includes("azure")) {
    return `azure-${hostname}`;
  }

  // Heroku
  if (process.env.DYNO || hostname.includes("heroku")) {
    return "heroku";
  }

  // Railway
  if (process.env.RAILWAY_ENVIRONMENT || hostname.includes("railway")) {
    return "railway";
  }

  // Vercel
  if (process.env.VERCEL || hostname.includes("vercel")) {
    return "vercel";
  }

  return `cloud-${hostname}`;
}

/**
 * Get local machine name
 */
function getLocalMachineName(hostname, platform) {
  try {
    // Try to get computer name on Windows
    if (platform === "win32") {
      try {
        const computerName = execSync("echo %COMPUTERNAME%", { encoding: "utf8" }).trim();
        if (computerName && computerName !== "%COMPUTERNAME%") {
          return `windows-${computerName}`;
        }
      } catch (e) {
        // Fall back to hostname
      }
    }

    // Try to get computer name on macOS/Linux
    if (platform === "darwin" || platform === "linux") {
      try {
        const computerName = execSync("scutil --get ComputerName 2>/dev/null || hostname", {
          encoding: "utf8",
          timeout: 2000,
        }).trim();
        if (computerName && computerName !== hostname) {
          return `mac-${computerName}`;
        }
      } catch (e) {
        // Fall back to hostname
      }
    }

    // Default to platform-hostname
    return `${platform}-${hostname}`;
  } catch (error) {
    // If all else fails, return platform-hostname
    return `${platform}-${hostname}`;
  }
}

/**
 * Get a short machine identifier for display
 */
export function getMachineDisplayName() {
  const info = getMachineInfo();

  // Return shorter, more user-friendly names
  switch (info.machineName) {
    case "droplet":
      return "Droplet";
    case "heroku":
      return "Heroku";
    case "railway":
      return "Railway";
    case "vercel":
      return "Vercel";
    default:
      // For local machines, try to make it more readable
      if (info.environment === "local") {
        return info.machineName.replace(/^(windows-|mac-|linux-)/, "").replace(/-/g, " ");
      }
      return info.machineName;
  }
}
