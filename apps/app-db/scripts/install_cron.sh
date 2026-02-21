#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup_mongo.sh"
RESTORE_SCRIPT="${SCRIPT_DIR}/restore_mongo_robust.sh"
ENV_FILE="${SCRIPT_DIR}/../docker/.env.production"
LOG_FILE="/var/log/mongo_backup.log"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Installing MongoDB backup and restore system..."

# Make scripts executable
chmod +x "$BACKUP_SCRIPT"
chmod +x "$RESTORE_SCRIPT"

# Create log file if it doesn't exist
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

# Read credentials from .env file if not already set
if [ -z "${MONGO_USERNAME:-}" ] || [ -z "${MONGO_PASSWORD:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    MONGO_USERNAME=$(grep '^MONGO_USERNAME=' "$ENV_FILE" | cut -d= -f2)
    MONGO_PASSWORD=$(grep '^MONGO_PASSWORD=' "$ENV_FILE" | cut -d= -f2)
  else
    log "Error: .env file not found and credentials not provided via environment"
    exit 1
  fi
fi

# Ensure backup directory exists
mkdir -p /var/backups/mongo
chmod 755 /var/backups/mongo

# Cron job: daily at 03:15 AM
CRON_LINE="15 3 * * * MONGO_USERNAME='${MONGO_USERNAME}' MONGO_PASSWORD='${MONGO_PASSWORD}' ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1"

# Remove any existing mongo backup cron jobs and add the new one
TEMP_CRON=$(mktemp)
crontab -l 2>/dev/null | grep -v 'mongo_backup.log' > "$TEMP_CRON" || true
echo "$CRON_LINE" >> "$TEMP_CRON"
crontab "$TEMP_CRON"
rm "$TEMP_CRON"

log "✅ Cron job installed successfully"
log "📅 Backup scheduled daily at 03:15 AM"
log "📁 Backup directory: /var/backups/mongo"
log "📝 Log file: $LOG_FILE"
log "🔧 Available commands:"
log "   - View cron jobs: crontab -l"
log "   - View backup logs: tail -f $LOG_FILE"
log "   - Manual backup: $BACKUP_SCRIPT"
log "   - Restore database: $RESTORE_SCRIPT"
log "   - List backups: $RESTORE_SCRIPT --list"
log "   - Verify database: $RESTORE_SCRIPT --verify"

