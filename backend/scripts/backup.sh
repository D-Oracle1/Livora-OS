#!/usr/bin/env bash
# =============================================================================
# RMS Platform — Automated PostgreSQL Backup Script
# =============================================================================
# Usage:
#   ./scripts/backup.sh                  # backup all databases
#   ./scripts/backup.sh --master-only    # backup master DB only
#   ./scripts/backup.sh --dry-run        # test without uploading
#
# Required environment variables (or .env file):
#   MASTER_DATABASE_URL   — master PostgreSQL connection string
#   DATABASE_URL          — optional default tenant DB URL
#   AWS_ACCESS_KEY_ID     — S3 credentials
#   AWS_SECRET_ACCESS_KEY
#   BACKUP_S3_BUCKET      — e.g. rms-backups
#   BACKUP_S3_PREFIX      — e.g. db-backups (optional, default: db-backups)
#
# Optional:
#   BACKUP_RETENTION_DAYS  — days to keep backups (default: 30)
#   BACKUP_ENCRYPT_KEY     — if set, backups are AES-256 encrypted
# =============================================================================

set -euo pipefail

# ── Load .env if available ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

# ── Configuration ─────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
MASTER_URL="${MASTER_DATABASE_URL:-}"
ENCRYPT_KEY="${BACKUP_ENCRYPT_KEY:-}"
DRY_RUN=false
MASTER_ONLY=false
BACKUP_DIR="/tmp/rms-backups-${TIMESTAMP}"

# ── Argument parsing ──────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --dry-run)    DRY_RUN=true ;;
    --master-only) MASTER_ONLY=true ;;
  esac
done

# ── Checks ───────────────────────────────────────────────────────────────────
command -v pg_dump >/dev/null 2>&1 || { echo "[ERROR] pg_dump not found. Install postgresql-client." >&2; exit 1; }

if [[ -z "$S3_BUCKET" ]]; then
  echo "[WARN] BACKUP_S3_BUCKET not set — backups will be stored locally only at: $BACKUP_DIR"
fi

mkdir -p "$BACKUP_DIR"

# ── Helper: dump one database ─────────────────────────────────────────────────
dump_db() {
  local label="$1"
  local url="$2"
  local filename="${BACKUP_DIR}/${label}-${TIMESTAMP}.sql.gz"

  echo "[INFO] Backing up: $label"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] Would dump $label to $filename"
    return 0
  fi

  if pg_dump "$url" | gzip > "$filename"; then
    local size
    size=$(du -sh "$filename" | cut -f1)
    echo "[INFO] Dump complete: $filename ($size)"
  else
    echo "[ERROR] pg_dump failed for $label" >&2
    return 1
  fi

  # Encrypt if key provided
  if [[ -n "$ENCRYPT_KEY" ]]; then
    openssl enc -aes-256-cbc -pbkdf2 -k "$ENCRYPT_KEY" -in "$filename" -out "${filename}.enc"
    rm "$filename"
    filename="${filename}.enc"
    echo "[INFO] Encrypted: $filename"
  fi

  # Upload to S3
  if [[ -n "$S3_BUCKET" ]]; then
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/${label}/${TIMESTAMP}/$(basename "$filename")"
    if aws s3 cp "$filename" "$s3_path" --quiet; then
      echo "[INFO] Uploaded to: $s3_path"
    else
      echo "[ERROR] S3 upload failed for $label" >&2
    fi
  fi
}

# ── Backup master database ────────────────────────────────────────────────────
if [[ -n "$MASTER_URL" ]]; then
  dump_db "master" "$MASTER_URL"
else
  echo "[WARN] MASTER_DATABASE_URL not set — skipping master DB backup"
fi

# ── Backup tenant databases (from master companies table) ─────────────────────
if [[ "$MASTER_ONLY" == "false" ]] && [[ -n "$MASTER_URL" ]]; then
  echo "[INFO] Fetching active tenant database URLs..."
  TENANT_URLS=$(psql "$MASTER_URL" -t -A -c "SELECT id || '|' || database_url FROM companies WHERE is_active = true AND database_url IS NOT NULL;" 2>/dev/null || echo "")

  if [[ -n "$TENANT_URLS" ]]; then
    while IFS='|' read -r company_id db_url; do
      [[ -z "$company_id" ]] && continue
      dump_db "tenant-${company_id}" "$db_url"
    done <<< "$TENANT_URLS"
  else
    echo "[INFO] No active tenant databases found or psql not available"
  fi
fi

# ── Prune old S3 backups ──────────────────────────────────────────────────────
if [[ -n "$S3_BUCKET" && "$DRY_RUN" == "false" ]]; then
  echo "[INFO] Pruning backups older than ${RETENTION_DAYS} days from S3..."
  CUTOFF=$(date -u -d "-${RETENTION_DAYS} days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v"-${RETENTION_DAYS}d" +"%Y-%m-%dT%H:%M:%SZ")
  aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive \
    | awk -v cutoff="$CUTOFF" '$1" "$2 < cutoff {print $4}' \
    | while read -r key; do
        aws s3 rm "s3://${S3_BUCKET}/$key" --quiet && echo "[INFO] Deleted old backup: $key"
      done
fi

# ── Cleanup local temp files ──────────────────────────────────────────────────
if [[ "$DRY_RUN" == "false" && -n "$S3_BUCKET" ]]; then
  rm -rf "$BACKUP_DIR"
  echo "[INFO] Local temp directory cleaned up"
else
  echo "[INFO] Backups available locally at: $BACKUP_DIR"
fi

echo "[INFO] Backup run complete at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
