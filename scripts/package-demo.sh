#!/usr/bin/env bash
# Package current source without credentials, local execution state or Git internals.
set -euo pipefail
umask 077
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
OUT="${1:-$HOME/MaritimePOCBackups}"
mkdir -p "$OUT"
OUT=$(cd -- "$OUT" && pwd)
case "$OUT/" in "$ROOT/"*) echo 'Output must be outside the repository' >&2; exit 1;; esac
ARCHIVE="$OUT/maritime-handoff-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
[[ ! -e "$ARCHIVE" ]] || { echo 'Archive already exists; retry in one second' >&2; exit 1; }
tar -czf "$ARCHIVE" --exclude=.git --exclude=node_modules --exclude=.venv --exclude=.auth --exclude=.env --exclude='.env.*' --exclude=.adlc --exclude='test-results*' --exclude=artifacts --exclude=__pycache__ --exclude='.*cache' --exclude=dist --exclude='core*' -C "$(dirname "$ROOT")" "$(basename "$ROOT")"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
sha256sum -c "$ARCHIVE.sha256"
printf 'Handoff bundle: %s\nCopy the archive and checksum to the Linux host; extract into a new directory.\n' "$ARCHIVE"
