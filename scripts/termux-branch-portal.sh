#!/usr/bin/env bash
set -euo pipefail
command -v pkg >/dev/null || { echo 'Run in native Termux.' >&2; exit 1; }
pkg install -y openssh curl
KEY="$HOME/.ssh/maritime_demo"
[[ -f "$KEY" ]] || { echo "Missing key: $KEY" >&2; exit 1; }
SSH=(ssh -T -p 22222 -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o ServerAliveInterval=20 -o ServerAliveCountMax=3)
"${SSH[@]}" b@127.0.0.1 'bash -s' <<'LINUX'
set -euo pipefail
ROOT=/home/b/POC-Maritime-logistics-SaaS
cd "$ROOT"
git diff --quiet
git diff --cached --quiet
# Stop only this account's known controller processes; never stop SSH.
python3 - <<'PY'
import json, os, pathlib, signal, time, urllib.error, urllib.request
try:
    with urllib.request.urlopen('http://127.0.0.1:4400/health', timeout=3) as response:
        health = json.load(response)
except urllib.error.URLError:
    health = None
if health and health.get('active'):
    raise SystemExit('A test run is active. Wait for completion and retry.')
pids = []
for process in pathlib.Path('/proc').glob('[0-9]*'):
    try:
        if process.stat().st_uid != os.getuid():
            continue
        args = (process / 'cmdline').read_bytes().split(b'\0')
        if args and pathlib.Path(os.fsdecode(args[0])).name == 'node' and b'support/maritime/controller.mjs' in args[1:]:
            pids.append(int(process.name))
    except (OSError, ValueError):
        continue
for pid in pids:
    print(f'Stopping controller PID {pid}')
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
deadline = time.monotonic() + 10
while any(pathlib.Path(f'/proc/{pid}').exists() for pid in pids):
    if time.monotonic() >= deadline:
        raise SystemExit('Controller did not stop; no forced termination attempted.')
    time.sleep(0.2)
PY
git fetch origin feat/portal-branch-testing
git switch feat/portal-branch-testing
git pull --ff-only origin feat/portal-branch-testing
mkdir -p "$HOME/.local/state/maritime-ssh"
LOG="$HOME/.local/state/maritime-ssh/branch-portal.log"
nohup bash "$ROOT/scripts/linux-demo.sh" serve > "$LOG" 2>&1 < /dev/null &
PID=$!
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:4400/health >/dev/null 2>&1; then
    echo "Branch portal ready: $(git rev-parse --short HEAD)"
    echo 'Experimental: isolated checkout cleanup is unreliable on this Android filesystem.'
    exit 0
  fi
  kill -0 "$PID" 2>/dev/null || break
  sleep 1
done
tail -40 "$LOG"
exit 1
LINUX
# Same-device Termux/Debian share loopback; avoid unnecessary conflicting tunnels.
URL=http://127.0.0.1:4400
if ! curl -fsS --max-time 5 "$URL/health"; then
  echo 'Dashboard is not reachable from Termux loopback. Check the Debian controller log.' >&2
  exit 1
fi
printf '\nOpen %s and select a branch.\n' "$URL"
if command -v termux-wake-lock >/dev/null; then termux-wake-lock || true; fi
if command -v termux-open-url >/dev/null; then termux-open-url "$URL"; fi
