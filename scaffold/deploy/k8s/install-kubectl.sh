#!/usr/bin/env bash
# Install kubectl via sudo if not already in PATH. Run from repo root.
# Uses official Kubernetes binary (Linux amd64/arm64). Idempotent.

set -e

if command -v kubectl &>/dev/null; then
  echo "kubectl already installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)"
  exit 0
fi

echo "kubectl not found; installing via sudo..."

ARCH=""
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *)
    echo "Unsupported arch: $(uname -m). Install kubectl manually."
    exit 1
    ;;
esac

if [ "$(uname -s)" != "Linux" ]; then
  echo "This script installs kubectl on Linux only. Install manually: https://kubernetes.io/docs/tasks/tools/"
  exit 1
fi

STABLE="$(curl -L -s https://dl.k8s.io/release/stable.txt)"
URL="https://dl.k8s.io/release/${STABLE}/bin/linux/${ARCH}/kubectl"
echo "Downloading kubectl ${STABLE} (linux/${ARCH})..."
curl -sSL -o /tmp/kubectl "$URL"
chmod +x /tmp/kubectl
sudo install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl
rm -f /tmp/kubectl

echo "kubectl installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)"
