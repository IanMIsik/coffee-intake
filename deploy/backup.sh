#!/usr/bin/env bash
# Daily database backup. Add to cron, e.g.:  15 2 * * *  /opt/coffee/deploy/backup.sh
# Optional: BACKUP_DIR (default ./backups), KEEP_DAYS (default 14), BACKUP_S3_URI (needs the aws CLI).
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)
DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DIR/coffee-$STAMP.sql.gz"
mkdir -p "$DIR"

"${COMPOSE[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE"

# A tiny file means the dump failed, so do not keep it or trust it.
if [ "$(wc -c < "$FILE")" -lt 1000 ]; then
  rm -f "$FILE"
  echo "Backup failed: dump was empty" >&2
  exit 1
fi
echo "Backup written: $FILE"

find "$DIR" -name 'coffee-*.sql.gz' -mtime +"${KEEP_DAYS:-14}" -delete

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$FILE" "${BACKUP_S3_URI%/}/$(basename "$FILE")"
fi
