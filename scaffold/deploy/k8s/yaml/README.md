# Kubernetes manifests (Kind)

Modular YAMLs derived from `scaffold/deploy/docker-compose/docker-compose.yml`. All resources use namespace **roadmap**.

## Layout

| Path | Purpose |
|------|--------|
| `namespace.yaml` | Dedicated namespace `roadmap` |
| `configmap.yaml` | Non-sensitive env (DB_HOST, PORT, BACKEND_URL, etc.) |
| `secret.yaml` | DB_PASSWORD, JWT_SECRET (replace before apply) |
| `postgres/` | PVC, Deployment (persistent), Service (NodePort 30432) |
| `backend/` | Deployment (resources + probes), Service (NodePort 30081), HPA (1–4) |
| `seed/` | Job (run once after backend ready) |
| `frontend/` | Deployment (resources + probes), Service (NodePort 30080), HPA (1–4) |
| `observability/` | Loki, Tempo, OTEL Collector, Prometheus, Promtail, Grafana (equivalent to docker-compose observability profile) |

## Dependencies (apply order)

1. Namespace → ConfigMap + Secret  
2. Postgres (PVC → Deployment → Service) → wait ready  
3. Backend (Deployment → Service → HPA) → wait ready  
4. Seed Job → wait complete  
5. Frontend (Deployment → Service → HPA)  
6. Observability: Loki, Tempo (wait) → OTEL Collector, Prometheus, Promtail (DaemonSet), Grafana  

## Ports

- **Postgres:** in-cluster 5432; NodePort **30432**. Use `kubectl port-forward --address 0.0.0.0 -n roadmap svc/postgres 5432:5432` for access from any IP.
- **Backend:** NodePort **30081** (or port-forward with `--address 0.0.0.0` for any IP).
- **Frontend:** NodePort **30080** (or port-forward with `--address 0.0.0.0` for any IP).
- **Grafana:** ClusterIP; use port-forward for port 3001: `kubectl port-forward --address 0.0.0.0 -n roadmap svc/grafana 3001:3000`. Default login: admin / value of `GRAFANA_ADMIN_PASSWORD` in secret (default `admin`).
- **Prometheus:** NodePort **30090** (or port-forward 9090:9090 with `--address 0.0.0.0` for any IP).

## Images

Deploy expects local images loaded into Kind: `roadmap-backend:latest`, `roadmap-frontend:latest`, `roadmap-seed:latest`. Build from docker-compose Dockerfiles and load with `make k8s-build-load-images`.

## Scaling

HPA for backend and frontend: min 1, max 4 replicas (CPU/memory targets in `backend/hpa.yaml` and `frontend/hpa.yaml`).
