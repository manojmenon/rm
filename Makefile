.PHONY: all build run test migrate seed docker-up docker-down backend frontend

# Backend (Go) — module lives in app/backend/
build-backend:
	cd app/backend && go build -o ../../bin/server ./cmd/server

run-backend: build-backend
	./bin/server

# Requires Postgres at localhost:5432 (e.g. make docker-up-postgres first)
run-backend-dev:
	cd app/backend && go run ./cmd/server

# Frontend (app/frontend/)
install-frontend:
	cd app/frontend && npm install

run-frontend:
	cd app/frontend && npm run dev

build-frontend:
	cd app/frontend && npm run build

# Database
migrate-up:
	migrate -path app/backend/internal/migrations -database "postgres://postgres:postgres@localhost:5432/roadmap?sslmode=disable" up

migrate-down:
	migrate -path app/backend/internal/migrations -database "postgres://postgres:postgres@localhost:5432/roadmap?sslmode=disable" down

# Docker Compose (compose file and Dockerfiles in scaffold/deploy/docker-compose/)
COMPOSE_FILE := scaffold/deploy/docker-compose/docker-compose.yml

docker-up:
	docker compose -f $(COMPOSE_FILE) --project-directory . up -d

# Full stack including observability (postgres, seed, backend, frontend, loki, promtail, tempo, otel-collector, prometheus, grafana)
docker-up-all:
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability up -d

# Rebuild from scratch: down, build with --no-cache, then up -d (no cached layers).
docker-rebuild-up-all:
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability down
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability build --no-cache
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability up -d

# Stop and remove all containers (app + observability). Use same profile as docker-up-all so the network can be removed.
# Stop Grafana first so it releases port 3001, then down the rest. Free port 3001 if still in use (stray process).
docker-down-all:
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability stop grafana 2>/dev/null || true
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability down
	@fuser -k 3001/tcp 2>/dev/null || true; \
	pid=$$(lsof -ti :3001 2>/dev/null); [ -n "$$pid" ] && kill $$pid 2>/dev/null || true

# List all services/containers (app + observability)
docker-ps-all:
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability ps

docker-down:
	docker compose -f $(COMPOSE_FILE) --project-directory . down

# Start only Postgres (for running backend/frontend locally without Docker)
docker-up-postgres:
	docker compose -f $(COMPOSE_FILE) --project-directory . up -d postgres

# Stop only Postgres (used by vm-down-all)
docker-down-postgres:
	docker compose -f $(COMPOSE_FILE) --project-directory . stop postgres

docker-build:
	docker compose -f $(COMPOSE_FILE) --project-directory . build

# Start only observability stack (Loki, Promtail, Tempo, otel-collector, Prometheus, Grafana).
docker-up-observability:
	docker compose -f $(COMPOSE_FILE) --project-directory . --profile observability up -d loki promtail tempo otel-collector prometheus grafana

# Full stack: start postgres only, run backend and frontend locally
dev: docker-up
	@echo "Start backend: make run-backend-dev"
	@echo "Start frontend: make run-frontend"

# VM (Ubuntu) — run app on Ubuntu VM via scripts in scaffold/deploy/vm/ubuntu/. See scaffold/deploy/vm/ubuntu/README.md
# From repo root: make vm-up-all | vm-down-all | vm-rebuild-all | vm-status. Set VM_HOST to run via SSH.
VM_DIR := scaffold/deploy/vm/ubuntu
vm-up-all:
	./$(VM_DIR)/up-all.sh
vm-down-all:
	./$(VM_DIR)/down-all.sh
vm-rebuild-all:
	./$(VM_DIR)/rebuild-all.sh
vm-status:
	./$(VM_DIR)/status.sh
vm-check-health:
	./$(VM_DIR)/check-health.sh

# Tests (see scaffold/tests/README.md)
test-backend:
	cd app/backend && go test ./...

test-frontend:
	cd app/frontend && npm run lint

# Integration/smoke: requires backend and frontend running
test-integration: smoke-test

test: test-backend test-frontend

# Seed (optional - run after migrate). From host: connects to localhost:5432 (use when postgres is in Docker with port 5432 exposed).
seed:
	cd app/backend && go run ./scripts/seed/main.go

