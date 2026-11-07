#!/usr/bin/env bash
# Run from an extracted checkout on a supported Linux host. Never changes firewall/SSH/VPN.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
case "${1:-help}" in
 doctor)
  for tool in node npm ssh docker; do command -v "$tool" || { echo "Missing prerequisite: $tool" >&2; exit 1; }; done
  node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'
  docker info >/dev/null
  echo 'Tool and Docker access checks passed. Physical Android/VPN/SSH acceptance remains separate.'
  ;;
 prepare)
  command -v node >/dev/null; command -v npm >/dev/null
  cd "$ROOT/frontend"
  npm ci
  echo 'Installing Chromium. System dependencies may require sudo; install them separately with npx playwright install-deps chromium.'
  npx playwright install chromium
  npm run demo:preflight
  npm run test:maritime:demo
  ;;
 serve)
  cd "$ROOT/frontend"
  npm run demo:preflight
  exec npm run demo:controller
  ;;
 docker-check)
  command -v docker >/dev/null
  docker info >/dev/null
  docker build -f "$ROOT/Dockerfile.playwright" -t maritime-qa "$ROOT"
  docker run --rm --init --ipc=host maritime-qa
  ;;
 fingerprint)
  found=0
  for key in /etc/ssh/ssh_host_*_key.pub; do
    [[ -f "$key" ]] || continue
    ssh-keygen -lf "$key"; found=1
  done
  [[ "$found" == 1 ]] || { echo 'No system SSH host public keys found. Ask the administrator for the active server fingerprint.'; exit 1; }
  ;;
 *) echo 'Usage: bash scripts/linux-demo.sh {doctor|prepare|serve|docker-check|fingerprint}';;
esac
