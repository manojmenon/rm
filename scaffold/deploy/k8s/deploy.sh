#!/usr/bin/env bash
# Deploy app to Kind in dependency order. Run from repo root.
# Prerequisites: kind, kubectl; cluster created (or use make k8s-deploy-all to ensure cluster).
# Images: roadmap-backend:latest, roadmap-frontend:latest, roadmap-seed:latest (build and load via make k8s-build-load-images).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

# Use absolute path so kubectl -f works regardless of cwd
YAML_DIR="${YAML_DIR:-$REPO_ROOT/scaffold/deploy/k8s/yaml}"
NAMESPACE="${K8S_NAMESPACE:-roadmap}"
CLUSTER_NAME="${CLUSTER_NAME:-roadmap}"

# If Postgres is already running on port 5432, reuse it (do not deploy Postgres in cluster).
# Set USE_EXTERNAL_POSTGRES=1 to force, or deploy.sh auto-detects when localhost:5432 is open.
USE_EXTERNAL_POSTGRES="${USE_EXTERNAL_POSTGRES:-}"
if [ -z "$USE_EXTERNAL_POSTGRES" ]; then
  if (echo >/dev/tcp/localhost/5432) 2>/dev/null; then
    USE_EXTERNAL_POSTGRES=1
  fi
fi

echo "=== 1. Namespace ==="
kubectl apply -f "$YAML_DIR/namespace.yaml"

echo "=== 2. ConfigMap and Secret ==="
if [ -n "$USE_EXTERNAL_POSTGRES" ]; then
  echo "  Using external Postgres (already on port 5432); DB_HOST=host.docker.internal"
  kubectl apply -f "$YAML_DIR/configmap-external-postgres.yaml"
else
  kubectl apply -f "$YAML_DIR/configmap.yaml"
fi
kubectl apply -f "$YAML_DIR/secret.yaml"

echo "=== 3. Postgres (PVC, Deployment, Service) ==="
if [ -n "$USE_EXTERNAL_POSTGRES" ]; then
  echo "  Skipping Postgres (reusing existing on host:5432)"
else
  kubectl apply -f "$YAML_DIR/postgres/pvc.yaml"
  kubectl apply -f "$YAML_DIR/postgres/deployment.yaml"
  kubectl apply -f "$YAML_DIR/postgres/service.yaml"
  echo "Waiting for postgres to be ready..."
  kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=120s
fi

echo "=== 4. Backend (Deployment, Service, HPA) ==="
kubectl apply -f "$YAML_DIR/backend/deployment.yaml"
kubectl apply -f "$YAML_DIR/backend/service.yaml"
kubectl apply -f "$YAML_DIR/backend/hpa.yaml"

echo "Waiting for backend to be ready..."
if ! kubectl wait --for=condition=ready pod -l app=backend -n "$NAMESPACE" --timeout=180s; then
  echo "Backend did not become ready. Pod status and logs:"
  kubectl get pods -n "$NAMESPACE" -l app=backend -o wide
  kubectl describe pod -n "$NAMESPACE" -l app=backend
  kubectl logs -n "$NAMESPACE" -l app=backend --tail=100
  exit 1
fi

echo "=== 5. Seed Job (run once) ==="
kubectl delete job seed -n "$NAMESPACE" --ignore-not-found
kubectl apply -f "$YAML_DIR/seed/job.yaml"
kubectl wait --for=condition=complete job/seed -n "$NAMESPACE" --timeout=90s || true

echo "=== 6. Frontend (Deployment, Service, HPA) ==="
kubectl apply -f "$YAML_DIR/frontend/deployment.yaml"
kubectl apply -f "$YAML_DIR/frontend/service.yaml"
kubectl apply -f "$YAML_DIR/frontend/hpa.yaml"

echo "Waiting for frontend to be ready..."
if ! kubectl wait --for=condition=ready pod -l app=frontend -n "$NAMESPACE" --timeout=180s; then
  echo "Frontend did not become ready. Pod status and logs:"
  kubectl get pods -n "$NAMESPACE" -l app=frontend -o wide
  kubectl describe pod -n "$NAMESPACE" -l app=frontend
  kubectl logs -n "$NAMESPACE" -l app=frontend --tail=100
  exit 1
fi

OBS="$YAML_DIR/observability"
echo "=== 7. Observability (Loki, Tempo, OTEL Collector, Prometheus, Promtail, Grafana) ==="
echo "Loki..."
kubectl apply -f "$OBS/loki/configmap.yaml"
kubectl apply -f "$OBS/loki/pvc.yaml"
kubectl apply -f "$OBS/loki/deployment.yaml"
kubectl apply -f "$OBS/loki/service.yaml"
echo "Tempo..."
kubectl apply -f "$OBS/tempo/configmap.yaml"
kubectl apply -f "$OBS/tempo/pvc.yaml"
kubectl apply -f "$OBS/tempo/deployment.yaml"
kubectl apply -f "$OBS/tempo/service.yaml"
echo "Waiting for Loki and Tempo..."
kubectl wait --for=condition=ready pod -l app=loki -n "$NAMESPACE" --timeout=120s
kubectl wait --for=condition=ready pod -l app=tempo -n "$NAMESPACE" --timeout=120s
echo "OTEL Collector..."
kubectl apply -f "$OBS/otel-collector/configmap.yaml"
kubectl apply -f "$OBS/otel-collector/deployment.yaml"
kubectl apply -f "$OBS/otel-collector/service.yaml"
echo "Prometheus..."
kubectl apply -f "$OBS/prometheus/configmap.yaml"
kubectl apply -f "$OBS/prometheus/deployment.yaml"
kubectl apply -f "$OBS/prometheus/service.yaml"
echo "Promtail..."
kubectl apply -f "$OBS/promtail/serviceaccount.yaml"
kubectl apply -f "$OBS/promtail/configmap.yaml"
kubectl apply -f "$OBS/promtail/daemonset.yaml"
kubectl apply -f "$OBS/promtail/service.yaml"
echo "Grafana..."
kubectl apply -f "$OBS/grafana/configmap.yaml"
kubectl apply -f "$OBS/grafana/pvc.yaml"
kubectl apply -f "$OBS/grafana/deployment.yaml"
kubectl apply -f "$OBS/grafana/service.yaml"

echo "=== Deploy complete. Namespace: $NAMESPACE ==="
if [ -n "$USE_EXTERNAL_POSTGRES" ]; then
  echo "App: Backend NodePort 30081, Frontend NodePort 30080, Postgres: external (reused on host:5432)"
else
  echo "App: Backend NodePort 30081, Frontend NodePort 30080, Postgres NodePort 30432"
fi
echo "Observability: Grafana (port 3001 via port-forward), Prometheus NodePort 30090"
echo "Grafana from any IP: kubectl port-forward --address 0.0.0.0 -n $NAMESPACE svc/grafana 3001:3000"
