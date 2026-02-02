# Product Roadmap Management System

Enterprise product roadmap management with multi-product support, milestones, dependencies, RBAC (superadmin/admin/owner/user), audit logging, activity logs (login/logout and actions), observability (OpenTelemetry, Prometheus, Grafana), and Gantt-style timeline views. Frontend uses DHL branding (red/yellow) across Dashboard, Products, Groups, Users, and Admin pages.

**Landing & home:** Root URL `/` redirects to `/roadmap`; the Roadmap page is both the landing page and the home page. Unauthenticated users are redirected to login from the Roadmap page.

## Stack

- **Backend:** Go 1.22+, Gin, GORM, PostgreSQL (JSONB), JWT, RBAC, zap (structured logs), OpenTelemetry, rate limiting, pagination
- **Frontend:** Next.js 14, TypeScript, Tailwind, React Query, Zustand, OpenTelemetry API (`useTrace`)
- **Database:** PostgreSQL with soft deletes, indexes on dates, foreign keys, `audit_logs` and `activity_logs` tables
- **Observability:** OTLP tracing (→ Tempo), Prometheus metrics, Loki (logs via Promtail), Grafana (Prometheus, Loki, Tempo datasources; dashboards in `scaffold/config/grafana/dashboards/`)

## Project structure

| Area | Location | Description |
|------|----------|-------------|
| **Backend** | `app/backend/` (`cmd/server/`, `internal/`, `scripts/seed/`, `go.mod`) | Go API (Gin, GORM, JWT, zap, OTEL) |
| **Frontend** | `app/frontend/` | Next.js 14 app (TypeScript, Tailwind, React Query) |
| **Database** | Postgres (Docker or external) | Schema via GORM AutoMigrate; seed in `app/backend/scripts/seed/` |
| **Config** | [config/](config/) | Env examples and all config files (metrics, logs, traces, Grafana) |
| **Deployment** | [deploy/](deploy/) | Docker Compose, Docker (single-service), VM options |
| **Tests** | [tests/](tests/) | Backend unit tests, frontend lint, integration/smoke |

