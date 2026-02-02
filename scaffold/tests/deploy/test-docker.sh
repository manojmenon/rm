#!/usr/bin/env bash
# Test deployment using plain Docker (single-service containers).
# Run from repo root: ./scaffold/tests/deploy/test-docker.sh
#
# What it does:
#   1. Starts Postgres container
#   2. Builds and runs backend container (needs Postgres on host or linked)
#   3. Builds and runs frontend container
#   4. Runs smoke test (backend health + frontend reachable)
#   5. Stops and removes containers
# Exit: 0 on success, non-zero on failure.

set -e

# Resolve repo root from script location (works when run as ./scaffold/tests/deploy/test-docker.sh from root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

BACKEND_IMAGE="${BACKEND_IMAGE:-rm-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-rm-frontend}"
POSTGRES_NAME="${POSTGRES_NAME:-rm-postgres-deploy-test}"
BACKEND_NAME="${BACKEND_NAME:-rm-backend-deploy-test}"
FRONTEND_NAME="${FRONTEND_NAME:-rm-frontend-deploy-test}"

if [ "$(uname)" = "Linux" ]; then
  DB_HOST="${DB_HOST:-172.17.0.1}"
else
  DB_HOST="${DB_HOST:-host.docker.internal}"
fi

cleanup() {
  echo "Cleaning up containers..."
  docker rm -f "$FRONTEND_NAME" 2>/dev/null || true
  docker rm -f "$BACKEND_NAME"  2>/dev/null || true
  docker rm -f "$POSTGRES_NAME"  2>/dev/null || true
}
trap cleanup EXIT

echo "=== 1. Start Postgres ==="
docker run -d --name "$POSTGRES_NAME" -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=roadmap \
  postgres:16-alpine

echo "Waiting for Postgres..."
sleep 5
until docker exec "$POSTGRES_NAME" pg_isready -U postgres 2>/dev/null; do sleep 1; done

echo "=== 2. Build and run backend ==="
docker build -f scaffold/deploy/docker-compose/Dockerfile.backend -t "$BACKEND_IMAGE" .
docker run -d --name "$BACKEND_NAME" -p 8080:8080 \
  -e DB_HOST="$DB_HOST" \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=roadmap \
  -e DB_SSLMODE=disable \
  -e JWT_SECRET=change-me \
  "$BACKEND_IMAGE"

echo "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/api/health >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then echo "Backend did not become ready"; exit 1; fi
  sleep 1
done

echo "=== 3. Build and run frontend ==="
docker build -f scaffold/deploy/docker-compose/Dockerfile.frontend -t "$FRONTEND_IMAGE" .
docker run -d --name "$FRONTEND_NAME" -p 3000:3000 \
  -e BACKEND_URL=http://host.docker.internal:8080 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8080 \
  "$FRONTEND_IMAGE"

echo "Waiting for frontend..."
sleep 5
for i in $(seq 1 30); do
  code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "308" ]; then break; fi
  if [ "$i" -eq 30 ]; then echo "Frontend did not become ready"; exit 1; fi
  sleep 1
done

echo "=== 4. Smoke test ==="
curl -sf http://localhost:8080/api/health | grep -q '"status":"ok"' || { echo "Backend health FAIL"; exit 1; }
echo "  Backend: OK"
curl -sf -o /dev/null -w "  Frontend: %{http_code}\n" http://localhost:3000/ || { echo "Frontend FAIL"; exit 1; }
echo "Smoke test passed."

echo "=== Deploy test (Docker) passed ==="
