#!/usr/bin/env bash
# Bring up the app on the Ubuntu VM (native backend/frontend; Postgres via Docker).
# Run from repo root: make vm-up-all
# Starts Docker Postgres, then backend and frontend in the background; logs in .pids/backend.log and .pids/frontend.log.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# Script is at scaffold/deploy/vm/ubuntu/; go up 4 levels to repo root
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
VM_USER="${VM_USER:-ubuntu}"
VM_REPO_PATH="${VM_REPO_PATH:-/home/ubuntu/rm}"
PID_DIR="$SCRIPT_DIR/.pids"
SETENV="$REPO_ROOT/scaffold/deploy/vm/setEnv.sh"
BACKEND_LOG="$PID_DIR/backend.log"
FRONTEND_LOG="$PID_DIR/frontend.log"

# When VM_HOST is set, run this script on the remote with VM_HOST cleared so it runs in "local" mode there.
if [ -n "${VM_HOST:-}" ]; then
  echo "=== VM (Ubuntu): bring up app on remote ${VM_USER}@${VM_HOST}:${VM_REPO_PATH} ==="
  ssh "${VM_USER}@${VM_HOST}" "cd ${VM_REPO_PATH} && REPO_ROOT=${VM_REPO_PATH} VM_HOST= ./scaffold/deploy/vm/ubuntu/up-all.sh"
  echo "=== VM up-all complete ==="
  exit 0
fi

cd "$REPO_ROOT"
mkdir -p "$PID_DIR"

echo "=== VM (Ubuntu): bring up app (Postgres via Docker; backend/frontend in background) ==="
echo "  Target: local (current directory)"

# Load .env so DB_*, PORT, etc. are respected
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$REPO_ROOT/.env"
  set +a
  echo "  Loaded .env"
fi

# Bring up Docker Postgres (for VM runs that use localhost:5432)
echo "  Starting Docker Postgres..."
make docker-up-postgres
# Wait for Postgres to be ready
for i in 1 2 3 4 5 6 7 8 9 10; do
  if (echo >/dev/tcp/${DB_HOST:-localhost}/${DB_PORT:-5432}) 2>/dev/null; then
    echo "  Postgres ready at ${DB_HOST:-localhost}:${DB_PORT:-5432}"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "  Warning: Postgres not yet reachable after 10 attempts; backend will retry on startup."
  fi
  sleep 1
done

# Source env (DB_*, PATH, NVM) for backend and frontend
# shellcheck source=../../setEnv.sh
[ -f "$SETENV" ] && . "$SETENV"

# Kill any existing backend/frontend from .pids so we run fresh
for name in backend frontend; do
  if [ -f "$PID_DIR/$name.pid" ]; then
    pid=$(cat "$PID_DIR/$name.pid")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "  Stopped existing $name (PID $pid)"
    fi
    rm -f "$PID_DIR/$name.pid"
  fi
done

# Free ports 8080 (backend) and 3000 (frontend) if in use (e.g. orphaned processes from previous run)
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
    echo "  Freed port $p (was in use)"
    sleep 1
  fi
done

# Start backend in background; output to log file (truncated each run)
echo "  Starting backend (log: $BACKEND_LOG)..."
: > "$BACKEND_LOG"
nohup env REPO_ROOT="$REPO_ROOT" SETENV="$SETENV" bash -c 'set -a; [ -f "$REPO_ROOT/.env" ] && . "$REPO_ROOT/.env"; set +a; . "$SETENV"; cd "$REPO_ROOT" && make run-backend-dev' >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$PID_DIR/backend.pid"

sleep 2

# Start frontend in background; output to log file (truncated each run)
echo "  Starting frontend (log: $FRONTEND_LOG)..."
: > "$FRONTEND_LOG"
nohup env REPO_ROOT="$REPO_ROOT" SETENV="$SETENV" bash -c 'set -a; [ -f "$REPO_ROOT/.env" ] && . "$REPO_ROOT/.env"; set +a; . "$SETENV"; cd "$REPO_ROOT" && PORT=3000 make run-frontend' >> "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$PID_DIR/frontend.pid"

echo ""
echo "  Backend PID $BACKEND_PID, frontend PID $FRONTEND_PID"
echo "  Logs: $BACKEND_LOG, $FRONTEND_LOG"
echo "  Stop with: make vm-down-all"
echo "=== VM up-all complete ==="
