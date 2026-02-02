# Product Roadmap Management System — As-Is Specification

This document describes the **current logic, structure, and artifacts** of the Product Roadmap Management System so the entire program and artifacts can be recreated. Use it as a single source of truth for rebuilding or porting the system.

---

## 1. Purpose and scope

- **Product:** Enterprise product roadmap management with multi-product support, milestones, dependencies, RBAC (superadmin/admin/owner/user), audit logging, activity logs (login/logout and actions), observability (OpenTelemetry, Prometheus, Grafana), and Gantt-style timeline views.
- **Landing:** Root URL `/` redirects to `/roadmap`; the Roadmap page is both landing and home. Unauthenticated users are redirected to login from the Roadmap page.
- **Branding:** Frontend uses DHL-style branding (red/yellow) across Dashboard, Products, Groups, Users, and Admin pages.

---

## 2. Repository layout (top level)

```
.
├── app/                      # Application (backend, frontend, database-related)
│   ├── backend/              # Go API (module: github.com/rm/roadmap/backend)
│   │   ├── cmd/server/        # Entrypoint: main.go
│   │   ├── internal/          # config, models, repositories, services, handlers, middleware, auth, dto, logger, telemetry, migrations
│   │   └── scripts/seed/     # Seed superadmin, admin, owner users
│   └── frontend/              # Next.js 14 app (TypeScript, Tailwind, React Query, Zustand)
│       └── src/              # app/, components/, hooks/, lib/, store/
├── scaffold/                  # Config, deploy, tests, init, Grafana (non-app)
│   ├── config/               # Env examples; metrics/, logs/, traces/, grafana/ (Prometheus, Loki, Tempo, OTEL, Grafana)
│   ├── deploy/               # docker-compose/, docker/, vm/ (setEnv.sh), k8s/ (Kind)
│   │   └── k8s/              # Kubernetes (Kind)
│   │       └── kind/
│   │           ├── ubuntu/   # create-cluster.sh, delete-cluster.sh
│   │           └── macos/    # create-cluster.sh, delete-cluster.sh
│   ├── tests/                # Backend unit, frontend lint, integration/smoke layout
│   ├── init/                 # Initialization assets
│   │   └── prompts/          # AI/prompt assets (this file, prompt.md)
│   └── grafana/              # Additional Grafana dashboards
├── infra/                    # Future Ansible: Docker, Docker Compose, VM provisioning
├── Makefile
├── README.md
└── .env.example
```

- **App:** All application code (backend Go API, frontend Next.js, DB schema/seed) lives under `app/`.
- **Scaffold:** All supporting assets (config files, deployment definitions, test layout, init/prompts, Grafana) live under `scaffold/`.
- **Infra:** Reserved for future Ansible (or similar) to provision Docker, Docker Compose, VM.
- **K8s:** Kind (Kubernetes in Docker) scripts; `ubuntu/` and `macos/` each have create-cluster and delete-cluster scripts.

---

## 3. Backend (Go)

### 3.1 Module and stack

- **Module:** `github.com/rm/roadmap/backend`
- **Go:** 1.22+
- **Framework:** Gin
- **ORM:** GORM with PostgreSQL (JSONB where needed)
- **Auth:** JWT (access + refresh); bcrypt for passwords
- **Logging:** zap (JSON/console)
- **Telemetry:** OpenTelemetry (OTLP HTTP to collector → Tempo)
- **Metrics:** Prometheus (`http_requests_total`, `http_request_duration_seconds`); `/metrics` endpoint

### 3.2 Config (internal/config)

Loaded from environment; all keys and defaults:

