.PHONY: all build run test migrate seed docker-up docker-down backend frontend

# Backend (Go)
build-backend:
	go build -o bin/server ./cmd/server

run-backend: build-backend
	./bin/server

# Requires DB running (e.g. docker-compose up -d postgres)
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
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker-compose build

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

# Seed (optional - run after migrate)
seed:
	go run ./scripts/seed/main.go
