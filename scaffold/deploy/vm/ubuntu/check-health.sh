#!/usr/bin/env bash
# Health check: backend /api/health and frontend reachable. Exit 0 if all OK, 1 otherwise.
# Run from repo root: make vm-check-health
# Respects .env (BACKEND_URL, FRONTEND_URL, DB_*). If VM_HOST set, runs on remote.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# Script is at scaffold/deploy/vm/ubuntu/; go up 4 levels to repo root
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
VM_USER="${VM_USER:-ubuntu}"
VM_REPO_PATH="${VM_REPO_PATH:-/home/ubuntu/rm}"

# When VM_HOST is set, run this script on the remote with VM_HOST cleared.
if [ -n "${VM_HOST:-}" ]; then
  ssh "${VM_USER}@${VM_HOST}" "cd ${VM_REPO_PATH} && REPO_ROOT=${VM_REPO_PATH} VM_HOST= ./scaffold/deploy/vm/ubuntu/check-health.sh"
  exit $?
fi

cd "$REPO_ROOT"

# Load .env so BACKEND_URL, FRONTEND_URL, DB_* are respected
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$REPO_ROOT/.env"
  set +a
fi

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BACKEND_URL="${BACKEND_URL%/}"
FRONTEND_URL="${FRONTEND_URL%/}"

echo "=== VM (Ubuntu): health check ==="
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

FAIL=0

echo -n "  Backend /api/health ... "
if curl -sf --connect-timeout 3 "$BACKEND_URL/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
  echo "OK"
else
  echo "FAIL"
  FAIL=1
fi

echo -n "  Frontend ... "
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 3 "$FRONTEND_URL/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "308" ]; then
  echo "OK (HTTP $HTTP_CODE)"
else
  echo "FAIL (HTTP $HTTP_CODE)"
  FAIL=1
fi

echo ""
if [ $FAIL -eq 0 ]; then
  echo "=== VM health check passed ==="
  exit 0
else
  echo "=== VM health check failed ==="
  exit 1
fi
