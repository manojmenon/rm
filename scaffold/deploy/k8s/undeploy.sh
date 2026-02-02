#!/usr/bin/env bash
# Remove app from Kind (reverse dependency order). Run from repo root.
# Does NOT delete PVCs so data persists across down/up. Use k8s-rebuild-all to remove PVCs too.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

# Use absolute path so kubectl -f works regardless of cwd
YAML_DIR="${YAML_DIR:-$REPO_ROOT/scaffold/deploy/k8s/yaml}"
NAMESPACE="${K8S_NAMESPACE:-roadmap}"

OBS="$YAML_DIR/observability"
echo "=== Removing observability ==="
kubectl delete -f "$OBS/grafana/service.yaml" --ignore-not-found
kubectl delete -f "$OBS/grafana/deployment.yaml" --ignore-not-found
# PVCs not deleted here; use k8s-rebuild-all (or k8s-delete-pvcs) to remove them
kubectl delete -f "$OBS/grafana/configmap.yaml" --ignore-not-found
kubectl delete -f "$OBS/promtail/service.yaml" --ignore-not-found
kubectl delete -f "$OBS/promtail/daemonset.yaml" --ignore-not-found
kubectl delete -f "$OBS/promtail/configmap.yaml" --ignore-not-found
kubectl delete -f "$OBS/promtail/serviceaccount.yaml" --ignore-not-found
kubectl delete -f "$OBS/prometheus/service.yaml" --ignore-not-found
kubectl delete -f "$OBS/prometheus/deployment.yaml" --ignore-not-found
kubectl delete -f "$OBS/prometheus/configmap.yaml" --ignore-not-found
kubectl delete -f "$OBS/otel-collector/service.yaml" --ignore-not-found
kubectl delete -f "$OBS/otel-collector/deployment.yaml" --ignore-not-found
kubectl delete -f "$OBS/otel-collector/configmap.yaml" --ignore-not-found
kubectl delete -f "$OBS/tempo/service.yaml" --ignore-not-found
kubectl delete -f "$OBS/tempo/deployment.yaml" --ignore-not-found
kubectl delete -f "$OBS/tempo/configmap.yaml" --ignore-not-found
kubectl delete -f "$OBS/loki/service.yaml" --ignore-not-found
kubectl delete -f "$OBS/loki/deployment.yaml" --ignore-not-found
kubectl delete -f "$OBS/loki/configmap.yaml" --ignore-not-found

echo "=== Removing frontend ==="
kubectl delete -f "$YAML_DIR/frontend/hpa.yaml" --ignore-not-found
kubectl delete -f "$YAML_DIR/frontend/service.yaml" --ignore-not-found
kubectl delete -f "$YAML_DIR/frontend/deployment.yaml" --ignore-not-found

echo "=== Removing seed job ==="
kubectl delete -f "$YAML_DIR/seed/job.yaml" --ignore-not-found

echo "=== Removing backend ==="
kubectl delete -f "$YAML_DIR/backend/hpa.yaml" --ignore-not-found
kubectl delete -f "$YAML_DIR/backend/service.yaml" --ignore-not-found
kubectl delete -f "$YAML_DIR/backend/deployment.yaml" --ignore-not-found

echo "=== Removing postgres ==="
kubectl delete -f "$YAML_DIR/postgres/service.yaml" --ignore-not-found
kubectl delete -f "$YAML_DIR/postgres/deployment.yaml" --ignore-not-found
# postgres-data PVC not deleted here

echo "=== Removing config (namespace and PVCs kept for k8s-down-all) ==="
kubectl delete -f "$YAML_DIR/configmap.yaml" --ignore-not-found
kubectl delete -f "$YAML_DIR/secret.yaml" --ignore-not-found
# Namespace not deleted so PVCs persist. Use k8s-rebuild-all to remove PVCs and get a clean slate.

echo "=== Undeploy complete ==="
