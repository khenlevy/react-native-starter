#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/mongo"
CONTAINER="mongo"
DATE="$(date +%F_%H%M%S)"
ARCHIVE="mongo_backup_${DATE}.gz"
LOG_FILE="/var/log/mongo_backup.log"
ENV_FILE="/opt/app-db/docker/.env.production"

# Load environment variables from .env.production file if not already set
# Note: The .env.production file is copied from root during deployment
if [ -z "${MONGO_USERNAME:-}" ] || [ -z "${MONGO_PASSWORD:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    # Source the .env.production file (which contains production environment variables)
    set -a
    source "$ENV_FILE"
    set +a
  else
    echo "Error: .env.production file not found and credentials not provided via environment"
    exit 1
  fi
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting MongoDB backup..."

# Check if MongoDB container is running
if ! docker ps | grep -q "$CONTAINER"; then
    log "ERROR: MongoDB container is not running"
    exit 1
fi

# Run mongodump inside the container with authentication
log "Creating database dump..."
if ! docker exec "$CONTAINER" bash -lc \
  "mongodump --authenticationDatabase admin -u \"$MONGO_USERNAME\" -p \"$MONGO_PASSWORD\" --archive=/data/db/$ARCHIVE --gzip"; then
    log "ERROR: mongodump failed"
    exit 1
fi

# Copy backup from container to host
log "Copying backup from container..."
if ! docker cp "$CONTAINER:/data/db/$ARCHIVE" "$BACKUP_DIR/$ARCHIVE"; then
    log "ERROR: Failed to copy backup from container"
    exit 1
fi

# Remove backup from container
docker exec "$CONTAINER" rm -f "/data/db/$ARCHIVE"

# Verify backup file
if [ ! -f "$BACKUP_DIR/$ARCHIVE" ] || [ ! -s "$BACKUP_DIR/$ARCHIVE" ]; then
    log "ERROR: Backup file is missing or empty"
    exit 1
fi

# Keep only the last 2 mongo_backup archives, and always remove pre-restore/current_data backups
cd "$BACKUP_DIR"
BACKUP_COUNT=$(ls -1 mongo_backup_*.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 2 ]; then
    log "Cleaning up old backups (keeping last 2)..."
    ls -1t mongo_backup_*.gz | tail -n +3 | xargs -r rm -f
fi

# Always remove pre-restore and current_data backup files (they are not meant to be kept)
rm -f pre_restore_backup_*.gz current_data_backup_*.tar.gz 2>/dev/null || true

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$ARCHIVE" | cut -f1)
log "SUCCESS: Backup saved → $BACKUP_DIR/$ARCHIVE (Size: $BACKUP_SIZE)"

# Show current backups
log "Current backups:"
ls -lh "$BACKUP_DIR" | grep mongo_backup_ | tee -a "$LOG_FILE"

