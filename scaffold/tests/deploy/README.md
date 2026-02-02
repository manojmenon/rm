# Deploy tests

Tests for deploying the app into **Docker**, **Docker Compose**, **K8s (Kind)**, and **VM**. Run from **repo root**. Each test is in a separate script; use the commands below to run and verify.

## Prerequisites

- **Docker:** Docker and Docker Compose (for Docker and Docker Compose tests).
- **K8s:** `kind` and `kubectl` installed (for K8s test). On Ubuntu use [scaffold/deploy/k8s/kind/ubuntu/](../../deploy/k8s/kind/ubuntu/); on macOS use [scaffold/deploy/k8s/kind/macos/](../../deploy/k8s/kind/macos/).
- **VM:** Backend and frontend already running on the VM (for VM test); see [scaffold/deploy/vm/](../../deploy/vm/).

## Commands to run and test

### 1. Docker (single-service containers)

Builds Postgres, backend, and frontend as separate containers; runs smoke test; cleans up.

```bash
# From repo root (required)
make test-deploy-docker
# or
./scaffold/tests/deploy/test-docker.sh
```

**What it does:** Starts Postgres → builds and runs backend → builds and runs frontend → curls `/api/health` and frontend root → stops and removes containers. **Exit 0** = passed.

**Optional:** Use `DB_HOST=172.17.0.1` on Linux if backend cannot reach Postgres (default uses `172.17.0.1` on Linux, `host.docker.internal` on macOS).

---

### 2. Docker Compose (app stack only)

Brings up the app Compose stack (postgres, seed, backend, frontend; no observability); runs smoke test; brings it down.

```bash
# From repo root (required)
make test-deploy-docker-compose
# or
./scaffold/tests/deploy/test-docker-compose.sh
```

**What it does:** `docker compose build` and `up -d` → waits for backend and frontend → curls `/api/health` and frontend root → `docker compose down`. **Exit 0** = passed.

**Equivalent manual steps:**

```bash
make docker-up
make smoke-test
make docker-down
```

---

### 2b. Docker Compose full stack (app + observability)

Brings up the **full** stack with observability profile (postgres, seed, backend, frontend, Loki, Promtail, Tempo, otel-collector, Prometheus, Grafana); runs smoke test; brings it down.

```bash
# From repo root (required)
make docker-test-all
# or
./scaffold/tests/deploy/test-docker-compose-all.sh
```

**What it does:** `docker compose build` and `up -d --profile observability` → waits for backend and frontend → smoke test → `docker compose down --profile observability`. **Exit 0** = passed.

**Equivalent manual steps:**

```bash
make docker-up-all
make smoke-test
make docker-down-all
```

---

### 3. K8s (Kind)

Creates a Kind cluster, verifies it (and optionally a minimal workload), then deletes the cluster. Does **not** deploy the roadmap app (no K8s manifests yet).

```bash
# From repo root (required). Ubuntu/Linux uses kind/ubuntu by default.
make test-deploy-k8s
# or
./scaffold/tests/deploy/test-k8s.sh
```

**On macOS**, use the macos Kind scripts:

```bash
KIND_SCRIPT_DIR=scaffold/deploy/k8s/kind/macos make test-deploy-k8s
# or
KIND_SCRIPT_DIR=scaffold/deploy/k8s/kind/macos ./scaffold/tests/deploy/test-k8s.sh
```

**What it does:** Runs `scaffold/deploy/k8s/kind/ubuntu/create-cluster.sh` (or macos) → `kubectl cluster-info`, `kubectl get nodes`, optional nginx deployment → runs `delete-cluster.sh` on exit. **Exit 0** = passed.

**Create/delete cluster only (no test script):**

```bash
./scaffold/deploy/k8s/kind/ubuntu/create-cluster.sh
# ... use cluster ...
./scaffold/deploy/k8s/kind/ubuntu/delete-cluster.sh
```

---

### 4. VM (bare metal / host)

Assumes backend and frontend are **already running** on the VM (e.g. after `source scaffold/deploy/vm/setEnv.sh`, `make run-backend-dev`, `make run-frontend`). Verifies backend health and frontend reachable.

**On the VM (from repo root):**

```bash
make test-deploy-vm
# or
./scaffold/tests/deploy/test-vm.sh
```

**From another machine** (replace `<vm-ip>` with the VM’s IP or hostname):

```bash
BACKEND_URL=http://<vm-ip>:8080 FRONTEND_URL=http://<vm-ip>:3000 ./scaffold/tests/deploy/test-vm.sh
```

**What it does:** Curls `BACKEND_URL/api/health` and `FRONTEND_URL/`. **Exit 0** = passed.

**Manual steps on VM:**

```bash
source scaffold/deploy/vm/setEnv.sh
make run-backend-dev   # terminal 1
make run-frontend     # terminal 2
make smoke-test       # terminal 3, or ./scaffold/tests/deploy/test-vm.sh
```

---

## Summary

| Target            | Make target                 | Script                         | Run from   | Prerequisites                    |
|-------------------|-----------------------------|--------------------------------|------------|----------------------------------|
| **Docker**        | `make test-deploy-docker`   | `test-docker.sh`               | Repo root  | Docker                           |
| **Docker Compose**| `make test-deploy-docker-compose` | `test-docker-compose.sh` | Repo root  | Docker, Docker Compose           |
| **Docker Compose (full)** | `make docker-test-all` | `test-docker-compose-all.sh` | Repo root  | Docker, Docker Compose           |
| **K8s (Kind)**    | `make test-deploy-k8s`      | `test-k8s.sh`                  | Repo root  | kind, kubectl; Ubuntu or macOS   |
| **VM**            | `make test-deploy-vm`       | `test-vm.sh`                   | Repo root (or VM) | Backend + frontend already running |

All scripts resolve the repo root from their own path, so they work when run as `./scaffold/tests/deploy/test-*.sh` from the repo root. They exit **0** on success and non-zero on failure so you can use them in CI or `make` targets.
