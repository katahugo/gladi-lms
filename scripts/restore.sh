#!/usr/bin/env bash
# =============================================================================
# restore.sh — Pulihkan database dari backup di Azure Blob Storage.
#
# PENDAMPING backup.sh (A8) — sesuai plan §D2 ("uji restore sekali, dokumentasi
# SOP"). Membuktikan backup bisa dipulihkan, bukan sekadar tersimpan.
#
# Pemakaian:
#   ./scripts/restore.sh                          → restore backup TERBARU
#   ./scripts/restore.sh pgdump-gladi_lms-20260722T020000Z.dump
#
# PERINGATAN: menimpa isi database saat ini. Hanya jalankan di lingkungan
# staging/uji, atau production saat darurat dengan aplikasi dihentikan dulu.
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

if [ -z "${POSTGRES_DB:-}" ] && [ -f .env ]; then
  set -a; source .env; set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER wajib diisi}"
: "${POSTGRES_DB:?POSTGRES_DB wajib diisi}"
: "${AZURE_STORAGE_ACCOUNT:?AZURE_STORAGE_ACCOUNT wajib diisi}"
: "${AZURE_STORAGE_CONTAINER:?AZURE_STORAGE_CONTAINER wajib diisi}"
: "${AZURE_STORAGE_SAS_TOKEN:?AZURE_STORAGE_SAS_TOKEN wajib diisi}"

SAS="${AZURE_STORAGE_SAS_TOKEN#\?}"
BASE="https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${AZURE_STORAGE_CONTAINER}"
BACKUP_NAME="${1:-}"

# Jika argumen kosong: ambil backup terbaru dari daftar blob
if [ -z "$BACKUP_NAME" ]; then
  echo "==> Mencari backup terbaru untuk ${POSTGRES_DB}..."
  BLOB_LIST="$(curl -fsS "${BASE}?restype=container&comp=list&prefix=pgdump-${POSTGRES_DB}-&${SAS}")"
  BACKUP_NAME="$(echo "$BLOB_LIST" | grep -oP '(?<=<Name>)[^<]+' | sort | tail -n 1)"
  if [ -z "$BACKUP_NAME" ]; then
    echo "==> GAGAL: tidak ada backup ditemukan untuk ${POSTGRES_DB}" >&2
    exit 1
  fi
fi
echo "==> Restore dari: ${BACKUP_NAME}"

LOCAL_PATH="/tmp/${BACKUP_NAME}"

echo "==> [1/4] Download backup"
curl -fsS -o "$LOCAL_PATH" "${BASE}/${BACKUP_NAME}?${SAS}"
SIZE_BYTES="$(stat -c%s "$LOCAL_PATH")"
[ "$SIZE_BYTES" -ge 1024 ] || { echo "==> GAGAL: file terlalu kecil (${SIZE_BYTES} bytes)" >&2; exit 1; }
echo "    Download OK (${SIZE_BYTES} bytes)"

echo "==> [2/4] Salin ke container & recreate database"
echo ""
echo "    ⚠  PERINGATAN: operasi ini akan MENGHAPUS database '${POSTGRES_DB}'"
echo "    ⚠  dan menggantinya dengan backup '${BACKUP_NAME}'."
echo "    ⚠  Container app & worker akan di-restart setelahnya."
echo ""

# Konfirmasi eksplisit — wajib, mencegah restore tidak sengaja
if [ "${SKIP_CONFIRM:-}" != "yes" ]; then
  read -r -p "    Lanjutkan? Ketik 'YA' (huruf besar): " confirm
  if [ "$confirm" != "YA" ]; then
    echo "    Restore dibatalkan."
    rm -f "$LOCAL_PATH"
    exit 0
  fi
fi

docker cp "$LOCAL_PATH" "lms_postgres:/tmp/${BACKUP_NAME}"

# Putus koneksi aktif, lalu drop + create ulang
docker exec lms_postgres psql -U "$POSTGRES_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
docker exec lms_postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
docker exec lms_postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"

echo "==> [3/4] pg_restore"
docker exec lms_postgres pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner \
  --no-privileges \
  "/tmp/${BACKUP_NAME}"

echo "==> [4/4] Verifikasi & restart aplikasi"
TABLES="$(docker exec lms_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' \n')"
echo "    Jumlah tabel di public schema: ${TABLES}"
[ "$TABLES" -ge 10 ] || { echo "==> PERINGATAN: tabel terlalu sedikit — cek manual!" >&2; exit 1; }

# Setelah restore, jalankan migrasi untuk memastikan skema up-to-date
echo ""
echo "==> Menjalankan migrasi (memastikan skema DB sesuai kode terbaru)..."
NETWORK_NAME="$(docker inspect lms_postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || true)"
if [ -n "$NETWORK_NAME" ]; then
  docker run --rm \
    --network "$NETWORK_NAME" \
    -e PGHOST=postgres -e PGPORT=5432 \
    -e PGDATABASE="${POSTGRES_DB}" \
    -e PGUSER="${POSTGRES_USER}" \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    "$(docker inspect --format='{{.Config.Image}}' lms_app 2>/dev/null || echo 'ghcr.io/katahugo/gladi-lms/app:latest')" \
    node migrate.mjs && echo "    Migrasi selesai." || echo "    PERINGATAN: migrasi gagal — jalankan manual deploy.sh"
fi

# Restart app + worker agar koneksi ke DB yang baru diperbarui
echo ""
echo "==> Restart aplikasi..."
docker compose restart app worker
sleep 5
if curl -fsS http://localhost/api/health >/dev/null 2>&1; then
  echo "    Aplikasi sehat setelah restore."
else
  echo "    PERINGATAN: health check gagal — cek 'docker compose logs app'"
fi

# Bersihkan file sementara
rm -f "$LOCAL_PATH"
docker exec lms_postgres rm -f "/tmp/${BACKUP_NAME}"

echo ""
echo "==> Restore SELESAI — ${TABLES} tabel pulih. Data dari backup ${BACKUP_NAME}."
echo "    Aplikasi sudah di-restart dengan koneksi ke database yang baru."
