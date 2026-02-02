#!/usr/bin/env bash
# Create a Kind (Kubernetes in Docker) cluster - macOS compatible.
# Run from repo root: ./scaffold/deploy/k8s/kind/macos/create-cluster.sh

set -e

CLUSTER_NAME="${CLUSTER_NAME:-roadmap}"

if kind get kubeconfig --name "$CLUSTER_NAME" &>/dev/null; then
  echo "Cluster '$CLUSTER_NAME' already exists. Use delete-cluster.sh to remove it first, or set CLUSTER_NAME=other ./create-cluster.sh"
  exit 1
fi

echo "Creating Kind cluster: $CLUSTER_NAME"
kind create cluster --name "$CLUSTER_NAME"

echo "Cluster '$CLUSTER_NAME' is ready. Use: kubectl cluster-info --context kind-$CLUSTER_NAME"
# Optional: load local app images into the cluster, e.g.:
# kind load docker-image rm-backend:latest --name "$CLUSTER_NAME"
# kind load docker-image rm-frontend:latest --name "$CLUSTER_NAME"