# Seed against Docker Postgres: run the seed container (postgres must be up).
seed-docker:
	docker compose -f $(COMPOSE_FILE) --project-directory . run --rm seed

# Quick smoke test: backend health (and DB), then frontend reachable. Use after docker-up or when running backend/frontend locally.
smoke-test:
	@echo "→ Backend health (includes DB ping)..."
	@curl -sf http://localhost:8080/api/health | grep -q '"status":"ok"' && echo "  Backend: OK" || (echo "  Backend: FAIL (is backend running on :8080?)"; exit 1)
	@echo "→ Frontend..."
	@curl -sf -o /dev/null -w "  Frontend: %{http_code}\n" http://localhost:3000/ || (echo "  Frontend: FAIL (is frontend running on :3000?)"; exit 1)
	@echo "Smoke test passed."

# Kubernetes (Kind) — YAML in scaffold/deploy/k8s/yaml/. See scaffold/deploy/k8s/README.md
# Main targets: k8s-up-all | k8s-down-all | k8s-rebuild-all
K8S_YAML_DIR := scaffold/deploy/k8s/yaml
K8S_DIR := scaffold/deploy/k8s
CLUSTER_NAME ?= roadmap

# --- Main k8s targets (consistent naming) ---
k8s-up-all: k8s-install-kubectl k8s-down-all k8s-install-kind k8s-cluster-ensure k8s-build-load-images k8s-deploy

# Remove workloads and config; keeps namespace and PVCs so data persists across down/up.
k8s-down-all:
	./$(K8S_DIR)/undeploy.sh

# Full rebuild: down, delete PVCs (fresh volumes), build/load images, deploy.
k8s-rebuild-all: k8s-down-all
	./$(K8S_DIR)/delete-pvcs.sh
	$(MAKE) k8s-build-load-images
	$(MAKE) k8s-deploy

# --- Helpers ---
k8s-install-kubectl:
	./$(K8S_DIR)/install-kubectl.sh

k8s-install-kind:
	./$(K8S_DIR)/install-kind.sh

k8s-cluster-ensure:
	./$(K8S_DIR)/ensure-cluster.sh

k8s-build-load-images:
	./$(K8S_DIR)/build-load-images.sh

k8s-deploy:
	./$(K8S_DIR)/deploy.sh

k8s-undeploy:
	./$(K8S_DIR)/undeploy.sh

# Delete PVCs only (postgres, loki, tempo, grafana). Use after k8s-down-all for a clean rebuild.
k8s-delete-pvcs:
	./$(K8S_DIR)/delete-pvcs.sh

k8s-deploy-all: k8s-up-all

k8s-status:
	kubectl get all -n roadmap
	kubectl get pvc -n roadmap
	kubectl get hpa -n roadmap

# Smoke test against K8s stack: backend health and frontend via NodePort (requires cluster and deploy).
# Backend NodePort 30081, Frontend NodePort 30080. With Kind, these are reachable at localhost.
k8s-smoke-test:
	@echo "→ Backend health (NodePort 30081)..."
	@curl -sf http://localhost:30081/api/health | grep -q '"status":"ok"' && echo "  Backend: OK" || (echo "  Backend: FAIL (is cluster up? make k8s-up-all)"; exit 1)
	@echo "→ Frontend (NodePort 30080)..."
	@curl -sf -o /dev/null -w "  Frontend: %{http_code}\n" http://localhost:30080/ || (echo "  Frontend: FAIL"; exit 1)
	@echo "K8s smoke test passed."

# Deploy tests (run from repo root). See scaffold/tests/deploy/README.md
test-deploy-docker:
	./scaffold/tests/deploy/test-docker.sh

test-deploy-docker-compose:
	./scaffold/tests/deploy/test-docker-compose.sh

# Full stack (app + observability): up with profile, smoke test, down.
docker-test-all:
	./scaffold/tests/deploy/test-docker-compose-all.sh

test-deploy-docker-compose-all: docker-test-all

test-deploy-k8s:
	./scaffold/tests/deploy/test-k8s.sh

test-deploy-vm:
	./scaffold/tests/deploy/test-vm.sh
