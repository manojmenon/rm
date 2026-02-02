#!/usr/bin/env bash
# Delete the Kind cluster - Ubuntu/Linux compatible.
# Run from repo root: ./scaffold/deploy/k8s/kind/ubuntu/delete-cluster.sh

set -e

CLUSTER_NAME="${CLUSTER_NAME:-roadmap}"

if ! kind get kubeconfig --name "$CLUSTER_NAME" &>/dev/null; then
  echo "Cluster '$CLUSTER_NAME' does not exist."
  exit 0
fi

echo "Deleting Kind cluster: $CLUSTER_NAME"
kind delete cluster --name "$CLUSTER_NAME"
echo "Cluster '$CLUSTER_NAME' deleted."
