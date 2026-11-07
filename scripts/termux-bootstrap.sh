#!/usr/bin/env bash
# Single entry point: configure trusted SSH, deploy immutable source, serve, tunnel.
set -euo pipefail
umask 077
command -v pkg >/dev/null || { echo 'Run in native Termux'; exit 1; }
pkg install -y curl openssh
STATE="$HOME/.local/state/maritime-termux"
mkdir -p "$STATE"
REF='feat/android-termux-demo'
BASE="https://raw.githubusercontent.com/bmifsud/POC-Maritime-logistics-SaaS/$REF"
curl --fail --location --show-error "$BASE/scripts/termux-demo.sh" -o "$STATE/helper.sh"
bash "$STATE/helper.sh" setup
source "$STATE/config"
SSH=(ssh -p "$PORT" -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$STATE/known_hosts" -o ConnectTimeout=10)
echo 'Deploying to a new directory under ~/maritime-demos; existing checkouts remain unchanged.'
"${SSH[@]}" "$USER_NAME@$HOST" bash -s <<'REMOTE'
set -euo pipefail
for tool in git node npm curl; do command -v "$tool" >/dev/null || { echo "Missing Linux prerequisite: $tool"; exit 1; }; done
node -e 'if(Number(process.versions.node.split(".")[0])<22)throw Error("Node 22+ required")'
if curl -fsS --max-time 3 http://127.0.0.1:4400/health >/dev/null; then
 echo 'Port 4400 already serves a dashboard. Stop it before deploying a new version.'; exit 1
fi
mkdir -p "$HOME/maritime-demos"
CHECKOUT=$(mktemp -d "$HOME/maritime-demos/run.XXXXXXXX")
git clone --single-branch --branch feat/android-termux-demo https://github.com/bmifsud/POC-Maritime-logistics-SaaS.git "$CHECKOUT"
cd "$CHECKOUT"
bash scripts/linux-demo.sh prepare
if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
 bash scripts/linux-demo.sh docker-check
else
 echo 'Docker unavailable: container acceptance remains BLOCKED. Browser demo can continue.'
fi
cd frontend
nohup node support/maritime/controller.mjs > "$CHECKOUT/controller.log" 2>&1 < /dev/null &
PID=$!
printf '%s\n' "$PID" > "$CHECKOUT/controller.pid"
for attempt in $(seq 1 30); do
 if curl -fsS --max-time 2 http://127.0.0.1:4400/health >/dev/null; then
  echo "READY. Checkout: $CHECKOUT"
  echo "Stop controller: kill $PID"
  exit 0
 fi
 kill -0 "$PID" 2>/dev/null || break
 sleep 1
done
cat "$CHECKOUT/controller.log"
kill "$PID" 2>/dev/null || true
exit 1
REMOTE
bash "$STATE/helper.sh" start
echo "Stop tunnel: bash '$STATE/helper.sh' stop"
echo 'Confirm actual Chrome run, report access, rotation and refresh before accepting Android smoke.'