- **Server:** `PORT` (default 8080)
- **Database:** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE` (defaults: localhost, 5432, postgres, postgres, roadmap, disable)
- **JWT:** `JWT_SECRET` (required non-empty in production), `JWT_ACCESS_EXPIRY_MIN`, `JWT_REFRESH_EXPIRY_MIN`
- **Log:** `LOG_LEVEL` (debug|info|warn|error), `LOG_FORMAT` (console|json)
- **Otel:** `OTEL_EXPORTER_OTLP_ENDPOINT` (empty = tracing disabled)

### 3.3 Models (internal/models)

- **User:** id (UUID), name, email, password_hash, role (superadmin|admin|owner|user), team_id, direct_manager_id, timestamps, soft delete. Associations: Team, DirectManager, DirectReports, DottedLineManagers, Products (as owner).
- **Product:** id, name, version (legacy display), description, owner_id, status (pending|approved|archived), lifecycle_status (active|not_active|suspend|end_of_roadmap), category1/2/3, metadata (JSONB), timestamps, soft delete. Associations: Owner, Milestones, ProductVersions.
- **Milestone:** id, product_id, name, start_date, end_date, metadata (JSONB), timestamps, soft delete.
- **Dependency:** milestone-to-milestone (source_milestone_id, target_milestone_id).
- **ProductRequest:** product creation request; user, status, etc.
- **ProductDeletionRequest:** deletion request; product, status, etc.
- **ProductVersion:** product_id, name/version identifier; used for grouping in roadmap.
- **ProductVersionDependency:** version-to-version dependency.
- **Group:** named set of products; name, description (required >10 chars).
- **AuditLog:** user_id, action, entity_type, entity_id, old_data/new_data (JSONB), IP, user_agent, trace_id; optional archived flag.
- **ActivityLog:** login, login_failed, logout, and action events (create/save/delete etc.).
- **Notification:** in-app notifications; read/unread, archive.
- **Org hierarchy:** HoldingCompany → Company → Function → Department → Team. Each has id, name, parent refs, timestamps.
- **UserDottedLineManager:** user_id, manager_id (many-to-many dotted-line managers).

Role hierarchy: **user** < **owner** < **admin** < **superadmin**. Only superadmin can edit the Roadmap (Gantt). Admin can do everything except edit Roadmap. Owner can CRUD own products and milestones. User can view and submit product requests.

### 3.4 Repositories (internal/repositories)

One repository per main entity: User, Product, Milestone, Dependency, ProductRequest, ProductDeletionRequest, ProductVersion, ProductVersionDependency, Group, AuditLog, ActivityLog, Notification, HoldingCompany, Company, Function, Department, Team, UserDottedLine. All use GORM; soft deletes where defined on the model.

### 3.5 Services (internal/services)

- **AuthService:** login (record activity), register, refresh; uses UserRepository and JWT.
- **ProductService:** CRUD products, list with filters; coordinates versions, deletion requests, groups, milestones; emits audit/activity and notifications where needed.
- **ProductVersionService,** **ProductVersionDependencyService:** version and version-dependency CRUD; audit/activity.
- **MilestoneService,** **DependencyService:** milestone and milestone-level dependency CRUD; audit/activity.
- **ProductRequestService,** **ProductDeletionRequestService:** create/list/approve; audit/activity and notifications.
- **GroupService:** CRUD groups.
- **AuditService:** list audit logs, archive, delete archived.
- **ActivityService:** list activity logs; record logout (and login/login_failed from auth).
- **NotificationService:** list, unread count, mark read/read-all, archive, delete.
- **OrgService:** full CRUD for holding companies, companies, functions, departments, teams.
- **UserHandler** uses UserRepository and DottedLineRepository directly for admin user management (list, get, update, remove-from-products, delete, dotted-line managers).

### 3.6 Handlers (internal/handlers)

One handler per domain: Auth, Product, ProductVersion, ProductVersionDependency, ProductRequest, ProductDeletionRequest, Milestone, Dependency, Group, User, Org (holding-companies, companies, functions, departments, teams), Audit, Activity, Notification. All return JSON; errors return appropriate HTTP status and `{"error":"..."}`. Pagination where applicable (e.g. audit, activity, products list).

### 3.7 Middleware (internal/middleware)

- **Recovery:** panic recovery; log and return 500.
- **CORS:** permissive for dev; configurable.
- **RequestID:** set `X-Request-ID` and trace ID in context.
- **Prometheus:** record `http_requests_total` (counter) and `http_request_duration_seconds` (histogram) for non-/metrics routes.
- **Telemetry:** OpenTelemetry span per request; tracer name `github.com/rm/roadmap/backend`.
- **RateLimit:** per-IP rate limiting (e.g. 600 req/s, burst 600).
- **Auth:** validate JWT on `/api/*` (except health); set user_id, role, claims in context.
- **AuditContext:** capture IP and User-Agent for audit/activity.
- **RequireAdmin:** allow only admin and superadmin (403 otherwise).
- **RequireRole(roles...):** allow only listed roles.
- **RequireOwnerOrAdmin:** owner, admin, superadmin.

### 3.8 Routes (cmd/server/main.go)

- **Unauthenticated:**  
  `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`  
  `GET /api/health` (pings DB; 503 if DB down; `?loki_test=1` logs one line for Loki verification)  
  `GET /health` (simple ok)  
  `GET /metrics` (Prometheus scrape; no auth)

- **Authenticated (/api/* with JWT):**  
  `POST /api/auth/logout` (records logout in activity_logs)  
  Products: `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id` (DELETE admin only)  
  Milestones: `GET /api/products/:id/milestones`, `POST/PUT/DELETE /api/milestones`  
  Versions: `GET /api/products/:id/versions`, `POST/PUT/DELETE /api/product-versions`, `GET/POST/DELETE /api/product-versions/:id/dependencies`  
  Version deps: `POST/DELETE /api/product-version-dependencies`  
  Deletion requests: `POST /api/products/:id/request-deletion`, `GET /api/product-deletion-requests`, `PUT /api/product-deletion-requests/:id/approve` (admin)  
  Dependencies: `GET/POST /api/dependencies`, `DELETE /api/dependencies/:id`  
  Product requests: `POST /api/product-requests`, `GET /api/product-requests`, `PUT /api/product-requests/:id/approve` (admin)  
  Notifications: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PUT /api/notifications/read-all`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/:id/archive`, `DELETE /api/notifications/:id`  
  Users (admin): `GET/GET /api/users`, `GET /api/users/:id`, `PUT`, `PUT /api/users/:id/remove-from-products`, `DELETE`, dotted-line: `GET/POST/DELETE /api/users/:id/dotted-line-managers`  
  Org (admin): full CRUD under `/api/holding-companies`, `/api/companies`, `/api/functions`, `/api/departments`, `/api/teams`  
  Audit: `GET /api/audit-logs`, `POST /api/audit-logs/archive`, `POST /api/audit-logs/archive/delete` (admin)  
  Activity: `GET /api/activity-logs` (admin)  
  Groups: `GET/POST /api/groups`, `GET/PUT/DELETE /api/groups/:id`

- **Startup:** DB connect with retry (e.g. 15 attempts, 2s apart) for Docker Compose; GORM AutoMigrate for all models; then start HTTP server. Trust proxy when behind Next.js (SetTrustedProxies).

### 3.9 Migrations (internal/migrations)

SQL migrations (golang-migrate style) in order:  
`000001_init`, `000002_audit_logs`, `000003_product_versions_and_deletion`, `000004_audit_logs_archive`, `000005_product_version_dependencies`, `000006_notifications`, `000007_org_and_user_managers`, `000008_activity_logs`.  
Backend also runs GORM AutoMigrate on startup so schema stays in sync with models.

### 3.10 Seed (scripts/seed)

Creates three users if not present:  
- superadmin@example.com / admin123 (RoleSuperadmin)  
- admin@example.com / admin123 (RoleAdmin)  
- owner@example.com / admin123 (RoleOwner)  
Uses same DB env as backend; retries connect like main server.

---

## 4. Frontend (Next.js)

### 4.1 Stack

- **Next.js:** 14.x (App Router)
- **TypeScript,** **Tailwind CSS**
- **React Query** (@tanstack/react-query) for server state
- **Zustand** for auth (and any local UI state)
- **OpenTelemetry API** (@opentelemetry/api) — e.g. useTrace for spans
- **vis-timeline** for Gantt
- **date-fns,** **react-hook-form**
- **dotenv** for BACKEND_URL / NEXT_PUBLIC_API_URL

### 4.2 API proxy (src/app/api/[[...path]]/route.ts)

All `/api/*` (and `/auth/*`) requests are proxied to the backend.  
- Backend base URL: `BACKEND_URL` or `NEXT_PUBLIC_API_URL` or `http://localhost:8080`.  
- Path mapping: `/api/auth/logout` → backend `POST /api/auth/logout`; other `/api/auth/*` → backend `/auth/*`; rest of `/api/*` → backend `/api/*`.  
- Forwards method, headers (excluding host/connection), body, and query params; returns backend response status and body.

### 4.3 Pages (src/app)

- **/** → redirect to `/roadmap`
- **/roadmap** — Roadmap (Gantt); superadmin can edit; others view only
- **/login,** **/register** — Auth
- **/dashboard** — Dashboard (stats, my products, pending requests)
- **/products,** **/products/new,** **/products/[id]** — Products list, create, detail (milestones, versions, dependencies)
- **/groups** — Groups list and CRUD
- **/requests** — Product creation requests (user view)
- **/notifications** — Notifications list and actions
- **/activity-logs** — Activity logs (admin)
- **/audit-logs** — Audit logs (admin)
- **/admin** — Admin landing
- **/admin/users,** **/admin/activity-logs,** **/admin/audit-logs,** **/admin/requests,** **/admin/deletion-requests** — Admin sub-pages

