#!/usr/bin/env bash
set -euo pipefail

# Determine local forward port: TUNNEL_LOCAL_PORT > MONGO_PORT > 27017
PORT="${TUNNEL_LOCAL_PORT:-${MONGO_PORT:-27017}}"
SSH_HOST="${DO_DROPLET_HOST:-${SSH_HOST:-kl_droplet}}"

echo "[dev-with-tunnel] Using local port $PORT for SSH tunnel to $SSH_HOST:27017"

# If port busy, try 27018
if lsof -i tcp:"$PORT" >/dev/null 2>&1; then
  if [ "$PORT" = "27017" ]; then
    echo "[dev-with-tunnel] Port 27017 busy; falling back to 27018"
    PORT=27018
  else
    echo "[dev-with-tunnel] Port $PORT busy; continuing (assuming an existing tunnel)"
  fi
fi

# Establish SSH tunnel in background if port appears free
if ! lsof -i tcp:"$PORT" >/dev/null 2>&1; then
  echo "[dev-with-tunnel] Establishing SSH tunnel on localhost:$PORT -> $SSH_HOST:27017"
  ssh -f -N -L "$PORT:localhost:27017" -o ExitOnForwardFailure=yes -o ServerAliveInterval=60 -o ServerAliveCountMax=3 "$SSH_HOST"
  sleep 0.5
fi

export MONGO_HOST=localhost
export MONGO_PORT="$PORT"

echo "[dev-with-tunnel] Starting Scanner with MONGO_HOST=$MONGO_HOST MONGO_PORT=$MONGO_PORT"
exec node --watch index.js

