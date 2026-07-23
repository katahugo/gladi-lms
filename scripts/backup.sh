#!/usr/bin/env bash
# =============================================================================
# backup.sh — Backup database PostgreSQL ke Azure Blob Storage (plan §D1).
#
# Alur:
#   1. pg_dump di dalam container lms_postgres (custom format, terkompresi)
#   2. Upload ke Azure Blob Storage via REST API dengan SAS token
#   3. Rotasi: hapus blob backup yang lebih tua dari RETENTION_DAYS hari
#   4. Laporkan status — exit code non-zero jika gagal (ditangkap monitoring)
#
# Dijalankan oleh: cron harian di host VPS (contoh crontab ada di bawah file).
#
# Variabel environment yang dibutuhkan (dari .env di ~/gladi-lms):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   AZURE_STORAGE_ACCOUNT     — nama akun storage
#   AZURE_STORAGE_CONTAINER   — container blob (mis. lms-backups)
#   AZURE_STORAGE_SAS_TOKEN   — SAS token dengan izin write+list+delete
#
# Keamanan: SAS token TIDAK boleh masuk git. File ini hanya membaca dari .env.
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "$APP_DIR"

# Muat .env jika variabel belum ada di environment
if [ -z "${POSTGRES_DB:-}" ] && [ -f .env ]; then
  set -a; source .env; set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER wajib diisi}"
: "${POSTGRES_DB:?POSTGRES_DB wajib diisi}"
: "${AZURE_STORAGE_ACCOUNT:?AZURE_STORAGE_ACCOUNT wajib diisi}"
: "${AZURE_STORAGE_CONTAINER:?AZURE_STORAGE_CONTAINER wajib diisi}"
: "${AZURE_STORAGE_SAS_TOKEN:?AZURE_STORAGE_SAS_TOKEN wajib diisi}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_NAME="pgdump-${POSTGRES_DB}-${TIMESTAMP}.dump"
BACKUP_PATH="/tmp/${BACKUP_NAME}"
BLOB_URL="https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/${BACKUP_NAME}"

echo "==> [1/3] pg_dump database ${POSTGRES_DB}"
# Custom format (-Fc): terkompresi + bisa restore selektif dengan pg_restore.
# Dump dibuat di dalam container lalu disalin keluar ke /tmp host.
docker exec lms_postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  -f "/tmp/${BACKUP_NAME}"
docker cp "lms_postgres:/tmp/${BACKUP_NAME}" "$BACKUP_PATH"
docker exec lms_postgres rm -f "/tmp/${BACKUP_NAME}"

SIZE_BYTES="$(stat -c%s "$BACKUP_PATH")"
if [ "$SIZE_BYTES" -lt 1024 ]; then
  echo "==> GAGAL: ukuran dump mencurigakan (${SIZE_BYTES} bytes) — backup dibatalkan" >&2
  rm -f "$BACKUP_PATH"
  exit 1
fi
echo "    Dump OK: ${BACKUP_NAME} (${SIZE_BYTES} bytes)"

echo "==> [2/3] Upload ke Azure Blob: ${AZURE_STORAGE_CONTAINER}/${BACKUP_NAME}"
# SAS token di .env disimpan TANPA tanda tanya di depan
SAS="${AZURE_STORAGE_SAS_TOKEN#\?}"

HTTP_CODE="$(curl -sS -o /tmp/backup-upload-resp.txt -w "%{http_code}" \
  -X PUT \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@${BACKUP_PATH}" \
  "${BLOB_URL}?${SAS}")"

if [ "$HTTP_CODE" != "201" ]; then
  echo "==> GAGAL upload (HTTP ${HTTP_CODE}):" >&2
  cat /tmp/backup-upload-resp.txt >&2
  rm -f "$BACKUP_PATH" /tmp/backup-upload-resp.txt
  exit 1
fi
echo "    Upload OK (HTTP 201)"

# Hapus dump lokal — salinan aman sudah di Blob Storage
rm -f "$BACKUP_PATH" /tmp/backup-upload-resp.txt

echo "==> [3/3] Rotasi: hapus backup lebih tua dari ${RETENTION_DAYS} hari"
CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y%m%dT%H%M%SZ)"

# Daftar blob dengan prefix pgdump-<db>-
LIST_URL="https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}?restype=container&comp=list&prefix=pgdump-${POSTGRES_DB}-&${SAS}"
BLOB_LIST="$(curl -fsS "$LIST_URL")"

DELETED=0
# Ekstrak nama blob dari XML response (format <Name>...</Name>)
for BLOB in $(echo "$BLOB_LIST" | grep -oP '(?<=<Name>)[^<]+' || true); do
  # Ambil timestamp dari nama: pgdump-<db>-YYYYMMDDTHHMMSSZ.dump
  BLOB_TS="$(echo "$BLOB" | grep -oP '\d{8}T\d{6}Z' || true)"
  if [ -n "$BLOB_TS" ] && [[ "$BLOB_TS" < "$CUTOFF" ]]; then
    echo "    Menghapus: $BLOB (lebih tua dari $CUTOFF)"
    curl -fsS -X DELETE \
      "https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}/${BLOB}?${SAS}" \
      >/dev/null
    DELETED=$((DELETED + 1))
  fi
done

echo "==> Backup SELESAI: ${BACKUP_NAME} ter-upload aman. Rotasi menghapus ${DELETED} backup lama."

# -----------------------------------------------------------------------------
# Contoh crontab di VPS (crontab -e) — backup harian jam 02:00 UTC:
#
#   0 2 * * * /home/<user>/gladi-lms/scripts/backup.sh >> /var/log/lms-backup.log 2>&1
#
# Monitoring kegagalan: backup.sh exit non-zero → cron mengirim email/notif,
# dan Uptime Kuma (D3) memonitor keberadaan backup terbaru (file push monitor
# atau pengecekan log) — detail di langkah D3.
# -----------------------------------------------------------------------------
