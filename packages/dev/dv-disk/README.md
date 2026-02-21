# @buydy/dv-disk

Disk management utilities for Buydy development tools. This package provides disk space monitoring, cleanup operations, and disk resource management.

## Overview

This package provides disk management utilities for monitoring disk space, performing cleanup operations, and managing disk resources. It's used by other Buydy development tools like `dv-cd` for deployment automation and server maintenance.

## Features

### Disk Management
- Disk space monitoring and cleanup
- Automated backup management
- Docker resource cleanup
- Log file management
- Configurable retention policies
- Disk usage monitoring

## Installation

```bash
yarn add -D @buydy/dv-disk
```

## Prerequisites

- `rsync` must be installed on your system
- SSH access to the remote server

## Usage

### Sync a Single File

```javascript
import { syncFile } from "@buydy/dv-file-sync";

await syncFile({
  localFilePath: "/path/to/local/file.txt",
  remoteFilePath: "/opt/app/file.txt",
  host: "example.com",
  user: "root",
});
```

### Sync a Directory

```javascript
import { syncDirectory } from "@buydy/dv-file-sync";

await syncDirectory({
  localPath: "/path/to/local/dir",
  remotePath: "/opt/app",
  host: "example.com",
  user: "root",
  options: {
    delete: true, // Delete files on remote that don't exist locally
    exclude: ["node_modules", ".git"], // Exclude patterns
  },
});
```

### Custom Rsync Options

```javascript
await syncDirectory({
  localPath: "./build",
  remotePath: "/var/www",
  host: "192.168.1.100",
  user: "deploy",
  options: {
    verbose: true,
    compress: true,
    showProgress: true,
    delete: false,
    exclude: ["*.log", "tmp/*"],
  },
});
```

### Advanced: Direct Rsync Execution

```javascript
import { executeRsync } from "@buydy/dv-file-sync";

// Full control over rsync arguments
await executeRsync([
  "-avz",
  "--progress",
  "--exclude=node_modules",
  "/local/path/",
  "user@host:/remote/path/",
]);
```

## API Reference

### `syncFile(config)`

Syncs a single file to a remote server.

**Parameters:**
- `config.localFilePath` (string) - Local file path
- `config.remoteFilePath` (string) - Remote destination path
- `config.host` (string) - Remote host address
- `config.user` (string) - SSH username
- `config.options` (object, optional):
  - `verbose` (boolean, default: true) - Show detailed output
  - `compress` (boolean, default: true) - Enable compression
  - `showProgress` (boolean, default: true) - Show progress

**Returns:** Promise<void>

### `syncDirectory(config)`

Syncs a directory to a remote server.

**Parameters:**
- `config.localPath` (string) - Local directory path
- `config.remotePath` (string) - Remote destination path
- `config.host` (string) - Remote host address
- `config.user` (string) - SSH username
- `config.options` (object, optional):
  - `verbose` (boolean, default: true) - Show detailed output
  - `compress` (boolean, default: true) - Enable compression
  - `showProgress` (boolean, default: true) - Show progress
  - `delete` (boolean, default: false) - Delete remote files not in local
  - `exclude` (string[], default: []) - Patterns to exclude

**Returns:** Promise<void>

### `executeRsync(args, options)`

Low-level rsync execution wrapper.

**Parameters:**
- `args` (string[]) - Rsync command arguments
- `options` (object, optional) - Node.js spawn options

**Returns:** Promise<void>

## Examples

### Deployment Scenario

```javascript
import { syncDirectory, syncFile } from "@buydy/dv-file-sync";

// Sync application code
await syncDirectory({
  localPath: "./dist",
  remotePath: "/opt/myapp",
  host: process.env.DEPLOY_HOST,
  user: "root",
  options: {
    delete: true,
    exclude: [".env", "node_modules"],
  },
});

// Upload environment file separately
await syncFile({
  localFilePath: ".env.production",
  remoteFilePath: "/opt/myapp/.env",
  host: process.env.DEPLOY_HOST,
  user: "root",
});
```

## Used By

- `@buydy/dv-cd` - Continuous deployment tools

## Notes

- All sync operations use SSH for secure file transfer
- SSH keys should be properly configured for passwordless authentication
- The package automatically adds `-o StrictHostKeyChecking=no` to SSH options
- Directory paths automatically get trailing slashes for proper rsync behavior

