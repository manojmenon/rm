# Product Roadmap Management System

Enterprise product roadmap management with multi-product support, milestones, dependencies, RBAC (superadmin/admin/owner/user), audit logging, activity logs (login/logout and actions), observability (OpenTelemetry, Prometheus, Grafana), and Gantt-style timeline views. Frontend uses DHL branding (red/yellow) across Dashboard, Products, Groups, Users, and Admin pages.

**Landing & home:** Root URL `/` redirects to `/roadmap`; the Roadmap page is both the landing page and the home page. Unauthenticated users are redirected to login from the Roadmap page.

## Stack

- **Backend:** Go 1.22+, Gin, GORM, PostgreSQL (JSONB), JWT, RBAC, zap (structured logs), OpenTelemetry, rate limiting, pagination
- **Frontend:** Next.js 14, TypeScript, Tailwind, React Query, Zustand, OpenTelemetry API (`useTrace`)
- **Database:** PostgreSQL with soft deletes, indexes on dates, foreign keys, `audit_logs` and `activity_logs` tables
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

Backend uses GORM AutoMigrate by default, so tables (including `audit_logs`, `activity_logs`) are created on first run if the DB exists.

### 2. Backend

```bash
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
- `make build-backend` / `make build-frontend` – build artifacts
- `make docker-up` / `make docker-down` – start/stop containers
- `make test` / `make test-backend` / `make test-frontend` – run tests and lint
- `make migrate-up` / `make migrate-down` – SQL migrations
- `make seed` – seed superadmin, admin, and owner users (optional). Superadmin: `superadmin@example.com` / `admin123`; Admin: `admin@example.com` / `admin123`; Owner: `owner@example.com` / `admin123`.

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

## Project Structure

```
.
├── cmd/server/              # Go entrypoint
├── internal/
│   ├── config/              # App config
│   ├── models/              # GORM models (Product, User, Milestone, AuditLog, ActivityLog, Group, Org, etc.)
│   ├── repositories/        # Data access
│   ├── services/            # Business logic (Audit, Activity, Auth, Product, Milestone, etc.)
│   ├── handlers/            # HTTP handlers
│   ├── middleware/          # RequestID, Telemetry, Auth, RBAC, AuditContext, RateLimit, CORS
│   ├── auth/                # JWT
│   ├── dto/                 # Request/response DTOs, pagination, AuditMeta
│   ├── telemetry/           # OpenTelemetry tracer provider
│   └── migrations/          # SQL migrations (init, audit_logs, product_versions, notifications, org, activity_logs, etc.)
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router (dashboard, products, roadmap, groups, login, register, admin, activity-logs, audit-logs, notifications, requests)
│       ├── components/     # Nav, RequireAuth, RequireRole, RoadmapView (Gantt), GlobalSearch, etc.
│       ├── hooks/           # useTrace (OTEL)
│       ├── lib/             # API client, dateRangePresets, requestUtils, roles
│       └── store/           # Zustand auth store
├── scripts/seed/            # Seed superadmin, admin, owner users
├── docker-compose.yml       # postgres, backend, frontend, otel-collector, prometheus, grafana
├── otel-collector.yaml      # OTLP receiver, batch, prometheus/logging exporters
├── prometheus.yml           # Scrape configs
├── grafana-dashboard.json   # Import into Grafana
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

```bash
go run ./scripts/seed/main.go
```

Creates: **superadmin** (`superadmin@example.com` / `admin123`), **admin** (`admin@example.com` / `admin123`), and **owner** (`owner@example.com` / `admin123`) users.

## License

MIT
