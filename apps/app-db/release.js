import { releaseComposeStackToDroplet } from '@buydy/dv-cd';
import { syncFile } from '@buydy/dv-files';
import { executeRemoteCommand } from '@buydy/dv-ssh';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, readFileSync } from 'fs';
import { getAppName, findMonorepoRoot } from '@buydy/dv-monorepo';
import { createSSHConnection } from '@buydy/dv-ssh';
import dotenv from 'dotenv';
import logger from '@buydy/se-logger';

/**
 * Get the current user's public IP address
 */
async function _getCurrentIP() {
  try {
    const response = await fetch('https://api.ipify.org');
    const ip = (await response.text()).trim();

    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return ip;
    }

    throw new Error('Invalid IP format received');
  } catch (error) {
    logger.business('Failed to detect IP address', { error: error.message });
    throw error;
  }
}

/**
 * Configure security measures on the droplet (IP-agnostic, key-only SSH)
 */
async function _configureSecurity(conn) {
  logger.business('Configuring security (key-only, IP-agnostic)');

  const commands = [
    // Update system packages (use apt-get for script compatibility)
    'apt-get update && apt-get upgrade -y',

    // Install security tools
    'apt-get install -y fail2ban ufw unattended-upgrades apt-listchanges',

    // Configure fail2ban for SSH protection
    'systemctl enable fail2ban',
    'systemctl start fail2ban',

    // Configure automatic security updates
    'echo "Unattended-Upgrade::Automatic-Reboot \\"false\\";" >> /etc/apt/apt.conf.d/50unattended-upgrades',
    'echo "Unattended-Upgrade::Remove-Unused-Dependencies \\"true\\";" >> /etc/apt/apt.conf.d/50unattended-upgrades',
    'systemctl enable unattended-upgrades',
    'systemctl start unattended-upgrades',

    // Enforce key-only SSH
    'sed -i "s/^#?PasswordAuthentication.*/PasswordAuthentication no/" /etc/ssh/sshd_config',
    'sed -i "s/^#?PubkeyAuthentication.*/PubkeyAuthentication yes/" /etc/ssh/sshd_config',
    'sed -i "s/^#?PermitRootLogin.*/PermitRootLogin prohibit-password/" /etc/ssh/sshd_config',
    'systemctl restart ssh || systemctl restart sshd',

    // iptables minimal baseline (IP-agnostic)
    'iptables -F',
    'iptables -X',
    'iptables -P INPUT DROP',
    'iptables -P FORWARD DROP',
    'iptables -P OUTPUT ACCEPT',
    'iptables -A INPUT -i lo -j ACCEPT',
    'iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
    'iptables -A INPUT -p tcp --dport 22 -j ACCEPT',
    'mkdir -p /etc/iptables && iptables-save > /etc/iptables/rules.v4',

    // UFW: default deny incoming, allow SSH only; explicitly deny Mongo/API ports
    'ufw --force reset',
    'ufw default deny incoming',
    'ufw default allow outgoing',
    'ufw allow 22/tcp',
    'ufw deny 27017/tcp',
    'ufw deny 3000/tcp',
    'ufw deny 3001/tcp',
    'ufw deny 4001/tcp',
    'ufw --force enable',
  ];

  for (const command of commands) {
    try {
      await conn.exec(command, [], { cwd: '/root' });
      logger.debug('Security command completed', { command });
    } catch (error) {
      logger.business('Security command warning', {
        command,
        error: error.message,
      });
    }
  }

  logger.business('Security configured successfully');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STACK_PATH = path.join(__dirname, 'docker');

// Load environment variables from root .env.production
const monorepoRoot = findMonorepoRoot(__dirname);
const rootEnvPath = path.join(monorepoRoot, '.env.production');
dotenv.config({ path: rootEnvPath });

// Use .env.production for Docker Compose (no temporary .env file needed)
const ENV_FILE = path.join(STACK_PATH, '.env.production');

(async () => {
  // Validate environment variables
  const host = process.env.DO_DROPLET_HOST;
  if (!host) {
    logger.business('Missing environment variable', {
      variable: 'DO_DROPLET_HOST',
      message:
        'Make sure .env.production is properly configured with DO_DROPLET_HOST',
    });
    process.exit(1);
  }

  // Validate required environment variables are loaded
  if (!process.env.MONGO_USERNAME || !process.env.MONGO_PASSWORD) {
    logger.business('Missing MongoDB credentials', {
      envFile: '.env.production',
      required: ['MONGO_USERNAME', 'MONGO_PASSWORD'],
    });
    process.exit(1);
  }

  // Copy .env.production to Docker directory for Docker Compose
  const sourceEnvPath = path.join(monorepoRoot, '.env.production');
  const envContent = readFileSync(sourceEnvPath, 'utf8');
  writeFileSync(ENV_FILE, envContent);

  logger.business('Environment file copied', {
    source: sourceEnvPath,
    destination: ENV_FILE,
  });

  const appName = getAppName();
  const config = {
    host: host,
    user: process.env.DO_DROPLET_USERNAME || 'root',
    remotePath: `/opt/${appName}`,
    stackPath: STACK_PATH,
    envFile: ENV_FILE,
    postDeploy: [
      // Try to pull latest images (with timeout and fallback)
      `timeout 30 docker compose -f /opt/${appName}/docker/docker-compose.yml pull || echo "Docker pull failed, using cached images"`,
      // Make scripts executable
      `chmod +x /opt/${appName}/scripts/*.sh`,
      // Initialize MongoDB with proper authentication
      `cd /opt/${appName} && ./scripts/init_mongo_with_auth.sh`,
      // Start all services
      `docker compose -f /opt/${appName}/docker/docker-compose.yml up -d --remove-orphans`,
      // Install cron job for daily backups (script reads from .env.production file)
      `cd /opt/${appName} && ./scripts/install_cron.sh`,
    ],
  };

  try {
    // Security hardening now handled centrally by dv-cd release flow.
    // Proceed with normal release
    await releaseComposeStackToDroplet(config);

    // Create optimal indexes after successful deployment
    logger.business('Creating optimal database indexes...');
    try {
      // Upload and run the index script via Docker on the droplet where it can access MongoDB
      const sshConn = await createSSHConnection({
        host,
        username: process.env.DO_DROPLET_USERNAME || 'root',
      });

      // Upload the script to the droplet
      const scriptPath = path.join(
        monorepoRoot,
        'scripts',
        'create-optimal-indexes.js',
      );
      await syncFile({
        localFilePath: scriptPath,
        remoteFilePath: '/tmp/create-optimal-indexes.js',
        host,
        user: process.env.DO_DROPLET_USERNAME || 'root',
      });

      // Run the script via Docker container with access to .env.production and network access to MongoDB
      await executeRemoteCommand(
        sshConn,
        `docker run --rm -v /tmp:/workspace -v /opt/app-db/docker/.env.production:/workspace/.env.production --network container:mongo -e NODE_ENV=production -e DOCKER_RUNNING=true -e MONGO_HOST=localhost node:18-alpine sh -c "cd /workspace && npm install -g dotenv-cli && dotenv -e .env.production node create-optimal-indexes.js"`,
      );

      sshConn.dispose();
      logger.business('✅ Database indexes created successfully');
    } catch (indexError) {
      logger.business('⚠️ Index creation failed, but deployment succeeded', {
        error: indexError.message,
      });
      // Don't fail the deployment if index creation fails
    }
  } catch (error) {
    logger.business('Release failed', { error: error.message });
    process.exit(1);
  }
})();
