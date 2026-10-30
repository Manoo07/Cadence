#!/usr/bin/env bash
# Day 02 — run the whole demo once and log everything.
#
# Your notes: "keep a log as you go: for every run, record the plan,
# Workers Planned, Workers Launched, and both totals. Then film what the log
# says." This writes that log. Nothing in the video comes from anywhere else.
set -euo pipefail
cd "$(dirname "$0")"

PG="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
export PATH="$PG:$PATH"
DB="${PGDATABASE:-day02}"
LOG="capture-$(date +%Y%m%d-%H%M%S).log"

run() { psql -X -q -d "$DB" -f "$1"; }

{
  echo "================ CAPTURE $(date) ================"
  echo
  run checks.sql
  echo
  run runA.sql
  echo
  run runB.sql
  echo
  run scene6.sql
} 2>&1 | tee "$LOG"

echo
echo "log written: $(pwd)/$LOG"
