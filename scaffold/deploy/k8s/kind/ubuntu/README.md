# Kind on Ubuntu

Scripts to create and manage a [Kind](https://kind.sigs.k8s.io/) (Kubernetes in Docker) cluster on **Ubuntu** (and other Linux).

## Prerequisites

- Docker installed and the user in the `docker` group.
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) and [kubectl](https://kubernetes.io/docs/tasks/tools/) installed.

## Usage

From repo root:

```bash
# Create cluster (default name: roadmap)
./scaffold/deploy/k8s/kind/ubuntu/create-cluster.sh

# Delete cluster
./scaffold/deploy/k8s/kind/ubuntu/delete-cluster.sh
```

Or from this directory:

```bash
cd scaffold/deploy/k8s/kind/ubuntu
./create-cluster.sh
./delete-cluster.sh
```

## Scripts

- **create-cluster.sh** – creates a Kind cluster; optional: load local Docker images (e.g. backend, frontend) into the cluster.
- **delete-cluster.sh** – deletes the Kind cluster.

Adjust `CLUSTER_NAME` and image names inside the scripts as needed for your app.

---

## Deploy tests

Deploy tests for **Docker**, **Docker Compose**, **K8s (Kind)**, and **VM** live in **scaffold/tests/deploy/**. Each target has a separate test script and can be run from repo root.

### Commands to run and test

| Target            | Command (from repo root) | What it does |
|-------------------|---------------------------|--------------|
| **Docker**        | `./scaffold/tests/deploy/test-docker.sh` | Postgres + backend + frontend containers → smoke test → cleanup |
| **Docker Compose**| `./scaffold/tests/deploy/test-docker-compose.sh` | Compose up → smoke test → Compose down |
| **K8s (Kind)**    | `./scaffold/tests/deploy/test-k8s.sh` | Create Kind cluster → verify cluster (and optional workload) → delete cluster |
| **VM**            | `./scaffold/tests/deploy/test-vm.sh` | Assumes backend/frontend already running on VM; curls health + frontend |

### K8s (Kind) test (this directory)

To **run the K8s deploy test** (creates cluster, verifies it, deletes it):

```bash
# From repo root (uses Ubuntu Kind scripts by default)
chmod +x scaffold/tests/deploy/test-k8s.sh
./scaffold/tests/deploy/test-k8s.sh
```

The test uses **scaffold/deploy/k8s/kind/ubuntu/** by default. It does **not** deploy the roadmap app into the cluster (no K8s manifests yet); it only checks that the Kind cluster can be created and used (e.g. `kubectl get nodes`, optional minimal pod).

**Manual create → use → delete:**

```bash
./scaffold/deploy/k8s/kind/ubuntu/create-cluster.sh
kubectl cluster-info --context kind-roadmap
kubectl get nodes
# ... use cluster ...
./scaffold/deploy/k8s/kind/ubuntu/delete-cluster.sh
```

Full details and all four test scripts: [scaffold/tests/deploy/README.md](../../../tests/deploy/README.md).
