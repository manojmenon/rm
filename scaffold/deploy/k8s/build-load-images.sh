#!/usr/bin/env bash
# Build app images from docker-compose Dockerfiles, tag for Kind, load into cluster. Run from repo root.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

CLUSTER_NAME="${CLUSTER_NAME:-roadmap}"
COMPOSE_DIR="${COMPOSE_DIR:-$REPO_ROOT/scaffold/deploy/docker-compose}"

echo "=== Building images (backend, frontend, seed) ==="
docker build -t roadmap-backend:latest -f "$COMPOSE_DIR/Dockerfile.backend" .
docker build -t roadmap-frontend:latest -f "$COMPOSE_DIR/Dockerfile.frontend" .
docker build -t roadmap-seed:latest -f "$COMPOSE_DIR/Dockerfile.seed" .

echo "=== Loading images into Kind cluster '$CLUSTER_NAME' ==="
kind load docker-image roadmap-backend:latest --name "$CLUSTER_NAME"
kind load docker-image roadmap-frontend:latest --name "$CLUSTER_NAME"
kind load docker-image roadmap-seed:latest --name "$CLUSTER_NAME"

echo "=== Images loaded ==="
