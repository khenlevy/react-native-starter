#!/usr/bin/env bash
set -euo pipefail

# MongoDB initialization script that ensures proper authentication setup
# This script guarantees that MongoDB starts with the correct admin user from .env.production

CONTAINER="mongo"
ENV_FILE="/opt/app-db/docker/.env.production"
LOG_FILE="/var/log/mongo_init.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    exit 1
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
if [ -z "${MONGO_USERNAME:-}" ] || [ -z "${MONGO_PASSWORD:-}" ]; then
    error "MONGO_USERNAME or MONGO_PASSWORD not found in .env.production"
fi

log "Initializing MongoDB auth for user: $MONGO_USERNAME"

# Start/ensure MongoDB with auth using Docker Compose (binds localhost only)
log "Starting MongoDB via Docker Compose..."
cd /opt/app-db/docker
docker compose up -d mongo

# Wait for MongoDB with authentication to be ready (admin may be created by MONGO_INITDB_* on first boot)
log "Waiting for MongoDB with authentication to be ready..."
for i in {1..20}; do
    if docker exec "$CONTAINER" mongosh --authenticationDatabase admin -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        log "MongoDB with authentication is ready"
        break
    fi
    if [ $i -eq 15 ]; then
        log "Auth ping failed; attempting bootstrap without auth to (re)create admin"
    fi
    log "Waiting for MongoDB authentication... ($i/60)"
    sleep 1
done

# If auth still not available, perform a fast, local bootstrap without auth
if ! docker exec "$CONTAINER" mongosh --authenticationDatabase admin -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
  log "Bootstrapping admin user without auth..."
  # Stop compose container to release volume
  docker compose stop mongo || true
  # Detect the data volume name used by the compose container
  VOLUME_NAME=$(docker inspect -f '{{ range .Mounts }}{{ if eq .Destination "/data/db" }}{{ .Name }}{{ end }}{{ end }}' "$CONTAINER" 2>/dev/null || true)
  if [ -z "$VOLUME_NAME" ]; then
    error "Could not detect Mongo data volume from running container; aborting to avoid creating a new unintended volume"
  fi
  log "Using volume: $VOLUME_NAME"
  # Start temporary no-auth container bound to the same volume
  docker run -d --name mongo_bootstrap -v "$VOLUME_NAME":/data/db mongo:8.0
  # Wait for bootstrap Mongo to accept commands
  for j in {1..20}; do
    if docker exec mongo_bootstrap mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  # Upsert admin
  docker exec mongo_bootstrap mongosh --quiet --eval "
    try {
      const adm = db.getSiblingDB('admin');
      const u = adm.getUser('$MONGO_USERNAME');
      if (!u) { adm.createUser({ user: '$MONGO_USERNAME', pwd: '$MONGO_PASSWORD', roles: [{ role: 'root', db: 'admin' }] }); print('created'); }
      else { adm.updateUser('$MONGO_USERNAME', { pwd: '$MONGO_PASSWORD' }); print('updated'); }
    } catch(e) { print(e.message); quit(1) }
  "
  # Stop bootstrap
  docker stop mongo_bootstrap >/dev/null 2>&1 || true
  docker rm mongo_bootstrap >/dev/null 2>&1 || true
  # Start compose again
  docker compose up -d mongo
  # Short auth wait
  for k in {1..20}; do
    if docker exec "$CONTAINER" mongosh --authenticationDatabase admin -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      break
    fi
    if [ $k -eq 20 ]; then
      error "MongoDB authentication still failing after bootstrap"
    fi
    sleep 1
  done
fi

# Idempotent upsert of admin user (handles password rotation on running container)
log "Ensuring admin user exists/updated..."
docker exec "$CONTAINER" mongosh --authenticationDatabase admin -u "$MONGO_USERNAME" -p "$MONGO_PASSWORD" --quiet --eval "
  try {
    const adm = db.getSiblingDB('admin');
    const u = adm.getUser('$MONGO_USERNAME');
    if (!u) {
      adm.createUser({ user: '$MONGO_USERNAME', pwd: '$MONGO_PASSWORD', roles: [{ role: 'root', db: 'admin' }] });
      print('created');
    } else {
      adm.updateUser('$MONGO_USERNAME', { pwd: '$MONGO_PASSWORD' });
      print('updated');
    }
  } catch(e) { print(e.message); quit(1) }
"

log "✅ MongoDB authentication setup completed successfully"
log "Admin user '$MONGO_USERNAME' is ready for use"
exit 0
