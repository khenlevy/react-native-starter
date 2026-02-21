import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Installs Docker prerequisites on the droplet using the installation script
 * @param {NodeSSH} ssh - SSH client connection
 * @param {Object} options - Installation options
 * @param {boolean} options.reset - Whether to reset Docker completely
 * @param {boolean} options.cleanup - Whether to cleanup existing containers
 * @returns {Promise<void>}
 */
export async function installDocker(ssh, options = {}) {
  const { reset = false, cleanup = false } = options;

  if (reset) {
    console.log("🔄 Resetting Docker completely...");
  } else if (cleanup) {
    console.log("🧹 Cleaning up Docker...");
  } else {
    console.log("🐳 Installing Docker using installation script...");
  }

  // Read the installation script
  const scriptPath = join(__dirname, "../../../scripts/install-docker.sh");
  let scriptContent;

  try {
    scriptContent = readFileSync(scriptPath, "utf8");
  } catch (error) {
    console.error(
      "❌ Could not read Docker installation script:",
      error.message
    );
    throw new Error("Docker installation script not found");
  }

  // Determine script arguments
  let scriptArgs = "";
  if (reset) {
    scriptArgs = "--reset";
  } else if (cleanup) {
    scriptArgs = "--cleanup";
  }

  // Write script to temporary file on droplet and execute it
  const tempScriptPath = `/tmp/install-docker-${Date.now()}.sh`;

  try {
    // Encode script content as base64 to avoid shell escaping issues
    const encodedScript = Buffer.from(scriptContent).toString("base64");
    await ssh.execCommand(
      `echo '${encodedScript}' | base64 -d > ${tempScriptPath}`
    );

    // Make script executable
    await ssh.execCommand(`chmod +x ${tempScriptPath}`);

    // Execute the script
    const command = scriptArgs
      ? `bash ${tempScriptPath} ${scriptArgs}`
      : `bash ${tempScriptPath}`;

    const result = await ssh.execCommand(command);

    // Print output in real-time (node-ssh doesn't support streaming, so we print after)
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.code === 0) {
      if (reset) {
        console.log("\n✅ Docker reset completed successfully");
      } else if (cleanup) {
        console.log("\n✅ Docker cleanup completed successfully");
      } else {
        console.log("\n✅ Docker installation completed successfully");
      }
    } else {
      console.error("\n❌ Docker operation failed with code:", result.code);
      console.error("📋 Output:", result.stdout);
      console.error("❌ Error:", result.stderr);
      throw new Error(
        `Docker installation script failed with exit code ${result.code}`
      );
    }
  } catch (error) {
    console.error(
      "❌ Failed to execute Docker installation script:",
      error.message
    );
    throw error;
  } finally {
    // Clean up temporary script file
    try {
      await ssh.execCommand(`rm -f ${tempScriptPath}`);
    } catch (cleanupError) {
      console.warn(
        "⚠️  Failed to clean up temporary script file:",
        cleanupError.message
      );
    }
  }
}
