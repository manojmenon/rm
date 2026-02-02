# Product Roadmap Management System

Enterprise product roadmap management with multi-product support, milestones, dependencies, RBAC, audit logging, observability (OpenTelemetry, Prometheus, Grafana), and Gantt-style timeline views.

## Stack

- **Backend:** Go 1.22+, Gin, GORM, PostgreSQL (JSONB), JWT, RBAC, zap (structured logs), OpenTelemetry, rate limiting, pagination
- **Frontend:** Next.js 14, TypeScript, Tailwind, React Query, Zustand, OpenTelemetry API (`useTrace`)
- **Database:** PostgreSQL with soft deletes, indexes on dates, foreign keys, `audit_logs` table
- **Observability:** OTLP tracing, Prometheus metrics, Grafana dashboard (import `grafana-dashboard.json`)

## Quick Start

### Prerequisites

- Go 1.22+
- Node.js 20+
- PostgreSQL 16 (or use Docker)
- [golang-migrate](https://github.com/golang-migrate/migrate) (optional, for SQL migrations)

### 1. Database

```bash
# Using Docker
docker-compose up -d postgres

# Or run migrations (if using golang-migrate)
make migrate-up
```

Backend uses GORM AutoMigrate by default, so tables (including `audit_logs`) are created on first run if the DB exists.

### 2. Backend

```bash
# Install deps
go mod download

# Run (set DB_* if not using defaults)
export DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=roadmap
go run ./cmd/server
```

API: `http://localhost:8080`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:3000`. API requests are proxied from `/api/*` to the backend.

### 4. Full stack with Docker

```bash
docker-compose up --build
```

- Backend: http://localhost:8080  
- Frontend: http://localhost:3000  
- Postgres: localhost:5432  
- OpenTelemetry Collector: 4317 (gRPC), 4318 (HTTP)  
- Prometheus: http://localhost:9090  
- Grafana: http://localhost:3001 (admin / admin). Import `grafana-dashboard.json` via Dashboards → Import.

## Makefile

- `make run-backend-dev` – run Go server (DB must be up)
- `make run-frontend` – run Next.js dev
- `make docker-up` / `make docker-down` – start/stop containers
- `make test-backend` – run Go tests
- `make migrate-up` / `make migrate-down` – run SQL migrations
- `make seed` – seed admin/owner users (optional)

## Project Structure

```
.
├── cmd/server/              # Go entrypoint
├── internal/
│   ├── config/              # App config
│   ├── models/               # GORM models (+ audit_logs)
│   ├── repositories/        # Data access
│   ├── services/            # Business logic (+ AuditService)
│   ├── handlers/            # HTTP handlers (no business logic)
│   ├── middleware/          # RequestID, Telemetry, Auth, RBAC, AuditContext, RateLimit, CORS
│   ├── auth/                # JWT
│   ├── dto/                 # Request/response DTOs, pagination, AuditMeta
│   ├── telemetry/           # OpenTelemetry tracer provider
│   └── migrations/          # SQL migrations (up/down)
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router
│       ├── components/      # Nav, RequireAuth, RequireRole, RoadmapView
│       ├── hooks/           # useTrace (OTEL)
│       ├── lib/             # API client
│       └── store/           # Zustand auth store
├── docker-compose.yml       # postgres, backend, frontend, otel-collector, prometheus, grafana
├── otel-collector.yaml      # OTLP receiver, batch, prometheus/logging exporters
├── prometheus.yml           # Scrape configs
├── grafana-dashboard.json   # Import into Grafana
├── Makefile
└── README.md
```

## Middleware

- **RequestID** – sets `X-Request-ID` and trace ID in context
- **Telemetry** – OpenTelemetry span per request, trace_id for audit
- **RateLimit** – per-IP rate limiting (100 req/s)
- **Auth** – JWT validation for `/api/*`
- **AuditContext** – IP and User-Agent for audit entries
- **RBAC** – RequireAdmin / RequireRole for protected routes

## Audit Logging

Every mutating action (product create/update/delete, etc.) writes an audit record asynchronously. Records include: user_id, action, entity_type, entity_id, old_data/new_data (JSONB), ip_address, user_agent, trace_id. Audit writes are non-blocking and do not fail business logic.

## Observability

- **Tracing:** OTLP HTTP to collector (set `OTEL_EXPORTER_OTLP_ENDPOINT`). Spans for each HTTP request.
- **Metrics:** Prometheus-style metrics (dashboard panels expect `http_requests_total`, `http_request_duration_seconds`, `db_query_duration_seconds`, `product_created_total`, `audit_events_total`, `login_attempts_total`, etc.). Backend can be extended to expose a `/metrics` endpoint.
- **Logs:** Structured JSON logs via zap (no `fmt.Println`).
- **Grafana:** Import `grafana-dashboard.json` for request rate, latency p95, errors, DB time, products created, roadmap changes, audit events, failed logins.

## Roles

- **Admin:** Full CRUD, approve product requests, delete products, manage users.
- **Owner:** CRUD own products, edit milestones/dependencies; cannot delete product or approve requests.
- **User:** View products, submit product creation requests; cannot edit roadmaps.

## API Overview

- `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`
- `GET /products?limit=20&offset=0&owner_id=&status=` → `{ items, total, limit, offset }`
- `POST /products`, `GET/PUT/DELETE /products/:id` (DELETE admin only)
- `GET /products/:id/milestones`, `POST/PUT/DELETE /milestones/:id`
- `POST /dependencies`, `DELETE /dependencies/:id`
- `GET/POST /product-requests`, `PUT /product-requests/:id/approve` (admin only)

Protected routes use `Authorization: Bearer <access_token>`.

## Environment

| Variable                      | Default                   | Description            |
|------------------------------|---------------------------|------------------------|
| PORT                         | 8080                      | Backend port           |
| DB_HOST                      | localhost                 | PostgreSQL host        |
| DB_PORT                      | 5432                      | PostgreSQL port        |
| DB_USER                      | postgres                  | DB user                |
| DB_PASSWORD                  | postgres                  | DB password            |
| DB_NAME                      | roadmap                   | DB name                |
| DB_SSLMODE                   | disable                   | SSL mode               |
| JWT_SECRET                   | change-me-in-production   | JWT signing key        |
| JWT_ACCESS_EXPIRY_MIN        | 15                        | Access token TTL       |
| JWT_REFRESH_EXPIRY_MIN       | 10080                     | Refresh token TTL      |
| OTEL_EXPORTER_OTLP_ENDPOINT  | (empty)                   | OTLP HTTP endpoint     |

## Seed Data

```bash
go run ./scripts/seed/main.go
```

Creates admin (`admin@example.com` / `admin123`) and owner (`owner@example.com` / `admin123`) users.

## License

MIT
# rm
# rm
