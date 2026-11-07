#!/usr/bin/env bash
# Android/Termux control-plane bootstrap. No passwords or private keys are logged.
set -euo pipefail
umask 077
STATE="${MARITIME_TERMUX_STATE:-$HOME/.local/state/maritime-termux}"
mkdir -p "$STATE"
CONFIG="$STATE/config"
usage() { printf '%s\n' 'Usage: bash termux-demo.sh {setup|doctor|start|status|open|stop|docker-check}' 'Dashboard must already run on Linux loopback port 4400.'; }
load() {
  [[ -f "$CONFIG" ]] || { echo 'Run setup first.' >&2; exit 1; }
  # Configuration is generated locally with printf %q, never downloaded.
  source "$CONFIG"
  [[ "$HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.:-]*$ && "$USER_NAME" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_-]*$ ]] || { echo 'Invalid SSH host/user'; exit 1; }
  [[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1 && "$PORT" -le 65535 ]] || { echo 'Invalid SSH port'; exit 1; }
  SSH=(ssh -p "$PORT" -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$STATE/known_hosts" -o ConnectTimeout=10 -o ServerAliveInterval=20 -o ServerAliveCountMax=3)
}
alive() {
  [[ -S "$STATE/control" ]] && "${SSH[@]}" -S "$STATE/control" -O check "$USER_NAME@$HOST" >/dev/null 2>&1
}
health() { curl --fail --silent --show-error --connect-timeout 3 --max-time 8 http://127.0.0.1:14400/health; printf '\n'; }
case "${1:-help}" in
 setup)
  if ! command -v ssh >/dev/null || ! command -v curl >/dev/null; then
    if command -v pkg >/dev/null; then
      read -r -p 'Install Termux openssh and curl packages? [y/N] ' answer
      [[ "$answer" == y || "$answer" == Y ]] || exit 1
      pkg install -y openssh curl
    else echo 'Install openssh-client and curl first.' >&2; exit 1; fi
  fi
  read -r -p 'Reachable Linux SSH hostname or IP: ' HOST
  read -r -p 'Linux SSH username: ' USER_NAME
  read -r -p 'SSH port [22]: ' PORT; PORT="${PORT:-22}"
  read -r -p "Existing private-key path [$HOME/.ssh/id_ed25519]: " KEY; KEY="${KEY:-$HOME/.ssh/id_ed25519}"
  if [[ ! -f "$KEY" ]]; then
    read -r -p 'Generate dedicated passphrase-protected key here? [y/N] ' answer
    [[ "$answer" == y || "$answer" == Y ]] || exit 1
    mkdir -p "$(dirname "$KEY")"; ssh-keygen -t ed25519 -f "$KEY" -C maritime-termux
    echo 'Install this PUBLIC key in the Linux account authorized_keys:'; cat "$KEY.pub"
  fi
  printf 'HOST=%q\nUSER_NAME=%q\nPORT=%q\nKEY=%q\n' "$HOST" "$USER_NAME" "$PORT" "$KEY" > "$CONFIG"
  load
  echo 'Ask the Linux administrator for its SSH host-key fingerprint through a trusted channel.'
  read -r -p 'Expected SHA256 host-key fingerprint: ' EXPECTED
  [[ "$EXPECTED" == SHA256:* ]] || { echo 'A verified SHA256 fingerprint is required'; exit 1; }
  ssh-keyscan -T 10 -p "$PORT" "$HOST" > "$STATE/scanned_hosts" 2> "$STATE/keyscan.log"
  : > "$STATE/known_hosts"
  while IFS= read -r entry; do
    [[ -n "$entry" && "$entry" != \#* ]] || continue
    printf '%s\n' "$entry" > "$STATE/candidate"
    fingerprint=$(ssh-keygen -lf "$STATE/candidate" | awk '{print $2}')
    [[ "$fingerprint" != "$EXPECTED" ]] || printf '%s\n' "$entry" >> "$STATE/known_hosts"
  done < "$STATE/scanned_hosts"
  rm -f "$STATE/candidate" "$STATE/scanned_hosts"
  [[ -s "$STATE/known_hosts" ]] || { echo 'Host fingerprint mismatch; refusing connection'; exit 1; }
  echo 'Setup complete. Run: bash termux-demo.sh start'
  ;;
 start)
  load
  if alive; then echo 'Existing SSH tunnel is active.'; health; exit; fi
  rm -f "$STATE/control"
  "${SSH[@]}" -M -S "$STATE/control" -fNT -o ExitOnForwardFailure=yes -L 127.0.0.1:14400:127.0.0.1:4400 "$USER_NAME@$HOST"
  if ! health; then
    echo 'SSH connected, but dashboard unavailable. Start npm run demo:controller on Linux.' >&2
    "${SSH[@]}" -S "$STATE/control" -O exit "$USER_NAME@$HOST" >/dev/null 2>&1 || true
    exit 1
  fi
  command -v termux-wake-lock >/dev/null && termux-wake-lock || true
  echo 'Open Android Chrome: http://127.0.0.1:14400'
  if command -v termux-open-url >/dev/null; then termux-open-url http://127.0.0.1:14400; fi
  echo 'Verify on-device: run passes, report opens, refresh recovers, portrait/landscape work.'
  ;;
 status|doctor)
  load
  command -v ssh; command -v curl
  if alive; then echo 'SSH tunnel active'; health; else echo 'No active tunnel. Run start.'; exit 1; fi
  ;;
 open)
  load; alive || { echo 'Start tunnel first'; exit 1; }; health
  if command -v termux-open-url >/dev/null; then termux-open-url http://127.0.0.1:14400; else echo 'Open http://127.0.0.1:14400 in Chrome'; fi
  ;;
 stop)
  load
  if alive; then "${SSH[@]}" -S "$STATE/control" -O exit "$USER_NAME@$HOST"; fi
  rm -f "$STATE/control"
  command -v termux-wake-unlock >/dev/null && termux-wake-unlock || true
  echo 'Tunnel stopped.'
  ;;
 docker-check)
  load
  read -r -p 'Absolute repository path on this SSH host: ' REPO
  [[ "$REPO" =~ ^/[a-zA-Z0-9_./-]+$ && "$REPO" != *..* ]] || { echo 'Unsafe repository path'; exit 1; }
  echo 'This operation builds and runs the test image on the configured Linux host.'
  read -r -p 'Proceed? [y/N] ' answer; [[ "$answer" == y || "$answer" == Y ]] || exit 1
  set +e
  "${SSH[@]}" "$USER_NAME@$HOST" "cd '$REPO' && docker info >/dev/null && docker build -f Dockerfile.playwright -t maritime-qa . && docker run --rm --init --ipc=host maritime-qa" 2>&1 | tee "$STATE/docker-check.log"
  result=${PIPESTATUS[0]}; set -e
  printf 'Remote Docker exit code: %s\n' "$result"; exit "$result"
  ;;
 *) usage; [[ "${1:-help}" == help ]] ;;
esac
