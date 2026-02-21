#!/usr/bin/env bash
set -euo pipefail

# Secure MongoDB Access Script
# This script creates an SSH tunnel to access MongoDB securely
# No direct IP binding - uses SSH tunneling for security

CONTAINER="mongo"
ENV_FILE="/opt/app-db/docker/.env.production"
LOCAL_PORT="27018"  # Local port for SSH tunnel

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    log "ERROR: $1"
    exit 1
}

usage() {
    echo "Usage: $0 [start|stop|status]"
    echo ""
    echo "Commands:"
    echo "  start   - Create SSH tunnel to MongoDB (requires SSH access)"
    echo "  stop    - Stop SSH tunnel"
    echo "  status  - Check tunnel status"
    echo ""
    echo "After starting the tunnel, connect to MongoDB using:"
    echo "  Host: localhost"
    echo "  Port: $LOCAL_PORT"
    echo "  Username: (from MONGO_USERNAME)"
    echo "  Password: (from MONGO_PASSWORD)"
    echo "  Authentication Database: admin"
}

# Load environment variables
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
    log "Loaded MongoDB credentials from .env.production"
else
    error ".env.production file not found at $ENV_FILE"
fi

# Validate required environment variables
if [ -z "${DO_DROPLET_HOST:-}" ] || [ -z "${MONGO_USERNAME:-}" ] || [ -z "${MONGO_PASSWORD:-}" ]; then
    error "Required environment variables not found. Please check DO_DROPLET_HOST, MONGO_USERNAME, and MONGO_PASSWORD"
fi

start_tunnel() {
    log "Starting SSH tunnel to MongoDB..."
    
    # Check if tunnel is already running
    if pgrep -f "ssh.*$LOCAL_PORT:localhost:27017" > /dev/null; then
        log "SSH tunnel is already running on port $LOCAL_PORT"
        return 0
    fi
    
    # Create SSH tunnel
    log "Creating SSH tunnel: localhost:$LOCAL_PORT -> $DO_DROPLET_HOST:27017"
    ssh -f -N -L $LOCAL_PORT:localhost:27017 $DO_DROPLET_HOST
    
    # Wait a moment for tunnel to establish
    sleep 2
    
    # Test the tunnel
    if nc -z localhost $LOCAL_PORT 2>/dev/null; then
        log "✅ SSH tunnel established successfully"
        log "You can now connect to MongoDB using:"
        log "  Host: localhost"
        log "  Port: $LOCAL_PORT"
        log "  Username: $MONGO_USERNAME"
        log "  Password: $MONGO_PASSWORD"
        log "  Authentication Database: admin"
    else
        error "Failed to establish SSH tunnel"
    fi
}

stop_tunnel() {
    log "Stopping SSH tunnel..."
    
    # Find and kill SSH tunnel processes
    PIDS=$(pgrep -f "ssh.*$LOCAL_PORT:localhost:27017" || true)
    
    if [ -n "$PIDS" ]; then
        echo "$PIDS" | xargs kill
        log "✅ SSH tunnel stopped"
    else
        log "No SSH tunnel found running on port $LOCAL_PORT"
    fi
}

check_tunnel() {
    if pgrep -f "ssh.*$LOCAL_PORT:localhost:27017" > /dev/null; then
        log "✅ SSH tunnel is running on port $LOCAL_PORT"
        
        # Test connection
        if nc -z localhost $LOCAL_PORT 2>/dev/null; then
            log "✅ MongoDB is accessible through tunnel"
        else
            log "⚠️  Tunnel is running but MongoDB is not accessible"
        fi
    else
        log "❌ SSH tunnel is not running"
    fi
}

# Main script logic
case "${1:-start}" in
    start)
        start_tunnel
        ;;
    stop)
        stop_tunnel
        ;;
    status)
        check_tunnel
        ;;
    *)
        usage
        exit 1
        ;;
esac