#!/usr/bin/env bash
# Test full Docker Compose stack (app + observability).
# Run from repo root: ./scaffold/tests/deploy/test-docker-compose-all.sh
#
# What it does:
#   1. Brings up full stack with --profile observability (postgres, seed, backend, frontend, loki, promtail, tempo, otel-collector, prometheus, grafana)
#   2. Waits for backend and frontend to be ready
#   3. Runs smoke test (backend health + frontend reachable)
#   4. Brings down the stack
# Exit: 0 on success, non-zero on failure.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-scaffold/deploy/docker-compose/docker-compose.yml}"

cleanup() {
  echo "Bringing down stack..."
  docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_ROOT" --profile observability down 2>/dev/null || true
}
trap cleanup EXIT

echo "=== 1. Build and bring up full stack (app + observability) ==="
docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_ROOT" --profile observability build
docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_ROOT" --profile observability up -d

echo "Waiting for backend..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 90 ]; then echo "Backend did not become ready"; exit 1; fi
  sleep 2
done

echo "Waiting for frontend..."
for i in $(seq 1 45); do
  code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "308" ]; then break; fi
  if [ "$i" -eq 45 ]; then echo "Frontend did not become ready"; exit 1; fi
  sleep 2
done

echo "=== 2. Smoke test ==="
curl -sf http://localhost:8080/api/health | grep -q '"status":"ok"' || { echo "Backend health FAIL"; exit 1; }
echo "  Backend: OK"
curl -sf -o /dev/null -w "  Frontend: %{http_code}\n" http://localhost:3000/ || { echo "Frontend FAIL"; exit 1; }
echo "Smoke test passed."

echo "=== Deploy test (Docker Compose full stack) passed ==="
