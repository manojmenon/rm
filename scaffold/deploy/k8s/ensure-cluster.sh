#!/usr/bin/env bash
# Ensure Kind cluster exists: 1 control-plane + 2 workers. Run from repo root.
# If cluster already exists, do nothing. Otherwise create with scaffold/deploy/k8s/kind/cluster-config.yaml.
# Requires: kind, kubectl (use make k8s-install-kubectl and make k8s-install-kind if missing).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

CLUSTER_NAME="${CLUSTER_NAME:-roadmap}"
CONFIG_PATH="${KIND_CLUSTER_CONFIG:-$REPO_ROOT/scaffold/deploy/k8s/kind/cluster-config.yaml}"

if ! command -v kind &>/dev/null; then
  echo "kind not found; installing..."
  "$SCRIPT_DIR/install-kind.sh"
fi

if kind get kubeconfig --name "$CLUSTER_NAME" &>/dev/null; then
  echo "Kind cluster '$CLUSTER_NAME' already exists."
  exit 0
fi

echo "Creating Kind cluster '$CLUSTER_NAME' (1 control-plane, 2 workers)..."
kind create cluster --name "$CLUSTER_NAME" --config "$CONFIG_PATH"
echo "Cluster '$CLUSTER_NAME' is ready. Use: kubectl cluster-info --context kind-$CLUSTER_NAME"