Layout: root layout with Nav, Providers (React Query + auth), main content area; theme DHL (red #D40511, yellow); viewport and metadata set.

### 4.4 Components (src/components)

- **Nav** — Navigation; role-based links; logout
- **RequireAuth,** **RequireRole** — Protect routes by login and role
- **Providers** — React Query client + auth store
- **RoadmapView** — Gantt (vis-timeline); show versions checkbox; per-product expand/collapse; superadmin-only edit
- **MilestoneEditor,** **DependencyEditor** — Edit milestones and dependencies
- **ActivityLogsContent,** **AuditLogsContent** — Tables and filters for activity/audit
- **RequestQueueContent** — Product requests queue
- **GlobalSearch,** **Notification** UI, etc.

### 4.5 State and auth

- **store/auth.ts (Zustand):** access token, refresh token, user (id, email, name, role); login, logout, refresh; persist tokens (e.g. localStorage).
- **lib/roles.ts:** `isAdminOrAbove(role)`, `ADMIN_OR_SUPERADMIN_ROLES` — align with backend role hierarchy.
- **lib/api.ts:** base URL for API calls (same as proxy backend); attach `Authorization: Bearer <access_token>`.

### 4.6 Build and run

- `npm run dev`, `npm run build`, `npm run start`, `npm run lint`
- Standalone output supported for Docker (next build with standalone).

---

## 5. Database

- **Engine:** PostgreSQL 16
- **Database name:** roadmap (default)
- **Schema:** Defined by GORM models + migrations. Key tables: users, products, milestones, dependencies, product_requests, product_deletion_requests, product_versions, product_version_dependencies, groups, audit_logs, activity_logs, notifications, holding_companies, companies, functions, departments, teams, user_dotted_line_managers. Soft deletes (deleted_at) where applicable. Indexes on foreign keys and common filters (e.g. dates, status).

---

## 6. Observability

- **Logs:** Backend logs to stdout (zap JSON/console). In Docker, Promtail scrapes container logs and sends to Loki. Promtail adds labels (e.g. service name from Compose).
- **Traces:** Backend exports OTLP (HTTP) to OpenTelemetry Collector; collector forwards to Tempo. Trace ID is set in context and stored in audit_logs.
- **Metrics:** Backend exposes Prometheus metrics (request count, duration) at `/metrics`. Prometheus scrapes backend and optionally otel-collector.
- **Grafana:** Provisioned datasources for Prometheus, Loki, Tempo. Dashboards (e.g. technical stack, data flow) live in `scaffold/config/grafana/dashboards/` and `scaffold/grafana/`.

---

## 7. Deployment

### 7.1 Docker Compose (scaffold/deploy/docker-compose/)

- **Compose file:** `scaffold/deploy/docker-compose/docker-compose.yml`
- **Build context:** Repo root (../../.. from compose file). Dockerfiles: `Dockerfile.backend`, `Dockerfile.seed`, `Dockerfile.frontend` in same directory; they COPY `app/backend/` or `app/frontend/` from context.
- **Services:** postgres, seed (runs once after postgres healthy), backend, frontend, loki, promtail, tempo, otel-collector, prometheus, grafana.
- **Config mounts:** All config from `scaffold/config/` (relative to compose file: ../../config/ → scaffold/config/). Mounts: logs (Loki, Promtail), traces (Tempo, otel-collector), metrics (Prometheus), grafana provisioning.
- **Env:** Backend: PORT, DB_*, JWT_SECRET, OTEL_EXPORTER_OTLP_ENDPOINT. Frontend: NEXT_PUBLIC_API_URL, BACKEND_URL. Seed: DB_*.
- **Run from repo root:** `docker compose -f scaffold/deploy/docker-compose/docker-compose.yml --project-directory . up -d`

### 7.2 Makefile (repo root)

- **Backend:** `build-backend` (cd app/backend && go build -o ../../bin/server ./cmd/server), `run-backend`, `run-backend-dev`
- **Frontend:** `install-frontend`, `run-frontend`, `build-frontend` (all cd app/frontend)
- **DB:** `migrate-up`, `migrate-down` (migrate -path app/backend/internal/migrations -database "postgres://...")
- **Compose:** `COMPOSE_FILE := scaffold/deploy/docker-compose/docker-compose.yml`; `docker-up`, `docker-down`, `docker-up-postgres`, `docker-build`, `docker-up-observability`
- **Seed:** `seed` (go run app/backend/scripts/seed), `seed-docker` (compose run seed)
- **Test:** `test-backend` (cd app/backend && go test ./...), `test-frontend` (cd app/frontend && npm run lint), `test`, `smoke-test` (curl backend health + frontend root)

### 7.3 VM (scaffold/deploy/vm/)

- **setEnv.sh:** Sets PATH for Go, GOPATH, DB_* env, and NVM. Source from repo root: `source scaffold/deploy/vm/setEnv.sh`. Used when running backend/frontend on bare metal or VM.
- **README:** Describes running Postgres, backend, frontend manually; optional systemd example for backend; config from scaffold/config/env.

---

## 8. Infra and K8s

- **infra/:** Placeholder for Ansible (or similar) to automate Docker, Docker Compose, and VM provisioning. See infra/README.md.
- **scaffold/deploy/k8s/kind/ubuntu/** and **scaffold/deploy/k8s/kind/macos/:** Scripts `create-cluster.sh` and `delete-cluster.sh` for Kind (Kubernetes in Docker). Default cluster name: roadmap. Prerequisites: Docker, kind, kubectl. Run from repo root, e.g. `./scaffold/deploy/k8s/kind/ubuntu/create-cluster.sh`.

---

## 9. Testing

- **Backend:** Unit tests in `app/backend/internal/*_test.go` (e.g. logger). Run: `cd app/backend && go test ./...`
- **Frontend:** Lint: `cd app/frontend && npm run lint`
- **Integration/smoke:** `make smoke-test` — GET /api/health (expect 200 + "ok"), GET frontend root (expect 200). Backend and frontend must be running.

---

## 10. Environment variables (summary)

| Variable | Default | Used by |
|----------|---------|--------|
| PORT | 8080 | Backend |
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSLMODE | localhost, 5432, postgres, postgres, roadmap, disable | Backend, seed |
| JWT_SECRET | change-me-in-production | Backend |
| JWT_ACCESS_EXPIRY_MIN, JWT_REFRESH_EXPIRY_MIN | 15, 10080 | Backend |
| LOG_LEVEL, LOG_FORMAT | info, json | Backend |
| OTEL_EXPORTER_OTLP_ENDPOINT | (empty) | Backend |
| BACKEND_URL, NEXT_PUBLIC_API_URL | http://localhost:8080 | Frontend (proxy) |
| GRAFANA_PASSWORD | admin | Grafana (Compose) |

---

## 11. Business rules (concise)

- **RBAC:** user < owner < admin < superadmin. Only superadmin edits Roadmap (Gantt). Admin: full CRUD except Roadmap edit; can approve requests, manage users/org, audit/activity. Owner: CRUD own products and milestones. User: view, submit product requests.
- **Products:** status (pending/approved/archived), lifecycle (active/not_active/suspend/end_of_roadmap). Product creation via request; admin approves. Deletion via deletion request; admin approves.
- **Roadmap:** Unified Gantt for multiple products; product versions and version-level dependencies; “show versions” toggle; per-product expand/collapse for versions.
- **Audit:** Every mutating action writes audit_log (user, action, entity_type, entity_id, old/new JSONB, IP, user_agent, trace_id). Archive and delete archived (admin).
- **Activity:** Login (success), login_failed, logout, and action events; admin-only list.
- **Notifications:** In-app; read/unread, archive, unread count.
- **Org:** Hierarchy HoldingCompany → Company → Function → Department → Team; users have team, direct manager, dotted-line managers (admin-managed).

---

Use this document together with the actual source code and `scaffold/config` files to recreate the full program and deployment artifacts.
