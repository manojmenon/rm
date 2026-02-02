# VM (Ubuntu) — native app (no Docker)

Scripts in this directory bring up, down, or rebuild the app on an Ubuntu VM **without Docker**: Postgres (system), backend (Go), and frontend (Node). Invoke from **repo root** via Make:

- **`make vm-up-all`** — start backend then frontend in the **foreground** (no daemon). Backend runs as a job; frontend runs in foreground; **Ctrl+C** stops both. Postgres must be reachable (see .env).
- **`make vm-down-all`** — stop backend and frontend (Postgres is left running)
- **`make vm-rebuild-all`** — down, rebuild backend and frontend, then up
- **`make vm-status`** — show whether Postgres, backend, and frontend are running and responding (PIDs and health checks)
- **`make vm-check-health`** — health check: curl backend `/api/health` and frontend; exit 0 if both OK, 1 otherwise

Docker Compose is **not** used; the app runs natively on the VM (see `scaffold/deploy/vm/setEnv.sh` for env).

## Two modes

1. **Local (current machine is the VM)**  
   Run from repo root on the Ubuntu host:
   ```bash
   make vm-up-all
   ```
   No extra env needed; scripts start Docker Postgres then backend and frontend in the background; logs in `scaffold/deploy/vm/ubuntu/.pids/backend.log` and `.pids/frontend.log`.

2. **Remote VM (SSH)**  
   Run from your laptop; scripts SSH into the VM and run there. Set:
   - **`VM_HOST`** — VM hostname or IP (e.g. `192.168.1.100` or `my-ubuntu-vm`)
   - **`VM_USER`** — (optional) SSH user; default `ubuntu`
   - **`VM_REPO_PATH`** — (optional) path to the repo on the VM; default `/home/ubuntu/rm`

   Example:
   ```bash
   VM_HOST=192.168.1.100 make vm-up-all
   VM_HOST=my-vm VM_USER=ubuntu VM_REPO_PATH=/home/ubuntu/roadmap make vm-rebuild-all
   ```

   The repo must already exist on the VM at `VM_REPO_PATH` (e.g. clone or rsync).

All scripts **respect `.env`** at repo root: `DB_HOST`, `DB_PORT`, `PORT`, `BACKEND_URL`, `FRONTEND_URL`, etc. Copy `scaffold/config/env/backend.env.example` to `.env` and edit as needed.

## Prerequisites on the VM

- Docker (for Postgres; `vm-up-all` runs `make docker-up-postgres`)
- Go 1.22+ (backend)
- Node.js 20+ (frontend; NVM recommended — see `setEnv.sh`)
- Repo at the path you use for `VM_REPO_PATH` (when using SSH)

Source `scaffold/deploy/vm/setEnv.sh` for DB_*, PATH, and NVM when running manually.

## Paths

Scripts resolve the repo root from their own path, so they work when invoked from repo root regardless of current directory. PIDs and logs: `scaffold/deploy/vm/ubuntu/.pids/` (e.g. `backend.log`, `frontend.log`).

## Troubleshooting

- **Postgres connection refused** — `vm-up-all` starts Docker Postgres first and waits for it; ensure Docker is running. If you use a different Postgres (e.g. system or remote), set `DB_HOST`/`DB_PORT` in `.env`; the script still runs `make docker-up-postgres` (you can stop that container if not needed).
- **EADDRINUSE (port 3000 or 8080)** — `up-all.sh` frees ports 8080 and 3000 before starting (and `down-all.sh` frees them on stop) so orphaned processes don’t block. If another app uses those ports, stop it or change backend/frontend ports in `.env` and frontend config.
- **View logs** — `tail -f scaffold/deploy/vm/ubuntu/.pids/backend.log` and `tail -f .../frontend.log`.
