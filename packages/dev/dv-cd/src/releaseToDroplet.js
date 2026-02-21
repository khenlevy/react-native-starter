import dotenv from "dotenv";
import path from "path";
import { findMonorepoRoot, getAppName } from "@buydy/dv-monorepo";
import {
  ensureEnvironmentSymlinks,
  validateEnvironmentSymlinks,
  getFixInstructions,
} from "@buydy/dv-env";
import { createSSHConnection } from "@buydy/dv-ssh";
import { ensureDocker } from "@buydy/dv-docker";
import logger from "@buydy/se-logger";
import {
  deployApp,
  cleanupRemoteDocker,
  buildAndSaveImage,
  uploadAndLoadImage,
  cleanupLocalTar,
  cleanupLocalDocker,
} from "./services/app/index.js";
import { checkDiskSpaceAndCleanup } from "@buydy/dv-disk";

/**
 * Get the current user's public IP address
 */
// eslint-disable-next-line no-unused-vars
async function getCurrentIP() {
  try {
    const response = await fetch("https://api.ipify.org");
    const ip = (await response.text()).trim();

    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return ip;
    }

    throw new Error("Invalid IP format received");
  } catch (error) {
    logger.business("Failed to detect IP address", { error: error.message });
    throw error;
  }
}

/**
 * Configure SSH security measures (LEAN VERSION)
 */
async function configureSSHSecurity(conn) {
  try {
    logger.business("🔐 Configuring SSH security (lean)");

    // Enforce key-only SSH and allow SSH port
    await conn.execCommand(`
      sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
      sed -i 's/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
      sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
      systemctl enable ssh || true
      systemctl restart ssh || systemctl restart sshd || true
      # Configure Docker daemon to manage iptables (critical for networking)
      mkdir -p /etc/docker
      cat > /etc/docker/daemon.json <<'EOF'
{
  "iptables": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
      
      # iptables minimal baseline (IP-agnostic)
      # Note: Don't flush all rules if Docker is running - preserve Docker chains
      # Save Docker chains first if they exist
      iptables-save > /tmp/iptables-backup-$(date +%s).txt 2>/dev/null || true
      
      # Only flush INPUT/OUTPUT/FORWARD chains, preserve DOCKER chains
      iptables -P INPUT DROP
      iptables -P FORWARD DROP
      iptables -P OUTPUT ACCEPT
      iptables -F INPUT
      iptables -F OUTPUT
      iptables -F FORWARD
      
      # Allow loopback and existing connections
      iptables -A INPUT -i lo -j ACCEPT
      iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
      iptables -A INPUT -p tcp --dport 22 -j ACCEPT
      
      # Ensure Docker chains exist BEFORE Docker restart (critical!)
      iptables -t filter -N DOCKER 2>/dev/null || true
      iptables -t filter -N DOCKER-USER 2>/dev/null || true
      iptables -t filter -F DOCKER-USER 2>/dev/null || true
      # DOCKER-USER chain rules are processed before Docker's default rules
      # Since containers bind to 127.0.0.1 only, Docker will create rules that restrict to localhost
      # We add RETURN here to pass through to Docker's rules (which are restricted by port binding)
      # This maintains security while allowing Docker to manage container networking
      iptables -t filter -A DOCKER-USER -j RETURN 2>/dev/null || true
      
      # Save iptables rules
      mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4
      
      # Configure UFW to work with Docker (before enabling)
      ufw --force reset
      ufw default deny incoming
      ufw default allow outgoing
      ufw allow 22/tcp
      ufw deny 27017/tcp
      ufw deny 3000/tcp
      ufw deny 3001/tcp
      ufw deny 4001/tcp
      
      # Ensure UFW doesn't manage Docker chains (Docker manages its own)
      # This prevents UFW from interfering with Docker's iptables rules
      # Since containers bind to 127.0.0.1 only, they're not exposed externally anyway
      if [ -f /etc/ufw/after.rules ]; then
        # Add Docker bridge network exception to UFW (preserve Docker rules)
        # The DOCKER-USER chain is processed before Docker's default rules
        # Containers binding to 127.0.0.1 ensure only localhost access is allowed
        if ! grep -q "DOCKER-USER" /etc/ufw/after.rules; then
          sed -i '/^COMMIT$/i\\n# Allow Docker to manage its own chains (containers bind to 127.0.0.1 for security)\n*filter\n:DOCKER-USER - [0:0]\n-A DOCKER-USER -j RETURN\nCOMMIT\n' /etc/ufw/after.rules 2>/dev/null || true
        fi
      fi
      
      ufw --force enable
      
      # Restart Docker AFTER UFW is configured to rebuild iptables chains properly
      systemctl restart docker || service docker restart || true
      # Wait for Docker to fully initialize iptables chains
      sleep 3
      
      # Verify Docker chains exist after restart
      if iptables -t filter -L DOCKER >/dev/null 2>&1; then
        echo "✅ Docker iptables chains verified"
      else
        echo "⚠️ Warning: Docker chains missing after restart, may need manual intervention"
      fi
    `);

    logger.business("✅ SSH security configured (lean)");
    return true;
  } catch (error) {
    logger.business("❌ Failed to configure SSH security", {
      error: error.message,
    });
    return false;
  }
}

/**
 * Check if fail2ban is already installed
 */
// eslint-disable-next-line no-unused-vars
async function isFail2banInstalled(conn) {
  try {
    const result = await conn.execCommand(
      "which fail2ban-server && echo 'installed' || echo 'not_installed'"
    );
    return result.stdout.trim() === "installed";
  } catch (error) {
    return false;
  }
}

/**
 * Configure security measures on the droplet (STEP BY STEP)
 */
