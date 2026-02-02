#!/usr/bin/env bash
# Delete persistent volume claims in the roadmap namespace (postgres, loki, tempo, grafana).
# Use this for a full rebuild so the next deploy gets empty volumes. Run from repo root.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

YAML_DIR="${YAML_DIR:-$REPO_ROOT/scaffold/deploy/k8s/yaml}"
OBS="$YAML_DIR/observability"

echo "=== Deleting PVCs (postgres, loki, tempo, grafana) ==="
kubectl delete -f "$YAML_DIR/postgres/pvc.yaml" --ignore-not-found
kubectl delete -f "$OBS/loki/pvc.yaml" --ignore-not-found
kubectl delete -f "$OBS/tempo/pvc.yaml" --ignore-not-found
kubectl delete -f "$OBS/grafana/pvc.yaml" --ignore-not-found
echo "=== PVCs deleted ==="
