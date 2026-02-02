# Docker Compose deployment

Run the app stack (Postgres, backend, frontend) or the full stack including observability (Loki, Tempo, Prometheus, Grafana) with Docker Compose.

**Location:** Compose file and Dockerfiles live here. Config is in **scaffold/config/** at repo root.

## Prerequisites

- Docker and Docker Compose (v2)
- Config under **scaffold/config/** (metrics, logs, traces, grafana)

## Run from repo root

**App only (default):** postgres, seed, backend, frontend. Use this for the deploy test and for most dev.

```bash
make docker-up
# or
docker compose -f scaffold/deploy/docker-compose/docker-compose.yml --project-directory . up -d
```

**Full stack (with observability):** add Loki, Promtail, Tempo, otel-collector, Prometheus, Grafana.

```bash
docker compose -f scaffold/deploy/docker-compose/docker-compose.yml --project-directory . --profile observability up -d
# or
make docker-up && make docker-up-observability
```

Optional: copy env examples into a single `.env` at repo root (`cp scaffold/config/env/backend.env.example .env`) and edit.

- **Compose file:** `scaffold/deploy/docker-compose/docker-compose.yml`
- **Dockerfiles:** `scaffold/deploy/docker-compose/Dockerfile.backend`, `Dockerfile.seed`, `Dockerfile.frontend` (build context is repo root)
- **Config:** Mounted from `scaffold/config/` (paths relative to project root when using `--project-directory .`)

## Services

- **postgres** – PostgreSQL 16 (port 5432)
- **backend** – Go API (port 8080), `/metrics` for Prometheus
- **frontend** – Next.js (port 3000)
- **loki**, **promtail** – Logs
- **tempo**, **otel-collector** – Traces
- **prometheus** – Metrics (port 9090)
- **grafana** – Dashboards (port 3001)

See root [README](../../README.md) for URLs and testing.
