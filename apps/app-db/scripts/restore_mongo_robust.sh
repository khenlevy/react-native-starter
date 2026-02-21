#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/mongo"
CONTAINER="mongo"
MAX_ATTEMPTS=5
LOG_FILE="/var/log/mongo_restore.log"
ENV_FILE="/opt/app-db/docker/.env.production"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error function
error() {
    log "ERROR: $1"
    exit 1
}

# Load environment variables from .env.production file if not already set
# Note: The .env.production file is copied from root during deployment
if [ -z "${MONGO_USERNAME:-}" ] || [ -z "${MONGO_PASSWORD:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    # Source the .env.production file (which contains production environment variables)
    set -a
    source "$ENV_FILE"
    set +a
    log "Loaded MongoDB credentials from production environment file"
  else
    error ".env.production file not found and credentials not provided via environment"
  fi
fi

# Check if MongoDB container is running
check_mongo_container() {
    if ! docker ps | grep -q "$CONTAINER"; then
        error "MongoDB container is not running. Please start it first: docker compose up -d mongo"
    fi
    log "MongoDB container is running"
}

# Get available backups sorted by date (newest first)
get_available_backups() {
    if [ ! -d "$BACKUP_DIR" ]; then
        echo ""
        return
    fi
    
    cd "$BACKUP_DIR"
    ls -1t mongo_backup_*.gz 2>/dev/null | head -n 10 || echo ""
}

# Create a pre-restore backup
create_pre_restore_backup() {
    local timestamp=$(date +%F_%H%M%S)
    local backup_name="pre_restore_backup_${timestamp}.gz"
    
    log "Creating pre-restore backup: $backup_name"
    
    if ! docker exec "$CONTAINER" bash -lc \
      "mongodump --authenticationDatabase admin -u \"$MONGO_USERNAME\" -p \"$MONGO_PASSWORD\" --archive=/data/db/$backup_name --gzip"; then
        error "Failed to create pre-restore backup"
    fi
    
    if ! docker cp "$CONTAINER:/data/db/$backup_name" "$BACKUP_DIR/$backup_name"; then
        error "Failed to copy pre-restore backup from container"
    fi
    
    docker exec "$CONTAINER" rm -f "/data/db/$backup_name"
    log "Pre-restore backup created: $backup_name"
}

# Restore from a specific backup file
restore_from_backup() {
    local backup_file="$1"
    local temp_name="temp_restore_$(date +%s).gz"
    
    log "Attempting to restore from: $backup_file"
    
    # Copy backup to container
    if ! docker cp "$backup_file" "$CONTAINER:/data/db/$temp_name"; then
        log "Failed to copy backup to container"
        return 1
    fi
    
    # Restore the backup
    if ! docker exec "$CONTAINER" bash -lc \
      "mongorestore --drop --authenticationDatabase admin -u \"$MONGO_USERNAME\" -p \"$MONGO_PASSWORD\" --gzip --archive=/data/db/$temp_name"; then
        log "Failed to restore from backup"
        docker exec "$CONTAINER" rm -f "/data/db/$temp_name"
        return 1
    fi
    
    # Clean up
    docker exec "$CONTAINER" rm -f "/data/db/$temp_name"
    log "Successfully restored from: $backup_file"
    return 0
}

# Verify restore was successful
verify_restore() {
    log "Verifying database restore..."
    
    local output
    if ! output=$(docker exec "$CONTAINER" bash -lc \
      "mongosh --authenticationDatabase admin -u \"$MONGO_USERNAME\" -p \"$MONGO_PASSWORD\" --eval 'db.adminCommand(\"listCollections\")' --quiet" 2>&1); then
        log "Database verification failed: $output"
        return 1
    fi
    
    if echo "$output" | grep -q "Error\|Authentication failed"; then
        log "Database verification failed: $output"
        return 1
    fi
    
    local collection_count=$(echo "$output" | grep -c "name" || echo "0")
    log "Database verification successful. Collections found: $collection_count"
    return 0
}

# Main restore function with fallback logic
main_restore() {
    log "Starting robust MongoDB restore process..."
    
    # Check prerequisites
    check_mongo_container
    
    # Get available backups
    local backups
    backups=$(get_available_backups)
    
    if [ -z "$backups" ]; then
        error "No backup files found in $BACKUP_DIR"
    fi
    
    local backup_count=$(echo "$backups" | wc -l)
    log "Found $backup_count backup files available"
    
    # Show available backups
    log "Available backups (newest first):"
    echo "$backups" | while read -r backup; do
        if [ -n "$backup" ]; then
            local size
            size=$(du -h "$BACKUP_DIR/$backup" 2>/dev/null | cut -f1 || echo "unknown")
            log "  - $backup (Size: $size)"
        fi
    done
    
    # Create pre-restore backup
    create_pre_restore_backup
    
    # Try to restore from each backup until successful
    local attempt=1
    local successful_restore=false
    local used_backup=""
    
    while [ $attempt -le $MAX_ATTEMPTS ] && [ -n "$backups" ]; do
        local backup_file
        backup_file=$(echo "$backups" | head -n 1)
        
        if [ -z "$backup_file" ]; then
            log "No more backups to try"
            break
        fi
        
        log "Attempt $attempt/$MAX_ATTEMPTS: Trying backup $backup_file"
        
        if restore_from_backup "$BACKUP_DIR/$backup_file"; then
            if verify_restore; then
                successful_restore=true
                used_backup="$backup_file"
                log "SUCCESS: Database restored from $backup_file"
                break
            else
                log "Restore from $backup_file succeeded but verification failed"
            fi
        else
            log "Restore from $backup_file failed"
        fi
        
        # Remove the failed backup from the list and try the next one
        backups=$(echo "$backups" | tail -n +2)
        attempt=$((attempt + 1))
    done
    
    if [ "$successful_restore" = true ]; then
        log "🎉 RESTORE SUCCESSFUL!"
        log "Used backup: $used_backup"
        log "Attempts made: $((attempt - 1))"
        log "Pre-restore backup available for rollback if needed"
        return 0
    else
        error "Restore failed after $MAX_ATTEMPTS attempts. No working backup found."
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Robust MongoDB restore script with automatic fallback logic"
    echo "Automatically uses the latest available backup - no path required!"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -l, --list     List available backups"
    echo "  -v, --verify   Verify current database state"
    echo ""
    echo "The script will:"
    echo "  1. Check MongoDB container status"
    echo "  2. Find the latest available backup automatically"
    echo "  3. Create a pre-restore backup"
    echo "  4. Try to restore from the latest backup"
    echo "  5. If failed, try the next oldest backup (up to 5 attempts)"
    echo "  6. Verify the restore was successful"
    echo ""
    echo "Available backups:"
    get_available_backups | while read -r backup; do
        if [ -n "$backup" ]; then
            local size
            size=$(du -h "$BACKUP_DIR/$backup" 2>/dev/null | cut -f1 || echo "unknown")
            echo "  - $backup (Size: $size)"
        fi
    done
}

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    -l|--list)
        echo "Available backups:"
        get_available_backups | while read -r backup; do
            if [ -n "$backup" ]; then
                size=$(du -h "$BACKUP_DIR/$backup" 2>/dev/null | cut -f1 || echo "unknown")
                echo "  - $backup (Size: $size)"
            fi
        done
        exit 0
        ;;
    -v|--verify)
        check_mongo_container
        if verify_restore; then
            log "Database verification successful"
        else
            log "Database verification failed"
            exit 1
        fi
        exit 0
        ;;
    "")
        main_restore
        ;;
    *)
        echo "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac
