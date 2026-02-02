# VM / bare metal deployment

Run backend, frontend, and (optionally) Postgres and observability on a Linux VM or bare metal without Docker.

## Prerequisites

- Go 1.22+ (backend)
- Node.js 20+ (frontend)
- PostgreSQL 16 (database)
- Optional: Prometheus, Loki, Tempo, Grafana for observability

## Environment: setEnv.sh

**scaffold/deploy/vm/setEnv.sh** sets PATH for Go and GOPATH, DB connection env vars (`DB_HOST`, `DB_PORT`, etc.), and loads NVM for Node. Use it when running backend/frontend on the VM:

```bash
# From repo root
source scaffold/deploy/vm/setEnv.sh
# Then run backend and frontend (see Layout below)
```

You can also add `source /path/to/roadmap/scaffold/deploy/vm/setEnv.sh` to the VM user’s `.bashrc` or `.profile` so the environment is set in every shell.

## Layout

1. **Database:** Install Postgres, create DB and user. Use `scaffold/config/env/database.env.example` and `scaffold/config/env/backend.env.example` for connection details.
2. **Backend:** From repo root, `source scaffold/deploy/vm/setEnv.sh`, then build/run: `make build-backend` and `make run-backend` (or `make run-backend-dev`). Use `scaffold/config/env/backend.env.example` as `.env` if needed.
3. **Frontend:** Build in `app/frontend/`; use `scaffold/config/env/frontend.env.example` for `BACKEND_URL` and public URL.
4. **Reverse proxy (optional):** Put nginx/caddy in front of frontend (3000) and backend (8080); serve frontend static and proxy `/api/*` to backend.

## Example: backend as systemd service

Create `/etc/systemd/system/roadmap-backend.service`:

```ini
[Unit]
Description=Roadmap Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=roadmap
WorkingDirectory=/opt/roadmap
ExecStart=/opt/roadmap/bin/server
Restart=on-failure
EnvironmentFile=/opt/roadmap/.env

[Install]
WantedBy=multi-user.target
```

Install: from repo root run `make build-backend` (produces `bin/server`), copy `bin/server` and `scaffold/deploy/vm/setEnv.sh` (optional) to `/opt/roadmap`, copy `scaffold/config/env/backend.env.example` to `/opt/roadmap/.env`, edit, then `systemctl enable --now roadmap-backend`.

## Config

All env and config file examples: **scaffold/config/** at repo root.
