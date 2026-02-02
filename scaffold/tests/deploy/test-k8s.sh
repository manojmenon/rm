#!/usr/bin/env bash
# Test K8s (Kind) deployment: cluster lifecycle and basic cluster health.
# Run from repo root: ./scaffold/tests/deploy/test-k8s.sh
#
# What it does:
#   1. Creates a Kind cluster (default name: roadmap)
#   2. Verifies cluster is ready (kubectl get nodes, cluster-info)
#   3. Optionally runs a minimal pod test (deploy nginx, check ready, delete)
#   4. Deletes the Kind cluster
#
# Note: Deploying the roadmap app (backend/frontend) into K8s requires
# manifests (Deployments, Services, Ingress, etc.). This test only
# verifies that the Kind cluster can be created and used.
# Exit: 0 on success, non-zero on failure.

set -e

# Resolve repo root from script location (works when run as ./scaffold/tests/deploy/test-k8s.sh from root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$REPO_ROOT"

CLUSTER_NAME="${CLUSTER_NAME:-roadmap}"
KIND_SCRIPT_DIR="${KIND_SCRIPT_DIR:-scaffold/deploy/k8s/kind/ubuntu}"
# On macOS, set KIND_SCRIPT_DIR=scaffold/deploy/k8s/kind/macos

cleanup() {
  echo "Deleting Kind cluster..."
  "$REPO_ROOT/$KIND_SCRIPT_DIR/delete-cluster.sh" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== 1. Create Kind cluster ==="
"$REPO_ROOT/$KIND_SCRIPT_DIR/create-cluster.sh"

echo "=== 2. Verify cluster ==="
kubectl cluster-info --context "kind-$CLUSTER_NAME"
kubectl get nodes -o wide
kubectl wait --for=condition=Ready nodes --all --timeout=120s 2>/dev/null || true

echo "=== 3. Minimal workload test (optional) ==="
# Deploy a minimal pod to confirm cluster accepts workloads
kubectl create deployment nginx --image=nginx:alpine --replicas=1
kubectl wait --for=condition=available deployment/nginx --timeout=60s
kubectl get pods -l app=nginx
kubectl delete deployment nginx

echo "=== 4. Delete Kind cluster (on exit) ==="
# Cluster is deleted by cleanup trap on exit.

echo "=== Deploy test (K8s / Kind) passed ==="