- **Config:** `config/env/` has per-service `.env.example` files; `config/metrics/`, `config/logs/`, `config/traces/`, `config/grafana/` hold Prometheus, Loki, Tempo, OTEL Collector, and Grafana configs. Docker Compose mounts from `config/`.
- **Deployment:** See [deploy/README.md](deploy/README.md) for Docker Compose (full stack), Docker (single-service), and VM (bare metal) options.
- **Testing:** See [tests/README.md](tests/README.md) for backend unit tests, frontend lint, and integration/smoke; [How to test](#how-to-test) below.

## Quick Start

### Prerequisites

- Go 1.22+
- Node.js 20+
- PostgreSQL 16 (or use Docker)
- [golang-migrate](https://github.com/golang-migrate/migrate) (optional, for SQL migrations)

### 1. Database

```bash
# Using Docker (from repo root: make docker-up-postgres)
docker compose -f scaffold/deploy/docker-compose/docker-compose.yml --project-directory . up -d postgres

# Or run migrations (if using golang-migrate)
make migrate-up
```

Backend uses GORM AutoMigrate by default, so tables (including `audit_logs`, `activity_logs`) are created on first run if the DB exists.

### 2. Backend

**When running the backend without Docker**, it needs Postgres at `localhost:5432`. Start Postgres first, then run the server. **To be able to log in, seed the DB** (see [Seed Data](#seed-data)): `make seed`.

```bash
# Start only Postgres (Docker); then run backend locally
make docker-up-postgres
# wait for Postgres to be ready (a few seconds), then:
make seed
cd app/backend && go mod download
make run-backend-dev
```

If Postgres is already running elsewhere, set env and run:

```bash
export DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=roadmap
go run ./cmd/server
```

API: `http://localhost:8080`

### 3. Frontend

```bash
cd app/frontend
npm install
npm run dev
```

App: `http://localhost:3000`. API requests are proxied from `/api/*` to the backend. When running backend locally, do **not** set `BACKEND_URL` (or set it to `http://localhost:8080`) so the proxy targets your local server.

### 4. Full stack with Docker

To run **all** services (including Loki, Tempo, Prometheus, and Grafana):

```bash
docker compose up --build
# or
make docker-up
```

**Seed:** The `seed` service runs once after Postgres is healthy (with `DB_HOST=postgres`, etc.) and creates superadmin, admin, and owner users. The backend starts only after the seed completes, so the containerized Postgres is seeded before the app runs.

- Backend: http://localhost:8080  
- Frontend: http://localhost:3000  
- Postgres: localhost:5432  
- OpenTelemetry Collector: 4317 (gRPC), 4318 (HTTP)  
- Loki: http://localhost:3100 (logs; ingested by Promtail from container stdout)  
- Tempo: http://localhost:3200 (traces; backend sends OTLP to otel-collector → Tempo)  
- Prometheus: http://localhost:9090  
- Grafana: http://localhost:3001 (admin / admin). Datasources: Prometheus, Loki, Tempo (provisioned from `scaffold/config/grafana/provisioning/datasources/`). Import dashboards from **scaffold/config/grafana/dashboards/** (Roadmap Service, Technical stack, Data flow). Use Explore to query logs (Loki) and traces (Tempo).

If you started only postgres/backend/frontend and want to add the observability stack:

```bash
make docker-up-observability
```

**Frontend in Docker, backend on the host (port 8080):**  
If you run the frontend in Docker and the backend on the host (e.g. `go run ./cmd/server`), the frontend must proxy `/api/*` to the host. Set `BACKEND_URL` via a `.env` file or when starting:

- **Using a .env file:** The API proxy reads `BACKEND_URL` from `.env`. From the **frontend** directory, copy the example and edit:
  ```bash
  cd app/frontend && cp .env.example .env
  # Edit .env and set BACKEND_URL=http://10.66.50.210:8080 (or your host IP)
  ```
  When running in Docker, put `BACKEND_URL=http://10.66.50.210:8080` in a `.env` in the **project root** (so docker-compose passes it into the frontend container), or mount `app/frontend/.env` into the container.
- **Or set when starting:**
  ```bash
  BACKEND_URL=http://10.66.50.210:8080 docker compose up -d frontend
  ```

**Backend in Docker, Postgres on the host (use the host’s IP):**  
From inside a container, **`localhost` is the container itself, not the host.** If you see `host=localhost` in the backend error, the backend is trying to connect to Postgres inside its own container and will get “connection refused”. You must set `DB_HOST` to either:

- **Full stack (Postgres in this Compose):** Do **not** set `DB_HOST` (or ensure it is not `localhost`). The default in Compose is `postgres`, so the backend will use the Postgres service. If you have a `.env` with `DB_HOST=localhost`, remove it or set `DB_HOST=postgres` when running Docker.
- **Postgres on the host:** Set `DB_HOST` to the **host’s IP** (e.g. `10.66.50.210`) so the backend container can reach the host:

```bash
DB_HOST=10.66.50.210 docker compose up -d backend frontend
```

If Postgres is on the host and you do **not** want to start the Postgres/seed services from Compose (you already have Postgres and seed data at that IP):

```bash
DB_HOST=10.66.50.210 docker compose up -d backend frontend --no-deps
```

Ensure Postgres is listening on that IP (e.g. `listen_addresses = '*'` or the host’s address in `pg_hba.conf`) and that the DB is seeded (e.g. run `make seed` from the host against that host:port).

**If APIs return 500 only when using Docker Compose:**

This usually means the backend in the container can’t reach the DB or is getting requests in an unexpected way. The app is set up for that:

- **DB connection retry:** The backend retries connecting to Postgres for up to ~30s at startup, so it can wait for Postgres to be ready in Docker Compose.
- **Proxy:** The frontend service must have `BACKEND_URL: http://backend:8080` so the Next.js proxy targets the backend container (already set in `docker-compose.yml`).
- **Trusted proxies:** The backend trusts proxy headers when behind the Next.js proxy so `ClientIP()` and similar work correctly.

If you still see 500s or backend exits with “db connect failed”:

1. **Backend shows `host=localhost` and connection refused:** From inside a container, `localhost` is the container itself. Set `DB_HOST` when starting: for full stack use the default (don’t set `DB_HOST`, or `DB_HOST=postgres`); for Postgres on the host use the host’s IP, e.g. `DB_HOST=10.66.50.210 docker compose up -d`. Remove any `.env` that sets `DB_HOST=localhost`.
2. **Check backend logs:**  
   `docker compose logs backend` (or `docker compose logs -f backend`).
3. **Check DB from backend:**  
   `curl http://localhost:8080/api/health` — 503 or connection refused means the backend in Docker can’t reach Postgres (e.g. wrong `DB_*` or postgres not running).
4. **In the browser:** DevTools → Network → failed request → **Response** tab — the body often has `{"error": "..."}` with the real backend error (e.g. DB error, missing table).

**Login returns 500 when running backend + frontend locally (Postgres in Docker):**

1. **Backend must be running:** In a terminal run `make run-backend-dev`. If the backend is not listening on port 8080, the frontend proxy will fail and you may see 500.
2. **Seed users:** Run `make seed` so the DB has superadmin/admin/owner users. (Without seed you get 401 "invalid credentials", not 500.)
3. **See the real error:** Backend logs the cause: check the terminal where the Go server is running. In the browser: DevTools → Network → select the failed login request → **Response** tab; the body is usually `{"error":"..."}` with the backend error (e.g. DB connection, JWT, or table missing).
4. **Frontend proxy target:** Do not set `BACKEND_URL` in `app/frontend/.env` or `app/frontend/.env.local` to `http://backend:8080` when running the frontend on your host; that hostname only resolves inside Docker. Use unset (defaults to `http://localhost:8080`) or `BACKEND_URL=http://localhost:8080`.

## Testing the service

After `make docker-up` (or when running backend/frontend locally), verify everything is up:

1. **Backend + DB:**  
   `curl http://localhost:8080/api/health`  
   Expect: `{"status":"ok","db":"ok"}` (200). 503 or connection refused means backend can’t reach Postgres or isn’t running.

2. **Frontend:**  
   Open http://localhost:3000 — you should see the app (e.g. redirect to `/roadmap` or login).

3. **One-shot smoke test:**  
   `make smoke-test` — checks backend health and that the frontend responds.

**Observability (if you started the full stack):**

- Grafana: http://localhost:3001 (admin / your `GRAFANA_PASSWORD`)
- Prometheus: http://localhost:9090
- Loki (logs) and Tempo (traces) are provisioned as Grafana datasources.

### Testing Loki with backend logs

Backend logs go to **stdout** (zap → JSON/console). When the backend runs in Docker, that stdout is captured as container logs; **Promtail** scrapes Docker container logs and pushes them to **Loki**. So the path is: backend → stdout → Docker → Promtail → Loki.

**1. Emit a known log line from the backend**

```bash
curl "http://localhost:8080/api/health?loki_test=1"
```

The backend logs one line: `loki_test: backend log line for Loki verification`. The response is still `{"status":"ok","db":"ok"}`.

**2. Query Loki in Grafana**

1. Open **Grafana** → http://localhost:3001
2. Go to **Explore** (compass icon) → select datasource **Loki**
3. Use a query that targets the backend container, for example:
   - `{service="backend"}` — all backend logs (Promtail adds label `service` from Docker Compose service name)
   - Or: `{container=~"rm-backend.*"}` if your container name matches that pattern
4. Optionally filter by the test message: add `|= "loki_test"` to the query, e.g. `{service="backend"} |= "loki_test"`
5. Choose a time range that includes “now” and run the query

You should see the `loki_test` log line (and other backend logs). If you see no logs, confirm Promtail and Loki are running (`docker compose ps`) and that the backend container is running and was started with the rest of the stack (so Promtail can discover it).

## How to test

Run each module’s tests from the **repo root**. See [scaffold/tests/README.md](scaffold/tests/README.md) for details.

| What | Command | Notes |
|------|---------|-------|
| **Backend (unit)** | `make test-backend` or `cd app/backend && go test ./...` | No DB required for unit tests (e.g. `app/backend/internal/logger`). |
| **Frontend (lint)** | `make test-frontend` or `cd app/frontend && npm run lint` | ESLint. |
| **All module tests** | `make test` | Runs backend + frontend tests. |
| **Integration / smoke** | `make smoke-test` | Backend and frontend must be running (e.g. `make docker-up` first). Checks `/api/health` and frontend root. |

**Quick flow:**

1. **Backend only:** `make test-backend`
2. **Frontend only:** `make test-frontend`
3. **Full stack then smoke:** `make docker-up` then `make smoke-test`
4. **Local dev then smoke:** Terminal 1: `make run-backend-dev`; Terminal 2: `make run-frontend`; then `make smoke-test`

## Makefile

- `make run-backend-dev` – run Go server (DB must be up)
- `make run-frontend` – run Next.js dev
- `make build-backend` / `make build-frontend` – build artifacts
- `make docker-up` / `make docker-down` – start/stop all containers (including Prometheus and Grafana)
- `make docker-up-postgres` – start only Postgres (use when running backend/frontend locally; backend expects `localhost:5432`)
- `make docker-up-observability` – start only Loki, Promtail, Tempo, otel-collector, Prometheus, and Grafana (when core stack is already running)
- `make test` – run backend unit tests and frontend lint
- `make test-backend` – Go unit tests (`cd app/backend && go test ./...`)
- `make test-frontend` – frontend lint (`npm run lint` in app/frontend)
- `make test-integration` / `make smoke-test` – integration/smoke (backend + frontend must be running; see [How to test](#how-to-test))
- `make migrate-up` / `make migrate-down` – SQL migrations
- `make seed` – seed superadmin, admin, and owner users (optional). From host: connects to localhost:5432 (use when Postgres is in Docker with port 5432 exposed). Superadmin: `superadmin@example.com` / `admin123`; Admin: `admin@example.com` / `admin123`; Owner: `owner@example.com` / `admin123`.
- `make seed-docker` – run the seed container against Docker Postgres (`docker compose run --rm seed`). Use when Postgres is running in Docker and you want to seed from inside the stack.

## Roles

- **Superadmin:** Full access; only role that can **edit** the Roadmap (Gantt). Can set user role to superadmin; cannot be deleted by others.
- **Admin:** Full CRUD on products, approve product creation/deletion requests, delete products, manage users (remove from products, delete user), organization (holding companies → companies → functions → departments → teams), audit/activity logs. Cannot edit Roadmap (view only).
- **Owner:** CRUD own products, edit milestones/dependencies on product page; cannot delete product, approve requests, or edit Roadmap (view only).
- **User:** View products, submit product creation requests; view Roadmap only.

## Features

### Products

- Products have name, version, description, status (pending/approved/archived), lifecycle (active/not_active/suspend/end_of_roadmap), categories, owner.
- **Product versions** and **version-level dependencies** for roadmap grouping.
- **Product creation requests** – users request new products; admin approves/rejects.
- **Product deletion requests** – anyone can request deletion; admin approves/rejects. Pending deletion shown with trash icon on Products page.
- Products list: DHL-styled table; Action/View column visible on row hover or selection; deletion-request trash icon before product name when pending (admin can click to confirm/reject).

### Roadmap

- **Unified Gantt** when multiple products are selected (e.g. from Dashboard or filters).
- **Show versions** checkbox toggles only **version rows** (Product-level, Version X) in the Gantt; **product header rows are always shown**.
- Per-product **expand/collapse** (plus/minus **icons** in a bordered button, more visible on row hover) overrides the global checkbox for that product (show/hide versions for that product only).
- Only **superadmin** can edit roadmap (edit product name, edit milestone links); admin/owner/user view only.

### Groups

- Groups are named sets of products; description required (>10 chars).
- **View Gantt** opens Roadmap filtered by that group. Groups table and forms use DHL styling.

### Users & Organization (Admin)

- **Users:** List with team, direct manager; assign dotted-line managers (multi-select). **Remove from products** clears user as owner from all products; **Remove user** deletes the user (cannot delete self or superadmin). Users table DHL-styled.
- **Organization:** Hierarchy – Holding Companies → Companies → Functions → Departments → Teams. Users can be assigned to a team and have one direct manager and multiple dotted-line managers (manager chain up to 16 levels).

### Audit & Activity Logs

- **Audit logs:** Every mutating action (product/milestone/dependency/request/etc.) writes an audit record (user_id, action, entity_type, entity_id, old_data/new_data JSONB, IP, user_agent, trace_id). Main view + **archive** (admin can archive and delete archived).
- **Activity logs:** Every **login** (success) and **login_failed** (invalid credentials or error) and every **logout** request are recorded, plus actions like create/save/delete. Admin-only list with filter by action and date.

### Notifications

- In-app notifications (e.g. product updated, request approved); read/unread, archive, unread count.

## Middleware

- **RequestID** – sets `X-Request-ID` and trace ID in context
- **Telemetry** – OpenTelemetry span per request, trace_id for audit
- **RateLimit** – per-IP rate limiting (600 req/s, burst 600). Frontend staggers API calls (dashboard: global stats first, then my stats/users/pending; products/roadmap: first N version or dependency queries, then the rest after ~1s) to avoid 429 on load.
- **Auth** – JWT validation for `/api/*`
- **AuditContext** – IP and User-Agent for audit/activity entries
- **RBAC** – RequireAdmin / RequireRole for protected routes

## API Overview

- **Auth (no JWT):** `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`
- **Auth (JWT):** `POST /api/auth/logout` (logs logout activity)
- **Products:** `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id` (DELETE admin only). PUT supports `clear_owner` to unset product owner.
- **Versions:** `GET /api/products/:id/versions`, `POST /api/product-versions`, `PUT/DELETE /api/product-versions/:id`
- **Version dependencies:** `GET /api/product-versions/:id/dependencies`, `POST /api/product-version-dependencies`, `DELETE /api/product-version-dependencies/:id`
- **Milestones:** `GET /api/products/:id/milestones`, `POST /api/milestones`, `PUT/DELETE /api/milestones/:id`
- **Dependencies (milestone-level):** `GET /api/dependencies`, `POST /api/dependencies`, `DELETE /api/dependencies/:id`
- **Product requests:** `POST /api/product-requests`, `GET /api/product-requests`, `PUT /api/product-requests/:id/approve` (admin only)
- **Deletion requests:** `POST /api/products/:id/request-deletion`, `GET /api/product-deletion-requests`, `PUT /api/product-deletion-requests/:id/approve` (admin only)
- **Notifications:** `GET /api/notifications`, `GET /api/notifications/unread-count`, `PUT /api/notifications/read-all`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/:id/archive`, `DELETE /api/notifications/:id`
- **Users (admin):** `GET/GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `PUT /api/users/:id/remove-from-products`, `DELETE /api/users/:id`, dotted-line managers: `GET/POST/DELETE /api/users/:id/dotted-line-managers`
- **Organization (admin):** Holding companies, companies, functions, departments, teams – full CRUD under `/api/holding-companies`, `/api/companies`, `/api/functions`, `/api/departments`, `/api/teams`
- **Audit:** `GET /api/audit-logs`, `POST /api/audit-logs/archive`, `POST /api/audit-logs/archive/delete` (admin for archive/delete)
- **Activity:** `GET /api/activity-logs` (admin only)
- **Groups:** `GET/POST /api/groups`, `GET/PUT/DELETE /api/groups/:id`

Protected routes use `Authorization: Bearer <access_token>`.

## Project Structure (detailed)

```
.
├── app/                      # Application (backend, frontend, database-related)
│   ├── backend/              # Go module (go.mod, go.sum)
│   │   ├── cmd/server/       # Backend entrypoint
│   │   ├── internal/         # config, models, repositories, services, handlers, middleware, auth, dto, telemetry, logger, migrations
│   │   └── scripts/seed/     # Seed superadmin, admin, owner users
│   └── frontend/             # Frontend (Next.js): src/app, components, hooks, lib, store; includes Dockerfile for standalone build
├── scaffold/                 # Config, deploy, tests, init, Grafana (non-app)
│   ├── config/               # Env examples, metrics, logs, traces, Grafana
│   ├── deploy/               # Docker Compose, Docker (single-service), VM, k8s (Kind)
│   │   └── k8s/              # Kubernetes (Kind): kind/ubuntu, kind/macos
│   ├── tests/                # Backend unit tests layout, frontend lint, integration/smoke
│   ├── init/                 # Initialization / bootstrap assets
│   │   └── prompts/          # AI/prompt assets
│   └── grafana/              # Additional Grafana dashboards
├── infra/                    # Future Ansible: Docker, Docker Compose, VM provisioning
├── Makefile
└── README.md
```

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
| BACKEND_URL                  | http://localhost:8080     | Backend URL (frontend rewrites) |
| OTEL_EXPORTER_OTLP_ENDPOINT  | (empty)                   | OTLP HTTP endpoint     |

## Seed Data

**Docker Compose:** The seed runs automatically when you start the stack. The `seed` service runs once after Postgres is healthy (with `DB_HOST=postgres`, etc.), then the backend starts. So `make docker-up` will seed the containerized Postgres and then start the backend.

**Manual seed (from host):**

```bash
# Postgres in Docker with port 5432 exposed (default)
make seed
# or
cd app/backend && go run ./scripts/seed/main.go
```

**Manual seed (inside Docker):**

```bash
# Postgres already running in Docker
make seed-docker
# or
docker compose run --rm seed
```

**Environment:** The seed uses the same DB env as the backend: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`. From the host use defaults (localhost:5432) or set them; in Docker Compose the seed service has `DB_HOST=postgres`, etc.

Creates: **superadmin** (`superadmin@example.com` / `admin123`), **admin** (`admin@example.com` / `admin123`), and **owner** (`owner@example.com` / `admin123`) users.

## License

MIT
