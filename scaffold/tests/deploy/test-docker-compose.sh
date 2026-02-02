#!/usr/bin/env bash
# Test deployment using Docker Compose (full stack).
# Run from repo root: ./scaffold/tests/deploy/test-docker-compose.sh
#
# What it does:
#   1. Builds and brings up the app stack (postgres, seed, backend, frontend; observability is on profile)
#   2. Waits for backend and frontend to be ready
#   3. Runs smoke test (backend health + frontend reachable)
#   4. Brings down the stack
# Exit: 0 on success, non-zero on failure.

set -e

# Resolve repo root from script location (works when run as ./scaffold/tests/deploy/test-docker-compose.sh from root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-scaffold/deploy/docker-compose/docker-compose.yml}"

cleanup() {
  echo "Bringing down stack..."
  docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_ROOT" down 2>/dev/null || true
}
trap cleanup EXIT

echo "=== 1. Build and bring up stack ==="
docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_ROOT" build
docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_ROOT" up -d

echo "Waiting for backend..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 60 ]; then echo "Backend did not become ready"; exit 1; fi
  sleep 2
done

echo "Waiting for frontend..."
for i in $(seq 1 30); do
  code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "308" ]; then break; fi
  if [ "$i" -eq 30 ]; then echo "Frontend did not become ready"; exit 1; fi
  sleep 2
done

echo "=== 2. Smoke test ==="
curl -sf http://localhost:8080/api/health | grep -q '"status":"ok"' || { echo "Backend health FAIL"; exit 1; }
echo "  Backend: OK"
curl -sf -o /dev/null -w "  Frontend: %{http_code}\n" http://localhost:3000/ || { echo "Frontend FAIL"; exit 1; }
echo "Smoke test passed."

echo "=== Deploy test (Docker Compose) passed ==="
