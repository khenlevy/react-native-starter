# dv-cd

Continuous Deployment tools for Buydy apps. This package provides a command-line interface to deploy apps to Digital Ocean droplets.

## Architecture

The package is organized into a modular structure with configuration handled through environment variables:

```
packages/dev/dv-cd/
├── bin/
│   └── dv-cd-runner.js          # CLI entry point
├── src/
│   └── services/
│       ├── constants.js         # Deployment constants
│       ├── releaseToDroplet.js  # Main release orchestration (includes config)
│       ├── docker/
│       │   ├── index.js         # Docker functions exports
│       │   ├── checkDocker.js   # Check if Docker is installed
│       │   ├── installDocker.js # Install Docker prerequisites
│       │   └── ensureDocker.js  # Main Docker orchestration
│       ├── upload/
│       │   ├── index.js         # Upload functions exports
│       │   ├── createDeploymentDirectory.js
│       │   ├── copyFiles.js
│       │   ├── updateLatestSymlink.js
│       │   └── uploadToDroplet.js
│       └── ssh/
│           ├── index.js         # SSH functions exports
│           ├── createSSHClient.js
│           ├── createDirectoryToRemove.js
│           └── copyFileToRemote.js
├── package.json
└── README.md
```

## Installation

Add this package to your app's `devDependencies`:

```bash
yarn add -D @buydy/dv-cd
```

## Setup

### 1. Environment Configuration

Create a `.env.production` file in your app directory (e.g., `apps/app-api/.env.production`):

```env
# Production Environment Configuration
NODE_ENV=production

# Digital Ocean Droplet Configuration
# Assumes SSH keys are properly configured on the machine
DO_DROPLET_HOST=your-droplet-ip-or-domain.com
DO_DROPLET_USERNAME=root

# Server Configuration
PORT=3000
API_HOST=0.0.0.0
```

### 2. SSH Setup
- Ensure SSH keys are properly configured on the machine running the deployment
- Add your public key to the droplet's `~/.ssh/authorized_keys`
- The deployment will use the system's SSH configuration automatically

### 3. Package Script

Add a release script to your app's `package.json`:

```json
{
  "scripts": {
    "release": "cp .env.production .env && dv-cd release"
  },
  "devDependencies": {
    "@buydy/dv-cd": "workspace:*"
  }
}
```

## Usage

### Basic Commands

```bash
# Deploy the current app to production
dv-cd release

# Rollback to the previous release
dv-cd rollback

# Clean up old releases (keep latest 15 by default)
dv-cd cleanup

# Clean up old releases (keep latest 10)
dv-cd cleanup --keep 10
```

### Infrastructure Management

```bash
# Reset Docker completely (removes all containers, images, volumes)
dv-cd reset-docker

# Clean up Docker containers and networks (keeps images)
dv-cd cleanup-docker
```

### From App Directory

From your app directory, you can also use:

```bash
yarn release
```

This will:
1. Copy `.env.production` to `.env`
2. Find the monorepo root directory
3. Connect to your Digital Ocean droplet via SSH
4. Ensure Docker prerequisites are installed on the droplet
5. Copy all files from the monorepo root to `/opt/{app-name}/releases/{timestamp}/`
6. Build and deploy the Docker container
8. Perform health checks
9. Create a symlink at `/opt/{app-name}/latest` pointing to the latest release
10. Exclude common files/directories like `node_modules`, `.git`, `.env`, etc.

## File Structure on Droplet

After deployment, your files will be organized as follows:

```
/opt/{app-name}/
├── latest -> releases/2024-01-15T10-30-45-123Z/
└── releases/
    ├── 2024-01-15T10-30-45-123Z/
    │   ├── apps/
    │   ├── packages/
    │   ├── package.json
    │   └── ...
    └── 2024-01-15T09-15-30-456Z/
        └── ...
```

## Release Process

The complete release process includes:

1. **Infrastructure Setup**: Ensures Docker is running
2. **Local Docker Build**: Builds Docker image locally and saves as tar file
3. **File Upload**: Copies entire monorepo to timestamped release directory (excluding tar file)
4. **Image Upload**: Uploads Docker tar file to release directory
5. **Image Load**: Loads Docker image on the droplet
6. **App Deployment**: Stops old container, starts new one with pre-built image
7. **Health Check**: Verifies the app is running correctly
8. **Symlink Update**: Updates `latest` symlink to point to new release
9. **Cleanup**: Automatically removes old releases (keeps latest 15) and local tar file

## Rollback

If a release fails or has issues, you can quickly rollback:

```bash
dv-cd rollback
```

This will:
- Find the previous release
- Update the `latest` symlink
- Load the pre-built Docker image from the previous release
- Restart the app from the previous release
- Clean up old releases (keeps latest 15)

## Cleanup

To prevent disk space issues, clean up old releases:

```bash
dv-cd cleanup --keep 15
```

This keeps the latest 15 releases and removes older ones. The system automatically cleans up after each release to maintain this limit.

The `{app-name}` is automatically extracted from the package.json of the app running the release command. For example:
- `app-api` → `/opt/app-api/`
- `app-stocks-scanner` → `/opt/app-stocks-scanner/`

## Infrastructure Setup

The deployment process automatically sets up Docker using dedicated installation scripts:

### Docker Installation

1. **Check**: Verifies if Docker is already installed
2. **Install**: If not installed, runs the `scripts/install-docker.sh` script which:
   - Updates system packages non-interactively
   - Installs Docker Engine with official repository
   - Sets up Docker Compose and Buildx
   - Creates the `app-net` network
   - Configures user permissions

**Script Features:**
- **Non-interactive**: `DEBIAN_FRONTEND=noninteractive`
- **Conflict resolution**: `--force-confold` preserves existing configs
- **Official repository**: Uses Docker's official Ubuntu repository
- **Complete setup**: Includes all Docker tools and networking

**Note**: MongoDB is now handled by external cloud instances. The deployment process no longer sets up local MongoDB containers.



## Excluded Files

The following files and directories are automatically excluded from deployment by default:
- `node_modules`
- `.git`
- `.env`
- `.DS_Store`
- `*.log`
- `dist`
- `build`
- `coverage`
- `.nyc_output`

These patterns are built into the deployment service and cannot be customized.

## Dependencies

This package depends on:
- `@buydy/dv-monorepo` - For monorepo root detection
- `ssh2` - For SSH connections
- `dotenv` - For environment variable loading
- `commander` - For CLI interface

## Security Notes

- Never commit your `.env.production` file to version control
- Ensure SSH keys are properly configured and secured on the deployment machine
- Ensure your droplet's firewall is properly configured
- Consider using a dedicated deployment user instead of root

## Troubleshooting

1. **SSH Connection Failed**: Check your droplet's IP/domain and SSH credentials
2. **Permission Denied**: Ensure your SSH key has the correct permissions (600)
3. **Directory Not Found**: Make sure you're running the command from within a Buydy app directory
4. **Environment Variables**: Ensure `.env.production` exists and contains the required variables 