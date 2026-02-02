# Deployment options

Deployment layouts for the Product Roadmap stack.

| Option | Directory | Use case |
|--------|-----------|----------|
| **Docker Compose** | [docker-compose/](docker-compose/) | Full stack (backend, frontend, DB, observability) via compose from repo root. Use `make docker-up-all`, `make docker-down-all`, etc. |
| **VM** | [vm/](vm/) | Bare metal / VM. **Ubuntu (native, no Docker):** [vm/ubuntu/](vm/ubuntu/) — run from repo root: `make vm-up-all`, `make vm-down-all`, `make vm-rebuild-all`, `make vm-status`, `make vm-check-health`. Respects `.env` at repo root. (Postgres + backend + frontend; set `VM_HOST` to run via SSH). **Manual:** use `scaffold/deploy/vm/setEnv.sh` for PATH, DB_*, NVM. |
| **K8s (Kind)** | [k8s/](k8s/) | Kind (Kubernetes in Docker); [kind/ubuntu/](k8s/kind/ubuntu/) and [kind/macos/](k8s/kind/macos/) for OS-specific scripts. |

Config files and env examples live in **scaffold/config/** at repo root. Copy `config/env/*.example` as needed for your environment.
