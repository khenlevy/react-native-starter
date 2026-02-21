# app-db

MongoDB database service with automated backup system. Designed for deployment to a DigitalOcean droplet using Docker Compose.

## Overview

This application provides:

- **MongoDB 8.0** - Production-ready database with authentication
- **Automated Backups** - Daily backups at 03:15 AM, keeping last 2 backups
- **Manual Backup/Restore** - Scripts for on-demand database operations
- **Security** - MongoDB bound to localhost only, UFW firewall configured

## Architecture

```
┌─────────────────────────────────────┐
│           DigitalOcean Droplet     │
│  ┌─────────────────────────────────┐│
│  │  Docker Network: buydy-network  ││
│  │  ┌─────────────────────────────┐││
│  │  │  MongoDB Container          │││
│  │  │  - Port: 27017 (localhost) │││
│  │  │  - Auth: Enabled            │││
│  │  │  - Memory: 1GB limit        │││
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  Application Containers         ││
│  │  Scanner (port 4001)            ││
│  │  API (ports 3000/3001)         ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

## Quick Start

1. **Deploy to Production**:

   ```bash
   npm run release
   ```

2. **Access MongoDB**:

   ```bash
   # Via SSH tunnel (recommended)
   ssh -L 27017:localhost:27017 kl_droplet

   # Then connect with MongoDB Compass or CLI
   mongosh mongodb://username:password@localhost:27017/database
   ```

3. **Manual Backup**:

   ```bash
   npm run backup
   ```

4. **Restore from Backup**:
   ```bash
   npm run restore
   ```

## Environment Variables

Required in `.env.production`:

```bash
# MongoDB Authentication
MONGO_INITDB_ROOT_USERNAME=your_admin_username
MONGO_INITDB_ROOT_PASSWORD=your_secure_password

# Database Configuration
MONGO_DATABASE=your_database_name
MONGO_USERNAME=your_app_username
MONGO_PASSWORD=your_app_password
```

## Security Features

- **Localhost Binding**: MongoDB only accessible via SSH tunnel
- **Authentication**: Required for all database connections
- **UFW Firewall**: Blocks all external access to database ports
- **Memory Limits**: Prevents memory exhaustion on 2GB droplet

## Backup System

- **Automated**: Daily backups at 03:15 AM
- **Retention**: Keeps last 2 backups
- **Location**: `/var/backups/mongo/`
- **Manual**: On-demand backup/restore scripts available

## Troubleshooting

### Cannot Connect to MongoDB

1. **Check SSH tunnel**:

   ```bash
   ssh -L 27017:localhost:27017 kl_droplet
   ```

2. **Verify MongoDB is running**:

   ```bash
   ssh kl_droplet "docker ps | grep mongo"
   ```

3. **Check MongoDB logs**:
   ```bash
   ssh kl_droplet "docker logs mongo"
   ```

### Backup Issues

1. **Check backup directory**:

   ```bash
   ssh kl_droplet "ls -la /var/backups/mongo/"
   ```

2. **Manual backup**:
   ```bash
   ssh kl_droplet "cd /opt/app-db && ./scripts/backup_mongo.sh"
   ```

## Development

For local development, use the same Docker Compose setup:

```bash
cd apps/app-db/docker
docker compose up -d
```

This will start MongoDB with the same configuration as production.
