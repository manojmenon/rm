#!/usr/bin/env bash
# Bring down the app on the Ubuntu VM (stop backend and frontend processes — no Docker).
# Run from repo root: make vm-down-all
#
# If VM_HOST is set: SSH to the VM and run this script there.
# If VM_HOST is not set: run locally. Postgres is not stopped.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# Script is at scaffold/deploy/vm/ubuntu/; go up 4 levels to repo root
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
VM_USER="${VM_USER:-ubuntu}"
VM_REPO_PATH="${VM_REPO_PATH:-/home/ubuntu/rm}"
PID_DIR="$SCRIPT_DIR/.pids"

# When VM_HOST is set, run this script on the remote with VM_HOST cleared.
if [ -n "${VM_HOST:-}" ]; then
  echo "=== VM (Ubuntu): bring down app on remote ${VM_USER}@${VM_HOST}:${VM_REPO_PATH} ==="
  ssh "${VM_USER}@${VM_HOST}" "cd ${VM_REPO_PATH} && REPO_ROOT=${VM_REPO_PATH} VM_HOST= ./scaffold/deploy/vm/ubuntu/down-all.sh"
  echo "=== VM down-all complete ==="
  exit 0
fi

cd "$REPO_ROOT"
echo "=== VM (Ubuntu): bring down app (native, no Docker) ==="
echo "  Target: local (current directory)"

# Stop backend
if [ -f "$PID_DIR/backend.pid" ]; then
  pid=$(cat "$PID_DIR/backend.pid")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    echo "  Stopped backend (PID $pid)"
  fi
  rm -f "$PID_DIR/backend.pid"
fi

# Stop frontend
if [ -f "$PID_DIR/frontend.pid" ]; then
  pid=$(cat "$PID_DIR/frontend.pid")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    echo "  Stopped frontend (PID $pid)"
  fi
  rm -f "$PID_DIR/frontend.pid"
fi

# Free ports 8080 and 3000 if still in use (e.g. orphaned node/bash from previous run)
free_port() {
  local port=$1
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  else
    pid=$(lsof -ti ":$port" 2>/dev/null) && [ -n "$pid" ] && kill $pid 2>/dev/null || true
  fi
}
for p in 8080 3000; do
  if (echo >/dev/tcp/127.0.0.1/$p) 2>/dev/null; then
    free_port "$p"
    echo "  Freed port $p"
  fi
done

# Stop Docker Postgres (started by vm-up-all)
echo "  Stopping Docker Postgres..."
make docker-down-postgres

echo "=== VM down-all complete ==="
