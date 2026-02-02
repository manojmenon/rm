#!/usr/bin/env bash
# Test VM (bare metal) deployment: verifies app is reachable when running on the host.
# Run this script ON the VM (or host) where backend and frontend are already running.
#
# Prerequisites on the VM:
#   1. Postgres is running and reachable (e.g. localhost:5432)
#   2. Backend is running (e.g. make run-backend-dev → port 8080)
#   3. Frontend is running (e.g. make run-frontend → port 3000)
#
# Usage:
#   From repo root on the VM:
#     source scaffold/deploy/vm/setEnv.sh
#     make run-backend-dev   # in one terminal
#     make run-frontend      # in another terminal
#     ./scaffold/tests/deploy/test-vm.sh
#
# Or run remotely (replace localhost with VM hostname/IP if testing from another machine):
#   BACKEND_URL=http://<vm-ip>:8080 FRONTEND_URL=http://<vm-ip>:3000 ./scaffold/tests/deploy/test-vm.sh
#
# Exit: 0 on success, non-zero on failure.

set -e

# Optional: resolve repo root so script can be run from anywhere (this test only needs curl)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." 2>/dev/null && pwd)}"

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

# Strip trailing slash
BACKEND_URL="${BACKEND_URL%/}"
FRONTEND_URL="${FRONTEND_URL%/}"

echo "=== VM deploy test (backend and frontend must already be running) ==="
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"

echo "=== 1. Backend health ==="
if ! curl -sf "$BACKEND_URL/api/health" | grep -q '"status":"ok"'; then
  echo "  FAIL: Backend health check failed. Is the backend running on $BACKEND_URL?"
  exit 1
fi
echo "  Backend: OK"

echo "=== 2. Frontend reachable ==="
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$FRONTEND_URL/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "307" ] && [ "$HTTP_CODE" != "308" ]; then
  echo "  FAIL: Frontend returned $HTTP_CODE. Is the frontend running on $FRONTEND_URL?"
  exit 1
fi
echo "  Frontend: HTTP $HTTP_CODE OK"

echo "Smoke test passed."
echo "=== Deploy test (VM) passed ==="
