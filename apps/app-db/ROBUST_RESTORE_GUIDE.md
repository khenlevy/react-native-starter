# Robust MongoDB Restore System

This guide explains the enhanced MongoDB backup and restore system with automatic fallback logic.

## Overview

The robust restore system provides:

- **Daily automated backups** with only the last 2 backups kept
- **Intelligent restore** with automatic fallback to older backups
- **Up to 5 restore attempts** using different backup files
- **Pre-restore backup** for safety
- **Comprehensive logging** and verification

## System Components

### 1. Enhanced Backup Script (`backup_mongo.sh`)

- Creates daily backups at 03:15 AM via cron
- Keeps only the last 2 backups to save space
- Comprehensive error handling and logging
- Verifies backup integrity before completion

### 2. Robust Restore Script (`restore_mongo_robust.sh`)

- Tries to restore from the latest backup first
- Falls back to older backups if restore fails
- Up to 5 attempts or until no more backups available
- Creates a pre-restore backup for safety
- Verifies restore success after each attempt

### 3. Package Scripts (app-db/package.json)

- `yarn restore` - Run the robust restore process
- `yarn restore:list` - List available backups
- `yarn restore:verify` - Verify current database state
- `yarn backup` - Create a manual backup

## Usage

### From Local Machine (Recommended)

```bash
# Navigate to app-db directory
cd apps/app-db

# Run robust restore (tries latest backup, falls back if needed)
yarn restore

# List available backups
yarn restore:list

# Verify current database state
yarn restore:verify

# Create manual backup
yarn backup
```

### From Production Server

```bash
# SSH into production server
ssh root@kl_droplet

# Navigate to app-db directory
cd /opt/app-db

# Run restore with environment variables
export MONGO_INITDB_ROOT_USERNAME="admin"
export MONGO_INITDB_ROOT_PASSWORD="your_password"
./scripts/restore_mongo_robust.sh

# List available backups
./scripts/restore_mongo_robust.sh --list

# Verify database
./scripts/restore_mongo_robust.sh --verify
```

## How the Robust Restore Works

### 1. Pre-flight Checks

- Verifies MongoDB container is running
- Checks for available backup files
- Validates environment variables

### 2. Safety Backup

- Creates a backup of current database before restore
- Named: `pre_restore_backup_YYYY-MM-DD_HHMMSS.gz`
- Allows rollback if restore fails

### 3. Restore Attempts

The script tries to restore in this order:

1. **Latest backup** (most recent by timestamp)
2. **Second latest backup** (if first fails)
3. **Third latest backup** (if second fails)
4. **Fourth latest backup** (if third fails)
5. **Fifth latest backup** (if fourth fails)

### 4. Verification

After each restore attempt:

- Tests MongoDB connection
- Verifies collections are accessible
- Counts available collections
- Only considers restore successful if verification passes

### 5. Success or Failure

- **Success**: Reports which backup was used and number of attempts
- **Failure**: Reports that no working backup was found after 5 attempts

## Backup Management

### Daily Backups

- **Schedule**: Every day at 03:15 AM
- **Location**: `/var/backups/mongo/`
- **Retention**: Last 2 backups only
- **Format**: `mongo_backup_YYYY-MM-DD_HHMMSS.gz`

### Backup Rotation

```bash
# Example backup files (newest first)
mongo_backup_2025-01-20_031500.gz  # Today's backup
mongo_backup_2025-01-19_031500.gz  # Yesterday's backup
# Older backups are automatically deleted
```

## Logging

### Backup Logs

- **Location**: `/var/log/mongo_backup.log`
- **Content**: Backup creation, cleanup, and errors
- **View**: `tail -f /var/log/mongo_backup.log`

### Restore Logs

- **Location**: `/var/log/mongo_restore.log`
- **Content**: Restore attempts, verification, and results
- **View**: `tail -f /var/log/mongo_restore.log`

## Troubleshooting

### Common Issues

#### 1. No Backups Available

```bash
# Check if backups exist
yarn restore:list

# Create a manual backup
yarn backup
```

#### 2. MongoDB Container Not Running

```bash
# Check container status
ssh root@kl_droplet "docker compose -f /opt/app-db/docker/docker-compose.yml ps"

# Start MongoDB container
ssh root@kl_droplet "cd /opt/app-db/docker && docker compose up -d mongo"
```

#### 3. Restore Fails All Attempts

```bash
# Check restore logs
ssh root@kl_droplet "tail -f /var/log/mongo_restore.log"

# Verify backup integrity
ssh root@kl_droplet "cd /opt/app-db && ./scripts/restore_mongo_robust.sh --list"
```

#### 4. Rollback to Pre-Restore State

```bash
# Find pre-restore backup
ssh root@kl_droplet "ls -la /var/backups/mongo/pre_restore_backup_*.gz"

# Restore from pre-restore backup
ssh root@kl_droplet "cd /opt/app-db && export MONGO_INITDB_ROOT_USERNAME='admin' && export MONGO_INITDB_ROOT_PASSWORD='your_password' && ./scripts/restore_mongo_robust.sh /var/backups/mongo/pre_restore_backup_YYYY-MM-DD_HHMMSS.gz"
```

## Safety Features

### 1. Pre-Restore Backup

- Always creates a backup before attempting restore
- Allows complete rollback if needed
- Stored alongside regular backups

### 2. Verification

- Tests database connectivity after each restore
- Verifies collections are accessible
- Only considers restore successful if verification passes

### 3. Fallback Logic

- Tries multiple backups before giving up
- Uses backup age as fallback order (newest first)
- Limits attempts to prevent infinite loops

### 4. Comprehensive Logging

- Logs all operations with timestamps
- Records success/failure for each attempt
- Provides detailed error messages

## Monitoring

### Check System Health

```bash
# View recent backup activity
ssh root@kl_droplet "tail -20 /var/log/mongo_backup.log"

# View recent restore activity
ssh root@kl_droplet "tail -20 /var/log/mongo_restore.log"

# Check cron job status
ssh root@kl_droplet "crontab -l | grep mongo"
```

### Verify Database State

```bash
# Quick verification
yarn restore:verify

# Detailed database info
ssh root@kl_droplet "docker exec mongo mongosh --authenticationDatabase admin -u admin -p your_password --eval 'db.adminCommand(\"listCollections\")'"
```

## Best Practices

1. **Regular Monitoring**: Check backup logs weekly
2. **Test Restores**: Periodically test restore process
3. **Backup Verification**: Verify backup integrity after creation
4. **Documentation**: Keep track of restore operations
5. **Environment Variables**: Ensure credentials are properly configured

## Emergency Procedures

### Complete System Recovery

1. Ensure MongoDB container is running
2. Check available backups: `yarn restore:list`
3. Run robust restore: `yarn restore`
4. Verify database: `yarn restore:verify`
5. Check application connectivity

### Manual Restore from Specific Backup

1. SSH into production: `ssh root@kl_droplet`
2. Navigate to app-db: `cd /opt/app-db`
3. Set environment variables
4. Run restore: `./scripts/restore_mongo_robust.sh /var/backups/mongo/backup_file.gz`
