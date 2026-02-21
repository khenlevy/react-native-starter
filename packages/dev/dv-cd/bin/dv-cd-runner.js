#!/usr/bin/env node

import { program } from 'commander';
import { releaseToDroplet } from '../src/releaseToDroplet.js';
import { cleanupRemoteDocker } from '../src/services/app/index.js';
import { createSSHConnection } from '@buydy/dv-ssh';
import { installDocker } from '@buydy/dv-docker';
import { getAppName, findMonorepoRoot } from '@buydy/dv-monorepo';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - use .env.production for production operations
const appDir = findMonorepoRoot(process.cwd());
const appEnvPath = path.join(appDir, 'apps', getAppName(), '.env.production');
const rootEnvPath = path.join(appDir, '.env.production');

// Try app symlink first, then root directly
dotenv.config({ path: appEnvPath });
if (!process.env.DO_DROPLET_HOST) {
  dotenv.config({ path: rootEnvPath });
}

// CLI setup
program
  .name('dv-cd')
  .description('Deploy Buydy apps to Digital Ocean droplet')
  .version('1.0.0');

program
  .command('release')
  .description('Deploy the current app to production')
  .option('--cwd <path>', 'Working directory for the app')
  .action(async (options) => {
    if (options.cwd) {
      process.chdir(options.cwd);
    }
    await releaseToDroplet();
  });

program
  .command('cleanup')
  .description('Clean up old releases')
  .option('-k, --keep <number>', 'Number of recent releases to keep', '3')
  .action(async (options) => {
    try {
      const conn = await createSSHConnection({
        host: process.env.DO_DROPLET_HOST,
        username: process.env.DO_DROPLET_USERNAME,
        remoteBasePath: `/opt/${getAppName()}`
      });
      
      await cleanupRemoteDocker(conn, `/opt/${getAppName()}`, '', '', parseInt(options.keep));
      conn.end();
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('reset-docker')
  .description('Reset Docker completely (removes all containers, images, volumes)')
  .action(async () => {
    try {
      const conn = await createSSHConnection({
        host: process.env.DO_DROPLET_HOST,
        username: process.env.DO_DROPLET_USERNAME,
        remoteBasePath: `/opt/${getAppName()}`
      });
      
      await installDocker(conn, { reset: true });
      conn.end();
    } catch (error) {
      console.error('❌ Docker reset failed:', error.message);
      process.exit(1);
    }
  });


program
  .command('cleanup-docker')
  .description('Clean up Docker containers and networks (keeps images)')
  .action(async () => {
    try {
      const conn = await createSSHConnection({
        host: process.env.DO_DROPLET_HOST,
        username: process.env.DO_DROPLET_USERNAME,
        remoteBasePath: `/opt/${getAppName()}`
      });
      
      await installDocker(conn, { cleanup: true });
      conn.end();
    } catch (error) {
      console.error('❌ Docker cleanup failed:', error.message);
      process.exit(1);
    }
  });


program.parse(); 