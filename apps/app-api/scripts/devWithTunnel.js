/*
 * Development launcher that ensures an SSH tunnel to the production MongoDB
 * is established before starting the local API. This lets the local API
 * connect to the production DB securely via localhost.
 */

import { spawn } from 'child_process';
import net from 'net';

function log(message) {
  // Keep logs concise and business-level
  // eslint-disable-next-line no-console
  console.log(`[devWithTunnel] ${message}`);
}

async function isPortFree(port) {
  // First check if port has a LISTEN socket (something actually listening)
  try {
    const { execSync } = await import('child_process');
    const result = execSync(`lsof -i :${port} -sTCP:LISTEN 2>/dev/null || true`, { encoding: 'utf8' });
    if (result.trim()) {
      // Port has something listening - not free
      return false;
    }
  } catch (err) {
    // If check fails, fall through to net.createServer check
  }
  
  // Check if we can actually listen on the port
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function chooseLocalPort(preferred) {
  if (await isPortFree(preferred)) return preferred;
  
  // Port is busy - check if it's an SSH tunnel (LISTEN state)
  if (preferred === 27017) {
    try {
      const { execSync } = await import('child_process');
      // Check for LISTEN socket (SSH tunnel)
      const listenResult = execSync(`lsof -i :27017 -sTCP:LISTEN 2>/dev/null || true`, { encoding: 'utf8' });
      if (listenResult.trim()) {
        // Port has a LISTEN socket - likely an SSH tunnel, use it
        log(`Port 27017 is busy but appears to be an SSH tunnel (LISTEN state); using it.`);
        return preferred;
      }
      
      // Check what's actually using the port (might be stuck connection)
      const allResult = execSync(`lsof -i :27017 2>/dev/null || true`, { encoding: 'utf8' });
      if (allResult.trim()) {
        log(`Port 27017 is busy but NOT in LISTEN state (might be a stuck connection).`);
        log(`Current connections: ${allResult.split('\n').slice(0, 3).join('; ')}`);
        log(`To fix: Kill stuck connections with: lsof -ti :27017 | xargs kill -9`);
      }
    } catch (err) {
      // If we can't check, fail loudly
    }
    
    // Port 27017 is busy and not a tunnel - throw error
    log(`ERROR: Port 27017 is busy and not an SSH tunnel.`);
    log(`Please check what's using it: lsof -i :27017`);
    log(`If it's a stuck connection, kill it: lsof -ti :27017 | xargs kill -9`);
    throw new Error(`Port ${preferred} is busy and not an SSH tunnel. Cannot proceed.`);
  }
  
  // For other ports, also fail if busy
  log(`ERROR: Port ${preferred} is busy.`);
  log(`Please check what's using it: lsof -i :${preferred}`);
  throw new Error(`Port ${preferred} is busy. Cannot proceed.`);
}

async function ensureSshTunnel() {
  const isDev = (process.env.ENV || process.env.NODE_ENV || 'development') === 'development';
  if (!isDev) {
    log('Non-development environment detected; skipping SSH tunnel.');
    return { tunnel: null, localPort: process.env.MONGO_PORT || 27017 };
  }

  // Determine SSH host alias from env or default
  const sshHost = process.env.DO_DROPLET_HOST || process.env.SSH_HOST || 'kl_droplet';
  const requestedLocalPort = Number(process.env.TUNNEL_LOCAL_PORT || process.env.MONGO_PORT || 27017);
  
  // This will throw an error if port is busy and not an SSH tunnel
  const localPort = await chooseLocalPort(requestedLocalPort);

  // If a tunnel is already established externally on the chosen port, skip creating new one
  if (!(await isPortFree(localPort))) {
    log(`Port ${localPort} already in use; assuming an existing tunnel.`);
    return { tunnel: null, localPort };
  }

  const args = [
    '-N',
    '-L',
    `${localPort}:localhost:27017`,
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=60',
    '-o',
    'ServerAliveCountMax=3',
    sshHost,
  ];

  log(`Establishing SSH tunnel on localhost:${localPort} -> ${sshHost}:27017`);
  const tunnel = spawn('ssh', args, { stdio: 'ignore', detached: false });

  return new Promise((resolve, reject) => {
    let settled = false;
    // Give the tunnel a brief moment to initialize and check the port
    const verifyTimer = setTimeout(async () => {
      const ok = !(await isPortFree(localPort));
      if (ok && !settled) {
        settled = true;
        log(`SSH tunnel established on port ${localPort}`);
        resolve({ tunnel, localPort });
      }
    }, 800);

    tunnel.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(verifyTimer);
      reject(err);
    });

    tunnel.once('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(verifyTimer);
      reject(new Error(`SSH tunnel exited with code ${code}`));
    });
  });
}

async function main() {
  let tunnelChild = null;
  let localPort = 27017;
  try {
    const result = await ensureSshTunnel();
    tunnelChild = result.tunnel;
    localPort = result.localPort;
  } catch (e) {
    log(`Failed to establish SSH tunnel: ${e.message}`);
    process.exit(1);
  }

  // Set env defaults for the API process if not explicitly set
  if (!process.env.MONGO_HOST) process.env.MONGO_HOST = 'localhost';
  if (!process.env.MONGO_PORT) process.env.MONGO_PORT = String(localPort);

  log(`Starting API with MONGO_HOST=${process.env.MONGO_HOST} MONGO_PORT=${process.env.MONGO_PORT}`);

  const apiProc = spawn(process.execPath, ['--watch', 'src/index.js'], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
  });

  const cleanup = () => {
    if (apiProc && !apiProc.killed) {
      try { apiProc.kill('SIGINT'); } catch (_) { /* noop */ }
    }
    if (tunnelChild && !tunnelChild.killed) {
      log('Closing SSH tunnel');
      try { tunnelChild.kill('SIGINT'); } catch (_) { /* noop */ }
    }
  };

  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);

  apiProc.on('exit', (code) => {
    cleanup();
    process.exit(code || 0);
  });
}

main();


