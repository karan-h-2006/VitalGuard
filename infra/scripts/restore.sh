#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path-to-dump-file>"
  exit 1
fi

INPUT_FILE="$1"
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Backup file $INPUT_FILE not found!"
  exit 1
fi

echo "Restoring VitalGuard PostgreSQL database from $INPUT_FILE..."
docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  pg_restore -U vitalguard -d vitalguard --clean --if-exists -v < "$INPUT_FILE"

echo "Restore complete!"
