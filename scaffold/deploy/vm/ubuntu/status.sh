#!/usr/bin/env bash
# Show VM app status: processes (backend, frontend) and whether they are running and responding.
# Run from repo root: make vm-status
#
# If VM_HOST is set: SSH to the VM and run this script there.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# Script is at scaffold/deploy/vm/ubuntu/; go up 4 levels to repo root
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
VM_USER="${VM_USER:-ubuntu}"
VM_REPO_PATH="${VM_REPO_PATH:-/home/ubuntu/rm}"
PID_DIR="$SCRIPT_DIR/.pids"

# When VM_HOST is set, run this script on the remote with VM_HOST cleared.
if [ -n "${VM_HOST:-}" ]; then
  echo "=== VM (Ubuntu): status on remote ${VM_USER}@${VM_HOST}:${VM_REPO_PATH} ==="
  ssh "${VM_USER}@${VM_HOST}" "cd ${VM_REPO_PATH} && REPO_ROOT=${VM_REPO_PATH} VM_HOST= ./scaffold/deploy/vm/ubuntu/status.sh"
  exit 0
fi

cd "$REPO_ROOT"

# Load .env so DB_HOST, DB_PORT, BACKEND_URL, FRONTEND_URL are respected
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$REPO_ROOT/.env"
  set +a
fi

echo "=== VM (Ubuntu): app status ==="
echo ""

# Postgres
PG_RUNNING="no"
PG_RESPONDING="no"
if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready -q -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" 2>/dev/null; then
    PG_RUNNING="yes"
    PG_RESPONDING="yes"
  fi
else
  if (echo >/dev/tcp/${DB_HOST:-localhost}/${DB_PORT:-5432}) 2>/dev/null; then
    PG_RUNNING="yes"
    PG_RESPONDING="yes"
  fi
fi

# Backend
BACKEND_PID=""
BACKEND_RUNNING="no"
BACKEND_RESPONDING="no"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL%/}"
if [ -f "$PID_DIR/backend.pid" ]; then
  BACKEND_PID=$(cat "$PID_DIR/backend.pid")
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    BACKEND_RUNNING="yes"
    if curl -sf --connect-timeout 2 "$BACKEND_URL/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
      BACKEND_RESPONDING="yes"
    fi
  fi
fi

# Frontend
FRONTEND_PID=""
FRONTEND_RUNNING="no"
FRONTEND_RESPONDING="no"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL%/}"
if [ -f "$PID_DIR/frontend.pid" ]; then
  FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
  if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    FRONTEND_RUNNING="yes"
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 2 "$FRONTEND_URL/" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
      FRONTEND_RESPONDING="yes"
    fi
  fi
fi

printf "  %-10s  %-8s  %-10s  %s\n" "Process" "Running" "Responding" "PID/Note"
echo "  ----------  --------  ----------  ---"
printf "  %-10s  %-8s  %-10s  %s\n" "Postgres" "$PG_RUNNING" "$PG_RESPONDING" "${DB_HOST:-localhost}:${DB_PORT:-5432}"
printf "  %-10s  %-8s  %-10s  %s\n" "Backend" "$BACKEND_RUNNING" "$BACKEND_RESPONDING" "${BACKEND_PID:-—}"
printf "  %-10s  %-8s  %-10s  %s\n" "Frontend" "$FRONTEND_RUNNING" "$FRONTEND_RESPONDING" "${FRONTEND_PID:-—}"
echo ""
echo "  Endpoints: Backend $BACKEND_URL/api/health  Frontend $FRONTEND_URL/"
echo "  Logs: $PID_DIR/backend.log  $PID_DIR/frontend.log"
echo "=== VM status complete ==="
