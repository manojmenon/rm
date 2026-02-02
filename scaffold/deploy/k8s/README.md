# Kubernetes

Kubernetes-related assets for the roadmap stack (Kind, manifests, deploy).

| Directory | Purpose |
|-----------|---------|
| **kind/** | [Kind](https://kind.sigs.k8s.io/) cluster config (1 control-plane, 2 workers) and OS-specific scripts. |
| **kind/ubuntu/** | Ubuntu/Linux scripts. |
| **kind/macos/** | macOS scripts. |
| **yaml/** | Modular K8s manifests (namespace, configmap, secret, postgres, backend, seed, frontend). See [yaml/README.md](yaml/README.md). |

## Deploy to Kind (Makefile, from repo root)

- **`make k8s-up-all`** — Download and install kubectl and kind via sudo if missing, create Kind cluster (1 control-plane, 2 workers), build & load images, deploy in dependency order (namespace → config → postgres → backend → seed → frontend → observability). All in namespace `roadmap`; HPA 1–4 for backend and frontend; observability stack: Loki, Tempo, OTEL Collector, Prometheus, Promtail, Grafana. Use **`make k8s-deploy-all`** as an alias.
- **`make k8s-install-kubectl`** — Install kubectl via sudo if not in PATH (Linux amd64/arm64; idempotent).
- **`make k8s-install-kind`** — Install kind via sudo if not in PATH (Linux amd64/arm64; idempotent). Requires Docker.
- **`make k8s-cluster-ensure`** — Create Kind cluster only if it does not exist (using `kind/cluster-config.yaml`). Fails with a clear message if kind is not installed.
- **`make k8s-build-load-images`** — Build backend, frontend, seed from docker-compose Dockerfiles; load into Kind.
- **`make k8s-deploy`** — Apply YAMLs in order (assumes cluster and images exist).
- **`make k8s-undeploy`** — Remove all deployed resources (reverse order).
- **`make k8s-down-all`** — Same as k8s-undeploy: remove workloads and config; **keeps namespace and PVCs** so data (Postgres, Loki, Tempo, Grafana) persists across down/up.
- **`make k8s-rebuild-all`** — Full rebuild: k8s-down-all, **delete PVCs** (fresh volumes), build/load images, deploy. Use when you want a clean slate (no persisted data).
- **`make k8s-delete-pvcs`** — Delete PVCs only (postgres, loki, tempo, grafana). Use after k8s-down-all if you want to remove volumes without redeploying.
- **`make k8s-status`** — Show pods, services, PVCs, HPA in namespace `roadmap`.
- **`make k8s-smoke-test`** — Hit backend health (NodePort 30081) and frontend (NodePort 30080). Use after `k8s-up-all` or `k8s-deploy` to verify the stack.

Ports: Postgres 30432, Backend 30081, Frontend 30080, Prometheus 30090. Grafana: use port-forward for port 3001 — `kubectl port-forward --address 0.0.0.0 -n roadmap svc/grafana 3001:3000` (listens on all IPs). Grafana login: admin / `GRAFANA_ADMIN_PASSWORD` from secret (default `admin`).

**Reuse existing Postgres:** If Postgres is already running on port 5432 (e.g. on the host), deploy skips deploying Postgres and uses it (backend/seed connect via `host.docker.internal`). Auto-detected when localhost:5432 is open, or set `USE_EXTERNAL_POSTGRES=1`.

Ensure `kind` and `kubectl` are installed.

## How to test the K8s cluster

1. **Bring up the full stack** (from repo root):
   ```bash
   make k8s-up-all
   ```
   This installs kubectl/kind if needed, tears down any existing deploy, ensures the Kind cluster, builds and loads images, and deploys app + observability.

2. **Check that everything is running:**
   ```bash
   make k8s-status
   ```
   All pods in `roadmap` should be Running/Completed. If any are not Ready, run:
   ```bash
   kubectl get pods -n roadmap -o wide
   kubectl describe pod -n roadmap <pod-name>
   kubectl logs -n roadmap <pod-name> --tail=50
   ```

3. **Smoke test (backend + frontend via NodePort):**
   ```bash
   make k8s-smoke-test
   ```
   With Kind, NodePorts are exposed on localhost: backend **30081**, frontend **30080**. The smoke test curls `/api/health` and the frontend root.

4. **Manual checks:**
   - **Backend:** `curl http://localhost:30081/api/health` → `{"status":"ok","db":"ok"}`
   - **Frontend:** open http://localhost:30080 in a browser (or `curl -s -o /dev/null -w "%{http_code}" http://localhost:30080/` → 200)
   - **Grafana:** run `kubectl port-forward --address 0.0.0.0 -n roadmap svc/grafana 3001:3000`, then open http://localhost:3001 or http://<host-ip>:3001 (login: admin / value of `GRAFANA_ADMIN_PASSWORD` in secret)
   - **Prometheus:** open http://localhost:30090/targets to see scrape targets

5. **Port-forward instead of NodePort (optional):**
   ```bash
   kubectl port-forward --address 0.0.0.0 -n roadmap svc/backend 8080:8080 &
   kubectl port-forward --address 0.0.0.0 -n roadmap svc/frontend 3000:3000 &
   make smoke-test   # uses localhost:8080 and localhost:3000
   ```

6. **Tear down when done:**
   ```bash
   make k8s-down-all
   ```
   To remove the Kind cluster as well, use your kind scripts (e.g. `scaffold/deploy/k8s/kind/ubuntu/delete-cluster.sh`).
