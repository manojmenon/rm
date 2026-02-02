# Test structure

Per-module and integration testing for the Product Roadmap stack.

## Layout

| Directory | Purpose |
|-----------|---------|
| **backend** | Backend (Go) unit and package tests; run from repo root |
| **frontend** | Frontend (Next.js) lint and optional unit/e2e tests |
| **integration** | Smoke and integration tests (e.g. API health, full stack) |
| **deploy** | Deploy tests: Docker, Docker Compose, K8s (Kind), VM — see [deploy/README.md](deploy/README.md) |

## Running tests

From **repo root**:

```bash
# Backend: Go unit tests (backend/internal packages)
make test-backend
# or: cd app/backend && go test ./...

# Frontend: lint (and optional npm test if configured)
make test-frontend
# or: cd app/frontend && npm run lint

# All module tests
make test

# Integration / smoke: requires backend and frontend running
make smoke-test
```

## Backend tests

- **Location:** `app/backend/internal/*_test.go` (co-located with code) or `scaffold/tests/backend/` for test helpers.
- **Run:** `cd backend && go test ./...` from repo root (no DB required for unit tests that don’t touch DB).
- **Coverage:** `cd backend && go test -cover ./...`

## Frontend tests

- **Lint:** `cd app/frontend && npm run lint` (ESLint).
- **Optional:** Add Jest/Vitest in `app/frontend/` and `npm test`; document in `scaffold/tests/frontend/README.md`.

## Integration tests

- **Smoke:** `make smoke-test` — hits `/api/health` and frontend root.
- **Manual:** Start stack with `make docker-up`, then run smoke-test and exercise the app.

## Deploy tests

Tests for deploying the app into Docker, Docker Compose, K8s (Kind), and VM. Each target has a separate script in **scaffold/tests/deploy/**:

- **Docker:** `./scaffold/tests/deploy/test-docker.sh` — single-service containers, then smoke test, then cleanup.
- **Docker Compose:** `./scaffold/tests/deploy/test-docker-compose.sh` — full stack up → smoke test → down.
- **K8s (Kind):** `./scaffold/tests/deploy/test-k8s.sh` — create Kind cluster, verify, delete (Ubuntu/macos scripts).
- **VM:** `./scaffold/tests/deploy/test-vm.sh` — run on VM when backend/frontend are already running; verifies health and frontend.

See [deploy/README.md](deploy/README.md) for full commands and prerequisites.

See root [README](../README.md) for full testing instructions.