async function configureSecurity(conn) {
  logger.business("🔧 Starting security configuration step by step");

  try {
    // Step 1: SSH hardening and allow 22
    logger.business("📋 Step 1/6: SSH hardening and allow 22");
    await conn.execCommand(
      "sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config"
    );
    await conn.execCommand(
      "sed -i 's/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config"
    );
    await conn.execCommand(
      "sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config"
    );
    await conn.execCommand(
      "systemctl restart ssh || systemctl restart sshd || true"
    );
    await conn.execCommand(
      "iptables -F && iptables -X && iptables -P INPUT DROP && iptables -P FORWARD DROP && iptables -P OUTPUT ACCEPT && iptables -A INPUT -i lo -j ACCEPT && iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT && iptables -A INPUT -p tcp --dport 22 -j ACCEPT && mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4"
    );
    await conn.execCommand("ufw allow 22/tcp", [], { timeout: 5000 });
    logger.business("✅ Step 1 completed: SSH hardened");

    // Step 2: Deny MongoDB
    logger.business("📋 Step 2/6: Denying MongoDB port");
    await conn.execCommand("ufw deny 27017", [], { timeout: 5000 });
    logger.business("✅ Step 2 completed: MongoDB denied");

    // Step 3: Deny API ports
    logger.business("📋 Step 3/6: Denying API ports");
    await conn.execCommand("ufw deny 3000", [], { timeout: 5000 });
    await conn.execCommand("ufw deny 3001", [], { timeout: 5000 });
    logger.business("✅ Step 3 completed: API ports denied");

    // Step 4: Deny Scanner port
    logger.business("📋 Step 4/6: Denying Scanner port");
    await conn.execCommand("ufw deny 4001", [], { timeout: 5000 });
    logger.business("✅ Step 4 completed: Scanner port denied");

    // Step 5: Enable UFW
    logger.business("📋 Step 5/6: Enabling UFW");
    await conn.execCommand("ufw --force enable", [], { timeout: 10000 });
    logger.business("✅ Step 5 completed: UFW enabled");

    // Step 6: Verify status
    logger.business("📋 Step 6/6: Verifying UFW status");
    const statusResult = await conn.execCommand("ufw status", [], {
      timeout: 5000,
    });
    logger.business("✅ Step 6 completed: UFW status verified", {
      status: statusResult.stdout?.substring(0, 200),
    });

    logger.business("🎉 Security configuration completed successfully!");
    return true;
  } catch (error) {
    logger.business("❌ Security configuration failed", {
      error: error.message,
      step: "Unknown",
    });
    return false;
  }
}

// Load environment variables from the app directory
// Use .env.production for releases (symlinked from root)
const appDir = findMonorepoRoot(process.cwd());
const envPath = path.join(appDir, "apps", getAppName(), ".env.production");
dotenv.config({ path: envPath });

// Validate symlinks follow to root
const rootEnvPath = path.join(appDir, ".env.production");
if (
  !dotenv.config({ path: rootEnvPath }).parsed &&
  !process.env.DO_DROPLET_HOST
) {
  logger.business("Environment loading fallback", {
    message:
      "Could not load environment from symlink, trying root .env.production",
  });
  dotenv.config({ path: rootEnvPath });
}

export async function releaseToDroplet() {
  let conn, tarPath, imageName, releasePath;
  try {
    logger.business("Starting release");

    // Ensure environment symlinks exist first
    logger.business("Ensuring environment symlinks exist");
    ensureEnvironmentSymlinks();

    // Validate environment configuration
    logger.business("Validating environment configuration");
    const { allValid, results } = validateEnvironmentSymlinks();

    if (!allValid) {
      logger.business("Environment validation failed", { results });
      results.forEach((result) => {
        if (!result.valid) {
          logger.business("Environment validation error", {
            app: result.app,
            errors: result.errors,
          });
        }
      });
      logger.business("Fix instructions", {
        instructions: getFixInstructions(),
      });
      process.exit(1);
    }

    logger.business("Environment configuration valid");

    const appName = getAppName();
    const monorepoRoot = findMonorepoRoot(process.cwd());

    // Build Docker image locally
    const { imageName: builtImage, tarPath: tar } = await buildAndSaveImage(
      monorepoRoot
    );
    imageName = builtImage;
    tarPath = tar;

    // Test SSH connection first
    logger.business("Testing SSH connection");
    try {
      conn = await createSSHConnection({
        host: process.env.DO_DROPLET_HOST,
        username: process.env.DO_DROPLET_USERNAME,
      });
      logger.business("SSH connection successful");
    } catch (error) {
      logger.business("SSH connection failed", {
        error: error.message,
        message: "Please check your SSH key and droplet configuration",
      });
      process.exit(1);
    }

    // Configure SSH security (key-only auth, fail2ban)
    await configureSSHSecurity(conn);

    // Configure security measures
    logger.business("Configuring security measures");
    await configureSecurity(conn);

    await ensureDocker(conn);

    // Check disk space and cleanup if needed
    await checkDiskSpaceAndCleanup(conn);

    // Upload & load image
    releasePath = `/opt/${appName}/releases/${Date.now()}`;
    await uploadAndLoadImage(conn, tarPath, releasePath, imageName);

    // Start container
    await deployApp(conn, `/opt/${appName}`, releasePath, imageName);

    // Cleanup
    await cleanupLocalTar(tarPath);
    await cleanupLocalDocker(imageName);
    await cleanupRemoteDocker(
      conn,
      `/opt/${appName}`,
      releasePath,
      imageName,
      3
    );

    logger.business("Release complete");
  } catch (err) {
    logger.business("Release failed", { error: err.message });
    if (tarPath) await cleanupLocalTar(tarPath);
    if (imageName) await cleanupLocalDocker(imageName);
    process.exit(1);
  } finally {
    if (conn) conn.dispose();
  }
}
