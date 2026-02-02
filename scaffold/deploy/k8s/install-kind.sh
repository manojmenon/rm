#!/usr/bin/env bash
# Install kind via sudo if not already in PATH. Run from repo root.
# Uses official binary (Linux amd64/arm64). Idempotent. Requires Docker.

set -e

if command -v kind &>/dev/null; then
  echo "kind already installed: $(kind --version 2>/dev/null || true)"
  exit 0
fi

echo "kind not found; installing via sudo..."

ARCH=""
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *)
    echo "Unsupported arch: $(uname -m). Install kind manually: https://kind.sigs.k8s.io/docs/user/installing/"
    exit 1
    ;;
esac

if [ "$(uname -s)" != "Linux" ]; then
  echo "This script installs kind on Linux only. Install manually: https://kind.sigs.k8s.io/docs/user/installing/"
  exit 1
fi

# Use a known stable version; check https://github.com/kubernetes-sigs/kind/releases for latest
KIND_VERSION="${KIND_VERSION:-v0.26.0}"
URL="https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-${ARCH}"
echo "Downloading kind ${KIND_VERSION} (linux/${ARCH})..."
curl -sSL -o /tmp/kind "$URL"
chmod +x /tmp/kind
sudo install -o root -g root -m 0755 /tmp/kind /usr/local/bin/kind
rm -f /tmp/kind

echo "kind installed: $(kind --version 2>/dev/null || true)"
echo "Ensure Docker is running before creating a cluster."
