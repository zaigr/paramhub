#!/usr/bin/env bash
#
# Headless screenshot of the paramhub TUI.
#
# Drives the built CLI inside a pseudo-terminal with `expect`, captures the raw
# alt-screen byte stream, then replays it through a VT100 emulator (vt.cjs) to
# print the final visible screen — no real terminal or human needed.
#
# Steps are applied in order. Each --wait pauses; each --key sends bytes
# (expect escape syntax: \020 = Ctrl+P, \021 = Ctrl+Q, \r = Enter,
# \033 = Esc, \033[B = Down arrow). Send Ctrl+P etc. as the FIRST key — note
# multi-byte arrow sequences are sometimes dropped by the pty, so prefer
# driving via the command palette / typed single chars when possible.
#
# Example (palette over the list view, 30x120):
#   snapshot.sh --rows 30 --cols 120 --build \
#     --wait 2.2 --key '\020' --wait 1.8
#
# Example (no rebuild, larger screen):
#   snapshot.sh --cols 200 --rows 48 --wait 2.2 --key '\020' --wait 1.8
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"  # repo root
APP_DIR="$ROOT/packages/app"
VT="$(dirname "${BASH_SOURCE[0]}")/vt.cjs"

ROWS=30
COLS=120
BUILD=0
APP_CMD="node dist/cli.js"   # run from $APP_DIR
STEPS=()                      # ordered: "wait:<s>" | "key:<bytes>"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rows) ROWS="$2"; shift 2;;
    --cols) COLS="$2"; shift 2;;
    --build) BUILD=1; shift;;
    --app) APP_CMD="$2"; shift 2;;
    --wait) STEPS+=("wait:$2"); shift 2;;
    --key) STEPS+=("key:$2"); shift 2;;
    -h|--help) sed -n '2,30p' "$0"; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

if [[ "$BUILD" == "1" ]]; then
  echo "building @paramhub/app…" >&2
  (cd "$ROOT" && npx turbo run build --filter=@paramhub/app >/dev/null 2>&1) \
    || { echo "build failed" >&2; exit 1; }
fi

RAW="$(mktemp -t phtui).raw"
EXP="$(mktemp -t phtui).exp"
trap 'rm -f "$RAW" "$EXP"' EXIT

# Default sequence if none provided: just wait for first render.
if [[ ${#STEPS[@]} -eq 0 ]]; then STEPS=("wait:2.0"); fi

{
  echo "set timeout 15"
  echo "set stty_init \"rows $ROWS cols $COLS\""
  echo "log_file -a $RAW"
  echo "cd \"$APP_DIR\""
  echo "spawn $APP_CMD"
  for step in "${STEPS[@]}"; do
    kind="${step%%:*}"; val="${step#*:}"
    if [[ "$kind" == "wait" ]]; then
      echo "sleep $val"
    else
      echo "send \"$val\""
    fi
  done
  echo "expect timeout"
} > "$EXP"

expect "$EXP" >/dev/null 2>&1 || true

node "$VT" "$RAW" "$ROWS" "$COLS"
