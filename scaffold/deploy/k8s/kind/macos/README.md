# Kind on macOS

Scripts to create and manage a [Kind](https://kind.sigs.k8s.io/) (Kubernetes in Docker) cluster on **macOS** (Docker Desktop or colima, etc.).

## Prerequisites

- Docker running (Docker Desktop, colima, or similar).
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) and [kubectl](https://kubernetes.io/docs/tasks/tools/) installed (e.g. `brew install kind kubectl`).

## Usage

From repo root:

```bash
# Create cluster (default name: roadmap)
./scaffold/deploy/k8s/kind/macos/create-cluster.sh

# Delete cluster
./scaffold/deploy/k8s/kind/macos/delete-cluster.sh
```

Or from this directory:

```bash
cd scaffold/deploy/k8s/kind/macos
./create-cluster.sh
./delete-cluster.sh
```

## Scripts

- **create-cluster.sh** – creates a Kind cluster; optional: load local Docker images into the cluster.
- **delete-cluster.sh** – deletes the Kind cluster.

Adjust `CLUSTER_NAME` and image names inside the scripts as needed for your app.
