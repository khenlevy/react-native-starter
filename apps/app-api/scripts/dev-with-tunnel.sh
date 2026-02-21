#!/usr/bin/env bash
set -euo pipefail

# Determine local forward port: TUNNEL_LOCAL_PORT > MONGO_PORT > 27017
PORT="${TUNNEL_LOCAL_PORT:-${MONGO_PORT:-27017}}"
SSH_HOST="${DO_DROPLET_HOST:-${SSH_HOST:-kl_droplet}}"

echo "[dev-with-tunnel] Using local port $PORT for SSH tunnel to $SSH_HOST:27017"

# If port busy, check if it's an SSH tunnel (LISTEN state)
if lsof -i tcp:"$PORT" >/dev/null 2>&1; then
  if lsof -i :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[dev-with-tunnel] Port $PORT is busy but appears to be an SSH tunnel (LISTEN state); using it"
  else
    echo "[dev-with-tunnel] ERROR: Port $PORT is busy and not an SSH tunnel!"
    echo "[dev-with-tunnel] Please check what's using it: lsof -i :$PORT"
    echo "[dev-with-tunnel] Or kill the process: lsof -ti :$PORT | xargs kill"
    exit 1
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

echo "[dev-with-tunnel] Starting API with MONGO_HOST=$MONGO_HOST MONGO_PORT=$MONGO_PORT"
exec node --watch src/index.js


