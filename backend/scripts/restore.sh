#!/usr/bin/env bash
# =============================================================================
# RMS Platform — Database Restore Script
# =============================================================================
# Usage:
#   ./scripts/restore.sh --db master --file path/to/backup.sql.gz
#   ./scripts/restore.sh --db master --s3 s3://bucket/key.sql.gz
#   ./scripts/restore.sh --db tenant-<id> --file path/to/backup.sql.gz
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -o allexport
  source "$ENV_FILE"
  set +o allexport
fi

DB_LABEL=""
BACKUP_FILE=""
S3_PATH=""
ENCRYPT_KEY="${BACKUP_ENCRYPT_KEY:-}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --db)   DB_LABEL="$2"; shift 2 ;;
    --file) BACKUP_FILE="$2"; shift 2 ;;
    --s3)   S3_PATH="$2"; shift 2 ;;
    --key)  ENCRYPT_KEY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

[[ -z "$DB_LABEL" ]] && { echo "Usage: --db <master|tenant-<id>>"; exit 1; }
[[ -z "$BACKUP_FILE" && -z "$S3_PATH" ]] && { echo "Provide --file or --s3"; exit 1; }

# Resolve connection URL
if [[ "$DB_LABEL" == "master" ]]; then
  TARGET_URL="${MASTER_DATABASE_URL:-}"
else
  # Fetch tenant URL from master DB
  TENANT_ID="${DB_LABEL#tenant-}"
  TARGET_URL=$(psql "${MASTER_DATABASE_URL}" -t -A -c "SELECT database_url FROM companies WHERE id='${TENANT_ID}';" 2>/dev/null || echo "")
fi

[[ -z "$TARGET_URL" ]] && { echo "[ERROR] Could not resolve database URL for: $DB_LABEL"; exit 1; }

# Download from S3 if needed
if [[ -n "$S3_PATH" ]]; then
  BACKUP_FILE="/tmp/rms-restore-$(date +%s).sql.gz"
  echo "[INFO] Downloading from S3: $S3_PATH"
  aws s3 cp "$S3_PATH" "$BACKUP_FILE"
fi

# Decrypt if needed
if [[ "$BACKUP_FILE" == *.enc ]]; then
  [[ -z "$ENCRYPT_KEY" ]] && { echo "[ERROR] Backup is encrypted. Provide --key"; exit 1; }
  DECRYPTED="${BACKUP_FILE%.enc}"
  openssl enc -aes-256-cbc -pbkdf2 -d -k "$ENCRYPT_KEY" -in "$BACKUP_FILE" -out "$DECRYPTED"
  BACKUP_FILE="$DECRYPTED"
fi

echo "[WARN] This will OVERWRITE the database for: $DB_LABEL"
read -r -p "Type 'yes' to confirm: " CONFIRM
[[ "$CONFIRM" != "yes" ]] && { echo "Aborted."; exit 1; }

echo "[INFO] Restoring $BACKUP_FILE to $DB_LABEL..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql "$TARGET_URL"
else
  psql "$TARGET_URL" < "$BACKUP_FILE"
fi

echo "[INFO] Restore complete for: $DB_LABEL"
