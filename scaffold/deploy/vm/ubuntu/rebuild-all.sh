#!/usr/bin/env bash
# Rebuild and bring up the app on the Ubuntu VM: down, rebuild backend and frontend, up (no Docker).
# Run from repo root: make vm-rebuild-all
#
# If VM_HOST is set: SSH to the VM and run this script there.
# If VM_HOST is not set: run locally.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# Script is at scaffold/deploy/vm/ubuntu/; go up 4 levels to repo root
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
VM_USER="${VM_USER:-ubuntu}"
VM_REPO_PATH="${VM_REPO_PATH:-/home/ubuntu/rm}"

# When VM_HOST is set, run this script on the remote with VM_HOST cleared.
if [ -n "${VM_HOST:-}" ]; then
  echo "=== VM (Ubuntu): rebuild app on remote ${VM_USER}@${VM_HOST}:${VM_REPO_PATH} ==="
  ssh "${VM_USER}@${VM_HOST}" "cd ${VM_REPO_PATH} && REPO_ROOT=${VM_REPO_PATH} VM_HOST= ./scaffold/deploy/vm/ubuntu/rebuild-all.sh"
  echo "=== VM rebuild-all complete ==="
  exit 0
fi

cd "$REPO_ROOT"
echo "=== VM (Ubuntu): rebuild app (down, build, up) ==="
echo "  Target: local (current directory)"

# Down
"$SCRIPT_DIR/down-all.sh"

# Rebuild
echo "  Building backend and frontend..."
make build-backend
make build-frontend

# Up
"$SCRIPT_DIR/up-all.sh"
echo "=== VM rebuild-all complete ==="
