# dv-docker

Docker management utilities for remote servers in Buydy development tools.

## Overview

This package provides utilities for managing Docker installations on remote servers via SSH. It handles installation, cleanup, and verification of Docker on deployment targets.

## Features

- Check if Docker is installed on remote server
- Install Docker with official repository
- Reset Docker completely
- Cleanup Docker containers and networks
- Automated, non-interactive installation

## Installation

```bash
yarn add -D @buydy/dv-docker
```

## Usage

### Ensure Docker is Installed

```javascript
import { createSSHConnection } from "@buydy/dv-ssh";
import { ensureDocker } from "@buydy/dv-docker";

const conn = await createSSHConnection({
  host: "example.com",
  username: "root",
});

// Checks if Docker is installed, installs if not
await ensureDocker(conn);

conn.dispose();
```

### Check Docker Installation

```javascript
import { checkDocker } from "@buydy/dv-docker";

const isInstalled = await checkDocker(conn);
if (isInstalled) {
  console.log("Docker is ready!");
}
```

### Install Docker

```javascript
import { installDocker } from "@buydy/dv-docker";

// Fresh installation
await installDocker(conn);

// Reset Docker completely
await installDocker(conn, { reset: true });

// Cleanup containers and networks only
await installDocker(conn, { cleanup: true });
```

## What Gets Installed

The installation script sets up:

- Docker Engine (official repository)
- Docker Compose plugin
- Docker Buildx plugin
- Proper user permissions
- Docker service auto-start on boot

## Installation Script Details

The package includes `scripts/install-docker.sh` which:

- Uses non-interactive mode (safe for automation)
- Installs from official Docker repository
- Configures systemd service
- Creates Docker network if needed
- Handles conflicts with existing installations

**Modes:**

- **Default**: Install Docker if not present
- **`--reset`**: Remove Docker completely and reinstall
- **`--cleanup`**: Remove containers and networks, keep images

## API Reference

### `ensureDocker(conn)`

Ensures Docker is installed on the remote server. Checks first, installs only if needed.

**Parameters:**
- `conn` (NodeSSH) - SSH connection from `@buydy/dv-ssh`

**Returns:** Promise<void>

### `checkDocker(conn)`

Checks if Docker is installed and running.

**Parameters:**
- `conn` (NodeSSH) - SSH connection

**Returns:** Promise<boolean> - True if Docker is installed

### `installDocker(conn, options)`

Installs or manages Docker on the remote server.

**Parameters:**
- `conn` (NodeSSH) - SSH connection
- `options` (object, optional):
  - `reset` (boolean, default: false) - Remove and reinstall Docker
  - `cleanup` (boolean, default: false) - Cleanup containers/networks only

**Returns:** Promise<void>

## Examples

### Deployment Workflow

```javascript
import { createSSHConnection } from "@buydy/dv-ssh";
import { ensureDocker } from "@buydy/dv-docker";

async function deploy() {
  const conn = await createSSHConnection({
    host: process.env.DEPLOY_HOST,
    username: "root",
  });

  try {
    // Ensure Docker is ready
    await ensureDocker(conn);

    // Now you can run Docker commands
    await conn.execCommand("docker compose up -d");
  } finally {
    conn.dispose();
  }
}
```

### Reset Docker Installation

```javascript
import { installDocker } from "@buydy/dv-docker";

// Useful for troubleshooting or starting fresh
await installDocker(conn, { reset: true });
```

## Requirements

- Remote server must be Ubuntu/Debian-based
- SSH access with sudo privileges
- Internet connection on remote server

## Used By

- `@buydy/dv-cd` - Continuous deployment tools

## Notes

- Installation is fully automated and non-interactive
- Safe to run on servers with existing Docker installations
- Uses official Docker repository for latest stable versions
- Handles package conflicts automatically

