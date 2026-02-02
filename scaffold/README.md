# Scaffold

Non-application scaffolding: config, deployment definitions, tests, and supporting assets. The **app** (backend, frontend, database-related code) lives under `../app/`.

| Directory | Purpose |
|-----------|---------|
| **config/** | Env examples and config files (metrics, logs, traces, Grafana). Used by Docker Compose and VM runs. |
| **deploy/** | Docker Compose, single-service Docker, and VM (bare metal) deployment options. |
| **tests/** | Backend unit tests layout, frontend lint, integration/smoke test layout. |
| **init/** | Initialization / bootstrap assets. |
| **init/prompts/** | AI/prompt assets. |
| **grafana/** | Additional Grafana dashboards and provisioning (canonical dashboards are in `config/grafana/dashboards/`). |

- **Config:** `config/env/` has per-service `.env.example` files; `config/metrics/`, `config/logs/`, `config/traces/`, `config/grafana/` hold Prometheus, Loki, Tempo, OTEL Collector, and Grafana configs.
- **Deploy:** See [deploy/README.md](deploy/README.md) for Docker Compose, Docker (single-service), and VM options.
- **Testing:** See [tests/README.md](tests/README.md). Run tests from repo root via `make test-backend`, `make test-frontend`, `make smoke-test`.
