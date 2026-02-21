# dv-ssh

SSH connection and remote command execution utilities for Buydy development tools.

## Overview

This package provides a clean, reusable API for SSH connections and remote command execution. It's used by other Buydy development tools like `dv-cd` for deployment automation.

## Features

- SSH connection management with config file support
- Remote command execution (single or batch)
- Configurable error handling
- Silent mode for quiet operations
- SSH config file parsing (resolves hostname aliases)

## Installation

```bash
yarn add -D @buydy/dv-ssh
```

## Usage

### Create SSH Connection

```javascript
import { createSSHConnection } from "@buydy/dv-ssh";

const conn = await createSSHConnection({
  host: "example.com", // or SSH config alias
  username: "root",
  port: 22, // optional, defaults to 22
});

// Remember to dispose when done
conn.dispose();
```

### Execute Single Command

```javascript
import { executeRemoteCommand } from "@buydy/dv-ssh";

const result = await executeRemoteCommand(conn, "ls -la");
console.log(result.stdout);

// With options
await executeRemoteCommand(conn, "echo hello", {
  throwOnError: false, // Don't throw on non-zero exit
  silent: true, // Don't log output
});
```

### Execute Multiple Commands

```javascript
import { executeRemoteCommands } from "@buydy/dv-ssh";

await executeRemoteCommands(conn, [
  "mkdir -p /opt/myapp",
  "cd /opt/myapp",
  "docker compose up -d",
]);
```

## SSH Config Support

The package automatically reads `~/.ssh/config` to resolve hostname aliases:

```ssh-config
Host myserver
  HostName 192.168.1.100
  User deploy
  Port 2222
```

Then use:

```javascript
const conn = await createSSHConnection({ host: "myserver", username: "root" });
// Automatically resolves to 192.168.1.100:2222 with user 'deploy'
```

## Environment Variables

- `DO_DROPLET_HOST` - Name of private key file in `~/.ssh/` (optional)

## API Reference

### `createSSHConnection(config)`

Creates an SSH connection.

**Parameters:**
- `config.host` (string) - Hostname or IP address
- `config.username` (string) - SSH username
- `config.port` (number, optional) - SSH port (default: 22)

**Returns:** Promise<NodeSSH>

### `executeRemoteCommand(conn, command, options)`

Executes a single command on the remote server.

**Parameters:**
- `conn` (NodeSSH) - SSH connection
- `command` (string) - Command to execute
- `options.throwOnError` (boolean, default: true) - Throw if exit code !== 0
- `options.silent` (boolean, default: false) - Suppress output logging

**Returns:** Promise<{code, stdout, stderr}>

### `executeRemoteCommands(conn, commands, options)`

Executes multiple commands sequentially.

**Parameters:**
- `conn` (NodeSSH) - SSH connection
- `commands` (string[]) - Array of commands
- `options` (object) - Same as `executeRemoteCommand`

**Returns:** Promise<void>

## Used By

- `@buydy/dv-cd` - Continuous deployment tools
- `@buydy/dv-file-sync` - File synchronization utilities
- `@buydy/dv-docker` - Docker management utilities

