#!/usr/bin/env bash
# Restores a backup made by backup.sh. DESTROYS the current database contents.
#   ./restore.sh backups/coffee-20261014T021500Z.sql.gz
set -euo pipefail
cd "$(dirname "$0")"
if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: $0 <backup.sql.gz>" >&2
  exit 1
fi
read -r -p "This replaces ALL current data with $1. Type 'restore' to continue: " answer
if [ "$answer" != "restore" ]; then
  echo "Cancelled."
  exit 1
fi
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)
"${COMPOSE[@]}" stop api
"${COMPOSE[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\"" -c "CREATE DATABASE \"$POSTGRES_DB\""'
gunzip -c "$1" | "${COMPOSE[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" start api
echo "Restore complete."
