.PHONY: all build run test migrate seed docker-up docker-down backend frontend

# Backend (Go)
build-backend:
	go build -o bin/server ./cmd/server

run-backend: build-backend
	./bin/server

# Requires Postgres at localhost:5432 (e.g. make docker-up-postgres first)
run-backend-dev:
	go run ./cmd/server

# Frontend
install-frontend:
	cd frontend && npm install

run-frontend:
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

# Database
migrate-up:
	migrate -path internal/migrations -database "postgres://postgres:postgres@localhost:5432/roadmap?sslmode=disable" up

migrate-down:
	migrate -path internal/migrations -database "postgres://postgres:postgres@localhost:5432/roadmap?sslmode=disable" down

# Docker
docker-up:
	docker compose up -d

docker-down:
	docker compose down

# Start only Postgres (for running backend/frontend locally without Docker)
docker-up-postgres:
	docker compose up -d postgres

docker-build:
	docker compose build

# Start only observability stack (Loki, Promtail, Tempo, otel-collector, Prometheus, Grafana). Use when core (postgres, backend, frontend) is already running.
docker-up-observability:
	docker compose up -d loki promtail tempo otel-collector prometheus grafana

# Full stack: start postgres only, run backend and frontend locally
dev: docker-up
	@echo "Start backend: make run-backend-dev"
	@echo "Start frontend: make run-frontend"

# Tests
test-backend:
	go test ./...

test-frontend:
	cd frontend && npm run lint

test: test-backend test-frontend

# Seed (optional - run after migrate). From host: connects to localhost:5432 (use when postgres is in Docker with port 5432 exposed).
seed:
	go run ./scripts/seed/main.go

# Seed against Docker Postgres: run the seed container (postgres must be up). Or use docker compose up so seed runs automatically.
seed-docker:
	docker compose run --rm seed

# Quick smoke test: backend health (and DB), then frontend reachable. Use after docker-up or when running backend/frontend locally.
smoke-test:
	@echo "→ Backend health (includes DB ping)..."
	@curl -sf http://localhost:8080/api/health | grep -q '"status":"ok"' && echo "  Backend: OK" || (echo "  Backend: FAIL (is backend running on :8080?)"; exit 1)
	@echo "→ Frontend..."
	@curl -sf -o /dev/null -w "  Frontend: %{http_code}\n" http://localhost:3000/ || (echo "  Frontend: FAIL (is frontend running on :3000?)"; exit 1)
	@echo "Smoke test passed."
