#!/usr/bin/env bash
set -euo pipefail

# Script to ensure admin user exists with correct credentials from .env.production
# This script is run during deployment to guarantee admin user authentication

CONTAINER="mongo"
ENV_FILE="/opt/app-db/docker/.env.production"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Error function
error() {
    log "ERROR: $1"
    exit 1
}

# Load environment variables from .env.production file
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
    log "Loaded MongoDB credentials from .env.production"
else
    error ".env.production file not found at $ENV_FILE"
fi

# Validate required environment variables
if [ -z "${MONGO_USERNAME:-}" ] || [ -z "${MONGO_PASSWORD:-}" ]; then
    error "MONGO_USERNAME or MONGO_PASSWORD not found in .env.production"
fi

log "Ensuring admin user exists with username: $MONGO_USERNAME"

# Wait for MongoDB to be ready
log "Waiting for MongoDB to be ready..."
for i in {1..30}; do
    if docker exec "$CONTAINER" mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        log "MongoDB is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        error "MongoDB failed to start within 30 seconds"
    fi
    sleep 1
done

# Check if admin user already exists and has correct credentials
log "Checking if admin user exists with correct credentials..."
if docker exec "$CONTAINER" mongosh --authenticationDatabase admin -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    log "Admin user already exists with correct credentials"
    exit 0
fi

log "Admin user needs to be created or updated"

# Start MongoDB without authentication to create/update admin user
log "Temporarily disabling authentication to create admin user..."

# Stop the current MongoDB container
docker stop "$CONTAINER" || true
docker rm "$CONTAINER" || true

# Start MongoDB without authentication
log "Starting MongoDB without authentication..."
docker run -d --name "$CONTAINER" -p 27017:27017 -v mongo_data:/data/db mongo:8.0

# Wait for MongoDB to be ready
log "Waiting for MongoDB to be ready without authentication..."
for i in {1..30}; do
    if docker exec "$CONTAINER" mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        log "MongoDB is ready without authentication"
        break
    fi
    if [ $i -eq 30 ]; then
        error "MongoDB failed to start without authentication within 30 seconds"
    fi
    sleep 1
done

# Create or update admin user
log "Creating/updating admin user..."
docker exec "$CONTAINER" mongosh --eval "
use admin;
try {
  db.dropUser('$MONGO_USERNAME');
  print('Dropped existing admin user');
} catch (e) {
  print('No existing admin user to drop');
}

db.createUser({
  user: '$MONGO_USERNAME',
  pwd: '$MONGO_PASSWORD',
  roles: [
    { role: 'root', db: 'admin' }
  ]
});
print('Admin user created successfully');
"

# Stop MongoDB without authentication
log "Stopping MongoDB without authentication..."
docker stop "$CONTAINER" || true
docker rm "$CONTAINER" || true

# Start MongoDB with authentication
log "Starting MongoDB with authentication..."
cd /opt/app-db/docker
if ! docker compose up -d mongo; then
    error "Failed to start MongoDB with authentication"
fi

# Wait for MongoDB to be ready with authentication
log "Waiting for MongoDB to be ready with authentication..."
for i in {1..60}; do
    if docker exec "$CONTAINER" mongosh --authenticationDatabase admin -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        log "MongoDB is ready with authentication"
        break
    fi
    if [ $i -eq 60 ]; then
        error "MongoDB failed to start with authentication within 60 seconds"
    fi
    log "Waiting for MongoDB authentication... ($i/60)"
    sleep 2
done

# Verify admin user works
log "Verifying admin user authentication..."
if docker exec "$CONTAINER" mongosh --authenticationDatabase admin -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    log "✅ Admin user authentication verified successfully"
else
    error "Admin user authentication verification failed"
fi

log "✅ Admin user setup completed successfully"
