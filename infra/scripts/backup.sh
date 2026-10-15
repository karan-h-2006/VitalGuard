#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$BACKUP_DIR/vitalguard_$TIMESTAMP.dump"

echo "Creating VitalGuard PostgreSQL database backup to $OUTPUT_FILE..."
docker compose -f infra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U vitalguard -d vitalguard -F c -b > "$OUTPUT_FILE"

echo "Backup complete: $OUTPUT_FILE"
