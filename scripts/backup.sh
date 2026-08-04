#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# IRISSAM Hospital ERP — Daily Backup Script
#
# Backs up:
#   1. PostgreSQL database (pg_dump → compressed SQL)
#   2. All medical files (tar + gzip of each storage directory)
#   3. SHA-256 checksums for integrity verification
#
# Output: /data/irissam/backups/YYYY-MM-DD/
#
# Schedule (add to crontab on VPS):
#   0 2 * * * /opt/irissam/scripts/backup.sh >> /var/log/irissam-backup.log 2>&1
#
# Retention: keeps last 30 daily backups (configurable via RETENTION_DAYS)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BACKUP_ROOT="${BACKUP_ROOT:-/data/irissam/backups}"
STORAGE_ROOT="${STORAGE_ROOT:-/data/irissam}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE="$(date +%Y-%m-%d)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${DATE}"

# PostgreSQL connection
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${POSTGRES_DB:-irissam}"
PGUSER="${POSTGRES_USER:-irissam}"
# PGPASSWORD must be set in the environment or ~/.pgpass

# ── Logging ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ── Setup ─────────────────────────────────────────────────────────────────────
log "=== IRISSAM Backup démarré (${TIMESTAMP}) ==="
mkdir -p "${BACKUP_DIR}"

# ── 1. PostgreSQL dump ────────────────────────────────────────────────────────
log "Sauvegarde PostgreSQL: ${PGDATABASE}@${PGHOST}:${PGPORT}"
DB_DUMP="${BACKUP_DIR}/postgres_${PGDATABASE}_${DATE}.sql.gz"

pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "${DB_DUMP}"

log "  → ${DB_DUMP} ($(du -sh "${DB_DUMP}" | cut -f1))"

# ── 2. File storage archives ──────────────────────────────────────────────────
for DIR_NAME in documents uploads pdfs; do
  SRC="${STORAGE_ROOT}/${DIR_NAME}"
  if [ -d "${SRC}" ]; then
    ARCHIVE="${BACKUP_DIR}/storage_${DIR_NAME}_${DATE}.tar.gz"
    log "Archivage ${SRC} → ${ARCHIVE}"
    tar \
      --create \
      --gzip \
      --file="${ARCHIVE}" \
      --directory="$(dirname "${SRC}")" \
      "$(basename "${SRC}")" \
      2>/dev/null || log "  ⚠ Avertissement lors de l'archivage de ${DIR_NAME}"
    log "  → ${ARCHIVE} ($(du -sh "${ARCHIVE}" | cut -f1))"
  else
    log "  ⚠ Répertoire ${SRC} introuvable — ignoré"
  fi
done

# ── 3. Checksums ──────────────────────────────────────────────────────────────
log "Calcul des checksums SHA-256"
CHECKSUM_FILE="${BACKUP_DIR}/SHA256SUMS"
(cd "${BACKUP_DIR}" && sha256sum ./*.gz > "${CHECKSUM_FILE}" 2>/dev/null) || true
log "  → ${CHECKSUM_FILE}"
cat "${CHECKSUM_FILE}" | while read -r line; do log "    ${line}"; done

# ── 4. Verify archive integrity ───────────────────────────────────────────────
log "Vérification de l'intégrité des archives"
VERIFY_FAILED=0
for ARCHIVE in "${BACKUP_DIR}"/*.tar.gz; do
  [ -f "${ARCHIVE}" ] || continue
  if tar --test --gzip --file="${ARCHIVE}" 2>/dev/null; then
    log "  ✓ $(basename "${ARCHIVE}") — OK"
  else
    log "  ✗ $(basename "${ARCHIVE}") — CORROMPU"
    VERIFY_FAILED=1
  fi
done
if gzip --test "${BACKUP_DIR}"/*.sql.gz 2>/dev/null; then
  log "  ✓ $(basename "${DB_DUMP}") — OK"
else
  log "  ✗ $(basename "${DB_DUMP}") — CORROMPU"
  VERIFY_FAILED=1
fi
[ "${VERIFY_FAILED}" -eq 0 ] || die "Une ou plusieurs archives sont corrompues!"

# ── 5. Retention: remove backups older than RETENTION_DAYS ───────────────────
log "Nettoyage: conservation des ${RETENTION_DAYS} derniers jours"
find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "????-??-??" \
     -mtime "+${RETENTION_DAYS}" -exec rm -rf {} + \
     2>/dev/null && log "  → Anciens backups supprimés" || true

# ── 6. Summary ────────────────────────────────────────────────────────────────
TOTAL_SIZE="$(du -sh "${BACKUP_DIR}" | cut -f1)"
log "=== Backup terminé avec succès (${TOTAL_SIZE}) ==="
log "    Répertoire: ${BACKUP_DIR}"
log ""
log "IMPORTANT: Ce backup est sur le même disque que les données."
log "Copiez les archives vers un stockage externe (autre serveur, S3, etc.)"
log "Exemple: rsync -av ${BACKUP_DIR}/ user@offsite-server:/backups/irissam/${DATE}/"
